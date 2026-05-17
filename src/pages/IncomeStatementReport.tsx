import { useState, useEffect, useMemo, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileBarChart, Printer, ChevronRight, ChevronDown, Download } from "lucide-react";
import * as XLSX from "xlsx";
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
  drilldown: "brand" | "epayment" | "points-brand" | "company" | "none";
  company?: string;
  metric?: "sales" | "cost";
  parent?: string;
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
  const [appliedStartDate, setAppliedStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [appliedEndDate, setAppliedEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [appliedBrandFilter, setAppliedBrandFilter] = useState<string>("all");
  const [appliedCompanyFilter, setAppliedCompanyFilter] = useState<string>("all");
  const [includePointCost, setIncludePointCost] = useState(true);

  const [brands, setBrands] = useState<string[]>([]);
  const [brandAbcMap, setBrandAbcMap] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [aggregates, setAggregates] = useState<BrandAggregate[]>([]);
  const [revenueSources, setRevenueSources] = useState<Record<string, number>>({});
  const [costSources, setCostSources] = useState<Record<string, number>>({});

  // Drilldown state
  const [drillOpen, setDrillOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ totalSales: false, costOfSales: false, ePayment: false, pointsCost: false });
  const [ePaymentByMethod, setEPaymentByMethod] = useState<Array<{ payment_method: string; bank_fee: number; percentage: number }>>([]);
  const [ePaymentByMethodLoading, setEPaymentByMethodLoading] = useState(false);
  const [pointsByCompany, setPointsByCompany] = useState<Array<{ company: string; points_cost: number; percentage: number }>>([]);
  const [pointsByCompanyLoading, setPointsByCompanyLoading] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillType, setDrillType] = useState<"brand" | "epayment">("brand");
  const [drillBrandData, setDrillBrandData] = useState<Array<{ brand_name: string; value: number; percentage: number; tx_count: number; coins: number }>>([]);
  const [drillEpayment, setDrillEpayment] = useState<EPaymentRow[]>([]);
  const [epaySorts, setEpaySorts] = useState<Array<{ key: keyof EPaymentRow; dir: "asc" | "desc" }>>([]);
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
      setEPaymentByMethod([]);
      setPointsByCompany([]);
      setExpanded(prev => ({ ...prev, ePayment: false, pointsCost: false }));
      const startInt = parseInt(startDate.replace(/-/g, ""));
      const endInt = parseInt(endDate.replace(/-/g, ""));
      const nextBrandFilter = brandFilter;
      const nextCompanyFilter = companyFilter;

      const { data, error } = await supabase.rpc("get_income_statement_brand_aggregates", {
        p_start_int: startInt,
        p_end_int: endInt,
        p_brand_name: nextBrandFilter === "all" ? null : nextBrandFilter,
        p_company: nextCompanyFilter === "all" ? null : nextCompanyFilter,
      });
      if (error) throw error;

      const list: BrandAggregate[] = (data || []).map((r: any) => ({
        brand_name: r.brand_name || "Unknown",
        total: Number(r.total) || 0,
        cost_sold: Number(r.cost_sold) || 0,
        bank_fee: Number(r.bank_fee) || 0,
        points_cost: Number(r.points_cost) || 0,
        qty: Number(r.qty) || 0,
        coins: Number(r.coins) || 0,
        tx_count: Number(r.tx_count) || 0,
      }));

      setAggregates(list);

      // Revenue source breakdown (Purple / Salla / Asus)
      const { data: rsData, error: rsError } = await supabase.rpc(
        "get_income_statement_revenue_source_aggregates",
        {
          p_start_int: startInt,
          p_end_int: endInt,
          p_brand_name: nextBrandFilter === "all" ? null : nextBrandFilter,
          p_company: nextCompanyFilter === "all" ? null : nextCompanyFilter,
        }
      );
      if (rsError) throw rsError;
      const rsMap: Record<string, number> = {};
      const csMap: Record<string, number> = {};
      (rsData || []).forEach((r: any) => {
        if (r.revenue_source) {
          rsMap[r.revenue_source] = Number(r.total) || 0;
          csMap[r.revenue_source] = Number(r.cost_sold) || 0;
        }
      });

      // ASUS Sales from confirmed manual sales orders (Sales Order Entry)
      if (nextCompanyFilter === "all" || nextCompanyFilter.toLowerCase() === "asus") {
        const { data: msoData, error: msoError } = await supabase
          .from("manual_sales_orders")
          .select("total_amount, total_cost")
          .eq("status", "confirmed")
          .gte("order_date", startDate)
          .lte("order_date", endDate);
        if (msoError) throw msoError;
        const asusTotal = (msoData || []).reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
        const asusCost = (msoData || []).reduce((s: number, r: any) => s + (Number(r.total_cost) || 0), 0);
        // Manual sales orders are the source of truth for Asus — replace any value coming from purpletransaction to avoid double counting
        rsMap["Asus"] = asusTotal;
        csMap["Asus"] = asusCost;
      }
      setRevenueSources(rsMap);
      setCostSources(csMap);

      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedBrandFilter(nextBrandFilter);
      setAppliedCompanyFilter(nextCompanyFilter);
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

  const totalCompanyCost = (costSources["Purple"] || 0) + (costSources["Salla"] || 0) + (costSources["Asus"] || 0);
  const grossProfit = totals.totalSales - totalCompanyCost - totals.pointsCost - totals.ePaymentCharges;

  const rows: IncomeRow[] = [
    { key: "totalSales", label: isRTL ? "*** إجمالي المبيعات ***" : "*** Total Sales ***", value: totals.totalSales, percentage: 100, isTotal: true, drilldown: "brand" },
    { key: "purpleSales", label: isRTL ? "مبيعات Purple" : "Purple Sales", value: revenueSources["Purple"] || 0, percentage: pct(revenueSources["Purple"] || 0, totals.totalSales), drilldown: "company", company: "Purple", metric: "sales", parent: "totalSales" },
    { key: "sallaSales", label: isRTL ? "مبيعات Salla" : "Salla Sales", value: revenueSources["Salla"] || 0, percentage: pct(revenueSources["Salla"] || 0, totals.totalSales), drilldown: "company", company: "Salla", metric: "sales", parent: "totalSales" },
    { key: "asusSales", label: isRTL ? "مبيعات Asus" : "Asus Sales", value: revenueSources["Asus"] || 0, percentage: pct(revenueSources["Asus"] || 0, totals.totalSales), drilldown: "company", company: "Asus", metric: "sales", parent: "totalSales" },
    { key: "costOfSales", label: isRTL ? "*** إجمالي التكلفة ***" : "*** Total Cost ***", value: totalCompanyCost, percentage: pct(totalCompanyCost, totals.totalSales), isTotal: true, drilldown: "brand" },
    { key: "purpleCost", label: isRTL ? "تكلفة Purple" : "Purple Cost", value: costSources["Purple"] || 0, percentage: pct(costSources["Purple"] || 0, totals.totalSales), drilldown: "company", company: "Purple", metric: "cost", parent: "costOfSales" },
    { key: "sallaCost", label: isRTL ? "تكلفة Salla" : "Salla Cost", value: costSources["Salla"] || 0, percentage: pct(costSources["Salla"] || 0, totals.totalSales), drilldown: "company", company: "Salla", metric: "cost", parent: "costOfSales" },
    { key: "asusCost", label: isRTL ? "تكلفة Asus" : "Asus Cost", value: costSources["Asus"] || 0, percentage: pct(costSources["Asus"] || 0, totals.totalSales), drilldown: "company", company: "Asus", metric: "cost", parent: "costOfSales" },
    { key: "pointsCost", label: isRTL ? "*** تكلفة النقاط ***" : "*** Point Cost ***", value: totals.pointsCost, percentage: pct(totals.pointsCost, totals.totalSales), isTotal: true, drilldown: "points-brand" },
    { key: "ePayment", label: isRTL ? "*** رسوم الدفع الإلكتروني ***" : "*** E-Payment Charges ***", value: totals.ePaymentCharges, percentage: pct(totals.ePaymentCharges, totals.totalSales), isTotal: true, drilldown: "epayment" },
    { key: "grossProfit", label: isRTL ? "*** الربح الإجمالي ***" : "*** Gross Profit ***", value: grossProfit, percentage: pct(grossProfit, totals.totalSales), isTotal: true, drilldown: "none" },
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

    if (row.drilldown === "company" && row.company) {
      setDrillType("brand");
      setDrillLoading(true);
      setDrillOpen(true);
      try {
        const startInt = parseInt(appliedStartDate.replace(/-/g, ""));
        const endInt = parseInt(appliedEndDate.replace(/-/g, ""));
        const baseTotal = row.value || 1;
        const map = new Map<string, { value: number; tx_count: number; coins: number }>();

        if (row.company === "Asus") {
          // Load brand id → name map to display readable names
          const { data: brandsData } = await supabase.from("brands").select("id, brand_name");
          const brandNameMap: Record<string, string> = {};
          (brandsData || []).forEach((b: any) => { brandNameMap[b.id] = b.brand_name; });

          // From confirmed manual sales orders → line items grouped by brand
          const { data: orders, error: oErr } = await supabase
            .from("manual_sales_orders")
            .select("id")
            .eq("status", "confirmed")
            .gte("order_date", appliedStartDate)
            .lte("order_date", appliedEndDate);
          if (oErr) throw oErr;
          const orderIds = (orders || []).map((o: any) => o.id);
          if (orderIds.length > 0) {
            let from = 0;
            while (true) {
              const { data: lines, error: lErr } = await supabase
                .from("manual_sales_order_lines")
                .select("brand_id, product_name, qty, total, total_cost, cost_price, coins_number")
                .in("order_id", orderIds)
                .range(from, from + PAGE_SIZE - 1);
              if (lErr) throw lErr;
              const batch = lines || [];
              batch.forEach((l: any) => {
                const brand = brandNameMap[l.brand_id] || l.brand_id || "Unknown";
                const cur = map.get(brand) || { value: 0, tx_count: 0, coins: 0 };
                const computedCost = (Number(l.cost_price) || 0) * (Number(l.qty) || 0) * (Number(l.coins_number) || 0);
                const v = row.metric === "cost" ? (Number(l.total_cost) || computedCost) : (Number(l.total) || 0);
                cur.value += v;
                cur.tx_count += 1;
                cur.coins += (Number(l.coins_number) || 0) * (Number(l.qty) || 0);
                map.set(brand, cur);
              });
              if (batch.length < PAGE_SIZE) break;
              from += PAGE_SIZE;
            }
          }
        } else {
          // Purple / Salla from purpletransaction grouped by brand_name
          let from = 0;
          while (true) {
            let q = supabase
              .from("purpletransaction")
              .select("brand_name, total, cost_sold, coins_number")
              .gte("created_at_date_int", startInt)
              .lte("created_at_date_int", endInt)
              .eq("revenue_source", row.company);
            if (appliedBrandFilter !== "all") q = q.eq("brand_name", appliedBrandFilter);
            if (appliedCompanyFilter !== "all") q = q.eq("company", appliedCompanyFilter);
            const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
            if (error) throw error;
            const batch = data || [];
            batch.forEach((r: any) => {
              const brand = r.brand_name || "Unknown";
              const cur = map.get(brand) || { value: 0, tx_count: 0, coins: 0 };
              const v = row.metric === "cost" ? Number(r.cost_sold) || 0 : Number(r.total) || 0;
              cur.value += v;
              cur.tx_count += 1;
              cur.coins += Number(r.coins_number) || 0;
              map.set(brand, cur);
            });
            if (batch.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
          }
        }

        const breakdown = Array.from(map.entries())
          .map(([brand_name, v]) => ({ brand_name, value: v.value, percentage: (v.value / baseTotal) * 100, tx_count: v.tx_count, coins: row.company === "Asus" ? v.coins : (brandAbcMap[brand_name] === "A" ? v.coins : 0) }))
          .filter((b) => Math.abs(b.value) > 0.001)
          .sort((a, b) => b.value - a.value);
        setDrillBrandData(breakdown);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load breakdown");
      } finally {
        setDrillLoading(false);
      }
      return;
    }

    if (row.drilldown === "epayment") {
      setDrillType("epayment");
      setDrillLoading(true);
      setDrillOpen(true);
      try {
        const { data, error } = await supabase.rpc("get_epayment_charges_breakdown", {
          p_date_from: appliedStartDate,
          p_date_to: appliedEndDate,
          p_brand_name: appliedBrandFilter === "all" ? null : appliedBrandFilter,
          p_company: appliedCompanyFilter === "all" ? null : appliedCompanyFilter,
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
      const startInt = parseInt(appliedStartDate.replace(/-/g, ""));
      const endInt = parseInt(appliedEndDate.replace(/-/g, ""));
      let from = 0;
      let all: any[] = [];
      while (true) {
        let q = supabase
          .from("purpletransaction")
          .select("order_number, customer_name, customer_phone, brand_name, product_name, qty, total, cost_sold, bank_fee, payment_method, created_at_date")
          .gte("created_at_date_int", startInt)
          .lte("created_at_date_int", endInt)
          .eq("brand_name", brandName);
        if (appliedCompanyFilter !== "all") q = q.eq("company", appliedCompanyFilter);
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
      <Card className="print:hidden">
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
              {rows.filter(r => !r.parent || expanded[r.parent]).map((row) => {
                const clickable = row.drilldown !== "none" && Math.abs(row.value) > 0.001;
                const isExpandable = row.key === "totalSales" || row.key === "costOfSales" || row.key === "ePayment" || row.key === "pointsCost";
                const isOpen = isExpandable && expanded[row.key];
                const splitClick = row.key === "ePayment" || row.key === "pointsCost"; // chevron expands, amount opens popup
                return (
                  <Fragment key={row.key}>
                    <div
                      key={row.key}
                      onClick={() => !splitClick && clickable && openDrilldown(row)}
                      className={[
                        "flex items-center justify-between py-3 px-2 transition-colors",
                        row.isTotal ? "font-bold text-lg border-t-2 mt-2 pt-4" : "",
                        row.parent ? "pl-8" : "",
                        clickable && !splitClick ? "cursor-pointer hover:bg-muted/50 rounded-md" : "",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2">
                        {isExpandable ? (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const willOpen = !expanded[row.key];
                              setExpanded(prev => ({ ...prev, [row.key]: willOpen }));
                              if (row.key === "ePayment" && willOpen && ePaymentByMethod.length === 0 && !ePaymentByMethodLoading) {
                                setEPaymentByMethodLoading(true);
                                try {
                                  const { data, error } = await supabase.rpc("get_epayment_charges_breakdown", {
                                    p_date_from: appliedStartDate,
                                    p_date_to: appliedEndDate,
                                    p_brand_name: appliedBrandFilter === "all" ? null : appliedBrandFilter,
                                    p_company: appliedCompanyFilter === "all" ? null : appliedCompanyFilter,
                                  });
                                  if (error) throw error;
                                  const agg: Record<string, number> = {};
                                  (data || []).forEach((i: any) => {
                                    const k = i.payment_method || "Unknown";
                                    agg[k] = (agg[k] || 0) + (Number(i.bank_fee) || 0);
                                  });
                                  const totalFee = totals.ePaymentCharges || 1;
                                  const list = Object.entries(agg).map(([payment_method, bank_fee]) => ({
                                    payment_method,
                                    bank_fee,
                                    percentage: (bank_fee / totalFee) * 100,
                                  })).sort((a, b) => b.bank_fee - a.bank_fee);
                                  setEPaymentByMethod(list);
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to load breakdown");
                                } finally {
                                  setEPaymentByMethodLoading(false);
                                }
                              }
                              if (row.key === "pointsCost" && willOpen && pointsByCompany.length === 0 && !pointsByCompanyLoading) {
                                setPointsByCompanyLoading(true);
                                try {
                                  const startInt = parseInt(appliedStartDate.replace(/-/g, ""));
                                  const endInt = parseInt(appliedEndDate.replace(/-/g, ""));
                                  let q = supabase
                                    .from("purpletransaction")
                                    .select("company, points_cost")
                                    .eq("is_deleted", false)
                                    .gte("order_date_int_utc", startInt)
                                    .lte("order_date_int_utc", endInt);
                                  if (appliedBrandFilter !== "all") q = q.eq("brand_name", appliedBrandFilter);
                                  if (appliedCompanyFilter !== "all") q = q.eq("company", appliedCompanyFilter);
                                  const agg: Record<string, number> = {};
                                  let from = 0;
                                  while (true) {
                                    const { data, error } = await q.range(from, from + 999);
                                    if (error) throw error;
                                    (data || []).forEach((r: any) => {
                                      const k = r.company || "Unknown";
                                      agg[k] = (agg[k] || 0) + (Number(r.points_cost) || 0);
                                    });
                                    if (!data || data.length < 1000) break;
                                    from += 1000;
                                  }
                                  const totalPts = totals.pointsCost || 1;
                                  const list = Object.entries(agg)
                                    .filter(([, v]) => Math.abs(v) > 0.001)
                                    .map(([company, points_cost]) => ({
                                      company,
                                      points_cost,
                                      percentage: (points_cost / totalPts) * 100,
                                    }))
                                    .sort((a, b) => b.points_cost - a.points_cost);
                                  setPointsByCompany(list);
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to load breakdown");
                                } finally {
                                  setPointsByCompanyLoading(false);
                                }
                              }
                            }}
                            className="p-0.5 rounded hover:bg-muted"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : (
                          clickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
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
                        <span
                          className={[
                            row.isTotal ? "text-lg" : "",
                            splitClick && clickable ? "cursor-pointer hover:underline" : "",
                          ].join(" ")}
                          onClick={(e) => {
                            if (splitClick && clickable) {
                              e.stopPropagation();
                              openDrilldown(row);
                            }
                          }}
                        >
                          {fmt(row.value)}
                        </span>
                      </div>
                    </div>
                    {row.key === "ePayment" && isOpen && (
                      <>
                        {ePaymentByMethodLoading ? (
                          <div className="flex items-center gap-2 py-2 pl-8 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> {isRTL ? "جاري التحميل" : "Loading"}…
                          </div>
                        ) : ePaymentByMethod.length === 0 ? (
                          <div className="py-2 pl-8 text-sm text-muted-foreground">{isRTL ? "لا توجد بيانات" : "No data"}</div>
                        ) : ePaymentByMethod.map((pm) => (
                          <div key={`pm-${pm.payment_method}`} className="flex items-center justify-between py-3 px-2 pl-8">
                            <span>{pm.payment_method}</span>
                            <div className="flex items-center gap-6">
                              <span className="text-sm text-muted-foreground">{pm.percentage.toFixed(2)}%</span>
                              <span>{fmt(pm.bank_fee)}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {row.key === "pointsCost" && isOpen && (
                      <>
                        {pointsByCompanyLoading ? (
                          <div className="flex items-center gap-2 py-2 pl-8 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> {isRTL ? "جاري التحميل" : "Loading"}…
                          </div>
                        ) : pointsByCompany.length === 0 ? (
                          <div className="py-2 pl-8 text-sm text-muted-foreground">{isRTL ? "لا توجد بيانات" : "No data"}</div>
                        ) : pointsByCompany.map((pc) => (
                          <div key={`pc-${pc.company}`} className="flex items-center justify-between py-3 px-2 pl-8">
                            <span>{pc.company}</span>
                            <div className="flex items-center gap-6">
                              <span className="text-sm text-muted-foreground">{pc.percentage.toFixed(2)}%</span>
                              <span>{fmt(pc.points_cost)}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print-only document */}
      <div className="hidden print:block print-document" dir={isRTL ? "rtl" : "ltr"}>
        <style>{`
          @media print {
            @page { size: A4; margin: 14mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-document { color: #000; font-family: Arial, sans-serif; }
            .print-document h1 { font-size: 22px; margin: 0 0 4px 0; }
            .print-document .meta { font-size: 11px; color: #444; margin-bottom: 12px; }
            .print-document table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .print-document th, .print-document td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
            .print-document th { text-align: ${isRTL ? "right" : "left"}; background: #f3f3f3; border-bottom: 1px solid #999; }
            .print-document td.num { text-align: ${isRTL ? "left" : "right"}; font-variant-numeric: tabular-nums; }
            .print-document tr.total td { font-weight: 700; border-top: 2px solid #000; background: #fafafa; }
            .print-document tr.child td:first-child { padding-${isRTL ? "right" : "left"}: 24px; color: #333; }
          }
        `}</style>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div>
            <h1>{isRTL ? "قائمة الدخل" : "Income Statement"}</h1>
            <div className="meta">
              {isRTL ? "من" : "From"} {appliedStartDate} {isRTL ? "إلى" : "to"} {appliedEndDate}
              {appliedBrandFilter !== "all" && ` · ${isRTL ? "العلامة" : "Brand"}: ${appliedBrandFilter}`}
              {appliedCompanyFilter !== "all" && ` · ${isRTL ? "الشركة" : "Company"}: ${appliedCompanyFilter}`}
            </div>
          </div>
          <div className="meta">{format(new Date(), "yyyy-MM-dd HH:mm")}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>{isRTL ? "البند" : "Item"}</th>
              <th className="num" style={{ textAlign: isRTL ? "left" : "right" }}>%</th>
              <th className="num" style={{ textAlign: isRTL ? "left" : "right" }}>{isRTL ? "القيمة" : "Amount"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={`${row.isTotal ? "total" : ""} ${row.parent ? "child" : ""}`.trim()}>
                <td>{row.label.replace(/\*/g, "").trim()}</td>
                <td className="num">{row.percentage !== 0 && row.percentage !== 100 ? `${row.percentage.toFixed(2)}%` : ""}</td>
                <td className="num">{fmt(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drilldown Dialog */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle>{drillTitle}</DialogTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows = drillType === "brand"
                    ? drillBrandData.map((b) => ({
                        Brand: b.brand_name,
                        "Tx Count": b.tx_count,
                        Coins: b.coins,
                        "%": Number(b.percentage.toFixed(2)),
                        Value: Number(b.value.toFixed(2)),
                      }))
                    : drillEpayment.map((r) => ({
                        "Payment Method": r.payment_method,
                        "Payment Brand": r.payment_brand,
                        "Tx Count": r.transaction_count,
                        "Total Sales": Number(r.total_sales.toFixed(2)),
                        "%": Number(r.percentage.toFixed(2)),
                        "Bank Fee": Number(r.bank_fee.toFixed(2)),
                      }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Data");
                  XLSX.writeFile(wb, `${drillTitle.replace(/[^a-z0-9]/gi, "_")}_${appliedStartDate}_${appliedEndDate}.xlsx`);
                }}
                disabled={drillLoading || (drillType === "brand" ? drillBrandData.length === 0 : drillEpayment.length === 0)}
              >
                <Download className="h-4 w-4 mr-1" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
            </div>
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
                  <TableHead className="text-right">{isRTL ? "الكوينز" : "Coins"}</TableHead>
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
                    <TableCell className="text-right">{(b.coins || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{b.percentage.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(b.value)}</TableCell>
                  </TableRow>
                ))}
                {drillBrandData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {isRTL ? "لا توجد بيانات" : "No data"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              {drillBrandData.length > 0 && (
                <TableFooter>
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                    <TableCell className="text-right">{drillBrandData.reduce((s, b) => s + (b.tx_count || 0), 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{drillBrandData.reduce((s, b) => s + (b.coins || 0), 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{drillBrandData.reduce((s, b) => s + (b.percentage || 0), 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{fmt(drillBrandData.reduce((s, b) => s + (b.value || 0), 0))}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          ) : (
            (() => {
              const toggleSort = (key: keyof EPaymentRow, multi: boolean) => {
                setEpaySorts((prev) => {
                  const idx = prev.findIndex((s) => s.key === key);
                  if (!multi) {
                    if (idx === 0 && prev.length === 1) {
                      return [{ key, dir: prev[0].dir === "asc" ? "desc" : "asc" }];
                    }
                    return [{ key, dir: "asc" }];
                  }
                  if (idx === -1) return [...prev, { key, dir: "asc" }];
                  const next = [...prev];
                  next[idx] = { key, dir: next[idx].dir === "asc" ? "desc" : "asc" };
                  return next;
                });
              };
              const sortIndicator = (key: keyof EPaymentRow) => {
                const idx = epaySorts.findIndex((s) => s.key === key);
                if (idx === -1) return null;
                const s = epaySorts[idx];
                return (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {s.dir === "asc" ? "▲" : "▼"}
                    {epaySorts.length > 1 ? <sup>{idx + 1}</sup> : null}
                  </span>
                );
              };
              const sorted = epaySorts.length === 0
                ? drillEpayment
                : [...drillEpayment].sort((a, b) => {
                    for (const s of epaySorts) {
                      const av = a[s.key];
                      const bv = b[s.key];
                      let cmp = 0;
                      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
                      else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
                      if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
                    }
                    return 0;
                  });
              const headers: Array<{ key: keyof EPaymentRow; label: string; align: "left" | "right" }> = [
                { key: "payment_method", label: isRTL ? "طريقة الدفع" : "Payment Method", align: "left" },
                { key: "payment_brand", label: isRTL ? "بوابة الدفع" : "Payment Brand", align: "left" },
                { key: "transaction_count", label: isRTL ? "عدد المعاملات" : "Tx Count", align: "right" },
                { key: "total_sales", label: isRTL ? "إجمالي المبيعات" : "Total Sales", align: "right" },
                { key: "percentage", label: isRTL ? "النسبة" : "%", align: "right" },
                { key: "bank_fee", label: isRTL ? "الرسوم" : "Bank Fee", align: "right" },
              ];
              return (
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => (
                    <TableHead
                      key={h.key as string}
                      className={`${h.align === "right" ? "text-right" : ""} cursor-pointer select-none hover:bg-muted/40`}
                      onClick={(e) => toggleSort(h.key, e.shiftKey)}
                      title={isRTL ? "Shift+نقر للفرز متعدد الأعمدة" : "Shift+Click for multi-column sort"}
                    >
                      {h.label}{sortIndicator(h.key)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r, i) => (
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
              {drillEpayment.length > 0 && (
                <TableFooter>
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2}>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                    <TableCell className="text-right">{drillEpayment.reduce((s, r) => s + (r.transaction_count || 0), 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{fmt(drillEpayment.reduce((s, r) => s + (r.total_sales || 0), 0))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{drillEpayment.reduce((s, r) => s + (r.percentage || 0), 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{fmt(drillEpayment.reduce((s, r) => s + (r.bank_fee || 0), 0))}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
              );
            })()
          )}
        </DialogContent>
      </Dialog>

      {/* Brand transactions dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-y-auto" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-6">
              <DialogTitle>{txTitle}</DialogTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows = txList.map((t) => ({
                    Order: t.order_number,
                    Date: t.created_at_date,
                    Customer: t.customer_name,
                    Phone: t.customer_phone,
                    Brand: t.brand_name,
                    Product: t.product_name,
                    Payment: t.payment_method,
                    Qty: Number(t.qty) || 0,
                    Total: Number(t.total) || 0,
                    Cost: Number(t.cost_sold) || 0,
                    Fee: Number(t.bank_fee) || 0,
                  }));
                  const ws = XLSX.utils.json_to_sheet(rows);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
                  XLSX.writeFile(wb, `${txTitle.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
                }}
                disabled={txLoading || txList.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
            </div>
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
                {txList.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={5}>{isRTL ? `الإجمالي (${txList.length.toLocaleString()})` : `Total (${txList.length.toLocaleString()})`}</TableCell>
                      <TableCell className="text-right">{txList.reduce((s, t) => s + (Number(t.qty) || 0), 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{fmt(txList.reduce((s, t) => s + (Number(t.total) || 0), 0))}</TableCell>
                      <TableCell className="text-right">{fmt(txList.reduce((s, t) => s + (Number(t.cost_sold) || 0), 0))}</TableCell>
                      <TableCell className="text-right">{fmt(txList.reduce((s, t) => s + (Number(t.bank_fee) || 0), 0))}</TableCell>
                    </TableRow>
                  </TableFooter>
                )}
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
