import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileBarChart, Printer, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface IncomeRow {
  key: string;
  label: string;
  value: number;
  percentage: number;
  isTotal?: boolean;
  drilldown: "brand" | "epayment" | "points-brand" | "none";
}

interface BrandAggregate {
  brand_name: string;
  total: number;
  cost_sold: number;
  bank_fee: number;
  points_cost: number;
  qty: number;
  coins: number;
  tx_count: number;
}

interface EPaymentRow {
  payment_method: string;
  payment_brand: string;
  transaction_count: number;
  total_sales: number;
  bank_fee: number;
  percentage: number;
}

const PAGE_SIZE = 1000;

const IncomeStatementReport = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [includePointCost, setIncludePointCost] = useState(true);

  const [brands, setBrands] = useState<string[]>([]);
  const [brandAbcMap, setBrandAbcMap] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [aggregates, setAggregates] = useState<BrandAggregate[]>([]);

  // Drilldown state
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillType, setDrillType] = useState<"brand" | "epayment">("brand");
  const [drillBrandData, setDrillBrandData] = useState<Array<{ brand_name: string; value: number; percentage: number; tx_count: number; coins: number }>>([]);
  const [drillEpayment, setDrillEpayment] = useState<EPaymentRow[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  // Second-level: transactions for a brand
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txList, setTxList] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txTitle, setTxTitle] = useState("");

  useEffect(() => {
    // Load brand & company lists
    (async () => {
      const { data: bData } = await supabase
        .from("brands")
        .select("brand_name, abc_analysis")
        .order("brand_name");
      const list = (bData || []).map((b: any) => b.brand_name).filter(Boolean);
      setBrands(list);
      const map: Record<string, string> = {};
      (bData || []).forEach((b: any) => {
        if (b.brand_name) map[b.brand_name] = (b.abc_analysis || "").toString().toUpperCase();
      });
      setBrandAbcMap(map);

      const { data: cData } = await supabase
        .from("purpletransaction")
        .select("company")
        .not("company", "is", null)
        .limit(2000);
      const uniqueCompanies = Array.from(new Set((cData || []).map((c: any) => c.company).filter(Boolean))).sort();
      setCompanies(uniqueCompanies as string[]);
    })();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const startInt = parseInt(startDate.replace(/-/g, ""));
      const endInt = parseInt(endDate.replace(/-/g, ""));

      // Fetch ALL transactions for date range, paginated
      let from = 0;
      let all: any[] = [];
      while (true) {
        let q = supabase
          .from("purpletransaction")
          .select("brand_name, total, cost_sold, bank_fee, payment_method, qty, coins_number, order_number, id")
          .gte("created_at_date_int", startInt)
          .lte("created_at_date_int", endInt);
        if (brandFilter !== "all") q = q.eq("brand_name", brandFilter);
        if (companyFilter !== "all") q = q.eq("company", companyFilter);
        const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const batch = data || [];
        all = all.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Group points cost by order_number to avoid double counting
      const pointsByOrderByBrand = new Map<string, Map<string, number>>(); // brand -> orderKey -> total

      const brandMap = new Map<string, BrandAggregate>();
      const getBrand = (name: string) => {
        const key = name || "Unknown";
        if (!brandMap.has(key)) {
          brandMap.set(key, {
            brand_name: key,
            total: 0,
            cost_sold: 0,
            bank_fee: 0,
            points_cost: 0,
            qty: 0,
            coins: 0,
            tx_count: 0,
          });
        }
        return brandMap.get(key)!;
      };

      for (const r of all) {
        const isPoint = (r.payment_method || "").toLowerCase() === "point";
        const brandKey = r.brand_name || "Unknown";
        const total = Number(r.total) || 0;
        if (isPoint) {
          if (!pointsByOrderByBrand.has(brandKey)) pointsByOrderByBrand.set(brandKey, new Map());
          const m = pointsByOrderByBrand.get(brandKey)!;
          const orderKey = r.order_number || r.id;
          m.set(orderKey, (m.get(orderKey) || 0) + total);
        } else {
          const agg = getBrand(brandKey);
          agg.total += total;
          agg.cost_sold += Number(r.cost_sold) || 0;
          agg.bank_fee += Number(r.bank_fee) || 0;
          agg.qty += Number(r.qty) || 0;
          agg.coins += Number(r.coins_number) || 0;
          agg.tx_count += 1;
        }
      }

      // Apply points cost grouped by order
      for (const [brandKey, orderMap] of pointsByOrderByBrand.entries()) {
        const agg = getBrand(brandKey);
        for (const v of orderMap.values()) {
          agg.points_cost += v;
        }
      }

      setAggregates(Array.from(brandMap.values()));
    } catch (e: any) {
      console.error("IncomeStatementReport fetch error", e);
      toast.error(e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };


  const totals = useMemo(() => {
    const totalSales = aggregates.reduce((s, a) => s + a.total, 0);
    const costOfSales = aggregates.reduce((s, a) => s + a.cost_sold, 0);
    const ePaymentCharges = aggregates.reduce((s, a) => s + a.bank_fee, 0);
    const pointsCost = aggregates.reduce((s, a) => s + a.points_cost, 0);
    const couponSales = 0;
    const shipping = 0;
    const taxes = 0;
    const effPoints = includePointCost ? pointsCost : 0;
    const netSales = totalSales - costOfSales - effPoints - ePaymentCharges;
    return { totalSales, costOfSales, ePaymentCharges, pointsCost: effPoints, couponSales, shipping, taxes, netSales };
  }, [aggregates, includePointCost]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const pct = (v: number, base: number) => (base > 0 ? (v / base) * 100 : 0);

  const rows: IncomeRow[] = [
    { key: "totalSales", label: isRTL ? "إجمالي المبيعات (شامل الخصومات)" : "Total Sales (Including Discounts)", value: totals.totalSales, percentage: 100, drilldown: "brand" },
    { key: "couponSales", label: isRTL ? "كوبونات الخصم" : "Discount Coupons", value: totals.couponSales, percentage: pct(totals.couponSales, totals.totalSales), drilldown: "none" },
    { key: "salesPlusCoupon", label: isRTL ? "المبيعات + الكوبونات" : "Sales + Coupon", value: totals.totalSales + totals.couponSales, percentage: pct(totals.totalSales + totals.couponSales, totals.totalSales), drilldown: "brand" },
    { key: "costOfSales", label: isRTL ? "تكلفة المبيعات" : "Cost Of Sales", value: totals.costOfSales, percentage: pct(totals.costOfSales, totals.totalSales), drilldown: "brand" },
    { key: "pointsCost", label: isRTL ? "تكلفة النقاط" : "Points Cost", value: totals.pointsCost, percentage: pct(totals.pointsCost, totals.totalSales), drilldown: "points-brand" },
    { key: "shipping", label: isRTL ? "الشحن" : "Shipping", value: totals.shipping, percentage: 0, drilldown: "none" },
    { key: "taxes", label: isRTL ? "الضرائب" : "Taxes", value: totals.taxes, percentage: 0, drilldown: "none" },
    { key: "ePayment", label: isRTL ? "رسوم الدفع الإلكتروني" : "E-Payment Charges", value: totals.ePaymentCharges, percentage: pct(totals.ePaymentCharges, totals.totalSales), drilldown: "epayment" },
    { key: "netSales", label: isRTL ? "صافي المبيعات" : "Net Sales", value: totals.netSales, percentage: pct(totals.netSales, totals.totalSales), isTotal: true, drilldown: "brand" },
  ];

  const openDrilldown = async (row: IncomeRow) => {
    if (row.drilldown === "none") return;
    setDrillTitle(row.label);

    if (row.drilldown === "brand" || row.drilldown === "points-brand") {
      setDrillType("brand");
      let breakdown: Array<{ brand_name: string; value: number; percentage: number; tx_count: number; coins: number }> = [];
      const baseTotal = row.value || 1;
      const coinsFor = (a: BrandAggregate) =>
        (brandAbcMap[a.brand_name] === "A") ? (a.coins || 0) : 0;
      if (row.key === "totalSales" || row.key === "salesPlusCoupon") {
        breakdown = aggregates.map((a) => ({ brand_name: a.brand_name, value: a.total, percentage: (a.total / baseTotal) * 100, tx_count: a.tx_count, coins: coinsFor(a) }));
      } else if (row.key === "costOfSales") {
        breakdown = aggregates.map((a) => ({ brand_name: a.brand_name, value: a.cost_sold, percentage: (a.cost_sold / baseTotal) * 100, tx_count: a.tx_count, coins: coinsFor(a) }));
      } else if (row.key === "pointsCost") {
        breakdown = aggregates.map((a) => ({ brand_name: a.brand_name, value: a.points_cost, percentage: a.points_cost ? (a.points_cost / baseTotal) * 100 : 0, tx_count: a.tx_count, coins: coinsFor(a) }));
      } else if (row.key === "netSales") {
        breakdown = aggregates.map((a) => {
          const v = a.total - a.cost_sold - (includePointCost ? a.points_cost : 0) - a.bank_fee;
          return { brand_name: a.brand_name, value: v, percentage: a.total > 0 ? (v / a.total) * 100 : 0, tx_count: a.tx_count, coins: coinsFor(a) };
        });
      }
      breakdown = breakdown.filter((b) => Math.abs(b.value) > 0.001).sort((a, b) => b.value - a.value);
      setDrillBrandData(breakdown);
      setDrillOpen(true);
      return;
    }

    if (row.drilldown === "epayment") {
      setDrillType("epayment");
      setDrillLoading(true);
      setDrillOpen(true);
      try {
        const { data, error } = await supabase.rpc("get_epayment_charges_breakdown", {
          p_date_from: startDate,
          p_date_to: endDate,
          p_brand_name: brandFilter === "all" ? null : brandFilter,
          p_company: companyFilter === "all" ? null : companyFilter,
        });
        if (error) throw error;
        const items: EPaymentRow[] = (data || []).map((i: any) => ({
          payment_method: i.payment_method || "Unknown",
          payment_brand: i.payment_brand || "Unknown",
          transaction_count: Number(i.transaction_count) || 0,
          total_sales: Number(i.total_sales) || 0,
          bank_fee: Number(i.bank_fee) || 0,
          percentage: Number(i.total_sales) > 0 ? (Number(i.bank_fee) / Number(i.total_sales)) * 100 : 0,
        })).sort((a: EPaymentRow, b: EPaymentRow) => b.bank_fee - a.bank_fee);
        setDrillEpayment(items);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load breakdown");
      } finally {
        setDrillLoading(false);
      }
    }
  };

  const openBrandTransactions = async (brandName: string, metric: string) => {
    setTxTitle(`${metric} — ${brandName}`);
    setTxDialogOpen(true);
    setTxLoading(true);
    try {
      const startInt = parseInt(startDate.replace(/-/g, ""));
      const endInt = parseInt(endDate.replace(/-/g, ""));
      let from = 0;
      let all: any[] = [];
      while (true) {
        let q = supabase
          .from("purpletransaction")
          .select("order_number, customer_name, customer_phone, brand_name, product_name, qty, total, cost_sold, bank_fee, payment_method, created_at_date")
          .gte("created_at_date_int", startInt)
          .lte("created_at_date_int", endInt)
          .eq("brand_name", brandName);
        if (companyFilter !== "all") q = q.eq("company", companyFilter);
        const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const batch = data || [];
        all = all.concat(batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setTxList(all.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0)));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileBarChart className="h-7 w-7 text-primary" />
            {isRTL ? "قائمة الدخل" : "Income Statement"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRTL ? "تقرير قائمة الدخل مع التفصيل لكل بند" : "Income statement report with drilldown per item"}
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          {isRTL ? "طباعة" : "Print"}
        </Button>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>{isRTL ? "العلامة التجارية" : "Brand"}</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{isRTL ? "الشركة" : "Company"}</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  {companies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchReport} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isRTL ? "تشغيل" : "Run"}
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              id="includePoint"
              type="checkbox"
              checked={includePointCost}
              onChange={(e) => setIncludePointCost(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="includePoint" className="cursor-pointer">
              {isRTL ? "تضمين تكلفة النقاط في صافي المبيعات" : "Include points cost in Net Sales"}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Statement */}
      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? "قائمة الدخل" : "Income Statement"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => {
                const clickable = row.drilldown !== "none" && Math.abs(row.value) > 0.001;
                return (
                  <div
                    key={row.key}
                    onClick={() => clickable && openDrilldown(row)}
                    className={[
                      "flex items-center justify-between py-3 px-2 transition-colors",
                      row.isTotal ? "font-bold text-lg border-t-2 mt-2 pt-4" : "",
                      clickable ? "cursor-pointer hover:bg-muted/50 rounded-md" : "",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-2">
                      {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      {row.label}
                    </span>
                    <div className="flex items-center gap-6">
                      {row.percentage !== 0 && row.percentage !== 100 && (
                        <span
                          className={[
                            "text-sm",
                            row.percentage < 0 ? "text-red-500" : row.key === "netSales" && row.percentage > 20 ? "text-green-500" : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {row.percentage.toFixed(2)}%
                        </span>
                      )}
                      <span className={row.isTotal ? "text-lg" : ""}>{fmt(row.value)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown Dialog */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{drillTitle}</DialogTitle>
          </DialogHeader>
          {drillLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : drillType === "brand" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "العلامة التجارية" : "Brand"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "عدد المعاملات" : "Tx Count"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "النسبة" : "%"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "القيمة" : "Value"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillBrandData.map((b) => (
                  <TableRow
                    key={b.brand_name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openBrandTransactions(b.brand_name, drillTitle)}
                  >
                    <TableCell className="font-medium">{b.brand_name}</TableCell>
                    <TableCell className="text-right">{b.tx_count.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{b.percentage.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(b.value)}</TableCell>
                  </TableRow>
                ))}
                {drillBrandData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {isRTL ? "لا توجد بيانات" : "No data"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "طريقة الدفع" : "Payment Method"}</TableHead>
                  <TableHead>{isRTL ? "بوابة الدفع" : "Payment Brand"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "عدد المعاملات" : "Tx Count"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "إجمالي المبيعات" : "Total Sales"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "النسبة" : "%"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "الرسوم" : "Bank Fee"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillEpayment.map((r, i) => (
                  <TableRow key={`${r.payment_method}-${r.payment_brand}-${i}`}>
                    <TableCell>{r.payment_method}</TableCell>
                    <TableCell>{r.payment_brand}</TableCell>
                    <TableCell className="text-right">{r.transaction_count.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{fmt(r.total_sales)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.percentage.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.bank_fee)}</TableCell>
                  </TableRow>
                ))}
                {drillEpayment.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {isRTL ? "لا توجد بيانات" : "No data"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Brand transactions dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{txTitle}</DialogTitle>
          </DialogHeader>
          {txLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "رقم الطلب" : "Order"}</TableHead>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isRTL ? "العميل" : "Customer"}</TableHead>
                    <TableHead>{isRTL ? "المنتج" : "Product"}</TableHead>
                    <TableHead>{isRTL ? "طريقة الدفع" : "Payment"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "التكلفة" : "Cost"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "الرسوم" : "Fee"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txList.slice(0, 1000).map((t, i) => (
                    <TableRow key={`${t.order_number}-${i}`}>
                      <TableCell className="font-mono text-xs">{t.order_number}</TableCell>
                      <TableCell className="text-xs">{t.created_at_date}</TableCell>
                      <TableCell>{t.customer_name}</TableCell>
                      <TableCell>{t.product_name}</TableCell>
                      <TableCell>{t.payment_method}</TableCell>
                      <TableCell className="text-right">{t.qty}</TableCell>
                      <TableCell className="text-right">{fmt(Number(t.total) || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(Number(t.cost_sold) || 0)}</TableCell>
                      <TableCell className="text-right">{fmt(Number(t.bank_fee) || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {txList.length > 1000 && (
                <p className="text-xs text-muted-foreground p-2">
                  {isRTL ? `عرض أول 1000 من ${txList.length} معاملة` : `Showing first 1000 of ${txList.length} transactions`}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncomeStatementReport;
