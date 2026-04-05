import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Printer, Download, Filter, ChevronsUpDown, Check, ArrowUp, ArrowDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import * as XLSX from "xlsx";

interface SalesOrderDetail {
  order_number: string;
  customer_phone: string;
  order_date: string;
  player_id: string;
  transaction_type: string;
  register_user_id: string;
  point: number;
  point_value: number;
  line_number: number;
  line_status: number;
  product_sku: string;
  product_id: number;
  product_name: string;
  brand_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  coins_number: number;
  total_cost: number;
  payment_method: string;
  payment_brand: string;
  payment_amount: number;
  payment_reference: string;
  payment_card_number: string;
  bank_transaction_id: string;
  payment_location: string;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

const numericKeys = new Set([
  "point", "point_value", "line_number", "line_status", "product_id",
  "quantity", "unit_price", "total", "coins_number", "total_cost",
  "payment_amount",
]);

const SalesOrderDetailReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterOrderNumber, setFilterOrderNumber] = useState("");
  const [filterCustomerPhone, setFilterCustomerPhone] = useState("");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("");
  const [filterSalesPerson, setFilterSalesPerson] = useState("");
  const [filterProductSku, setFilterProductSku] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [reportData, setReportData] = useState<SalesOrderDetail[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);
  const [brandOptions, setBrandOptions] = useState<{ id: string; name: string }[]>([]);
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>([]);
  const [timeZoneMode, setTimeZoneMode] = useState<"ksa" | "utc">("ksa");

  // Load product and brand options for dropdowns
  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: products }, { data: brands }] = await Promise.all([
        supabase.from("products").select("product_id, product_name").order("product_name").limit(2000),
        supabase.from("brands").select("id, brand_name").eq("status", "active").order("brand_name"),
      ]);
      if (products) setProductOptions(products.map((p: any) => ({ id: String(p.product_id), name: p.product_name || p.product_id })));
      if (brands) setBrandOptions(brands.map((b: any) => ({ id: b.brand_name, name: b.brand_name })));
    };
    fetchOptions();
  }, []);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const getKSADayBoundaries = (dateStr: string) => ({
    start: dateStr + "T00:00:00Z",
    end: dateStr + "T23:59:59.999Z",
  });

  // Helper to fetch all pages of a query
  const fetchAllPages = async (queryBuilder: any, batchSize = 1000): Promise<any[]> => {
    let all: any[] = [];
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await queryBuilder.range(offset, offset + batchSize - 1);
      if (error) throw error;
      if (data && data.length > 0) {
        all = all.concat(data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }
    return all;
  };

  const fetchReport = async () => {
    if (!fromDate || !toDate) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى تحديد نطاق التاريخ" : "Please select date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setLoadingStep(language === "ar" ? "تحميل الطلبات..." : "Loading orders...");
    try {
      const fromBounds = getKSADayBoundaries(fromDate);
      const toBounds = getKSADayBoundaries(toDate);

      // Step 1: Fetch headers
      let headerQuery = supabase
        .from("sales_order_header")
        .select("order_number, customer_phone, order_date, player_id, transaction_type, register_user_id, created_at")
        .gte("created_at", fromBounds.start)
        .lte("created_at", toBounds.end);

      if (filterSalesPerson) headerQuery = headerQuery.ilike("register_user_id", `%${filterSalesPerson}%`);
      if (filterOrderNumber) headerQuery = headerQuery.ilike("order_number", `%${filterOrderNumber}%`);
      if (filterCustomerPhone) headerQuery = headerQuery.ilike("customer_phone", `%${filterCustomerPhone}%`);

      const allHeaders = await fetchAllPages(headerQuery);
      setLoadingProgress(20);

      if (allHeaders.length === 0) {
        setReportData([]);
        toast({
          title: language === "ar" ? "لا توجد بيانات" : "No Data",
          description: language === "ar" ? "لا توجد طلبات في هذا النطاق" : "No orders found in this range",
        });
        setLoading(false);
        return;
      }

      const orderNumbers = allHeaders.map((h) => h.order_number);
      const headerMap = new Map(allHeaders.map((h) => [h.order_number, h]));

      // Step 2: Fetch lines AND payments in PARALLEL (major perf improvement)
      setLoadingStep(language === "ar" ? "تحميل التفاصيل والمدفوعات..." : "Loading details & payments...");
      const chunkSize = 500;
      const batchSize = 1000;

      const fetchLinesPromise = async () => {
        let allLines: any[] = [];
        for (let i = 0; i < orderNumbers.length; i += chunkSize) {
          const chunk = orderNumbers.slice(i, i + chunkSize);
          let lineQuery = supabase
            .from("sales_order_line")
            .select("order_number, line_number, line_status, product_sku, product_id, quantity, unit_price, total, coins_number, total_cost, point")
            .in("order_number", chunk);
          if (filterProductSku) lineQuery = lineQuery.ilike("product_sku", `%${filterProductSku}%`);
          if (filterProduct && filterProduct !== "all") lineQuery = lineQuery.eq("product_id", Number(filterProduct));
          const lines = await fetchAllPages(lineQuery, batchSize);
          allLines = allLines.concat(lines);
        }
        return allLines;
      };

      const fetchPaymentsPromise = async () => {
        let allPayments: any[] = [];
        for (let i = 0; i < orderNumbers.length; i += chunkSize) {
          const chunk = orderNumbers.slice(i, i + chunkSize);
          let payQuery = supabase
            .from("payment_transactions")
            .select("order_number, payment_method, payment_brand, payment_amount, payment_reference, payment_card_number, bank_transaction_id, payment_location")
            .in("order_number", chunk);
          if (filterPaymentMethod) payQuery = payQuery.ilike("payment_method", `%${filterPaymentMethod}%`);
          const payments = await fetchAllPages(payQuery, batchSize);
          allPayments = allPayments.concat(payments);
        }
        return allPayments;
      };

      // Run lines and payments fetch in parallel
      const [allLines, allPayments] = await Promise.all([fetchLinesPromise(), fetchPaymentsPromise()]);
      setLoadingProgress(60);

      // Step 3: Fetch products for names
      setLoadingStep(language === "ar" ? "تحميل بيانات المنتجات..." : "Loading product data...");
      const allProductIds = [...new Set(allLines.map((l: any) => Number(l.product_id)).filter(Boolean))];
      const productMap = new Map<number, { product_name: string; brand_name: string }>();
      
      // Fetch products in parallel chunks
      const productPromises = [];
      for (let i = 0; i < allProductIds.length; i += chunkSize) {
        const chunk = allProductIds.slice(i, i + chunkSize);
        productPromises.push(
          supabase.from("products").select("product_id, product_name, brand_name").in("product_id", chunk.map(String))
        );
      }
      const productResults = await Promise.all(productPromises);
      productResults.forEach(({ data: prodData }) => {
        if (prodData) {
          prodData.forEach((p: any) => {
            productMap.set(Number(p.product_id), { product_name: p.product_name || "", brand_name: p.brand_name || "" });
          });
        }
      });
      setLoadingProgress(80);

      // Step 4: Build results
      setLoadingStep(language === "ar" ? "تجميع النتائج..." : "Building results...");
      const paymentMap = new Map<string, any[]>();
      allPayments.forEach((p) => {
        if (!paymentMap.has(p.order_number)) paymentMap.set(p.order_number, []);
        paymentMap.get(p.order_number)!.push(p);
      });

      const filteredOrderNumbers = filterPaymentMethod
        ? new Set(orderNumbers.filter((on) => paymentMap.has(on)))
        : new Set(orderNumbers);

      const results: SalesOrderDetail[] = [];
      allLines.forEach((line) => {
        if (!filteredOrderNumbers.has(line.order_number)) return;
        const header = headerMap.get(line.order_number);
        if (!header) return;

        const prod = productMap.get(Number(line.product_id)) || { product_name: "", brand_name: "" };
        if (filterBrand && filterBrand !== "all" && prod.brand_name !== filterBrand) return;
        const payments = paymentMap.get(line.order_number) || [{ payment_method: "", payment_brand: "", payment_amount: 0, payment_reference: "", payment_card_number: "", bank_transaction_id: "", payment_location: "" }];

        payments.forEach((pay) => {
          results.push({
            order_number: line.order_number,
            customer_phone: header.customer_phone || "",
            order_date: header.created_at ? new Date(header.created_at).toLocaleString("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "",
            player_id: header.player_id || "",
            transaction_type: header.transaction_type || "",
            register_user_id: header.register_user_id || "",
            point: Number(line.point) || 0,
            point_value: 0,
            line_number: line.line_number || 0,
            line_status: line.line_status || 0,
            product_sku: line.product_sku || "",
            product_id: Number(line.product_id) || 0,
            product_name: prod.product_name,
            brand_name: prod.brand_name,
            quantity: Number(line.quantity) || 0,
            unit_price: Number(line.unit_price) || 0,
            total: Number(line.total) || 0,
            coins_number: Number(line.coins_number) || 0,
            total_cost: Number(line.total_cost) || 0,
            payment_method: pay.payment_method || "",
            payment_brand: pay.payment_brand || "",
            payment_amount: Number(pay.payment_amount) || 0,
            payment_reference: pay.payment_reference || "",
            payment_card_number: pay.payment_card_number || "",
            bank_transaction_id: pay.bank_transaction_id || "",
            payment_location: pay.payment_location || "",
          });
        });
      });

      results.sort((a, b) => a.order_date.localeCompare(b.order_date) || a.order_number.localeCompare(b.order_number));
      setLoadingProgress(100);
      setReportData(results);
      setSortConfigs([]);
      toast({
        title: language === "ar" ? "تم" : "Success",
        description: language === "ar" ? `تم تحميل ${results.length} سجل` : `Loaded ${results.length} records`,
      });
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingStep("");
    }
  };

  // Multi-column sort
  const handleSort = useCallback((key: string, event: React.MouseEvent) => {
    setSortConfigs((prev) => {
      const existingIdx = prev.findIndex((s) => s.key === key);
      if (event.shiftKey) {
        // Shift+click: add/toggle column in multi-sort
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          if (existing.direction === "desc") {
            // Remove from sort
            return prev.filter((_, i) => i !== existingIdx);
          }
          // Toggle direction
          return prev.map((s, i) => i === existingIdx ? { ...s, direction: "desc" } : s);
        }
        return [...prev, { key, direction: "asc" }];
      } else {
        // Regular click: single sort or toggle
        if (existingIdx >= 0 && prev.length === 1) {
          if (prev[0].direction === "desc") return [];
          return [{ key, direction: "desc" }];
        }
        return [{ key, direction: "asc" }];
      }
    });
  }, []);

  const clearSort = useCallback(() => setSortConfigs([]), []);

  const sortedData = useMemo(() => {
    if (sortConfigs.length === 0) return reportData;
    return [...reportData].sort((a, b) => {
      for (const { key, direction } of sortConfigs) {
        const aVal = a[key as keyof SalesOrderDetail];
        const bVal = b[key as keyof SalesOrderDetail];
        let cmp = 0;
        if (numericKeys.has(key)) {
          cmp = (Number(aVal) || 0) - (Number(bVal) || 0);
        } else {
          cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""));
        }
        if (cmp !== 0) return direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [reportData, sortConfigs]);

  const handleExport = () => {
    if (sortedData.length === 0) return;
    const exportData = sortedData.map((row) => ({
      "Order Number": row.order_number,
      "Customer Phone": row.customer_phone,
      "Order Date": row.order_date,
      "Player ID": row.player_id,
      "Transaction Type": row.transaction_type,
      "Register User ID": row.register_user_id,
      Point: row.point,
      "Point Value": row.point_value,
      "Line Number": row.line_number,
      "Line Status": row.line_status,
      "Product SKU": row.product_sku,
      "Product ID": row.product_id,
      "Product Name": row.product_name,
      "Brand Name": row.brand_name,
      Quantity: row.quantity,
      "Unit Price": row.unit_price,
      Total: row.total,
      "Coins Number": row.coins_number,
      "Total Cost": row.total_cost,
      "Payment Method": row.payment_method,
      "Payment Brand": row.payment_brand,
      "Payment Amount": row.payment_amount,
      "Payment Reference": row.payment_reference,
      "Payment Card Number": row.payment_card_number,
      "Bank Transaction ID": row.bank_transaction_id,
      "Payment Location": row.payment_location,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Order Detail");
    XLSX.writeFile(wb, `sales-order-detail-${fromDate}-to-${toDate}.xlsx`);
  };

  const handlePrint = () => window.print();

  const totals = reportData.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      total: acc.total + row.total,
      total_cost: acc.total_cost + row.total_cost,
      payment_amount: acc.payment_amount + row.payment_amount,
      coins_number: acc.coins_number + row.coins_number,
    }),
    { quantity: 0, total: 0, total_cost: 0, payment_amount: 0, coins_number: 0 }
  );

  const columns = [
    { key: "order_number", label: language === "ar" ? "رقم الطلب" : "Order Number" },
    { key: "customer_phone", label: language === "ar" ? "هاتف العميل" : "Customer Phone" },
    { key: "order_date", label: language === "ar" ? "تاريخ الطلب" : "Order Date" },
    { key: "player_id", label: "Player ID" },
    { key: "transaction_type", label: language === "ar" ? "نوع المعاملة" : "Transaction Type" },
    { key: "register_user_id", label: language === "ar" ? "معرف المستخدم" : "Register User ID" },
    { key: "point", label: language === "ar" ? "النقاط" : "Point" },
    { key: "point_value", label: language === "ar" ? "قيمة النقاط" : "Point Value" },
    { key: "line_number", label: language === "ar" ? "رقم السطر" : "Line #" },
    { key: "line_status", label: language === "ar" ? "حالة السطر" : "Line Status" },
    { key: "product_sku", label: "Product SKU" },
    { key: "product_id", label: "Product ID" },
    { key: "product_name", label: language === "ar" ? "اسم المنتج" : "Product Name" },
    { key: "brand_name", label: language === "ar" ? "اسم الماركة" : "Brand Name" },
    { key: "quantity", label: language === "ar" ? "الكمية" : "Quantity" },
    { key: "unit_price", label: language === "ar" ? "سعر الوحدة" : "Unit Price" },
    { key: "total", label: language === "ar" ? "الإجمالي" : "Total" },
    { key: "coins_number", label: language === "ar" ? "عدد الكوينز" : "Coins #" },
    { key: "total_cost", label: language === "ar" ? "إجمالي التكلفة" : "Total Cost" },
    { key: "payment_method", label: language === "ar" ? "طريقة الدفع" : "Payment Method" },
    { key: "payment_brand", label: language === "ar" ? "ماركة الدفع" : "Payment Brand" },
    { key: "payment_amount", label: language === "ar" ? "مبلغ الدفع" : "Payment Amount" },
    { key: "payment_reference", label: language === "ar" ? "مرجع الدفع" : "Payment Ref" },
    { key: "payment_card_number", label: language === "ar" ? "رقم البطاقة" : "Card Number" },
    { key: "bank_transaction_id", label: language === "ar" ? "معرف البنك" : "Bank Txn ID" },
    { key: "payment_location", label: language === "ar" ? "موقع الدفع" : "Payment Location" },
  ];

  const renderCellValue = (row: SalesOrderDetail, key: string) => {
    const value = row[key as keyof SalesOrderDetail];
    if (["unit_price", "total", "total_cost", "payment_amount", "point", "point_value"].includes(key)) {
      return formatNumber(Number(value) || 0);
    }
    return String(value ?? "");
  };

  const getSortIndex = (key: string) => sortConfigs.findIndex((s) => s.key === key);
  const getSortDirection = (key: string) => sortConfigs.find((s) => s.key === key)?.direction;

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { margin: 10mm; size: A4 landscape; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          table { width: 100%; border-collapse: collapse; font-size: 7pt; }
          th, td { border: 1px solid #000 !important; padding: 2px 4px; color: #000 !important; }
          th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tfoot td { font-weight: bold; background-color: #e0e0e0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-lovable-badge], [class*="lovable"], footer, .footer { display: none !important; visibility: hidden !important; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {language === "ar" ? "تقرير تفاصيل أوامر البيع" : "Sales Order Detail Report"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" ? "بيانات الطلبات مع الأسطر والمدفوعات" : "Orders joined with lines and payments"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={reportData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تصدير Excel" : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={reportData.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {language === "ar" ? "الفلاتر" : "Filters"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "رقم الطلب" : "Order Number"}</Label>
              <Input
                placeholder={language === "ar" ? "رقم الطلب" : "Order #"}
                value={filterOrderNumber}
                onChange={(e) => setFilterOrderNumber(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "هاتف العميل" : "Customer Phone"}</Label>
              <Input
                placeholder={language === "ar" ? "رقم الهاتف" : "Phone"}
                value={filterCustomerPhone}
                onChange={(e) => setFilterCustomerPhone(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "المنتج" : "Product"}</Label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue placeholder={language === "ar" ? "الكل" : "All"} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50 max-h-60">
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  {productOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الماركة" : "Brand"}</Label>
              <Popover open={brandOpen} onOpenChange={setBrandOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={brandOpen}
                    className="w-44 justify-between bg-background"
                  >
                    {filterBrand && filterBrand !== "all"
                      ? brandOptions.find((b) => b.name === filterBrand)?.name || filterBrand
                      : language === "ar" ? "الكل" : "All"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0 z-50">
                  <Command>
                    <CommandInput placeholder={language === "ar" ? "بحث الماركة..." : "Search brand..."} />
                    <CommandList>
                      <CommandEmpty>{language === "ar" ? "لا توجد نتائج" : "No brand found"}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => { setFilterBrand("all"); setBrandOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", (!filterBrand || filterBrand === "all") ? "opacity-100" : "opacity-0")} />
                          {language === "ar" ? "الكل" : "All"}
                        </CommandItem>
                        {brandOptions.map((b) => (
                          <CommandItem
                            key={b.id}
                            onSelect={() => { setFilterBrand(b.name); setBrandOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filterBrand === b.name ? "opacity-100" : "opacity-0")} />
                            {b.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
              <Input
                placeholder={language === "ar" ? "مثال: VISA" : "e.g. VISA"}
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "البائع" : "Sales Person"}</Label>
              <Input
                placeholder={language === "ar" ? "معرف المستخدم" : "User ID"}
                value={filterSalesPerson}
                onChange={(e) => setFilterSalesPerson(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "رمز المنتج" : "Product SKU"}</Label>
              <Input
                placeholder="SKU"
                value={filterProductSku}
                onChange={(e) => setFilterProductSku(e.target.value)}
                className="w-36"
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {language === "ar" ? "تشغيل التقرير" : "Run Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading Progress */}
      {loading && (
        <Card className="no-print">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{loadingStep}</span>
                <span className="font-mono">{loadingProgress}%</span>
              </div>
              <Progress value={loadingProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Cards */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-sm text-muted-foreground">{language === "ar" ? "إجمالي المبيعات" : "Total Sales"}</p>
              <p className="text-2xl font-bold font-mono">{formatNumber(totals.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-sm text-muted-foreground">{language === "ar" ? "إجمالي التكلفة" : "Total Cost"}</p>
              <p className="text-2xl font-bold font-mono">{formatNumber(totals.total_cost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-sm text-muted-foreground">{language === "ar" ? "إجمالي الكمية" : "Total Quantity"}</p>
              <p className="text-2xl font-bold font-mono">{formatNumber(totals.quantity)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-sm text-muted-foreground">{language === "ar" ? "إجمالي المدفوعات" : "Total Payments"}</p>
              <p className="text-2xl font-bold font-mono">{formatNumber(totals.payment_amount)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Sort Indicators */}
      {sortConfigs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap no-print">
          <span className="text-sm text-muted-foreground">{language === "ar" ? "الترتيب:" : "Sort:"}</span>
          {sortConfigs.map((sc, idx) => {
            const col = columns.find((c) => c.key === sc.key);
            return (
              <Badge key={sc.key} variant="secondary" className="flex items-center gap-1">
                <span>{idx + 1}.</span>
                <span>{col?.label || sc.key}</span>
                {sc.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" onClick={clearSort} className="h-6 px-2">
            <X className="h-3 w-3 mr-1" />
            {language === "ar" ? "مسح" : "Clear"}
          </Button>
          <span className="text-xs text-muted-foreground">
            ({language === "ar" ? "Shift+click لترتيب متعدد" : "Shift+click for multi-sort"})
          </span>
        </div>
      )}

      {/* Report */}
      <div className="print-area">
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold text-center">
            {language === "ar" ? "تقرير تفاصيل أوامر البيع" : "Sales Order Detail Report"}
          </h1>
          <p className="text-center text-sm">{fromDate} - {toDate}</p>
        </div>

        {reportData.length > 0 ? (
          <Card>
            <CardHeader className="no-print">
              <CardTitle className="text-sm text-muted-foreground">
                {language === "ar" ? `${reportData.length} سجل` : `${reportData.length} records`}
                {sortConfigs.length === 0 && (
                  <span className="ml-2 text-xs">
                    ({language === "ar" ? "اضغط على العنوان للترتيب" : "Click header to sort"})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((col) => {
                        const sortIdx = getSortIndex(col.key);
                        const sortDir = getSortDirection(col.key);
                        return (
                          <TableHead
                            key={col.key}
                            className="text-center whitespace-nowrap text-xs cursor-pointer select-none hover:bg-muted/50 transition-colors"
                            onClick={(e) => handleSort(col.key, e)}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {col.label}
                              {sortDir === "asc" && <ArrowUp className="h-3 w-3 text-primary" />}
                              {sortDir === "desc" && <ArrowDown className="h-3 w-3 text-primary" />}
                              {sortIdx >= 0 && sortConfigs.length > 1 && (
                                <span className="text-[10px] font-bold text-primary">{sortIdx + 1}</span>
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map((row, idx) => (
                      <TableRow key={idx}>
                        {columns.map((col) => (
                          <TableCell key={col.key} className="text-center whitespace-nowrap text-xs font-mono">
                            {renderCellValue(row, col.key)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={14} className="font-bold text-right">
                        {language === "ar" ? "الإجمالي" : "Totals"}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">{formatNumber(totals.quantity)}</TableCell>
                      <TableCell />
                      <TableCell className="text-center font-mono font-bold">{formatNumber(totals.total)}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{formatNumber(totals.coins_number)}</TableCell>
                      <TableCell className="text-center font-mono font-bold">{formatNumber(totals.total_cost)}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-center font-mono font-bold">{formatNumber(totals.payment_amount)}</TableCell>
                      <TableCell colSpan={4} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="no-print">
            <CardContent className="py-12 text-center text-muted-foreground">
              {language === "ar"
                ? "حدد نطاق التاريخ واضغط على تشغيل التقرير"
                : "Select date range and click Run Report"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SalesOrderDetailReport;
