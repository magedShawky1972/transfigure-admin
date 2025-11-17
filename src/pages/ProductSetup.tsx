import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Grid3x3, List, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
import { ProductExcelUpload } from "@/components/ProductExcelUpload";
import { format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

interface Product {
  id: string;
  product_id: string | null;
  odoo_product_id: number | null;
  product_name: string;
  product_price: string | null;
  product_cost: string | null;
  brand_name: string | null;
  brand_code: string | null;
  brand_type: string | null;
  status: string;
  odoo_sync_status: string | null;
  odoo_synced_at: string | null;
  created_at: string;
  updated_at: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  stock_quantity?: number | null;
  minimum_order_quantity?: number | null;
  reorder_point?: number | null;
  weight?: number | null;
  barcode?: string | null;
  supplier?: string | null;
  notes?: string | null;
}

interface Brand {
  id: string;
  brand_name: string;
  brand_code: string | null;
  brand_type_id: string | null;
  brand_type?: {
    type_name: string;
  };
}

const ProductSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [syncingProducts, setSyncingProducts] = useState<Set<string>>(new Set());
  
  // Filter states
  const [filterName, setFilterName] = useState<string>(() =>
    localStorage.getItem("ps.filterName") ?? ""
  );
  const [filterStatus, setFilterStatus] = useState<string>(() =>
    localStorage.getItem("ps.filterStatus") ?? "all"
  );
  const [filterBrand, setFilterBrand] = useState<string>(() =>
    localStorage.getItem("ps.filterBrand") ?? "all"
  );
  const [filterBrandType, setFilterBrandType] = useState<string>(() =>
    localStorage.getItem("ps.filterBrandType") ?? "all"
  );
  
  // View mode state
  const [viewMode, setViewMode] = useState<"grid" | "tree">(
    localStorage.getItem("ps.viewMode") === "tree" ? "tree" : "grid"
  );

  // Persist filters and view mode
  useEffect(() => {
    try {
      localStorage.setItem("ps.filterName", filterName);
      localStorage.setItem("ps.filterStatus", filterStatus);
      localStorage.setItem("ps.filterBrand", filterBrand);
      localStorage.setItem("ps.filterBrandType", filterBrandType);
      localStorage.setItem("ps.viewMode", viewMode);
    } catch {}
  }, [filterName, filterStatus, filterBrand, filterBrandType, viewMode]);
  
  const [formData, setFormData] = useState({
    product_id: "",
    odoo_product_id: "",
    product_name: "",
    product_price: "",
    product_cost: "",
    brand_name: "",
    brand_code: "",
    brand_type: "",
    status: "active",
    sku: "",
  });

  useEffect(() => {
    fetchProducts(true);
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from("brands")
        .select(`
          id,
          brand_name,
          brand_code,
          brand_type_id,
          brand_type:brand_type_id (
            type_name
          )
        `)
        .eq("status", "active")
        .order("brand_name", { ascending: true });

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      console.error("Error fetching brands:", error);
    }
  };

  const fetchProducts = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("product_name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const nameMatch = !filterName || product.product_name.toLowerCase().includes(filterName.toLowerCase());
    const statusMatch = filterStatus === "all" || product.status === filterStatus;
    const brandMatch = filterBrand === "all" || product.brand_name === filterBrand;
    const brandTypeMatch = filterBrandType === "all" || product.brand_type === filterBrandType;
    return nameMatch && statusMatch && brandMatch && brandTypeMatch;
  });

  // Get unique brands and brand types for filters
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand_name).filter(Boolean)));
  const uniqueBrandTypes = Array.from(new Set(products.map(p => p.brand_type).filter(Boolean)));

  // Group products by brand for tree view
  const productsByBrand = filteredProducts.reduce((acc, product) => {
    const brand = product.brand_name || t("productSetup.noBrand");
    if (!acc[brand]) {
      acc[brand] = [];
    }
    acc[brand].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update({
            product_id: formData.product_id || null,
            odoo_product_id: formData.odoo_product_id ? parseInt(formData.odoo_product_id) : null,
            product_name: formData.product_name,
            product_price: formData.product_price || null,
            product_cost: formData.product_cost || null,
            brand_name: formData.brand_name || null,
            brand_code: formData.brand_code || null,
            brand_type: formData.brand_type || null,
            status: formData.status,
            sku: formData.sku || null,
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("productSetup.updated"),
        });
      } else {
        const { error } = await supabase
          .from("products")
          .insert({
            product_id: formData.product_id || null,
            odoo_product_id: formData.odoo_product_id ? parseInt(formData.odoo_product_id) : null,
            product_name: formData.product_name,
            product_price: formData.product_price || null,
            product_cost: formData.product_cost || null,
            brand_name: formData.brand_name || null,
            brand_code: formData.brand_code || null,
            brand_type: formData.brand_type || null,
            status: formData.status,
            sku: formData.sku || null,
          });

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("productSetup.created"),
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      product_id: product.product_id || "",
      odoo_product_id: product.odoo_product_id?.toString() || "",
      product_name: product.product_name,
      product_price: product.product_price || "",
      product_cost: product.product_cost || "",
      brand_name: product.brand_name || "",
      brand_code: product.brand_code || "",
      brand_type: product.brand_type || "",
      status: product.status,
      sku: product.sku || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productToDelete);

      if (error) throw error;
      
      toast({
        title: t("common.success"),
        description: t("productSetup.deleted"),
      });
      
      fetchProducts();
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      product_id: "",
      odoo_product_id: "",
      product_name: "",
      product_price: "",
      product_cost: "",
      brand_name: "",
      brand_code: "",
      brand_type: "",
      status: "active",
      sku: "",
    });
    setEditingProduct(null);
  };

  const handleBrandChange = (brandName: string) => {
    const selectedBrand = brands.find(b => b.brand_name === brandName);
    setFormData({
      ...formData,
      brand_name: brandName,
      brand_code: selectedBrand?.brand_code || "",
      brand_type: selectedBrand?.brand_type?.type_name || "",
    });
  };

  const getSelectedBrandType = () => {
    const selectedBrand = brands.find(b => b.brand_name === formData.brand_name);
    return selectedBrand?.brand_type?.type_name || "";
  };

  const handleSyncToOdoo = async (product: Product) => {
    setSyncingProducts(prev => new Set(prev).add(product.id));
    
    try {
      // Update status to pending
      await supabase
        .from("products")
        .update({ odoo_sync_status: 'pending' })
        .eq("id", product.id);

      const { data, error } = await supabase.functions.invoke('sync-product-to-odoo', {
        body: {
          productId: product.product_id || product.id,
          productName: product.product_name,
          uom: null,
          catCode: null,
          reorderPoint: null,
          minimumOrder: null,
          maximumOrder: null,
          costPrice: product.product_cost ? parseFloat(product.product_cost) : null,
          salesPrice: product.product_price ? parseFloat(product.product_price) : null,
          productWeight: null,
        }
      });

      if (error) throw error;

      if (data?.success) {
        // Update sync status to synced
        await supabase
          .from("products")
          .update({ 
            odoo_sync_status: 'synced',
            odoo_synced_at: new Date().toISOString(),
            odoo_product_id: data.odoo_product_id || null
          })
          .eq("id", product.id);

        toast({
          title: t("common.success"),
          description: data.message || "Product synced to Odoo successfully",
        });
        
        // Refresh products to show updated status
        fetchProducts();
      } else {
        throw new Error(data?.error || "Failed to sync product");
      }
    } catch (error: any) {
      console.error('Error syncing product to Odoo:', error);
      
      // Update status to failed
      await supabase
        .from("products")
        .update({ odoo_sync_status: 'failed' })
        .eq("id", product.id);
      
      toast({
        title: t("common.error"),
        description: error.message || "Failed to sync product to Odoo",
        variant: "destructive",
      });
      
      // Refresh products to show updated status
      fetchProducts();
    } finally {
      setSyncingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  return (
    <>
      {loading && <LoadingOverlay progress={100} message={t("common.loading")} />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("productSetup.title")}</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                {t("productSetup.viewGrid")}
              </Button>
              <Button
                variant={viewMode === "tree" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tree")}
              >
                <List className="h-4 w-4 mr-2" />
                {t("productSetup.viewTree")}
              </Button>
            </div>
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Excel
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              {t("productSetup.addNew")}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-card rounded-md border">
          <Input
            placeholder={t("productSetup.filterByName")}
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger>
              <SelectValue placeholder={t("productSetup.filterByBrand")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {uniqueBrands.map((brand) => (
                <SelectItem key={brand} value={brand!}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBrandType} onValueChange={setFilterBrandType}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Brand Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {uniqueBrandTypes.map((type) => (
                <SelectItem key={type} value={type!}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder={t("productSetup.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="active">{t("productSetup.active")}</SelectItem>
              <SelectItem value="inactive">{t("productSetup.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {viewMode === "grid" ? (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("productSetup.productId")}</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>{t("productSetup.productName")}</TableHead>
                  <TableHead>{t("productSetup.productPrice")}</TableHead>
                  <TableHead>{t("productSetup.productCost")}</TableHead>
                  <TableHead>{t("productSetup.brand")}</TableHead>
                  <TableHead>Brand Type</TableHead>
                  <TableHead>Brand Code</TableHead>
                  <TableHead>{t("productSetup.status")}</TableHead>
                  <TableHead>Odoo Sync Status</TableHead>
                  <TableHead>{t("productSetup.createdDate")}</TableHead>
                  <TableHead className="text-right">{t("productSetup.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.product_id || "-"}</TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell>{product.product_name}</TableCell>
                    <TableCell>{product.product_price || "-"}</TableCell>
                    <TableCell>{product.product_cost || "-"}</TableCell>
                    <TableCell>{product.brand_name || "-"}</TableCell>
                    <TableCell>{product.brand_type || "-"}</TableCell>
                    <TableCell>{product.brand_code || "-"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        product.status === "active" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}>
                        {product.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        product.odoo_sync_status === "synced" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                          : product.odoo_sync_status === "pending"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : product.odoo_sync_status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                      }`}>
                        {product.odoo_sync_status || "not_synced"}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(product.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSyncToOdoo(product)}
                        disabled={syncingProducts.has(product.id)}
                        title="Sync to Odoo"
                      >
                        <RefreshCw className={`h-4 w-4 ${syncingProducts.has(product.id) ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/product-details/${product.id}`)}
                        title="More Details"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setProductToDelete(product.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(productsByBrand).map(([brand, brandProducts]) => (
              <Collapsible key={brand}>
                <div className="rounded-md border bg-card">
                  <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-5 w-5 transition-transform duration-200 [&[data-state=open]]:rotate-90" />
                        <span className="text-lg font-semibold">{brand}</span>
                        <span className="text-sm text-muted-foreground">
                          ({brandProducts.length} {brandProducts.length === 1 ? t("productSetup.product") : t("productSetup.products")})
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("productSetup.productId")}</TableHead>
                            <TableHead>{t("productSetup.productName")}</TableHead>
                            <TableHead>{t("productSetup.productPrice")}</TableHead>
                            <TableHead>{t("productSetup.productCost")}</TableHead>
                            <TableHead>{t("productSetup.status")}</TableHead>
                            <TableHead>Odoo Sync Status</TableHead>
                            <TableHead>{t("productSetup.createdDate")}</TableHead>
                            <TableHead className="text-right">{t("productSetup.actions")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {brandProducts.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.product_id || "-"}</TableCell>
                              <TableCell>{product.product_name}</TableCell>
                              <TableCell>{product.product_price || "-"}</TableCell>
                              <TableCell>{product.product_cost || "-"}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  product.status === "active" 
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                }`}>
                                  {product.status}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  product.odoo_sync_status === "synced" 
                                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
                                    : product.odoo_sync_status === "pending"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                    : product.odoo_sync_status === "failed"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                }`}>
                                  {product.odoo_sync_status || "not_synced"}
                                </span>
                              </TableCell>
                              <TableCell>{format(new Date(product.created_at), "MMM dd, yyyy")}</TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(product)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleSyncToOdoo(product)}
                                  disabled={syncingProducts.has(product.id)}
                                  title="Sync to Odoo"
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncingProducts.has(product.id) ? 'animate-spin' : ''}`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/product-details/${product.id}`)}
                                  title="More Details"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setProductToDelete(product.id);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? t("productSetup.editProduct") : t("productSetup.addNew")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product_id">{t("productSetup.productId")}</Label>
              <Input
                id="product_id"
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                placeholder={t("productSetup.productIdPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="Enter product SKU"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odoo_product_id">Odoo Product ID</Label>
              <Input
                id="odoo_product_id"
                type="number"
                value={formData.odoo_product_id}
                onChange={(e) => setFormData({ ...formData, odoo_product_id: e.target.value })}
                placeholder="Enter Odoo Product ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_name">{t("productSetup.productName")}</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder={t("productSetup.productNamePlaceholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_price">{t("productSetup.productPrice")}</Label>
              <Input
                id="product_price"
                value={formData.product_price}
                onChange={(e) => setFormData({ ...formData, product_price: e.target.value })}
                placeholder={t("productSetup.productPricePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_cost">{t("productSetup.productCost")}</Label>
              <Input
                id="product_cost"
                value={formData.product_cost}
                onChange={(e) => setFormData({ ...formData, product_cost: e.target.value })}
                placeholder={t("productSetup.productCostPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_name">{t("productSetup.brand")}</Label>
              <Select value={formData.brand_name} onValueChange={handleBrandChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("productSetup.brandPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.brand_name}>
                      {brand.brand_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_type">Brand Type</Label>
              <Input
                id="brand_type"
                value={formData.brand_type}
                disabled
                placeholder="Brand type will be shown here"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_code">Brand Code</Label>
              <Input
                id="brand_code"
                value={formData.brand_code}
                disabled
                placeholder="Brand code will be auto-populated"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">{t("productSetup.status")}</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("productSetup.active")}</SelectItem>
                  <SelectItem value="inactive">{t("productSetup.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                {t("productSetup.cancel")}
              </Button>
              <Button type="submit">
                {t("productSetup.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("productSetup.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.confirmAction")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Excel to Update Products</DialogTitle>
          </DialogHeader>
          <ProductExcelUpload
            onUploadComplete={() => {
              setUploadDialogOpen(false);
              fetchProducts();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductSetup;
