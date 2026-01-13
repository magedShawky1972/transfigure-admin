import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Search, RefreshCw, Download, AlertCircle, CheckCircle2, Clock, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface SyncDetail {
  id: string;
  run_id: string;
  order_number: string;
  order_date: string;
  customer_phone: string;
  product_names: string;
  total_amount: number;
  sync_status: string;
  error_message: string | null;
  step_customer: string;
  step_brand: string;
  step_product: string;
  step_order: string;
  step_purchase: string;
  created_at: string;
  brand_name: string | null;
  payment_method: string | null;
  payment_brand: string | null;
}

interface Brand {
  id: string;
  brand_name: string;
}

interface PaymentMethod {
  payment_type: string;
}

interface PaymentBrand {
  payment_method: string;
}

const OdooSyncStatusReport = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [syncDetails, setSyncDetails] = useState<SyncDetail[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [paymentBrands, setPaymentBrands] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);

  // Filters
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentBrandFilter, setPaymentBrandFilter] = useState<string>("all");

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchFilterOptions = async () => {
    // Fetch brands
    const { data: brandsData } = await supabase
      .from("brands")
      .select("id, brand_name")
      .eq("status", "active")
      .order("brand_name");
    
    if (brandsData) {
      setBrands(brandsData);
    }

    // Fetch distinct payment methods from payment_methods
    const { data: paymentMethodsData } = await supabase
      .from("payment_methods")
      .select("payment_type")
      .eq("is_active", true);
    
    if (paymentMethodsData) {
      const uniqueMethods = [...new Set(paymentMethodsData.map(p => p.payment_type).filter(Boolean))] as string[];
      setPaymentMethods(uniqueMethods);
    }

    // Fetch distinct payment brands from payment_methods
    const { data: paymentBrandsData } = await supabase
      .from("payment_methods")
      .select("payment_method")
      .eq("is_active", true);
    
    if (paymentBrandsData) {
      const uniqueBrands = [...new Set(paymentBrandsData.map(p => p.payment_method).filter(Boolean))] as string[];
      setPaymentBrands(uniqueBrands);
    }
  };

  const fetchSyncDetails = async () => {
    if (!fromDate || !toDate) return;

    setLoading(true);
    try {
      let query = supabase
        .from("odoo_sync_run_details")
        .select("*")
        .gte("order_date", format(fromDate, "yyyy-MM-dd"))
        .lte("order_date", format(toDate, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("sync_status", statusFilter);
      }

      if (brandFilter !== "all") {
        query = query.eq("brand_name", brandFilter);
      }

      if (productFilter) {
        query = query.ilike("product_names", `%${productFilter}%`);
      }

      if (paymentMethodFilter !== "all") {
        query = query.eq("payment_method", paymentMethodFilter);
      }

      if (paymentBrandFilter !== "all") {
        query = query.eq("payment_brand", paymentBrandFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSyncDetails(data || []);
    } catch (error) {
      console.error("Error fetching sync details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {language === "ar" ? "نجح" : "Success"}
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            {language === "ar" ? "فشل" : "Failed"}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            {language === "ar" ? "قيد الانتظار" : "Pending"}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const getStepBadge = (step: string) => {
    switch (step) {
      case "sent":
      case "found":
      case "created":
        return <Badge className="bg-green-100 text-green-800 text-xs">{step}</Badge>;
      case "failed":
      case "error":
        return <Badge className="bg-red-100 text-red-800 text-xs">{step}</Badge>;
      case "skipped":
        return <Badge className="bg-gray-100 text-gray-800 text-xs">{step}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{step || "-"}</Badge>;
    }
  };

  const exportToExcel = () => {
    const exportData = syncDetails.map((detail) => ({
      [language === "ar" ? "رقم الطلب" : "Order Number"]: detail.order_number,
      [language === "ar" ? "تاريخ الطلب" : "Order Date"]: detail.order_date,
      [language === "ar" ? "هاتف العميل" : "Customer Phone"]: detail.customer_phone,
      [language === "ar" ? "المنتجات" : "Products"]: detail.product_names,
      [language === "ar" ? "العلامة التجارية" : "Brand"]: detail.brand_name || "-",
      [language === "ar" ? "المبلغ الإجمالي" : "Total Amount"]: detail.total_amount,
      [language === "ar" ? "طريقة الدفع" : "Payment Method"]: detail.payment_method || "-",
      [language === "ar" ? "علامة الدفع" : "Payment Brand"]: detail.payment_brand || "-",
      [language === "ar" ? "الحالة" : "Status"]: detail.sync_status,
      [language === "ar" ? "خطوة العميل" : "Customer Step"]: detail.step_customer,
      [language === "ar" ? "خطوة العلامة" : "Brand Step"]: detail.step_brand,
      [language === "ar" ? "خطوة المنتج" : "Product Step"]: detail.step_product,
      [language === "ar" ? "خطوة الطلب" : "Order Step"]: detail.step_order,
      [language === "ar" ? "خطوة الشراء" : "Purchase Step"]: detail.step_purchase,
      [language === "ar" ? "رسالة الخطأ" : "Error Message"]: detail.error_message || "-",
      [language === "ar" ? "تاريخ المزامنة" : "Sync Date"]: format(new Date(detail.created_at), "yyyy-MM-dd HH:mm:ss"),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Odoo Sync Status");
    XLSX.writeFile(workbook, `odoo_sync_status_${format(new Date(), "yyyyMMdd_HHmmss")}.xlsx`);
  };

  const successCount = syncDetails.filter(d => d.sync_status === "success").length;
  const failedCount = syncDetails.filter(d => d.sync_status === "failed").length;
  const pendingCount = syncDetails.filter(d => d.sync_status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "تقرير حالة مزامنة Odoo" : "Odoo Sync Status Report"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "عرض البيانات المرسلة والغير مرسلة إلى Odoo مع رسائل الخطأ" 
              : "View data sent and not sent to Odoo with error messages"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters 
            ? (language === "ar" ? "إخفاء الفلاتر" : "Hide Filters")
            : (language === "ar" ? "إظهار الفلاتر" : "Show Filters")}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {language === "ar" ? "الفلاتر" : "Filters"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "yyyy-MM-dd") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "yyyy-MM-dd") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الحالة" : "Select status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="success">{language === "ar" ? "نجح" : "Success"}</SelectItem>
                    <SelectItem value="failed">{language === "ar" ? "فشل" : "Failed"}</SelectItem>
                    <SelectItem value="pending">{language === "ar" ? "قيد الانتظار" : "Pending"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Brand Filter */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "العلامة التجارية" : "Brand"}</Label>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر العلامة" : "Select brand"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.brand_name}>
                        {brand.brand_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Filter */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "المنتج" : "Product"}</Label>
                <Input
                  placeholder={language === "ar" ? "ابحث عن المنتج..." : "Search product..."}
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                />
              </div>

              {/* Payment Method Filter */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر طريقة الدفع" : "Select payment method"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Brand Filter */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "علامة الدفع" : "Payment Brand"}</Label>
                <Select value={paymentBrandFilter} onValueChange={setPaymentBrandFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر علامة الدفع" : "Select payment brand"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                    {paymentBrands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-end gap-2">
                <Button onClick={fetchSyncDetails} disabled={loading} className="flex-1">
                  {loading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {language === "ar" ? "بحث" : "Search"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={exportToExcel}
                  disabled={syncDetails.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {language === "ar" ? "تصدير" : "Export"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {syncDetails.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{syncDetails.length}</div>
              <p className="text-muted-foreground text-sm">
                {language === "ar" ? "إجمالي السجلات" : "Total Records"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{successCount}</div>
              <p className="text-muted-foreground text-sm">
                {language === "ar" ? "نجحت" : "Successful"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{failedCount}</div>
              <p className="text-muted-foreground text-sm">
                {language === "ar" ? "فشلت" : "Failed"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-muted-foreground text-sm">
                {language === "ar" ? "قيد الانتظار" : "Pending"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar" ? "تفاصيل المزامنة" : "Sync Details"}
            {syncDetails.length > 0 && ` (${syncDetails.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : syncDetails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" 
                ? "لا توجد بيانات. اختر نطاق التاريخ واضغط بحث" 
                : "No data. Select date range and click Search"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "رقم الطلب" : "Order #"}</TableHead>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "العميل" : "Customer"}</TableHead>
                    <TableHead>{language === "ar" ? "المنتجات" : "Products"}</TableHead>
                    <TableHead>{language === "ar" ? "العلامة" : "Brand"}</TableHead>
                    <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{language === "ar" ? "الدفع" : "Payment"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "الخطوات" : "Steps"}</TableHead>
                    <TableHead>{language === "ar" ? "رسالة الخطأ" : "Error"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncDetails.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell className="font-mono">{detail.order_number}</TableCell>
                      <TableCell>{detail.order_date}</TableCell>
                      <TableCell>{detail.customer_phone}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={detail.product_names}>
                        {detail.product_names}
                      </TableCell>
                      <TableCell>{detail.brand_name || "-"}</TableCell>
                      <TableCell>{detail.total_amount?.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div>{detail.payment_method || "-"}</div>
                          <div className="text-muted-foreground">{detail.payment_brand || "-"}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(detail.sync_status)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs text-muted-foreground">C:</span>
                          {getStepBadge(detail.step_customer)}
                          <span className="text-xs text-muted-foreground">B:</span>
                          {getStepBadge(detail.step_brand)}
                          <span className="text-xs text-muted-foreground">P:</span>
                          {getStepBadge(detail.step_product)}
                          <span className="text-xs text-muted-foreground">O:</span>
                          {getStepBadge(detail.step_order)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {detail.error_message ? (
                          <span className="text-red-600 text-sm" title={detail.error_message}>
                            {detail.error_message.length > 50 
                              ? detail.error_message.substring(0, 50) + "..." 
                              : detail.error_message}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OdooSyncStatusReport;
