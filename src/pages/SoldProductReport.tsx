import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, Printer, RefreshCw, Search, ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SoldProduct {
  brand_name: string;
  product_name: string;
  unit_price: number;
  qty: number;
  total: number;
}

interface ProductSummary {
  brand_name: string;
  product_name: string;
  total_qty: number;
  total_value: number;
  avg_unit_price: number;
}

interface BrandTotal {
  brand_name: string;
  total_qty: number;
  total_value: number;
}

const SoldProductReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<SoldProduct[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [paymentMethodSearchQuery, setPaymentMethodSearchQuery] = useState("");

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ["brands-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, brand_name")
        .eq("status", "active")
        .order("brand_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products - filter by selected brands
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-report", selectedBrands],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, product_name, brand_name")
        .eq("status", "active")
        .order("product_name");
      
      if (selectedBrands.length > 0) {
        query = query.in("brand_name", selectedBrands);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payment methods - use multiple queries to get all unique values
  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods-for-report"],
    queryFn: async () => {
      // Fetch distinct payment methods by querying with different filters
      const allPaymentMethods = new Set<string>();
      
      // Query for each potential payment method type to ensure we get all
      const knownMethods = ['hyperpay', 'salla', 'cod', 'ecom_payment', 'point'];
      
      for (const method of knownMethods) {
        const { data } = await supabase
          .from("purpletransaction")
          .select("payment_method")
          .eq("payment_method", method)
          .limit(1);
        if (data && data.length > 0 && data[0].payment_method) {
          allPaymentMethods.add(data[0].payment_method);
        }
      }
      
      // Also fetch any other payment methods not in the known list
      const { data: otherData } = await supabase
        .from("purpletransaction")
        .select("payment_method")
        .not("payment_method", "in", `(${knownMethods.join(",")})`)
        .neq("payment_method", null)
        .limit(100);
      
      if (otherData) {
        otherData.forEach(d => {
          if (d.payment_method) allPaymentMethods.add(d.payment_method);
        });
      }
      
      return Array.from(allPaymentMethods).sort();
    },
  });

  // Reset product selection when brands change
  const handleBrandToggle = (brandName: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brandName)
        ? prev.filter((b) => b !== brandName)
        : [...prev, brandName]
    );
    setSelectedProducts([]);
  };

  const handleProductToggle = (productName: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productName)
        ? prev.filter((p) => p !== productName)
        : [...prev, productName]
    );
  };

  const clearBrands = () => {
    setSelectedBrands([]);
    setSelectedProducts([]);
  };

  const clearProducts = () => {
    setSelectedProducts([]);
  };

  const handlePaymentMethodToggle = (method: string) => {
    setSelectedPaymentMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
  };

  const clearPaymentMethods = () => {
    setSelectedPaymentMethods([]);
  };

  const fetchReportData = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "يرجى تحديد نطاق التاريخ" : "Please select date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("purpletransaction")
        .select("brand_name, product_name, unit_price, qty, total")
        .gte("created_at_date", dateFrom)
        .lte("created_at_date", dateTo)
        .neq("is_deleted", true);

      if (selectedBrands.length > 0) {
        query = query.in("brand_name", selectedBrands);
      }

      if (selectedProducts.length > 0) {
        query = query.in("product_name", selectedProducts);
      }

      if (selectedPaymentMethods.length > 0) {
        query = query.in("payment_method", selectedPaymentMethods);
      }

      const { data, error } = await query.order("brand_name").order("product_name");

      if (error) throw error;

      const processedData: SoldProduct[] = (data || []).map((item) => ({
        brand_name: item.brand_name || "",
        product_name: item.product_name || "",
        unit_price: parseFloat(String(item.unit_price || 0).replace(/,/g, "")) || 0,
        qty: parseFloat(String(item.qty || 0).replace(/,/g, "")) || 0,
        total: parseFloat(String(item.total || 0).replace(/,/g, "")) || 0,
      }));

      setReportData(processedData);

      toast({
        title: isRTL ? "تم" : "Success",
        description: isRTL
          ? `تم تحميل ${processedData.length} سجل`
          : `Loaded ${processedData.length} records`,
      });
    } catch (error: any) {
      console.error("Error fetching report:", error);
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!searchQuery) return reportData;
    const query = searchQuery.toLowerCase();
    return reportData.filter(
      (item) =>
        item.brand_name.toLowerCase().includes(query) ||
        item.product_name.toLowerCase().includes(query)
    );
  }, [reportData, searchQuery]);

  // Summarize by product (aggregate qty and total for each product)
  const productSummary = useMemo((): ProductSummary[] => {
    const summaryMap: Record<string, ProductSummary> = {};
    
    filteredData.forEach((item) => {
      const key = `${item.brand_name}|${item.product_name}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          brand_name: item.brand_name,
          product_name: item.product_name,
          total_qty: 0,
          total_value: 0,
          avg_unit_price: 0,
        };
      }
      summaryMap[key].total_qty += item.qty;
      summaryMap[key].total_value += item.total;
    });

    // Calculate average unit price
    Object.values(summaryMap).forEach((summary) => {
      summary.avg_unit_price = summary.total_qty > 0 
        ? summary.total_value / summary.total_qty 
        : 0;
    });

    return Object.values(summaryMap).sort((a, b) => 
      a.brand_name.localeCompare(b.brand_name) || a.product_name.localeCompare(b.product_name)
    );
  }, [filteredData]);

  // Group summarized products by brand
  const groupedData = useMemo(() => {
    const brandGroups: Record<string, ProductSummary[]> = {};
    
    productSummary.forEach((item) => {
      if (!brandGroups[item.brand_name]) {
        brandGroups[item.brand_name] = [];
      }
      brandGroups[item.brand_name].push(item);
    });

    return brandGroups;
  }, [productSummary]);

  // Calculate brand totals
  const brandTotals = useMemo((): BrandTotal[] => {
    return Object.entries(groupedData).map(([brand_name, items]) => ({
      brand_name,
      total_qty: items.reduce((sum, item) => sum + item.total_qty, 0),
      total_value: items.reduce((sum, item) => sum + item.total_value, 0),
    }));
  }, [groupedData]);

  // Grand totals
  const grandTotals = useMemo(() => {
    return {
      qty: brandTotals.reduce((sum, bt) => sum + bt.total_qty, 0),
      value: brandTotals.reduce((sum, bt) => sum + bt.total_value, 0),
    };
  }, [brandTotals]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const exportToExcel = () => {
    const exportData: any[] = [];

    Object.entries(groupedData).forEach(([brandName, items]) => {
      items.forEach((item) => {
        exportData.push({
          [isRTL ? "العلامة التجارية" : "Brand"]: item.brand_name,
          [isRTL ? "المنتج" : "Product"]: item.product_name,
          [isRTL ? "متوسط سعر الوحدة" : "Avg Unit Price"]: item.avg_unit_price,
          [isRTL ? "الكمية" : "Qty"]: item.total_qty,
          [isRTL ? "الإجمالي" : "Total"]: item.total_value,
        });
      });

      const brandTotal = brandTotals.find((bt) => bt.brand_name === brandName);
      if (brandTotal) {
        exportData.push({
          [isRTL ? "العلامة التجارية" : "Brand"]: `${isRTL ? "إجمالي" : "Total"} ${brandName}`,
          [isRTL ? "المنتج" : "Product"]: "",
          [isRTL ? "سعر الوحدة" : "Unit Price"]: "",
          [isRTL ? "الكمية" : "Qty"]: brandTotal.total_qty,
          [isRTL ? "الإجمالي" : "Total"]: brandTotal.total_value,
        });
      }
    });

    exportData.push({
      [isRTL ? "العلامة التجارية" : "Brand"]: isRTL ? "الإجمالي الكلي" : "Grand Total",
      [isRTL ? "المنتج" : "Product"]: "",
      [isRTL ? "سعر الوحدة" : "Unit Price"]: "",
      [isRTL ? "الكمية" : "Qty"]: grandTotals.qty,
      [isRTL ? "الإجمالي" : "Total"]: grandTotals.value,
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تقرير المبيعات" : "Sold Products");
    XLSX.writeFile(wb, `sold_products_${dateFrom}_${dateTo}.xlsx`);

    toast({
      title: isRTL ? "تم التصدير" : "Exported",
      description: isRTL ? "تم تصدير التقرير بنجاح" : "Report exported successfully",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {isRTL ? "تقرير المنتجات المباعة" : "Sold Product Report"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {reportData.length > 0 && (
            <>
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 me-2" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 me-2" />
                {isRTL ? "طباعة" : "Print"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{isRTL ? "الفلاتر" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "العلامة التجارية" : "Brand"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {selectedBrands.length === 0
                        ? (isRTL ? "الكل" : "All")
                        : selectedBrands.length === 1
                        ? selectedBrands[0]
                        : `${selectedBrands.length} ${isRTL ? "محدد" : "selected"}`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-popover border" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder={isRTL ? "بحث..." : "Search..."}
                      value={brandSearchQuery}
                      onChange={(e) => setBrandSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-2 space-y-1">
                      {brands
                        .filter((brand) =>
                          brand.brand_name.toLowerCase().includes(brandSearchQuery.toLowerCase())
                        )
                        .map((brand) => (
                          <div
                            key={brand.id}
                            className="flex items-center space-x-2 rtl:space-x-reverse p-2 hover:bg-muted rounded cursor-pointer"
                            onClick={() => handleBrandToggle(brand.brand_name)}
                          >
                            <Checkbox
                              checked={selectedBrands.includes(brand.brand_name)}
                              onCheckedChange={() => handleBrandToggle(brand.brand_name)}
                            />
                            <span className="text-sm">{brand.brand_name}</span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                  {selectedBrands.length > 0 && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" onClick={clearBrands} className="w-full">
                        <X className="h-4 w-4 me-2" />
                        {isRTL ? "مسح الكل" : "Clear All"}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "المنتج" : "Product"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {selectedProducts.length === 0
                        ? (isRTL ? "الكل" : "All")
                        : selectedProducts.length === 1
                        ? selectedProducts[0]
                        : `${selectedProducts.length} ${isRTL ? "محدد" : "selected"}`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-popover border" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder={isRTL ? "بحث..." : "Search..."}
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-2 space-y-1">
                      {products
                        .filter((product) =>
                          product.product_name.toLowerCase().includes(productSearchQuery.toLowerCase())
                        )
                        .map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center space-x-2 rtl:space-x-reverse p-2 hover:bg-muted rounded cursor-pointer"
                            onClick={() => handleProductToggle(product.product_name)}
                          >
                            <Checkbox
                              checked={selectedProducts.includes(product.product_name)}
                              onCheckedChange={() => handleProductToggle(product.product_name)}
                            />
                            <span className="text-sm">{product.product_name}</span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                  {selectedProducts.length > 0 && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" onClick={clearProducts} className="w-full">
                        <X className="h-4 w-4 me-2" />
                        {isRTL ? "مسح الكل" : "Clear All"}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "طريقة الدفع" : "Payment Method"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="truncate">
                      {selectedPaymentMethods.length === 0
                        ? (isRTL ? "الكل" : "All")
                        : selectedPaymentMethods.length === 1
                        ? selectedPaymentMethods[0]
                        : `${selectedPaymentMethods.length} ${isRTL ? "محدد" : "selected"}`}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0 bg-popover border" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder={isRTL ? "بحث..." : "Search..."}
                      value={paymentMethodSearchQuery}
                      onChange={(e) => setPaymentMethodSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-2 space-y-1">
                      {paymentMethods
                        .filter((method) =>
                          method.toLowerCase().includes(paymentMethodSearchQuery.toLowerCase())
                        )
                        .map((method) => (
                          <div
                            key={method}
                            className="flex items-center space-x-2 rtl:space-x-reverse p-2 hover:bg-muted rounded cursor-pointer"
                            onClick={() => handlePaymentMethodToggle(method)}
                          >
                            <Checkbox
                              checked={selectedPaymentMethods.includes(method)}
                              onCheckedChange={() => handlePaymentMethodToggle(method)}
                            />
                            <span className="text-sm">{method}</span>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                  {selectedPaymentMethods.length > 0 && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" onClick={clearPaymentMethods} className="w-full">
                        <X className="h-4 w-4 me-2" />
                        {isRTL ? "مسح الكل" : "Clear All"}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={fetchReportData} disabled={loading} className="w-full">
                {loading ? (
                  <RefreshCw className="h-4 w-4 me-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 me-2" />
                )}
                {isRTL ? "عرض التقرير" : "Run Report"}
              </Button>
            </div>
          </div>

          {reportData.length > 0 && (
            <div className="mt-4">
              <Input
                placeholder={isRTL ? "بحث في النتائج..." : "Search results..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "black" }}>
          {isRTL ? "تقرير المنتجات المباعة" : "Sold Product Report"}
        </h1>
        <p style={{ color: "black" }}>
          {dateFrom} - {dateTo}
        </p>
      </div>

      {/* Report Table */}
      {reportData.length > 0 && (
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="print:hidden flex flex-row items-center justify-between">
            <CardTitle>{isRTL ? "النتائج" : "Results"}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 me-2" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 me-2" />
                {isRTL ? "طباعة" : "Print"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="print-no-border print-black-text">
                <TableHeader>
                  <TableRow className="print:border-none">
                    <TableHead className="print:border-none font-bold">
                      {isRTL ? "العلامة التجارية" : "Brand"}
                    </TableHead>
                    <TableHead className="print:border-none font-bold">
                      {isRTL ? "المنتج" : "Product"}
                    </TableHead>
                    <TableHead className="print:border-none text-end font-bold">
                      {isRTL ? "سعر الوحدة" : "Unit Price"}
                    </TableHead>
                    <TableHead className="print:border-none text-end font-bold">
                      {isRTL ? "الكمية" : "Qty"}
                    </TableHead>
                    <TableHead className="print:border-none text-end font-bold">
                      {isRTL ? "الإجمالي" : "Total"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groupedData).map(([brandName, items]) => {
                    const brandTotal = brandTotals.find(
                      (bt) => bt.brand_name === brandName
                    );
                    return (
                      <>
                        {items.map((item, index) => (
                          <TableRow
                            key={`${brandName}-${index}`}
                            className="print:border-none"
                          >
                            <TableCell className="print:border-none">
                              {index === 0 ? item.brand_name : ""}
                            </TableCell>
                            <TableCell className="print:border-none">
                              {item.product_name}
                            </TableCell>
                            <TableCell className="print:border-none text-end">
                              {formatCurrency(item.avg_unit_price)}
                            </TableCell>
                            <TableCell className="print:border-none text-end">
                              {item.total_qty}
                            </TableCell>
                            <TableCell className="print:border-none text-end">
                              {formatCurrency(item.total_value)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Brand Total Row */}
                        <TableRow className="print:border-none bg-muted/50 font-semibold">
                          <TableCell colSpan={3} className="print:border-none font-bold">
                            {isRTL ? `إجمالي ${brandName}` : `${brandName} Total`}
                          </TableCell>
                          <TableCell className="print:border-none text-end font-bold">
                            {brandTotal?.total_qty}
                          </TableCell>
                          <TableCell className="print:border-none text-end font-bold">
                            {formatCurrency(brandTotal?.total_value || 0)}
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })}
                  {/* Grand Total Row */}
                  <TableRow className="print:border-none bg-primary/10 font-bold">
                    <TableCell colSpan={3} className="print:border-none font-bold">
                      {isRTL ? "الإجمالي الكلي" : "Grand Total"}
                    </TableCell>
                    <TableCell className="print:border-none text-end font-bold">
                      {grandTotals.qty}
                    </TableCell>
                    <TableCell className="print:border-none text-end font-bold">
                      {formatCurrency(grandTotals.value)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportData.length === 0 && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {isRTL
              ? "اختر نطاق التاريخ واضغط على عرض التقرير"
              : "Select date range and click Run Report"}
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .p-6, .p-6 * {
            visibility: visible;
          }
          .p-6 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:border-none,
          .print\\:border-none * {
            border: none !important;
          }
          .print-no-border,
          .print-no-border *,
          .print-no-border tr,
          .print-no-border td,
          .print-no-border th {
            border: none !important;
            box-shadow: none !important;
          }
          .print-black-text,
          .print-black-text * {
            color: black !important;
          }
          table {
            border-collapse: collapse;
          }
          th, td {
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default SoldProductReport;
