import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, Search, Printer, ArrowLeft, ArrowRightLeft, CalendarIcon, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface UnmatchedProduct {
  product_id: string;
  product_name: string;
  brand_name: string;
  brand_code: string;
  transaction_count: number;
}

interface OrphanProduct {
  product_id: string;
  product_name: string;
  brand_name: string;
  brand_code: string;
  sku: string;
  status: string;
}

type ViewMode = "unmatched" | "no-transactions";

const UnmatchedTransactionProducts = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === "ar";
  const [data, setData] = useState<UnmatchedProduct[]>([]);
  const [orphanData, setOrphanData] = useState<OrphanProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("unmatched");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Orders popup state
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [orderNumbers, setOrderNumbers] = useState<string[]>([]);

  const handleProductIdClick = async (productId: string) => {
    if (!dateFrom || !dateTo) return;
    setSelectedProductId(productId);
    setOrdersDialogOpen(true);
    setOrdersLoading(true);
    try {
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      const toStr = format(dateTo, "yyyy-MM-dd");
      
      let allOrders: string[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("purpletransaction")
          .select("order_number")
          .eq("product_id", productId)
          .gte("created_at_date", fromStr)
          .lte("created_at_date", toStr)
          .not("order_number", "is", null)
          .range(from, from + batchSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          data.forEach(d => { if (d.order_number) allOrders.push(d.order_number); });
          hasMore = data.length === batchSize;
          from += batchSize;
        } else {
          hasMore = false;
        }
      }

      // Deduplicate
      setOrderNumbers([...new Set(allOrders)]);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error(isRTL ? "خطأ في تحميل الطلبات" : "Error loading orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchData = async () => {
    if (!dateFrom || !dateTo) {
      toast.error(isRTL ? "يرجى تحديد نطاق التاريخ" : "Please select a date range");
      return;
    }
    setLoading(true);
    try {
      if (viewMode === "unmatched") {
        await fetchUnmatched();
      } else {
        await fetchNoTransactions();
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(isRTL ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnmatched = async () => {
    const fromStr = format(dateFrom!, "yyyy-MM-dd");
    const toStr = format(dateTo!, "yyyy-MM-dd");

    const { data: result, error } = await supabase.rpc("get_unmatched_transaction_products", {
      p_date_from: fromStr,
      p_date_to: toStr,
    });

    if (error) throw error;
    setData(result || []);
  };

  const fetchNoTransactions = async () => {
    const fromStr = format(dateFrom!, "yyyy-MM-dd");
    const toStr = format(dateTo!, "yyyy-MM-dd");

    const { data: result, error } = await supabase.rpc("get_products_without_transactions", {
      p_date_from: fromStr,
      p_date_to: toStr,
    });

    if (error) throw error;
    setOrphanData(
      (result || []).map((p: any) => ({
        product_id: p.product_id || "",
        product_name: p.product_name || "",
        brand_name: p.brand_name || "",
        brand_code: p.brand_code || "",
        sku: p.sku || "",
        status: p.status || "",
      }))
    );
  };

  const filtered = viewMode === "unmatched"
    ? data.filter(item =>
        item.product_id.toLowerCase().includes(search.toLowerCase()) ||
        item.product_name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand_code.toLowerCase().includes(search.toLowerCase())
      )
    : orphanData.filter(item =>
        item.product_id.toLowerCase().includes(search.toLowerCase()) ||
        item.product_name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        item.brand_code.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase())
      );

  const handleExport = () => {
    if (viewMode === "unmatched") {
      const ws = XLSX.utils.json_to_sheet((filtered as UnmatchedProduct[]).map(item => ({
        [isRTL ? "رقم المنتج" : "Product ID"]: item.product_id,
        [isRTL ? "اسم المنتج" : "Product Name"]: item.product_name,
        [isRTL ? "اسم البراند" : "Brand Name"]: item.brand_name,
        [isRTL ? "كود البراند" : "Brand Code"]: item.brand_code,
        [isRTL ? "عدد المعاملات" : "Transaction Count"]: item.transaction_count,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Unmatched Products");
      XLSX.writeFile(wb, "unmatched_transaction_products.xlsx");
    } else {
      const ws = XLSX.utils.json_to_sheet((filtered as OrphanProduct[]).map(item => ({
        [isRTL ? "رقم المنتج" : "Product ID"]: item.product_id,
        [isRTL ? "اسم المنتج" : "Product Name"]: item.product_name,
        SKU: item.sku,
        [isRTL ? "اسم البراند" : "Brand Name"]: item.brand_name,
        [isRTL ? "كود البراند" : "Brand Code"]: item.brand_code,
        [isRTL ? "الحالة" : "Status"]: item.status,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products Without Transactions");
      XLSX.writeFile(wb, "products_without_transactions.xlsx");
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isRTL ? "منتجات المعاملات غير المطابقة" : "Unmatched Transaction Products"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {viewMode === "unmatched"
                ? (isRTL
                  ? "منتجات موجودة في المعاملات ولكن غير موجودة في جدول المنتجات"
                  : "Products found in transactions but missing from the products table")
                : (isRTL
                  ? "منتجات موجودة في جدول المنتجات ولكن ليس لها معاملات"
                  : "Products in product setup with no transactions")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {isRTL ? "تصدير Excel" : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => { setSearch(""); setData([]); setOrphanData([]); setViewMode(v as ViewMode); }} className="print:hidden">
        <TabsList>
          <TabsTrigger value="unmatched" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {isRTL ? "في المعاملات وليس في المنتجات" : "In Transactions, Not in Products"}
          </TabsTrigger>
          <TabsTrigger value="no-transactions" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {isRTL ? "في المنتجات وليس في المعاملات" : "In Products, Not in Transactions"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Date Range Filter */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "yyyy-MM-dd") : (isRTL ? "من تاريخ" : "From Date")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "yyyy-MM-dd") : (isRTL ? "إلى تاريخ" : "To Date")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        <Button onClick={fetchData} disabled={loading || !dateFrom || !dateTo}>
          {loading
            ? (isRTL ? "جاري التحميل..." : "Loading...")
            : (isRTL ? "بحث" : "Search")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {isRTL ? `إجمالي: ${filtered.length} منتج` : `Total: ${filtered.length} products`}
            </CardTitle>
            <div className="relative w-72 print:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isRTL ? "بحث..." : "Search..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : viewMode === "unmatched" ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isRTL ? "رقم المنتج" : "Product ID"}</TableHead>
                    <TableHead>{isRTL ? "اسم المنتج" : "Product Name"}</TableHead>
                    <TableHead>{isRTL ? "اسم البراند" : "Brand Name"}</TableHead>
                    <TableHead>{isRTL ? "كود البراند" : "Brand Code"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "عدد المعاملات" : "Txn Count"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filtered as UnmatchedProduct[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد منتجات غير مطابقة" : "No unmatched products found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filtered as UnmatchedProduct[]).map((item, idx) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">
                          <button
                            className="text-primary underline hover:text-primary/80 cursor-pointer"
                            onClick={() => handleProductIdClick(item.product_id)}
                          >
                            {item.product_id}
                          </button>
                        </TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.brand_name}</TableCell>
                        <TableCell className="font-mono">{item.brand_code}</TableCell>
                        <TableCell className="text-center font-semibold">{item.transaction_count.toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{isRTL ? "رقم المنتج" : "Product ID"}</TableHead>
                    <TableHead>{isRTL ? "اسم المنتج" : "Product Name"}</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>{isRTL ? "اسم البراند" : "Brand Name"}</TableHead>
                    <TableHead>{isRTL ? "كود البراند" : "Brand Code"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filtered as OrphanProduct[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد منتجات بدون معاملات" : "No products without transactions found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filtered as OrphanProduct[]).map((item, idx) => (
                      <TableRow key={`${item.product_id}-${idx}`}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">{item.product_id || "-"}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="font-mono">{item.sku || "-"}</TableCell>
                        <TableCell>{item.brand_name || "-"}</TableCell>
                        <TableCell className="font-mono">{item.brand_code || "-"}</TableCell>
                        <TableCell>{item.status}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders Dialog */}
      <Dialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {isRTL ? `طلبات المنتج: ${selectedProductId}` : `Orders for Product: ${selectedProductId}`}
            </DialogTitle>
          </DialogHeader>
          {ordersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : orderNumbers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {isRTL ? "لا توجد طلبات" : "No orders found"}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {isRTL ? `إجمالي: ${orderNumbers.length} طلب` : `Total: ${orderNumbers.length} orders`}
              </p>
              <div className="overflow-auto max-h-[50vh] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{isRTL ? "رقم الطلب" : "Order Number"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderNumbers.map((order, idx) => (
                      <TableRow key={order}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">{order}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnmatchedTransactionProducts;
