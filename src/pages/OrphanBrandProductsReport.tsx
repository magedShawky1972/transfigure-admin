import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Download, Printer, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

interface ProductRow {
  id: string;
  product_name: string;
  sku: string | null;
  brand_code: string | null;
  brand_name: string | null;
  product_price: string | null;
  status: string;
}

const OrphanBrandProductsReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isRTL = language === "ar";

  const [orphanProducts, setOrphanProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchOrphanProducts();
  }, []);

  const fetchOrphanProducts = async () => {
    setLoading(true);
    try {
      // Fetch all brand codes from brands table
      const { data: brands, error: brandsError } = await supabase
        .from("brands")
        .select("brand_code");

      if (brandsError) throw brandsError;

      const validBrandCodes = new Set(
        (brands || [])
          .map(b => b.brand_code)
          .filter(Boolean)
          .map(c => c!.toLowerCase())
      );

      // Fetch all products in batches
      let allProducts: ProductRow[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("products")
          .select("id, product_name, sku, brand_code, brand_name, product_price, status")
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allProducts = [...allProducts, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Filter products whose brand_code doesn't exist in brands
      const orphans = allProducts.filter(p => {
        if (!p.brand_code) return true; // no brand_code at all
        return !validBrandCodes.has(p.brand_code.toLowerCase());
      });

      setOrphanProducts(orphans);
    } catch (error) {
      console.error("Error fetching orphan products:", error);
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل في تحميل البيانات" : "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filtered = orphanProducts.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.product_name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.brand_code?.toLowerCase().includes(term) ||
      p.brand_name?.toLowerCase().includes(term)
    );
  });

  // Group by brand_code for summary
  const brandCodeGroups = filtered.reduce((acc, p) => {
    const key = p.brand_code || (isRTL ? "(بدون كود)" : "(No Code)");
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, ProductRow[]>);

  const handleExport = () => {
    const rows = filtered.map(p => ({
      [isRTL ? "اسم المنتج" : "Product Name"]: p.product_name,
      SKU: p.sku || "",
      [isRTL ? "كود البراند" : "Brand Code"]: p.brand_code || "",
      [isRTL ? "اسم البراند" : "Brand Name"]: p.brand_name || "",
      [isRTL ? "السعر" : "Price"]: p.product_price || "",
      [isRTL ? "الحالة" : "Status"]: p.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orphan Brand Products");
    XLSX.writeFile(wb, "orphan_brand_products.xlsx");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isRTL ? "تقرير منتجات بدون براند" : "Orphan Brand Products Report"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL
                ? "المنتجات المرتبطة ببراند غير موجود في إعداد البراندات"
                : "Products linked to brands that don't exist in Brand Setup"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            {isRTL ? "تصدير" : "Export"}
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            {isRTL ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={isRTL ? "بحث بالاسم أو SKU أو كود البراند..." : "Search by name, SKU or brand code..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-destructive">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "إجمالي المنتجات" : "Total Products"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-orange-500">{Object.keys(brandCodeGroups).length}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "براندات مفقودة" : "Missing Brands"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{isRTL ? "اسم المنتج" : "Product Name"}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>{isRTL ? "كود البراند" : "Brand Code"}</TableHead>
                      <TableHead>{isRTL ? "اسم البراند" : "Brand Name"}</TableHead>
                      <TableHead>{isRTL ? "السعر" : "Price"}</TableHead>
                      <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          {isRTL ? "لا توجد منتجات بدون براند" : "No orphan brand products found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((p, idx) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{p.product_name}</TableCell>
                          <TableCell>{p.sku || "-"}</TableCell>
                          <TableCell className="text-destructive font-medium">{p.brand_code || "-"}</TableCell>
                          <TableCell>{p.brand_name || "-"}</TableCell>
                          <TableCell>{p.product_price || "-"}</TableCell>
                          <TableCell>{p.status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default OrphanBrandProductsReport;
