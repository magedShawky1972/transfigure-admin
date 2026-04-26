import { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CalendarIcon, Search, Download, Printer, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface FreeCoinsRow {
  product_name: string;
  brand_name: string;
  payment_method: string;
  payment_brand: string;
  coins_number: number;
  qty: number;
  unit_price: number;
  total: number;
  cost_price: number;
  cost_sold: number;
  profit: number;
  fixed_fee: number;
  net_profit: number;
}

const PAGE_SIZE = 1000;

const FreeCoinsReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === "ar";
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FreeCoinsRow[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [paymentBrands, setPaymentBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [selectedPaymentBrands, setSelectedPaymentBrands] = useState<string[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [paymentBrandOpen, setPaymentBrandOpen] = useState(false);
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("brands")
        .select("brand_name, abc_analysis")
        .eq("abc_analysis", "A")
        .order("brand_name");
      setBrands(Array.from(new Set((data || []).map((b: any) => b.brand_name).filter(Boolean))));
    })();
  }, []);

  const [brandOpen, setBrandOpen] = useState(false);

  useEffect(() => {
    (async () => {
      // Load distinct payment brands from payment_methods config (small table, no row cap concerns)
      const { data } = await supabase
        .from("payment_methods")
        .select("payment_method")
        .eq("is_active", true);
      const uniq = Array.from(new Set((data || []).map((r: any) => r.payment_method).filter(Boolean))).sort();
      setPaymentBrands(uniq);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      // "Free Coins" products = products with flexible coin amounts (named "فري كوينز").
      let query = supabase
        .from("products")
        .select("product_name")
        .ilike("product_name", "%فري كوينز%")
        .not("product_name", "is", null);
      if (selectedBrand !== "all") query = query.eq("brand_name", selectedBrand);
      const { data } = await query.order("product_name");
      const names = Array.from(new Set((data || []).map((p: any) => p.product_name).filter(Boolean)));
      setProducts(names);
      if (selectedProduct !== "all" && !names.includes(selectedProduct)) {
        setSelectedProduct("all");
      }
    })();
  }, [selectedBrand]);

  const handleSearch = async () => {
    if (!fromDate || !toDate) {
      toast({
        title: isRTL ? "تنبيه" : "Notice",
        description: isRTL ? "اختر نطاق التاريخ" : "Please select a date range",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const fromStr = format(fromDate, "yyyy-MM-dd");
      const toStr = format(toDate, "yyyy-MM-dd 23:59:59");

      // Build (payment_type + payment_method) -> fixed_value lookup (case-insensitive)
      // In purpletransaction: payment_method = gateway (hyperpay/salla), payment_brand = brand (MADA/VISA…)
      // In payment_methods:   payment_type   = gateway,                  payment_method = brand
      const { data: pmData } = await supabase
        .from("payment_methods")
        .select("payment_type, payment_method, fixed_value")
        .eq("is_active", true);
      const fixedFeeMap = new Map<string, number>();
      (pmData || []).forEach((p: any) => {
        const key = `${String(p.payment_type || "").toLowerCase()}|${String(p.payment_method || "").toLowerCase()}`;
        fixedFeeMap.set(key, Number(p.fixed_value) || 0);
      });

      let all: any[] = [];
      let from = 0;
      while (true) {
        let q = supabase
          .from("purpletransaction")
          .select("id, order_number, product_name, brand_name, payment_method, payment_brand, coins_number, qty, unit_price, total, cost_price, cost_sold, profit")
          .ilike("product_name", "%فري كوينز%")
          .gte("created_at_date", fromStr)
          .lte("created_at_date", toStr)
          .order("id", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (selectedBrand !== "all") q = q.eq("brand_name", selectedBrand);
        if (selectedProduct !== "all") q = q.eq("product_name", selectedProduct);
        if (selectedPaymentBrands.length > 0) q = q.in("payment_brand", selectedPaymentBrands);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Count lines per order_number to allocate fixed fee
      const linesPerOrder = new Map<string, number>();
      all.forEach((r) => {
        const key = r.order_number || "__no_order__";
        linesPerOrder.set(key, (linesPerOrder.get(key) || 0) + 1);
      });

      setRows(
        all.map((r) => {
          const profit = Number(r.profit) || 0;
          const pbKey = `${String(r.payment_method || "").toLowerCase()}|${String(r.payment_brand || "").toLowerCase()}`;
          const fullFee = fixedFeeMap.get(pbKey) ?? 0;
          const lineCount = linesPerOrder.get(r.order_number || "__no_order__") || 1;
          const fixed_fee = lineCount > 0 ? fullFee / lineCount : fullFee;
          return {
            product_name: r.product_name || "",
            brand_name: r.brand_name || "",
            payment_method: r.payment_method || "",
            payment_brand: r.payment_brand || "",
            coins_number: Number(r.coins_number) || 0,
            qty: Number(r.qty) || 0,
            unit_price: Number(r.unit_price) || 0,
            total: Number(r.total) || 0,
            cost_price: Number(r.cost_price) || 0,
            cost_sold: Number(r.cost_sold) || 0,
            profit,
            fixed_fee,
            net_profit: profit - fixed_fee,
          };
        })
      );
    } catch (err: any) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.coins += r.coins_number;
        acc.qty += r.qty;
        acc.total += r.total;
        acc.cost_sold += r.cost_sold;
        acc.profit += r.profit;
        acc.fixed_fee += r.fixed_fee;
        acc.net_profit += r.net_profit;
        return acc;
      },
      { coins: 0, qty: 0, total: 0, cost_sold: 0, profit: 0, fixed_fee: 0, net_profit: 0 }
    );
  }, [rows]);

  // Summary grouped by Coins sold (coins_number) + Payment Method + Payment Brand
  type SummaryLeaf = {
    coins_number: number;
    payment_method: string;
    payment_brand: string;
    qty: number;
    total: number;
    cost_sold: number;
    profit: number;
    fixed_fee: number;
    net_profit: number;
    count: number;
  };
  const summary = useMemo<SummaryLeaf[]>(() => {
    const map = new Map<string, SummaryLeaf>();
    rows.forEach((r) => {
      const key = `${r.coins_number}|${r.payment_method}|${r.payment_brand}`;
      const cur = map.get(key) || {
        coins_number: r.coins_number,
        payment_method: r.payment_method,
        payment_brand: r.payment_brand,
        qty: 0, total: 0, cost_sold: 0, profit: 0, fixed_fee: 0, net_profit: 0, count: 0,
      };
      cur.qty += r.qty;
      cur.total += r.total;
      cur.cost_sold += r.cost_sold;
      cur.profit += r.profit;
      cur.fixed_fee += r.fixed_fee;
      cur.net_profit += r.net_profit;
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) =>
      a.coins_number - b.coins_number ||
      a.payment_method.localeCompare(b.payment_method) ||
      a.payment_brand.localeCompare(b.payment_brand)
    );
  }, [rows]);

  // Group summary by coins tier for card display
  const summaryByCoins = useMemo(() => {
    const groups = new Map<number, {
      coins_number: number;
      lines: SummaryLeaf[];
      qty: number;
      total: number;
      cost_sold: number;
      profit: number;
      fixed_fee: number;
      net_profit: number;
      count: number;
    }>();
    summary.forEach((s) => {
      const g = groups.get(s.coins_number) || {
        coins_number: s.coins_number,
        lines: [], qty: 0, total: 0, cost_sold: 0, profit: 0, fixed_fee: 0, net_profit: 0, count: 0,
      };
      g.lines.push(s);
      g.qty += s.qty;
      g.total += s.total;
      g.cost_sold += s.cost_sold;
      g.profit += s.profit;
      g.fixed_fee += s.fixed_fee;
      g.net_profit += s.net_profit;
      g.count += s.count;
      groups.set(s.coins_number, g);
    });
    return Array.from(groups.values()).sort((a, b) => a.coins_number - b.coins_number);
  }, [summary]);

  const fmt = (n: number | null | undefined, d = 2) =>
    (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

  const handleExport = () => {
    if (rows.length === 0) return;
    const data = rows.map((r) => ({
      [isRTL ? "المنتج" : "Product"]: r.product_name,
      [isRTL ? "البراند" : "Brand"]: r.brand_name,
      [isRTL ? "طريقة الدفع" : "Payment Method"]: r.payment_method,
      [isRTL ? "وسيلة الدفع" : "Payment Brand"]: r.payment_brand,
      [isRTL ? "الكوينز" : "Coins"]: r.coins_number,
      [isRTL ? "الكمية" : "Qty"]: r.qty,
      [isRTL ? "سعر الوحدة" : "Unit Price"]: r.unit_price,
      [isRTL ? "الإجمالي" : "Total"]: r.total,
      [isRTL ? "سعر التكلفة" : "Cost Price"]: r.cost_price,
      [isRTL ? "تكلفة المباع" : "Cost Sold"]: r.cost_sold,
      [isRTL ? "الربح" : "Profit"]: r.profit,
      [isRTL ? "رسوم ثابتة" : "Fixed Fee"]: r.fixed_fee,
      [isRTL ? "صافي الربح" : "Net Profit"]: r.net_profit,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Free Coins");
    XLSX.writeFile(wb, `free-coins-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Free Coins Report</title>
      <style>
        *{ -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body{font-family:Arial;padding:20px;}
        table{width:100%;border-collapse:collapse;font-size:12px;}
        th,td{border:1px solid #ddd;padding:6px;text-align:${isRTL ? "right" : "left"};}
        th{background:#f3f4f6;}
        tfoot td{font-weight:bold;background:#f9fafb;}
        .text-destructive, .text-destructive *{ color:#dc2626 !important; }
        @media print { .text-destructive, .text-destructive *{ color:#dc2626 !important; } }
      </style></head><body>${printRef.current.innerHTML}</body></html>
    `);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 300);
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {isRTL ? "تقرير الكوينز المجانية" : "Free Coins Report"}
        </h1>
        <p className="text-muted-foreground">
          {isRTL
            ? "مبيعات تم دفعها باستخدام النقاط/الكوينز المجانية"
            : "Sales paid using points / free coins"}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !fromDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "PPP") : (isRTL ? "اختر" : "Pick")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !toDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "PPP") : (isRTL ? "اختر" : "Pick")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>{isRTL ? "البراند (الفئة A)" : "Brand (Class A)"}</Label>
              <Popover open={brandOpen} onOpenChange={setBrandOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className="truncate">
                      {selectedBrand === "all" ? (isRTL ? "الكل" : "All") : selectedBrand}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={isRTL ? "ابحث..." : "Search..."} />
                    <CommandList>
                      <CommandEmpty>{isRTL ? "لا يوجد" : "No results"}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedBrand("all"); setBrandOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedBrand === "all" ? "opacity-100" : "opacity-0")} />
                          {isRTL ? "الكل" : "All"}
                        </CommandItem>
                        {brands.map((b) => (
                          <CommandItem key={b} value={b} onSelect={() => { setSelectedBrand(b); setBrandOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedBrand === b ? "opacity-100" : "opacity-0")} />
                            {b}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>{isRTL ? "المنتج" : "Product"}</Label>
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className="truncate">
                      {selectedProduct === "all" ? (isRTL ? "الكل" : "All") : selectedProduct}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={isRTL ? "ابحث..." : "Search..."} />
                    <CommandList>
                      <CommandEmpty>{isRTL ? "لا يوجد" : "No results"}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setSelectedProduct("all"); setProductOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedProduct === "all" ? "opacity-100" : "opacity-0")} />
                          {isRTL ? "الكل" : "All"}
                        </CommandItem>
                        {products.map((p) => (
                          <CommandItem key={p} value={p} onSelect={() => { setSelectedProduct(p); setProductOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedProduct === p ? "opacity-100" : "opacity-0")} />
                            {p}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>{isRTL ? "وسيلة الدفع" : "Payment Brand"}</Label>
              <Popover open={paymentBrandOpen} onOpenChange={setPaymentBrandOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    <span className="truncate">
                      {selectedPaymentBrands.length === 0
                        ? (isRTL ? "الكل" : "All")
                        : `${selectedPaymentBrands.length} ${isRTL ? "محدد" : "selected"}`}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={isRTL ? "ابحث..." : "Search..."} />
                    <CommandList>
                      <CommandEmpty>{isRTL ? "لا يوجد" : "No results"}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => setSelectedPaymentBrands([])}>
                          <Check className={cn("mr-2 h-4 w-4", selectedPaymentBrands.length === 0 ? "opacity-100" : "opacity-0")} />
                          {isRTL ? "الكل" : "All"}
                        </CommandItem>
                        {paymentBrands.map((pb) => {
                          const checked = selectedPaymentBrands.includes(pb);
                          return (
                            <CommandItem
                              key={pb}
                              value={pb}
                              onSelect={() => {
                                setSelectedPaymentBrands((prev) =>
                                  prev.includes(pb) ? prev.filter((x) => x !== pb) : [...prev, pb]
                                );
                              }}
                            >
                              <Checkbox checked={checked} className="mr-2" />
                              {pb}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedPaymentBrands.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedPaymentBrands.map((pb) => (
                    <Badge
                      key={pb}
                      variant="secondary"
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedPaymentBrands((prev) => prev.filter((x) => x !== pb))}
                    >
                      {pb} ✕
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading} className="w-full">
                <Search className="mr-2 h-4 w-4" />
                {loading ? (isRTL ? "جاري..." : "Loading...") : (isRTL ? "بحث" : "Search")}
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                {isRTL ? "طباعة" : "Print"}
              </Button>
              <div className="ml-auto text-sm text-muted-foreground self-center">
                {isRTL ? `عدد السجلات: ${rows.length}` : `Records: ${rows.length}`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div ref={printRef}>
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">{isRTL ? "التفاصيل" : "Details"}</TabsTrigger>
                <TabsTrigger value="summary">{isRTL ? "ملخص" : "Summary"}</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "المنتج" : "Product"}</TableHead>
                  <TableHead>{isRTL ? "البراند" : "Brand"}</TableHead>
                  <TableHead>{isRTL ? "طريقة الدفع" : "Payment Method"}</TableHead>
                  <TableHead>{isRTL ? "وسيلة الدفع" : "Payment Brand"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "الكوينز" : "Coins"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "الكمية" : "Qty"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "سعر الوحدة" : "Unit Price"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "الإجمالي" : "Total"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "سعر التكلفة" : "Cost Price"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "تكلفة المباع" : "Cost Sold"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "الربح" : "Profit"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "رسوم ثابتة" : "Fixed Fee"}</TableHead>
                  <TableHead className="text-right">{isRTL ? "صافي الربح" : "Net Profit"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                      {isRTL ? "لا توجد بيانات. اختر الفلاتر ثم اضغط بحث." : "No data. Select filters and click Search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.product_name}</TableCell>
                      <TableCell>{r.brand_name}</TableCell>
                      <TableCell>{r.payment_method}</TableCell>
                      <TableCell>{r.payment_brand}</TableCell>
                      <TableCell className="text-right">{fmt(r.coins_number, 0)}</TableCell>
                      <TableCell className="text-right">{fmt(r.qty, 0)}</TableCell>
                      <TableCell className="text-right">{fmt(r.unit_price)}</TableCell>
                      <TableCell className="text-right">{fmt(r.total)}</TableCell>
                      <TableCell className="text-right">{fmt(r.cost_price)}</TableCell>
                      <TableCell className="text-right">{fmt(r.cost_sold)}</TableCell>
                      <TableCell className={cn("text-right font-medium", r.profit < 0 ? "text-destructive" : "")}>{fmt(r.profit)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(r.fixed_fee)}</TableCell>
                      <TableCell className={cn("text-right font-semibold", r.net_profit < 0 ? "text-destructive" : "text-primary")}>{fmt(r.net_profit)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">{isRTL ? "الإجمالي" : "Total"}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(totals.coins, 0)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(totals.qty, 0)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">{fmt(totals.total)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right font-bold">{fmt(totals.cost_sold)}</TableCell>
                    <TableCell className={cn("text-right font-bold", totals.profit < 0 ? "text-destructive" : "")}>{fmt(totals.profit)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(totals.fixed_fee)}</TableCell>
                    <TableCell className={cn("text-right font-bold", totals.net_profit < 0 ? "text-destructive" : "text-primary")}>{fmt(totals.net_profit)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
              </TabsContent>

              <TabsContent value="summary">
                {summaryByCoins.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    {isRTL ? "لا توجد بيانات." : "No data."}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {summaryByCoins.map((g) => {
                      const topIdx = g.lines.reduce(
                        (best, l, i, arr) => (l.net_profit > arr[best].net_profit ? i : best),
                        0
                      );
                      return (
                        <Card key={g.coins_number} className="overflow-hidden border-2">
                          <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-5 py-3 border-b">
                            <h3 className="text-lg font-bold">
                              {isRTL ? "المنتج: " : "Product: "}
                              <span className="text-primary">{fmt(g.coins_number, 0)} {isRTL ? "كوينز" : "Coins"}</span>
                            </h3>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{isRTL ? "طريقة الدفع" : "Payment Method"}</TableHead>
                                <TableHead>{isRTL ? "وسيلة الدفع" : "Payment Brand"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "العمليات" : "Txns"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "الكمية" : "Quantity"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "الإجمالي" : "Total"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "تكلفة المباع" : "Cost Sold"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "الربح" : "Profit"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "رسوم ثابتة" : "Fixed Fee"}</TableHead>
                                <TableHead className="text-right">{isRTL ? "صافي الربح" : "Net Profit"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {g.lines.map((s, i) => (
                                <TableRow key={i} className={cn(i === topIdx && "bg-primary/5")}>
                                  <TableCell>{s.payment_method}</TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {s.payment_brand}
                                      {i === topIdx && (
                                        <Badge variant="secondary" className="text-xs">
                                          {isRTL ? "الأفضل" : "top performer"}
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">{fmt(s.count, 0)}</TableCell>
                                  <TableCell className="text-right">{fmt(s.qty, 0)}</TableCell>
                                  <TableCell className="text-right">{fmt(s.total)}</TableCell>
                                  <TableCell className="text-right">{fmt(s.cost_sold)}</TableCell>
                                  <TableCell className={cn("text-right font-medium", s.profit < 0 ? "text-destructive" : "")}>{fmt(s.profit)}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{fmt(s.fixed_fee)}</TableCell>
                                  <TableCell className={cn("text-right font-semibold", s.net_profit < 0 ? "text-destructive" : "text-primary")}>{fmt(s.net_profit)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                            <TableFooter>
                              <TableRow className="bg-gradient-to-r from-amber-500/20 to-amber-600/10">
                                <TableCell colSpan={2} className="font-bold">{isRTL ? "الإجمالي" : "Total"}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(g.count, 0)}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(g.qty, 0)}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(g.total)}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(g.cost_sold)}</TableCell>
                                <TableCell className={cn("text-right font-bold", g.profit < 0 ? "text-destructive" : "")}>{fmt(g.profit)}</TableCell>
                                <TableCell className="text-right font-bold">{fmt(g.fixed_fee)}</TableCell>
                                <TableCell className={cn("text-right font-bold", g.net_profit < 0 ? "text-destructive" : "text-primary")}>{fmt(g.net_profit)}</TableCell>
                              </TableRow>
                            </TableFooter>
                          </Table>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FreeCoinsReport;
