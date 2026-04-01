import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Search, Download, Printer, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface SalesRow {
  product_name: string;
  qty: number;
  coins_number: number;
  unit_price: number;
  total: number;
  brand_name: string;
  order_number: string;
  created_at_date: string;
}

interface AggregatedRow {
  product_name: string;
  month_year: string;
  sort_key: string;
  total_qty: number;
  total_coins: number;
  total_amount: number;
  def: number;
}

type SortDirection = "asc" | "desc";
interface SortConfig {
  key: string;
  direction: SortDirection;
}

const MainProductSalesReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SalesRow[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [mainProductNames, setMainProductNames] = useState<string[]>([]);
  const [showAggregated, setShowAggregated] = useState(false);
  const [aggSortConfigs, setAggSortConfigs] = useState<SortConfig[]>([]);
  const [detailSortConfigs, setDetailSortConfigs] = useState<SortConfig[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBrands();
    fetchMainProducts();
  }, []);

  const fetchBrands = async () => {
    const { data } = await supabase
      .from("brands")
      .select("brand_name")
      .eq("status", "active")
      .order("brand_name");
    if (data) setBrands(data.map((b) => b.brand_name));
  };

  const fetchMainProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("product_name")
      .eq("is_main_product", true);
    if (data) setMainProductNames(data.map((p) => p.product_name));
  };

  const handleSearch = async () => {
    if (!fromDate || !toDate) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "يرجى تحديد نطاق التاريخ" : "Please select a date range",
        variant: "destructive",
      });
      return;
    }

    if (mainProductNames.length === 0) {
      toast({
        title: isRTL ? "لا توجد منتجات رئيسية" : "No Main Products",
        description: isRTL
          ? "لم يتم تحديد أي منتج كمنتج رئيسي"
          : "No products have been marked as Main Product",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const fromStr = format(fromDate, "yyyy-MM-dd");
      const toStr = format(toDate, "yyyy-MM-dd");

      let query = supabase
        .from("purpletransaction")
        .select("product_name, qty, coins_number, unit_price, total, brand_name, order_number, created_at_date")
        .in("product_name", mainProductNames)
        .gte("created_at_date", fromStr)
        .lte("created_at_date", toStr + "T23:59:59");

      if (selectedBrand !== "all") {
        query = query.eq("brand_name", selectedBrand);
      }

      let allData: SalesRow[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query.range(from, from + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...(data as unknown as SalesRow[])];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setResults(allData);
      setAggSortConfigs([]);
      setDetailSortConfigs([]);

      if (allData.length === 0) {
        toast({
          title: isRTL ? "لا توجد بيانات" : "No Data",
          description: isRTL ? "لم يتم العثور على بيانات للفلاتر المحددة" : "No data found for the selected filters",
        });
      }
    } catch (error: any) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    return {
      qty: results.reduce((sum, r) => sum + (r.qty || 0), 0),
      coins: results.reduce((sum, r) => sum + (r.coins_number || 0), 0),
      total: results.reduce((sum, r) => sum + (r.total || 0), 0),
    };
  }, [results]);

  const aggregatedData = useMemo<AggregatedRow[]>(() => {
    if (!showAggregated || results.length === 0) return [];

    const map = new Map<string, AggregatedRow>();

    for (const r of results) {
      const dateStr = r.created_at_date ? String(r.created_at_date).substring(0, 10) : "";
      let monthYear = "";
      let sortKey = "";
      if (dateStr.length >= 7) {
        const [year, month] = dateStr.split("-");
        monthYear = `${month}/${year}`;
        sortKey = `${year}${month}`;
      }

      const key = `${r.product_name}||${monthYear}`;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.total_qty += r.qty || 0;
        existing.total_coins += r.coins_number || 0;
        existing.total_amount += r.total || 0;
        existing.def = existing.total_qty - existing.total_coins;
      } else {
        const qty = r.qty || 0;
        const coins = r.coins_number || 0;
        map.set(key, {
          product_name: r.product_name,
          month_year: monthYear,
          sort_key: sortKey,
          total_qty: qty,
          total_coins: coins,
          total_amount: r.total || 0,
          def: qty - coins,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const nameCompare = a.product_name.localeCompare(b.product_name);
      if (nameCompare !== 0) return nameCompare;
      return a.sort_key.localeCompare(b.sort_key);
    });
  }, [results, showAggregated]);

  const aggregatedTotals = useMemo(() => {
    const qty = aggregatedData.reduce((sum, r) => sum + r.total_qty, 0);
    const coins = aggregatedData.reduce((sum, r) => sum + r.total_coins, 0);
    return {
      qty,
      coins,
      total: aggregatedData.reduce((sum, r) => sum + r.total_amount, 0),
      def: qty - coins,
    };
  }, [aggregatedData]);

  // Multi-column sorting
  const handleSort = useCallback((key: string, isAgg: boolean) => {
    const setter = isAgg ? setAggSortConfigs : setDetailSortConfigs;
    setter((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx === -1) return [...prev, { key, direction: "asc" as SortDirection }];
      if (prev[idx].direction === "asc") return prev.map((s, i) => i === idx ? { ...s, direction: "desc" as SortDirection } : s);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const getSortIcon = (key: string, configs: SortConfig[]) => {
    const config = configs.find((s) => s.key === key);
    if (!config) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    const idx = configs.indexOf(config);
    const badge = configs.length > 1 ? <span className="text-[10px] ml-0.5">{idx + 1}</span> : null;
    return config.direction === "asc"
      ? <><ArrowUp className="h-3 w-3 ml-1 inline text-primary" />{badge}</>
      : <><ArrowDown className="h-3 w-3 ml-1 inline text-primary" />{badge}</>;
  };

  const multiSort = <T,>(data: T[], configs: SortConfig[], getVal: (item: T, key: string) => any): T[] => {
    if (configs.length === 0) return data;
    return [...data].sort((a, b) => {
      for (const { key, direction } of configs) {
        const aVal = getVal(a, key);
        const bVal = getVal(b, key);
        let cmp = 0;
        if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else {
          cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""));
        }
        if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  };

  const sortedAggregated = useMemo(() => {
    if (aggSortConfigs.length === 0) return aggregatedData;
    return multiSort(aggregatedData, aggSortConfigs, (item, key) => {
      const map: Record<string, any> = {
        product_name: item.product_name,
        month_year: item.sort_key,
        total_qty: item.total_qty,
        total_coins: item.total_coins,
        total_amount: item.total_amount,
        def: item.def,
      };
      return map[key];
    });
  }, [aggregatedData, aggSortConfigs]);

  const sortedResults = useMemo(() => {
    if (detailSortConfigs.length === 0) return results;
    return multiSort(results, detailSortConfigs, (item, key) => (item as any)[key]);
  }, [results, detailSortConfigs]);

  const exportToExcel = () => {
    if (showAggregated && aggregatedData.length > 0) {
      const exportData = sortedAggregated.map((r) => ({
        [isRTL ? "اسم المنتج" : "Product Name"]: r.product_name,
        [isRTL ? "الشهر/السنة" : "Month/Year"]: r.month_year,
        [isRTL ? "إجمالي الكمية" : "Total Qty"]: r.total_qty,
        [isRTL ? "إجمالي الكوينز" : "Total Coins"]: r.total_coins,
        [isRTL ? "الفرق" : "Def."]: r.def,
        [isRTL ? "الإجمالي" : "Total"]: r.total_amount,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Aggregated Summary");
      XLSX.writeFile(wb, "main_product_sales_aggregated.xlsx");
      return;
    }

    if (results.length === 0) return;

    const exportData = sortedResults.map((r) => ({
      [isRTL ? "اسم المنتج" : "Product Name"]: r.product_name,
      [isRTL ? "الكمية" : "Qty"]: r.qty,
      [isRTL ? "الكوينز" : "Coins"]: r.coins_number,
      [isRTL ? "سعر الوحدة" : "Unit Price"]: r.unit_price,
      [isRTL ? "الإجمالي" : "Total"]: r.total,
      [isRTL ? "العلامة التجارية" : "Brand"]: r.brand_name,
      [isRTL ? "رقم الطلب" : "Order #"]: r.order_number,
      [isRTL ? "التاريخ" : "Date"]: r.created_at_date,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Main Product Sales");
    XLSX.writeFile(wb, "main_product_sales.xlsx");
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const title = isRTL ? "تقرير مبيعات المنتجات الرئيسية" : "Main Product Sales Report";
    const dateRange = fromDate && toDate
      ? `${format(fromDate, "yyyy-MM-dd")} → ${format(toDate, "yyyy-MM-dd")}`
      : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isRTL ? "rtl" : "ltr"}">
      <head>
        <title>${title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .header h1 { font-size: 18px; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: ${isRTL ? "right" : "left"}; font-size: 11px; }
          th { background: #f0f0f0; font-weight: bold; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background: #f5f5f5; }
          .summary { display: flex; gap: 20px; margin-bottom: 15px; flex-wrap: wrap; }
          .summary-item { border: 1px solid #ccc; padding: 8px 16px; text-align: center; border-radius: 4px; }
          .summary-item .label { font-size: 10px; color: #666; }
          .summary-item .value { font-size: 16px; font-weight: bold; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          <p>${dateRange}${selectedBrand !== "all" ? ` | ${isRTL ? "العلامة" : "Brand"}: ${selectedBrand}` : ""}</p>
          <p>${showAggregated ? (isRTL ? "ملخص مجمع" : "Aggregated Summary") : (isRTL ? "تفاصيل" : "Detail View")}</p>
        </div>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.warn('Print dialog was cancelled or failed:', e);
      }
      printWindow.close();
    }, 500);
  };

  const hasData = showAggregated ? aggregatedData.length > 0 : results.length > 0;

  const SortableHead = ({ label, sortKey, isAgg }: { label: string; sortKey: string; isAgg: boolean }) => (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50", sortKey.includes("qty") || sortKey.includes("coins") || sortKey.includes("total") || sortKey.includes("unit_price") || sortKey === "def" ? "text-right" : "")}
      onClick={() => handleSort(sortKey, isAgg)}
    >
      {label}
      {getSortIcon(sortKey, isAgg ? aggSortConfigs : detailSortConfigs)}
    </TableHead>
  );

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isRTL ? "تقرير مبيعات المنتجات الرئيسية" : "Main Product Sales Report"}
          </h1>
          <p className="text-muted-foreground">
            {isRTL
              ? "عرض مبيعات المنتجات المحددة كمنتج رئيسي"
              : "View sales for products marked as Main Product"}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={exportToExcel} disabled={!hasData}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!hasData}>
            <Printer className="h-4 w-4 mr-2" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>{isRTL ? "العلامة التجارية" : "Brand"}</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "yyyy-MM-dd") : (isRTL ? "اختر التاريخ" : "Pick a date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "yyyy-MM-dd") : (isRTL ? "اختر التاريخ" : "Pick a date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? "ملخص مجمع" : "Aggregated Summary"}</Label>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={showAggregated} onCheckedChange={setShowAggregated} />
                <span className="text-sm text-muted-foreground">
                  {showAggregated ? (isRTL ? "مفعل" : "On") : (isRTL ? "معطل" : "Off")}
                </span>
              </div>
            </div>

            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? (isRTL ? "جاري البحث..." : "Searching...") : (isRTL ? "بحث" : "Search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{isRTL ? "عدد السجلات" : "Records"}</p>
              <p className="text-2xl font-bold">
                {showAggregated ? aggregatedData.length.toLocaleString() : results.length.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الكمية" : "Total Qty"}</p>
              <p className="text-2xl font-bold">{totals.qty.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الكوينز" : "Total Coins"}</p>
              <p className="text-2xl font-bold">{totals.coins.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{isRTL ? "الإجمالي" : "Grand Total"}</p>
              <p className="text-2xl font-bold">{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Printable content wrapper */}
      <div ref={printRef}>
        {/* Aggregated Summary Table */}
        {showAggregated && aggregatedData.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <SortableHead label={isRTL ? "اسم المنتج" : "Product Name"} sortKey="product_name" isAgg />
                      <SortableHead label={isRTL ? "الشهر/السنة" : "Month/Year"} sortKey="month_year" isAgg />
                      <SortableHead label={isRTL ? "إجمالي الكمية" : "Total Qty"} sortKey="total_qty" isAgg />
                      <SortableHead label={isRTL ? "إجمالي الكوينز" : "Total Coins"} sortKey="total_coins" isAgg />
                      <SortableHead label={isRTL ? "الفرق" : "Def."} sortKey="def" isAgg />
                      <SortableHead label={isRTL ? "الإجمالي" : "Total"} sortKey="total_amount" isAgg />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAggregated.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.product_name}</TableCell>
                        <TableCell>{row.month_year}</TableCell>
                        <TableCell className="text-right">{row.total_qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.total_coins.toLocaleString()}</TableCell>
                        <TableCell className={cn("text-right font-medium", row.def !== 0 ? "text-destructive" : "")}>
                          {row.def.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{row.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={3}>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                      <TableCell className="text-right">{aggregatedTotals.qty.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{aggregatedTotals.coins.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right", aggregatedTotals.def !== 0 ? "text-destructive" : "")}>
                        {aggregatedTotals.def.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{aggregatedTotals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detail Results Table */}
        {!showAggregated && results.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <SortableHead label={isRTL ? "اسم المنتج" : "Product Name"} sortKey="product_name" isAgg={false} />
                      <SortableHead label={isRTL ? "الكمية" : "Qty"} sortKey="qty" isAgg={false} />
                      <SortableHead label={isRTL ? "الكوينز" : "Coins"} sortKey="coins_number" isAgg={false} />
                      <SortableHead label={isRTL ? "سعر الوحدة" : "Unit Price"} sortKey="unit_price" isAgg={false} />
                      <SortableHead label={isRTL ? "الإجمالي" : "Total"} sortKey="total" isAgg={false} />
                      <SortableHead label={isRTL ? "العلامة التجارية" : "Brand"} sortKey="brand_name" isAgg={false} />
                      <SortableHead label={isRTL ? "رقم الطلب" : "Order #"} sortKey="order_number" isAgg={false} />
                      <SortableHead label={isRTL ? "التاريخ" : "Date"} sortKey="created_at_date" isAgg={false} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{row.product_name}</TableCell>
                        <TableCell className="text-right">{row.qty?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.coins_number?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.unit_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{row.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{row.brand_name}</TableCell>
                        <TableCell>{row.order_number}</TableCell>
                        <TableCell>{row.created_at_date ? String(row.created_at_date).substring(0, 10) : ""}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                      <TableCell className="text-right">{totals.qty.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{totals.coins.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MainProductSalesReport;
