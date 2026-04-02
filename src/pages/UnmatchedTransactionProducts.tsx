import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Download, Search, Printer, ArrowLeft, ArrowRightLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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
  const [data, setData] = useState<UnmatchedProduct[]>([]);
  const [orphanData, setOrphanData] = useState<OrphanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("unmatched");

  useEffect(() => {
    fetchData();
  }, [viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (viewMode === "unmatched") {
        await fetchUnmatched();
      } else {
        await fetchNoTransactions();
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnmatched = async () => {
    const { data: txProducts, error: txError } = await supabase
      .from("purpletransaction")
      .select("product_id, product_name, brand_name, brand_code")
      .not("product_id", "is", null);
    if (txError) throw txError;

    const { data: products, error: pError } = await supabase
      .from("products")
      .select("product_id");
    if (pError) throw pError;

    const productIdSet = new Set(products?.map(p => p.product_id) || []);
    const unmatchedMap = new Map<string, UnmatchedProduct>();

    txProducts?.forEach(tx => {
      if (!tx.product_id || productIdSet.has(tx.product_id)) return;
      const existing = unmatchedMap.get(tx.product_id);
      if (existing) {
        existing.transaction_count++;
      } else {
        unmatchedMap.set(tx.product_id, {
          product_id: tx.product_id,
          product_name: tx.product_name || "",
          brand_name: tx.brand_name || "",
          brand_code: tx.brand_code || "",
          transaction_count: 1,
        });
      }
    });

    setData(Array.from(unmatchedMap.values()).sort((a, b) => b.transaction_count - a.transaction_count));
  };

  const fetchNoTransactions = async () => {
    // Use existing RPC to get distinct transaction product_ids efficiently
    const { data: txIds, error: txError } = await supabase.rpc("get_distinct_transaction_product_ids");
    if (txError) throw txError;
    const txIdSet = new Set<string>((txIds || []).map((t: any) => t.product_id));

    // Get all products in batches
    let allProducts: OrphanProduct[] = [];
    from = 0;
    hasMore = true;

    while (hasMore) {
      const { data: pBatch, error } = await supabase
        .from("products")
        .select("product_id, product_name, brand_name, brand_code, sku, status")
        .range(from, from + batchSize - 1);
      if (error) throw error;
      if (pBatch && pBatch.length > 0) {
        pBatch.forEach(p => {
          if (!p.product_id || !txIdSet.has(p.product_id)) {
            allProducts.push({
              product_id: p.product_id || "",
              product_name: p.product_name || "",
              brand_name: p.brand_name || "",
              brand_code: p.brand_code || "",
              sku: p.sku || "",
              status: p.status || "",
            });
          }
        });
        hasMore = pBatch.length === batchSize;
        from += batchSize;
      } else {
        hasMore = false;
      }
    }

    setOrphanData(allProducts);
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
        [language === "ar" ? "رقم المنتج" : "Product ID"]: item.product_id,
        [language === "ar" ? "اسم المنتج" : "Product Name"]: item.product_name,
        [language === "ar" ? "اسم البراند" : "Brand Name"]: item.brand_name,
        [language === "ar" ? "كود البراند" : "Brand Code"]: item.brand_code,
        [language === "ar" ? "عدد المعاملات" : "Transaction Count"]: item.transaction_count,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Unmatched Products");
      XLSX.writeFile(wb, "unmatched_transaction_products.xlsx");
    } else {
      const ws = XLSX.utils.json_to_sheet((filtered as OrphanProduct[]).map(item => ({
        [language === "ar" ? "رقم المنتج" : "Product ID"]: item.product_id,
        [language === "ar" ? "اسم المنتج" : "Product Name"]: item.product_name,
        SKU: item.sku,
        [language === "ar" ? "اسم البراند" : "Brand Name"]: item.brand_name,
        [language === "ar" ? "كود البراند" : "Brand Code"]: item.brand_code,
        [language === "ar" ? "الحالة" : "Status"]: item.status,
      })));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products Without Transactions");
      XLSX.writeFile(wb, "products_without_transactions.xlsx");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {language === "ar" ? "منتجات المعاملات غير المطابقة" : "Unmatched Transaction Products"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {viewMode === "unmatched"
                ? (language === "ar"
                  ? "منتجات موجودة في المعاملات ولكن غير موجودة في جدول المنتجات"
                  : "Products found in transactions but missing from the products table")
                : (language === "ar"
                  ? "منتجات موجودة في جدول المنتجات ولكن ليس لها معاملات"
                  : "Products in product setup with no transactions")}
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تصدير Excel" : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => { setSearch(""); setViewMode(v as ViewMode); }} className="print:hidden">
        <TabsList>
          <TabsTrigger value="unmatched" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {language === "ar" ? "في المعاملات وليس في المنتجات" : "In Transactions, Not in Products"}
          </TabsTrigger>
          <TabsTrigger value="no-transactions" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {language === "ar" ? "في المنتجات وليس في المعاملات" : "In Products, Not in Transactions"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {language === "ar" ? `إجمالي: ${filtered.length} منتج` : `Total: ${filtered.length} products`}
            </CardTitle>
            <div className="relative w-72 print:hidden">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === "ar" ? "بحث..." : "Search..."}
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
                    <TableHead>{language === "ar" ? "رقم المنتج" : "Product ID"}</TableHead>
                    <TableHead>{language === "ar" ? "اسم المنتج" : "Product Name"}</TableHead>
                    <TableHead>{language === "ar" ? "اسم البراند" : "Brand Name"}</TableHead>
                    <TableHead>{language === "ar" ? "كود البراند" : "Brand Code"}</TableHead>
                    <TableHead className="text-center">{language === "ar" ? "عدد المعاملات" : "Txn Count"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filtered as UnmatchedProduct[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد منتجات غير مطابقة" : "No unmatched products found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filtered as UnmatchedProduct[]).map((item, idx) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">{item.product_id}</TableCell>
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
                    <TableHead>{language === "ar" ? "رقم المنتج" : "Product ID"}</TableHead>
                    <TableHead>{language === "ar" ? "اسم المنتج" : "Product Name"}</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>{language === "ar" ? "اسم البراند" : "Brand Name"}</TableHead>
                    <TableHead>{language === "ar" ? "كود البراند" : "Brand Code"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filtered as OrphanProduct[]).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد منتجات بدون معاملات" : "No products without transactions found"}
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
    </div>
  );
};

export default UnmatchedTransactionProducts;
