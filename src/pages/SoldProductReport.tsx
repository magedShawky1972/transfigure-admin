import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Download, Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";

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
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<SoldProduct[]>([]);

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

  // Fetch products - filter by selected brand
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-report", selectedBrand],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, product_name, brand_name")
        .eq("status", "active")
        .order("product_name");
      
      if (selectedBrand !== "all") {
        query = query.eq("brand_name", selectedBrand);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Reset product selection when brand changes
  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setSelectedProduct("all");
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

      if (selectedBrand !== "all") {
        query = query.eq("brand_name", selectedBrand);
      }

      if (selectedProduct !== "all") {
        query = query.eq("product_name", selectedProduct);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <Select value={selectedBrand} onValueChange={handleBrandChange}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "اختر العلامة" : "Select Brand"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.brand_name}>
                      {brand.brand_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "المنتج" : "Product"}</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder={isRTL ? "اختر المنتج" : "Select Product"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.product_name}>
                      {product.product_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
