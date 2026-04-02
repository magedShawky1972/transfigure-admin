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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Download, Printer, ArrowLeft, Copy } from "lucide-react";
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

interface DuplicateGroup {
  sku: string;
  products: ProductRow[];
}

const DuplicateSkuReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, sku, brand_code, brand_name, product_price, status")
        .not("sku", "is", null)
        .neq("sku", "")
        .order("sku", { ascending: true })
        .order("product_name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);

      const uniqueBrands = [...new Set((data || []).map(p => p.brand_name).filter(Boolean))] as string[];
      setBrands(uniqueBrands.sort());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const duplicateGroups: DuplicateGroup[] = (() => {
    const skuMap: Record<string, ProductRow[]> = {};
    for (const p of products) {
      if (!p.sku) continue;
      const key = p.sku.trim().toLowerCase();
      if (!skuMap[key]) skuMap[key] = [];
      skuMap[key].push(p);
    }

    return Object.entries(skuMap)
      .filter(([, prods]) => prods.length > 1)
      .map(([, prods]) => ({ sku: prods[0].sku!, products: prods }))
      .filter(g => {
        const matchesSearch =
          !searchTerm ||
          g.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          g.products.some(p =>
            p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.brand_name?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        const matchesBrand =
          brandFilter === "all" ||
          g.products.some(p => p.brand_name === brandFilter);
        return matchesSearch && matchesBrand;
      })
      .sort((a, b) => b.products.length - a.products.length);
  })();

  const totalDuplicateProducts = duplicateGroups.reduce((sum, g) => sum + g.products.length, 0);

  const handleExportExcel = () => {
    const rows: any[] = [];
    duplicateGroups.forEach(g => {
      g.products.forEach((p, idx) => {
        rows.push({
          SKU: g.sku,
          "#": idx + 1,
          [language === "ar" ? "اسم المنتج" : "Product Name"]: p.product_name,
          [language === "ar" ? "كود البراند" : "Brand Code"]: p.brand_code || "",
          [language === "ar" ? "اسم البراند" : "Brand Name"]: p.brand_name || "",
          [language === "ar" ? "السعر" : "Price"]: p.product_price || "",
          [language === "ar" ? "الحالة" : "Status"]: p.status,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Duplicate SKUs");
    XLSX.writeFile(wb, `duplicate_sku_report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({
      title: language === "ar" ? "تم التصدير" : "Exported",
      description: language === "ar" ? "تم تصدير التقرير بنجاح" : "Report exported successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Copy className="h-6 w-6" />
            {language === "ar" ? "تقرير SKU المكررة" : "Duplicate SKU Report"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {language === "ar"
              ? `${duplicateGroups.length} SKU مكرر — ${totalDuplicateProducts} منتج`
              : `${duplicateGroups.length} duplicate SKUs — ${totalDuplicateProducts} products`}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportExcel} disabled={duplicateGroups.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          {language === "ar" ? "تصدير Excel" : "Export Excel"}
        </Button>
        <Button variant="outline" onClick={() => window.print()} disabled={duplicateGroups.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          {language === "ar" ? "طباعة" : "Print"}
        </Button>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث بالاسم، SKU، براند..." : "Search by name, SKU, brand..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === "ar" ? "كل البراندات" : "All Brands"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "كل البراندات" : "All Brands"}</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-center">
          {language === "ar" ? "تقرير SKU المكررة" : "Duplicate SKU Report"}
        </h1>
        <p className="text-center text-sm text-muted-foreground mt-1">
          {language === "ar" ? "تاريخ الطباعة:" : "Print Date:"}{" "}
          {new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
          {" | "}
          {language === "ar" ? "عدد SKU مكرر:" : "Duplicate SKUs:"} {duplicateGroups.length}
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : duplicateGroups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground print:hidden">
          {language === "ar" ? "لا توجد SKU مكررة" : "No duplicate SKUs found"}
        </div>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((group) => (
            <Card key={group.sku} className="print:shadow-none print:border print:break-inside-avoid">
              <CardContent className="p-0">
                <div className="px-4 py-3 bg-muted/50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-primary text-lg">{group.sku}</span>
                    <span className="text-sm text-muted-foreground">
                      ({group.products.length} {language === "ar" ? "منتجات" : "products"})
                    </span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center">#</TableHead>
                      <TableHead>{language === "ar" ? "اسم المنتج" : "Product Name"}</TableHead>
                      <TableHead>{language === "ar" ? "كود البراند" : "Brand Code"}</TableHead>
                      <TableHead>{language === "ar" ? "اسم البراند" : "Brand Name"}</TableHead>
                      <TableHead>{language === "ar" ? "السعر" : "Price"}</TableHead>
                      <TableHead className="print:hidden">{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.products.map((p, idx) => (
                      <TableRow key={p.id} className="print:text-xs">
                        <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{p.product_name}</TableCell>
                        <TableCell className="font-mono text-sm">{p.brand_code || "-"}</TableCell>
                        <TableCell>{p.brand_name || "-"}</TableCell>
                        <TableCell>{p.product_price || "-"}</TableCell>
                        <TableCell className="print:hidden">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            p.status === "active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}>
                            {p.status === "active"
                              ? (language === "ar" ? "نشط" : "Active")
                              : (language === "ar" ? "غير نشط" : "Inactive")}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DuplicateSkuReport;
