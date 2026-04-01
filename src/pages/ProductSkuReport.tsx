import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Download, Printer, ArrowLeft, Package, Pencil, Check, X, Wand2 } from "lucide-react";
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

const ProductSkuReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [brands, setBrands] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_name, sku, brand_code, brand_name, product_price, status")
        .order("brand_name", { ascending: true })
        .order("product_name", { ascending: true });

      if (error) throw error;

      setProducts(data || []);

      // Extract unique brand names
      const uniqueBrands = [...new Set((data || []).map(p => p.brand_name).filter(Boolean))] as string[];
      setBrands(uniqueBrands.sort());
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      !searchTerm ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBrand = brandFilter === "all" || p.brand_name === brandFilter;
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesPrice =
      priceFilter === "all" ||
      (priceFilter === "with_price" && p.product_price && p.product_price !== "0") ||
      (priceFilter === "no_price" && (!p.product_price || p.product_price === "0"));

    return matchesSearch && matchesBrand && matchesStatus && matchesPrice;
  });
  const generateSkuForProduct = (product: ProductRow): string | null => {
    if (!product.brand_name) return null;
    
    // Find all SKUs for the same brand_name (not brand_code)
    const brandSkus = products
      .filter(p => p.brand_name === product.brand_name && p.sku)
      .map(p => p.sku!);
    
    if (brandSkus.length === 0) return null;
    
    // Find the common prefix pattern (letters) and extract numbers
    const patterns = brandSkus.map(sku => {
      const match = sku.match(/^([A-Za-z]+)(\d+)$/);
      return match ? { prefix: match[1], num: parseInt(match[2], 10), digits: match[2].length } : null;
    }).filter(Boolean) as { prefix: string; num: number; digits: number }[];
    
    if (patterns.length === 0) return null;
    
    // Use the most common prefix
    const prefixCounts: Record<string, { count: number; digits: number }> = {};
    for (const p of patterns) {
      if (!prefixCounts[p.prefix]) prefixCounts[p.prefix] = { count: 0, digits: p.digits };
      prefixCounts[p.prefix].count++;
    }
    const bestPrefix = Object.entries(prefixCounts).sort((a, b) => b[1].count - a[1].count)[0][0];
    const digitLength = prefixCounts[bestPrefix].digits;
    
    // Find max number with that prefix across ALL products (not just same brand)
    const allSkusWithPrefix = products
      .filter(p => p.sku)
      .map(p => {
        const match = p.sku!.match(/^([A-Za-z]+)(\d+)$/);
        return match && match[1] === bestPrefix ? parseInt(match[2], 10) : null;
      })
      .filter(Boolean) as number[];
    
    const maxNum = Math.max(...allSkusWithPrefix, 0);
    const nextNum = maxNum + 1;
    
    return bestPrefix + String(nextNum).padStart(digitLength, "0");
  };

  const handleGenerateSku = async (product: ProductRow) => {
    const newSku = generateSkuForProduct(product);
    if (!newSku) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "لا يمكن توليد SKU - لا توجد أنماط SKU في نفس البراند" : "Cannot generate SKU - no SKU patterns found in same brand",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ sku: newSku })
        .eq("id", product.id);

      if (error) throw error;

      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, sku: newSku } : p)
      );
      toast({
        title: language === "ar" ? "تم التوليد" : "Generated",
        description: language === "ar" ? `تم توليد SKU: ${newSku}` : `SKU generated: ${newSku}`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (product: ProductRow) => {
    setEditingId(product.id);
    setEditValue(product.sku || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveSku = async (productId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ sku: editValue.trim() || null })
        .eq("id", productId);

      if (error) throw error;

      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, sku: editValue.trim() || null } : p)
      );
      setEditingId(null);
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم تحديث SKU بنجاح" : "SKU updated successfully",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredProducts.map((p, idx) => ({
      "#": idx + 1,
      [language === "ar" ? "اسم المنتج" : "Product Name"]: p.product_name,
      SKU: p.sku || "",
      [language === "ar" ? "كود البراند" : "Brand Code"]: p.brand_code || "",
      [language === "ar" ? "اسم البراند" : "Brand Name"]: p.brand_name || "",
      [language === "ar" ? "السعر" : "Price"]: p.product_price || "",
      [language === "ar" ? "الحالة" : "Status"]: p.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `product_sku_report_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: language === "ar" ? "تم التصدير" : "Exported",
      description: language === "ar" ? "تم تصدير التقرير بنجاح" : "Report exported successfully",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Screen header - hidden in print */}
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            {language === "ar" ? "تقرير المنتجات و SKU" : "Product & SKU Report"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {language === "ar"
              ? `${filteredProducts.length} منتج`
              : `${filteredProducts.length} products`}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportExcel} disabled={filteredProducts.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          {language === "ar" ? "تصدير Excel" : "Export Excel"}
        </Button>
        <Button variant="outline" onClick={handlePrint} disabled={filteredProducts.length === 0}>
          <Printer className="h-4 w-4 mr-2" />
          {language === "ar" ? "طباعة" : "Print"}
        </Button>
      </div>

      {/* Filters - hidden in print */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث بالاسم، SKU، كود البراند..." : "Search by name, SKU, brand code..."}
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === "ar" ? "كل الحالات" : "All Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "كل الحالات" : "All Status"}</SelectItem>
                <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                <SelectItem value="inactive">{language === "ar" ? "غير نشط" : "Inactive"}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priceFilter} onValueChange={setPriceFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={language === "ar" ? "كل الأسعار" : "All Prices"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "كل الأسعار" : "All Prices"}</SelectItem>
                <SelectItem value="with_price">{language === "ar" ? "بسعر" : "With Price"}</SelectItem>
                <SelectItem value="no_price">{language === "ar" ? "بدون سعر" : "No Price"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Print header - only visible when printing */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-center">
          {language === "ar" ? "تقرير المنتجات و SKU" : "Product & SKU Report"}
        </h1>
        <p className="text-center text-sm text-muted-foreground mt-1">
          {language === "ar" ? "تاريخ الطباعة:" : "Print Date:"}{" "}
          {new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
          {" | "}
          {language === "ar" ? "عدد المنتجات:" : "Total Products:"} {filteredProducts.length}
          {brandFilter !== "all" && ` | ${language === "ar" ? "البراند:" : "Brand:"} ${brandFilter}`}
        </p>
      </div>

      {/* Table */}
      <div ref={printRef}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground print:hidden">
            {language === "ar" ? "لا توجد منتجات" : "No products found"}
          </div>
        ) : (
          <Card className="print:shadow-none print:border-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="print:bg-muted">
                      <TableHead className="w-[60px] text-center">#</TableHead>
                      <TableHead>{language === "ar" ? "اسم المنتج" : "Product Name"}</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>{language === "ar" ? "كود البراند" : "Brand Code"}</TableHead>
                      <TableHead>{language === "ar" ? "اسم البراند" : "Brand Name"}</TableHead>
                      <TableHead>{language === "ar" ? "السعر" : "Price"}</TableHead>
                      <TableHead className="print:hidden">{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p, idx) => (
                      <TableRow key={p.id} className="print:text-xs">
                        <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{p.product_name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {editingId === p.id ? (
                            <div className="flex items-center gap-1 print:hidden">
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 w-32 text-xs font-mono"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveSku(p.id);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveSku(p.id)} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 group">
                              <span>{p.sku || "-"}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 print:hidden text-muted-foreground hover:text-foreground"
                                onClick={() => startEdit(p)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              {!p.sku && p.brand_code && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 print:hidden text-muted-foreground hover:text-primary"
                                  onClick={() => handleGenerateSku(p)}
                                  disabled={saving}
                                  title={language === "ar" ? "توليد SKU تلقائي" : "Auto-generate SKU"}
                                >
                                  <Wand2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProductSkuReport;
