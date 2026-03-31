import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CalendarIcon, Search, Download, Printer } from "lucide-react";
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

      // Fetch in batches to handle > 1000 rows
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

  const exportToExcel = () => {
    if (results.length === 0) return;

    const exportData = results.map((r) => ({
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

  const handlePrint = () => window.print();

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
          <Button variant="outline" onClick={exportToExcel} disabled={results.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={results.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Brand Filter */}
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

            {/* From Date */}
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
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date */}
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
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={setToDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? (isRTL ? "جاري البحث..." : "Searching...") : (isRTL ? "بحث" : "Search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">{isRTL ? "عدد السجلات" : "Records"}</p>
              <p className="text-2xl font-bold">{results.length.toLocaleString()}</p>
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

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isRTL ? "اسم المنتج" : "Product Name"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "الكوينز" : "Coins"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "سعر الوحدة" : "Unit Price"}</TableHead>
                    <TableHead className="text-right">{isRTL ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead>{isRTL ? "العلامة التجارية" : "Brand"}</TableHead>
                    <TableHead>{isRTL ? "رقم الطلب" : "Order #"}</TableHead>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row, idx) => (
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
                  {/* Totals Row */}
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
  );
};

export default MainProductSalesReport;
