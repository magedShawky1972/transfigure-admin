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
import { ArrowLeft, Download, Printer, RefreshCw, Search, ChevronDown, X, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface CoinsComparisonRow {
  product_id: string;
  product_name: string;
  brand_name: string;
  total_qty: number;
  total_coins_transaction: number; // sum of coins_number from purpletransaction
  product_coins_number: number; // coins_number from products table
  expected_coins: number; // product_coins_number * total_qty
  difference: number; // total_coins_transaction - expected_coins
}

const CoinsComparisonReport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [reportData, setReportData] = useState<CoinsComparisonRow[]>([]);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");

  // Fetch brands
  const { data: brands = [] } = useQuery({
    queryKey: ["coins-comparison-brands"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brands")
        .select("brand_name")
        .eq("status", "active")
        .order("brand_name");
      return data?.map((b) => b.brand_name) || [];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["coins-comparison-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("product_id, product_name")
        .eq("status", "active")
        .order("product_name");
      return data || [];
    },
  });

  const fetchBatch = async (
    fromInt: number,
    toInt: number,
    brandFilters: string[],
    productFilters: string[],
    rangeStart: number,
    batchSize: number
  ) => {
    let query = supabase
      .from("purpletransaction")
      .select("product_id, coins_number, qty, brand_name")
      .gte("created_at_date_int", fromInt)
      .lte("created_at_date_int", toInt)
      .gt("coins_number", 0)
      .range(rangeStart, rangeStart + batchSize - 1);

    if (brandFilters.length > 0) {
      query = query.in("brand_name", brandFilters);
    }
    if (productFilters.length > 0) {
      query = query.in("product_id", productFilters);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const handleGenerateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "يرجى تحديد نطاق التاريخ" : "Please select a date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setReportData([]);

    try {
      const fromInt = parseInt(dateFrom.replace(/-/g, ""));
      const toInt = parseInt(dateTo.replace(/-/g, ""));

      // Batch fetch transactions
      const batchSize = 1000;
      let allTransactions: any[] = [];
      let rangeStart = 0;
      let hasMore = true;

      while (hasMore) {
        const batch = await fetchBatch(fromInt, toInt, selectedBrands, selectedProducts, rangeStart, batchSize);
        allTransactions = [...allTransactions, ...batch];
        setLoadingProgress({ loaded: allTransactions.length, total: allTransactions.length });
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          rangeStart += batchSize;
        }
      }

      // Aggregate by product_id
      const productMap = new Map<string, { brand_name: string; total_qty: number; total_coins: number }>();
      for (const t of allTransactions) {
        const key = t.product_id;
        const existing = productMap.get(key);
        if (existing) {
          existing.total_qty += Number(t.qty) || 0;
          existing.total_coins += Number(t.coins_number) || 0;
        } else {
          productMap.set(key, {
            brand_name: t.brand_name || "",
            total_qty: Number(t.qty) || 0,
            total_coins: Number(t.coins_number) || 0,
          });
        }
      }

      // Fetch products coins_number for matching product_ids
      const productIds = Array.from(productMap.keys());
      const productCoinsMap = new Map<string, { coins_number: number; product_name: string }>();

      // Batch fetch products
      for (let i = 0; i < productIds.length; i += 500) {
        const chunk = productIds.slice(i, i + 500);
        const { data: productsData } = await supabase
          .from("products")
          .select("product_id, product_name, coins_number")
          .in("product_id", chunk);

        if (productsData) {
          for (const p of productsData) {
            productCoinsMap.set(p.product_id, {
              coins_number: Number(p.coins_number) || 0,
              product_name: p.product_name || p.product_id,
            });
          }
        }
      }

      // Build comparison rows
      const rows: CoinsComparisonRow[] = [];
      for (const [productId, agg] of productMap) {
        const productInfo = productCoinsMap.get(productId);
        const productCoins = productInfo?.coins_number || 0;
        const expectedCoins = productCoins * agg.total_qty;
        const difference = agg.total_coins - expectedCoins;

        rows.push({
          product_id: productId,
          product_name: productInfo?.product_name || productId,
          brand_name: agg.brand_name,
          total_qty: agg.total_qty,
          total_coins_transaction: agg.total_coins,
          product_coins_number: productCoins,
          expected_coins: expectedCoins,
          difference,
        });
      }

      // Sort by absolute difference descending
      rows.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

      setReportData(rows);
      toast({
        title: isRTL ? "تم" : "Done",
        description: isRTL
          ? `تم تحميل ${rows.length} منتج للمقارنة`
          : `Loaded ${rows.length} products for comparison`,
      });
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

  const filteredData = useMemo(() => {
    if (!searchQuery) return reportData;
    const q = searchQuery.toLowerCase();
    return reportData.filter(
      (r) =>
        r.product_id.toLowerCase().includes(q) ||
        r.product_name.toLowerCase().includes(q) ||
        r.brand_name.toLowerCase().includes(q)
    );
  }, [reportData, searchQuery]);

  const summaryStats = useMemo(() => {
    const totalCoinsTransaction = filteredData.reduce((s, r) => s + r.total_coins_transaction, 0);
    const totalExpected = filteredData.reduce((s, r) => s + r.expected_coins, 0);
    const totalDifference = totalCoinsTransaction - totalExpected;
    const mismatchCount = filteredData.filter((r) => r.difference !== 0).length;
    return { totalCoinsTransaction, totalExpected, totalDifference, mismatchCount };
  }, [filteredData]);

  const handleExportExcel = () => {
    const exportData = filteredData.map((r) => ({
      [isRTL ? "رقم المنتج" : "Product ID"]: r.product_id,
      [isRTL ? "اسم المنتج" : "Product Name"]: r.product_name,
      [isRTL ? "العلامة التجارية" : "Brand"]: r.brand_name,
      [isRTL ? "الكمية" : "Qty"]: r.total_qty,
      [isRTL ? "كوينز المنتج (الإعداد)" : "Product Coins (Setup)"]: r.product_coins_number,
      [isRTL ? "الكوينز المتوقعة" : "Expected Coins"]: r.expected_coins,
      [isRTL ? "كوينز المعاملات (الفعلية)" : "Transaction Coins (Actual)"]: r.total_coins_transaction,
      [isRTL ? "الفرق" : "Difference"]: r.difference,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coins Comparison");
    XLSX.writeFile(wb, `coins-comparison-${dateFrom}-to-${dateTo}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatNumber = (n: number) => n.toLocaleString();

  const filteredBrands = brands.filter((b) =>
    b.toLowerCase().includes(brandSearchQuery.toLowerCase())
  );

  const filteredProducts = products.filter((p) =>
    p.product_name?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    p.product_id?.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 print:space-y-2" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isRTL ? "تقرير مقارنة الكوينز" : "Coins Comparison Report"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isRTL
              ? "مقارنة كوينز المعاملات الفعلية مع كوينز المنتج المتوقعة"
              : "Compare actual transaction coins vs expected product coins"}
          </p>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">
          {isRTL ? "تقرير مقارنة الكوينز" : "Coins Comparison Report"}
        </h1>
        <p className="text-sm">
          {dateFrom} → {dateTo}
        </p>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <Label>{isRTL ? "من تاريخ" : "Date From"}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            {/* Date To */}
            <div>
              <Label>{isRTL ? "إلى تاريخ" : "Date To"}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>

            {/* Brand Filter */}
            <div>
              <Label>{isRTL ? "العلامة التجارية" : "Brand"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm">
                    {selectedBrands.length > 0
                      ? `${selectedBrands.length} ${isRTL ? "محدد" : "selected"}`
                      : isRTL ? "الكل" : "All"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <Input
                      placeholder={isRTL ? "بحث..." : "Search..."}
                      value={brandSearchQuery}
                      onChange={(e) => setBrandSearchQuery(e.target.value)}
                    />
                    {selectedBrands.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBrands([])}>
                        <X className="h-3 w-3 mr-1" /> {isRTL ? "مسح الكل" : "Clear all"}
                      </Button>
                    )}
                    <ScrollArea className="h-48">
                      {filteredBrands.map((brand) => (
                        <div key={brand} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={selectedBrands.includes(brand)}
                            onCheckedChange={(checked) => {
                              setSelectedBrands(
                                checked
                                  ? [...selectedBrands, brand]
                                  : selectedBrands.filter((b) => b !== brand)
                              );
                            }}
                          />
                          <span className="text-sm">{brand}</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Product Filter */}
            <div>
              <Label>{isRTL ? "المنتج" : "Product"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-sm">
                    {selectedProducts.length > 0
                      ? `${selectedProducts.length} ${isRTL ? "محدد" : "selected"}`
                      : isRTL ? "الكل" : "All"}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <Input
                      placeholder={isRTL ? "بحث..." : "Search..."}
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                    />
                    {selectedProducts.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setSelectedProducts([])}>
                        <X className="h-3 w-3 mr-1" /> {isRTL ? "مسح الكل" : "Clear all"}
                      </Button>
                    )}
                    <ScrollArea className="h-48">
                      {filteredProducts.map((p) => (
                        <div key={p.product_id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={selectedProducts.includes(p.product_id)}
                            onCheckedChange={(checked) => {
                              setSelectedProducts(
                                checked
                                  ? [...selectedProducts, p.product_id]
                                  : selectedProducts.filter((id) => id !== p.product_id)
                              );
                            }}
                          />
                          <span className="text-sm">{p.product_name} ({p.product_id})</span>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleGenerateReport} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {isRTL ? "عرض التقرير" : "Generate Report"}
            </Button>
            {reportData.length > 0 && (
              <>
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="h-4 w-4 mr-2" />
                  {isRTL ? "تصدير Excel" : "Export Excel"}
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  {isRTL ? "طباعة" : "Print"}
                </Button>
              </>
            )}
          </div>

          {loading && loadingProgress.total > 0 && (
            <div className="mt-2">
              <Progress value={100} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL
                  ? `تم تحميل ${loadingProgress.loaded.toLocaleString()} سجل...`
                  : `Loaded ${loadingProgress.loaded.toLocaleString()} records...`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {reportData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {isRTL ? "كوينز المعاملات (الفعلية)" : "Transaction Coins (Actual)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatNumber(summaryStats.totalCoinsTransaction)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {isRTL ? "الكوينز المتوقعة" : "Expected Coins"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatNumber(summaryStats.totalExpected)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {isRTL ? "إجمالي الفرق" : "Total Difference"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${summaryStats.totalDifference !== 0 ? "text-destructive" : "text-green-600"}`}>
                {formatNumber(summaryStats.totalDifference)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {isRTL ? "منتجات غير متطابقة" : "Mismatched Products"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${summaryStats.mismatchCount > 0 ? "text-destructive" : "text-green-600"}`}>
                  {summaryStats.mismatchCount}
                </p>
                <span className="text-sm text-muted-foreground">/ {filteredData.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      {reportData.length > 0 && (
        <div className="print:hidden">
          <Input
            placeholder={isRTL ? "بحث في النتائج..." : "Search results..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {/* Table */}
      {filteredData.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">#</TableHead>
                    <TableHead>{isRTL ? "رقم المنتج" : "Product ID"}</TableHead>
                    <TableHead>{isRTL ? "اسم المنتج" : "Product Name"}</TableHead>
                    <TableHead>{isRTL ? "العلامة التجارية" : "Brand"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "كوينز المنتج" : "Product Coins"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الكوينز المتوقعة" : "Expected Coins"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "كوينز المعاملات" : "Transaction Coins"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الفرق" : "Difference"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row, idx) => (
                    <TableRow key={row.product_id} className={row.difference !== 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{row.product_id}</TableCell>
                      <TableCell>{row.product_name}</TableCell>
                      <TableCell>{row.brand_name}</TableCell>
                      <TableCell className="text-center">{formatNumber(row.total_qty)}</TableCell>
                      <TableCell className="text-center">{formatNumber(row.product_coins_number)}</TableCell>
                      <TableCell className="text-center font-medium">{formatNumber(row.expected_coins)}</TableCell>
                      <TableCell className="text-center font-medium">{formatNumber(row.total_coins_transaction)}</TableCell>
                      <TableCell className={`text-center font-bold ${row.difference !== 0 ? "text-destructive" : "text-green-600"}`}>
                        {formatNumber(row.difference)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.difference === 0 ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {isRTL ? "متطابق" : "Match"}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {isRTL ? "غير متطابق" : "Mismatch"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CoinsComparisonReport;
