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
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get distinct product_ids from purpletransaction
      const { data: txProducts, error: txError } = await supabase
        .from("purpletransaction")
        .select("product_id, product_name, brand_name, brand_code")
        .not("product_id", "is", null);

      if (txError) throw txError;

      // Get all product_ids from products table
      const { data: products, error: pError } = await supabase
        .from("products")
        .select("product_id");

      if (pError) throw pError;

      const productIdSet = new Set(products?.map(p => p.product_id) || []);

      // Group by product_id and count, filter those not in products
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
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.filter(item =>
    item.product_id.toLowerCase().includes(search.toLowerCase()) ||
    item.product_name.toLowerCase().includes(search.toLowerCase()) ||
    item.brand_name.toLowerCase().includes(search.toLowerCase()) ||
    item.brand_code.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(item => ({
      [language === "ar" ? "رقم المنتج" : "Product ID"]: item.product_id,
      [language === "ar" ? "اسم المنتج" : "Product Name"]: item.product_name,
      [language === "ar" ? "اسم البراند" : "Brand Name"]: item.brand_name,
      [language === "ar" ? "كود البراند" : "Brand Code"]: item.brand_code,
      [language === "ar" ? "عدد المعاملات" : "Transaction Count"]: item.transaction_count,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Unmatched Products");
    XLSX.writeFile(wb, "unmatched_transaction_products.xlsx");
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
              {language === "ar"
                ? "منتجات موجودة في المعاملات ولكن غير موجودة في جدول المنتجات"
                : "Products found in transactions but missing from the products table"}
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
          ) : (
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
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد منتجات غير مطابقة" : "No unmatched products found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item, idx) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnmatchedTransactionProducts;
