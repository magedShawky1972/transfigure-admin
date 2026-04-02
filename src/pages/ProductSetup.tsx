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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Pencil, Trash2, Grid3x3, List, MoreHorizontal, RefreshCw, Upload, ArrowUpDown, ArrowUp, ArrowDown, Wand2, Bug } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductExcelUpload } from "@/components/ProductExcelUpload";
import { AdvancedProductFilter, FilterRule } from "@/components/AdvancedProductFilter";
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
  non_stock?: boolean;
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
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [productSkusWithTransactions, setProductSkusWithTransactions] = useState<Set<string>>(new Set());
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [syncingProducts, setSyncingProducts] = useState<Set<string>>(new Set());
  const [syncingAllProducts, setSyncingAllProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [syncTestDialogOpen, setSyncTestDialogOpen] = useState(false);
  const [syncTestProduct, setSyncTestProduct] = useState<Product | null>(null);
  const [syncTestSteps, setSyncTestSteps] = useState<Array<{ step: string; status: 'pending' | 'running' | 'success' | 'error'; detail?: string; timestamp?: string }>>([]);
  const [syncTestRunning, setSyncTestRunning] = useState(false);
  
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
  const [filterHasTransactions, setFilterHasTransactions] = useState(false);
  
  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState<FilterRule[]>([]);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
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
    allow_purchase: true,
  });

  useEffect(() => {
    fetchProducts(true);
    fetchBrands();
    fetchProductSkusWithTransactions();
  }, []);

  const fetchProductSkusWithTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("purpletransaction")
        .select("sku")
        .not("sku", "is", null)
        .limit(50000);
      if (error) throw error;
      const skuSet = new Set<string>();
      (data || []).forEach((row: any) => {
        if (row.sku) skuSet.add(row.sku);
      });
      setProductSkusWithTransactions(skuSet);
    } catch (err) {
      console.error("Error fetching transaction SKUs:", err);
    }
  };

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
      // Fetch all products in batches to avoid the 1000-row default limit
      let allProducts: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("product_name", { ascending: true })
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

      setProducts(allProducts);
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

  const applyAdvancedFilter = (product: Product, filter: FilterRule): boolean => {
    const value = (product as any)[filter.column];
    const filterValue = filter.value;
    
    if (!filterValue) return true;
    
    const stringValue = String(value || "").toLowerCase();
    const stringFilterValue = String(filterValue).toLowerCase();
    
    switch (filter.operator) {
      case "contains":
        return stringValue.includes(stringFilterValue);
      case "equals":
        return stringValue === stringFilterValue;
      case "not_equals":
        return stringValue !== stringFilterValue;
      case "greater_than":
        const numValue1 = parseFloat(String(value));
        const numFilter1 = parseFloat(filterValue);
        return !isNaN(numValue1) && !isNaN(numFilter1) && numValue1 > numFilter1;
      case "less_than":
        const numValue2 = parseFloat(String(value));
        const numFilter2 = parseFloat(filterValue);
        return !isNaN(numValue2) && !isNaN(numFilter2) && numValue2 < numFilter2;
      case "greater_equal":
        const numValue3 = parseFloat(String(value));
        const numFilter3 = parseFloat(filterValue);
        return !isNaN(numValue3) && !isNaN(numFilter3) && numValue3 >= numFilter3;
      case "less_equal":
        const numValue4 = parseFloat(String(value));
        const numFilter4 = parseFloat(filterValue);
        return !isNaN(numValue4) && !isNaN(numFilter4) && numValue4 <= numFilter4;
      default:
        return true;
    }
  };

  const filteredProducts = products.filter((product) => {
    const nameMatch = !filterName || product.product_name.toLowerCase().includes(filterName.toLowerCase());
    const statusMatch = filterStatus === "all" || product.status === filterStatus;
    const brandMatch = filterBrand === "all" || product.brand_name === filterBrand;
    const brandTypeMatch = filterBrandType === "all" || product.brand_type === filterBrandType;
    
    // Transaction exists filter
    const transactionMatch = !filterHasTransactions || productSkusWithTransactions.has(product.sku || product.product_id || "");
    
    // Apply advanced filters (all must match)
    const advancedMatch = advancedFilters.every(filter => applyAdvancedFilter(product, filter));
    
    return nameMatch && statusMatch && brandMatch && brandTypeMatch && transactionMatch && advancedMatch;
  });
  
  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = (a as any)[sortColumn];
    const bValue = (b as any)[sortColumn];
    
    // Handle null/undefined values
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    // Try numeric comparison first
    const aNum = parseFloat(String(aValue));
    const bNum = parseFloat(String(bValue));
    
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    }
    
    // String comparison
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    if (sortDirection === "asc") {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });
  
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Get unique brands and brand types for filters
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand_name).filter(Boolean)));
  const uniqueBrandTypes = Array.from(new Set(products.map(p => p.brand_type).filter(Boolean)));

  // Group products by brand for tree view
  const productsByBrand = sortedProducts.reduce((acc, product) => {
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
            allow_purchase: formData.allow_purchase,
          } as any)
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
            allow_purchase: formData.allow_purchase,
          } as any);

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
      allow_purchase: (product as any).allow_purchase ?? true,
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
      allow_purchase: true,
    });
    setEditingProduct(null);
  };

  const handleBrandChange = async (brandName: string) => {
    const selectedBrand = brands.find(b => b.brand_name === brandName);
    const newFormData = {
      ...formData,
      brand_name: brandName,
      brand_code: selectedBrand?.brand_code || "",
      brand_type: selectedBrand?.brand_type?.type_name || "",
    };

    // Auto-generate SKU for new products based on brand's sku_start_with
    if (!editingProduct && selectedBrand?.brand_code) {
      try {
        // Fetch the brand's sku_start_with
        const { data: brandData } = await supabase
          .from("brands")
          .select("sku_start_with")
          .eq("id", selectedBrand.id)
          .single();

        const prefix = (brandData as any)?.sku_start_with;
        if (prefix) {
          // Find the highest existing SKU number with this prefix
          const { data: existingProducts } = await supabase
            .from("products")
            .select("sku")
            .like("sku", `${prefix}%`)
            .not("sku", "is", null);

          let maxNum = 0;
          let padLength = 3; // default padding
          if (existingProducts && existingProducts.length > 0) {
            existingProducts.forEach((p: any) => {
              if (p.sku) {
                const numPart = p.sku.substring(prefix.length);
                const num = parseInt(numPart, 10);
                if (!isNaN(num)) {
                  if (num > maxNum) maxNum = num;
                  if (numPart.length > padLength) padLength = numPart.length;
                }
              }
            });
          }

          const nextNum = maxNum + 1;
          const newSku = prefix + String(nextNum).padStart(padLength, "0");
          newFormData.sku = newSku;
        }
      } catch (err) {
        console.error("Error generating SKU:", err);
      }
    }

    setFormData(newFormData);
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
          product_id: product.id,
          sku: product.sku || product.product_id,
          productName: product.product_name,
          uom: null,
          brandCode: product.brand_code || null,
          reorderPoint: product.reorder_point || null,
          minimumOrder: product.minimum_order_quantity || null,
          maximumOrder: null,
          costPrice: product.product_cost ? parseFloat(product.product_cost) : null,
          salesPrice: product.product_price ? parseFloat(product.product_price) : null,
          productWeight: product.weight || null,
          isNonStock: product.non_stock ?? false,
          odoo_product_id: product.odoo_product_id || null,
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

  const handleSyncAllToOdoo = async () => {
    setSyncingAllProducts(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-all-products-to-odoo');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: t("common.success"),
          description: `${data.results?.synced || 0} products synced, ${data.results?.skipped || 0} skipped`,
        });
        fetchProducts();
      } else {
        throw new Error(data?.error || 'Sync failed');
      }
    } catch (error: any) {
      console.error('Error syncing all products:', error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncingAllProducts(false);
    }
  };

  const handleTestSync = async (product: Product) => {
    setSyncTestProduct(product);
    setSyncTestDialogOpen(true);
    setSyncTestRunning(true);
    const steps: Array<{ step: string; status: 'pending' | 'running' | 'success' | 'error'; detail?: string; timestamp?: string }> = [];
    const addStep = (step: string, status: 'pending' | 'running' | 'success' | 'error', detail?: string) => {
      const entry = { step, status, detail, timestamp: new Date().toLocaleTimeString() };
      steps.push(entry);
      setSyncTestSteps([...steps]);
    };

    const sku = product.sku || product.product_id;
    try {
      // Step 1: Fetch Odoo config
      addStep('Fetching Odoo API configuration', 'running');
      const { data: odooConfig, error: configError } = await supabase
        .from('odoo_api_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (configError || !odooConfig) {
        addStep('Fetching Odoo API configuration', 'error', configError?.message || 'No active config found');
        setSyncTestRunning(false);
        return;
      }
      const isProductionMode = odooConfig.is_production_mode !== false;
      const productApiUrl = isProductionMode ? odooConfig.product_api_url : odooConfig.product_api_url_test;
      steps[steps.length - 1] = { ...steps[steps.length - 1], status: 'success', detail: `Environment: ${isProductionMode ? 'Production' : 'Test'}` };
      setSyncTestSteps([...steps]);

      // Step 2: Show PUT URL
      const putUrl = `${productApiUrl}/${sku}`;
      addStep(`PUT ${putUrl}`, 'running', 'Sending update request...');

      // Step 3: Call the edge function
      addStep('Calling sync-product-to-odoo edge function', 'running');
      const { data, error } = await supabase.functions.invoke('sync-product-to-odoo', {
        body: {
          product_id: product.id,
          sku: sku,
          productName: product.product_name,
          uom: null,
          brandCode: product.brand_code || null,
          reorderPoint: product.reorder_point || null,
          minimumOrder: product.minimum_order_quantity || null,
          maximumOrder: null,
          costPrice: product.product_cost ? parseFloat(product.product_cost) : null,
          salesPrice: product.product_price ? parseFloat(product.product_price) : null,
          productWeight: product.weight || null,
          isNonStock: product.non_stock ?? false,
          odoo_product_id: product.odoo_product_id || null,
        }
      });

      // Update PUT step
      steps[steps.length - 2] = { ...steps[steps.length - 2], status: data?.success ? 'success' : 'error', detail: `PUT ${putUrl}` };
      setSyncTestSteps([...steps]);

      if (error) {
        steps[steps.length - 1] = { ...steps[steps.length - 1], status: 'error', detail: `Edge Function Error: ${error.message}` };
        setSyncTestSteps([...steps]);
        setSyncTestRunning(false);
        return;
      }

      // Step 4: Show result
      steps[steps.length - 1] = { ...steps[steps.length - 1], status: data?.success ? 'success' : 'error', detail: JSON.stringify(data, null, 2) };
      setSyncTestSteps([...steps]);

      if (data?.success) {
        addStep('Result: Product synced successfully', 'success', `Odoo Product ID: ${data.odoo_product_id || 'N/A'}\nMessage: ${data.message || ''}`);
        // Update local record
        await supabase
          .from("products")
          .update({
            odoo_sync_status: 'synced',
            odoo_synced_at: new Date().toISOString(),
            odoo_product_id: data.odoo_product_id || null
          })
          .eq("id", product.id);
        fetchProducts();
      } else {
        addStep('Result: Sync failed', 'error', data?.error || 'Unknown error');
        await supabase
          .from("products")
          .update({ odoo_sync_status: 'failed' })
          .eq("id", product.id);
        fetchProducts();
      }
    } catch (err: any) {
      addStep('Unexpected error', 'error', err.message || 'Unknown error');
    }
    setSyncTestRunning(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === sortedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(sortedProducts.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedProducts);
      // Delete in batches of 100
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error } = await supabase
          .from("products")
          .delete()
          .in("id", batch);
        if (error) throw error;
      }

      toast({
        title: t("common.success"),
        description: language === "ar"
          ? `تم حذف ${ids.length} منتج بنجاح`
          : `${ids.length} products deleted successfully`,
      });
      setSelectedProducts(new Set());
      setBulkDeleteDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkSync = async () => {
    setBulkSyncing(true);
    const ids = Array.from(selectedProducts);
    const selectedProductsList = sortedProducts.filter(p => ids.includes(p.id));
    let successCount = 0;
    let failCount = 0;

    for (const product of selectedProductsList) {
      try {
        await supabase
          .from("products")
          .update({ odoo_sync_status: 'pending' })
          .eq("id", product.id);

        const { data, error } = await supabase.functions.invoke('sync-product-to-odoo', {
          body: {
            product_id: product.id,
            sku: product.sku || product.product_id,
            productName: product.product_name,
            uom: null,
            brandCode: product.brand_code || null,
            reorderPoint: product.reorder_point || null,
            minimumOrder: product.minimum_order_quantity || null,
            maximumOrder: null,
            costPrice: product.product_cost ? parseFloat(product.product_cost) : null,
            salesPrice: product.product_price ? parseFloat(product.product_price) : null,
            productWeight: product.weight || null,
            isNonStock: product.non_stock ?? false,
            odoo_product_id: product.odoo_product_id || null,
          }
        });

        if (error) throw error;

        if (data?.success) {
          await supabase
            .from("products")
            .update({
              odoo_sync_status: 'synced',
              odoo_synced_at: new Date().toISOString(),
              odoo_product_id: data.odoo_product_id || null
            })
            .eq("id", product.id);
          successCount++;
        } else {
          throw new Error(data?.error || "Failed");
        }
      } catch {
        await supabase
          .from("products")
          .update({ odoo_sync_status: 'failed' })
          .eq("id", product.id);
        failCount++;
      }
    }

    toast({
      title: t("common.success"),
      description: language === "ar"
        ? `تم مزامنة ${successCount} منتج، فشل ${failCount}`
        : `${successCount} synced, ${failCount} failed`,
    });

    setSelectedProducts(new Set());
    setBulkSyncing(false);
    fetchProducts();
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
            <Button 
              variant="outline" 
              onClick={handleSyncAllToOdoo}
              disabled={syncingAllProducts}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncingAllProducts ? 'animate-spin' : ''}`} />
              {syncingAllProducts ? 'Syncing...' : 'Sync All to Odoo'}
            </Button>
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
        <div className="space-y-4">
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
          
          <div className="flex items-center justify-between">
            <AdvancedProductFilter
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
            />
            <div className="text-sm text-muted-foreground">
              Showing {sortedProducts.length} of {products.length} products
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedProducts.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-md">
            <span className="text-sm font-medium">
              {language === "ar"
                ? `${selectedProducts.size} منتج محدد`
                : `${selectedProducts.size} selected`}
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {language === "ar" ? "حذف المحدد" : "Delete Selected"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkSync}
              disabled={bulkSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${bulkSyncing ? 'animate-spin' : ''}`} />
              {bulkSyncing
                ? (language === "ar" ? "جاري المزامنة..." : "Syncing...")
                : (language === "ar" ? "مزامنة المحدد مع Odoo" : "Sync Selected to Odoo")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedProducts(new Set())}
            >
              {language === "ar" ? "إلغاء التحديد" : "Clear Selection"}
            </Button>
          </div>
        )}

        {viewMode === "grid" ? (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={sortedProducts.length > 0 && selectedProducts.size === sortedProducts.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("product_id")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.productId")}
                      <SortIcon column="product_id" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("sku")}
                  >
                    <div className="flex items-center">
                      SKU
                      <SortIcon column="sku" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("product_name")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.productName")}
                      <SortIcon column="product_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("product_price")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.productPrice")}
                      <SortIcon column="product_price" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("product_cost")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.productCost")}
                      <SortIcon column="product_cost" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("brand_name")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.brand")}
                      <SortIcon column="brand_name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("brand_type")}
                  >
                    <div className="flex items-center">
                      Brand Type
                      <SortIcon column="brand_type" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("brand_code")}
                  >
                    <div className="flex items-center">
                      Brand Code
                      <SortIcon column="brand_code" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.status")}
                      <SortIcon column="status" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("odoo_product_id")}
                  >
                    <div className="flex items-center">
                      Odoo ID
                      <SortIcon column="odoo_product_id" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("odoo_sync_status")}
                  >
                    <div className="flex items-center">
                      Odoo Sync Status
                      <SortIcon column="odoo_sync_status" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center">
                      {t("productSetup.createdDate")}
                      <SortIcon column="created_at" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right">{t("productSetup.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map((product) => (
                    <TableRow key={product.id} className={`cursor-pointer ${selectedProducts.has(product.id) ? "bg-primary/5" : ""}`} onDoubleClick={() => navigate(`/product-details/${product.id}`)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleSelectProduct(product.id)}
                        />
                      </TableCell>
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
                    <TableCell className="text-center">{product.odoo_product_id || "-"}</TableCell>
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
                        onClick={() => handleTestSync(product)}
                        title="Test Sync (Debug)"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Bug className="h-4 w-4" />
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
                            <TableHead className="w-12">
                              <Checkbox
                                checked={brandProducts.every(p => selectedProducts.has(p.id))}
                                onCheckedChange={() => {
                                  const allSelected = brandProducts.every(p => selectedProducts.has(p.id));
                                  setSelectedProducts(prev => {
                                    const next = new Set(prev);
                                    brandProducts.forEach(p => {
                                      if (allSelected) next.delete(p.id);
                                      else next.add(p.id);
                                    });
                                    return next;
                                  });
                                }}
                              />
                            </TableHead>
                             <TableHead>{t("productSetup.productId")}</TableHead>
                             <TableHead>{t("productSetup.productName")}</TableHead>
                             <TableHead>{t("productSetup.productPrice")}</TableHead>
                             <TableHead>{t("productSetup.productCost")}</TableHead>
                             <TableHead>{t("productSetup.status")}</TableHead>
                             <TableHead>Odoo ID</TableHead>
                             <TableHead>Odoo Sync Status</TableHead>
                             <TableHead>{t("productSetup.createdDate")}</TableHead>
                             <TableHead className="text-right">{t("productSetup.actions")}</TableHead>
                           </TableRow>
                         </TableHeader>
                         <TableBody>
                           {brandProducts.map((product) => (
                             <TableRow key={product.id} className={`cursor-pointer ${selectedProducts.has(product.id) ? "bg-primary/5" : ""}`} onDoubleClick={() => navigate(`/product-details/${product.id}`)}>
                               <TableCell>
                                 <Checkbox
                                   checked={selectedProducts.has(product.id)}
                                   onCheckedChange={() => toggleSelectProduct(product.id)}
                                 />
                               </TableCell>
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
                              <TableCell className="text-center">{product.odoo_product_id || "-"}</TableCell>
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
                                  onClick={() => handleTestSync(product)}
                                  title="Test Sync (Debug)"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Bug className="h-4 w-4" />
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
              <div className="flex gap-1">
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Enter product SKU"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={language === "ar" ? "توليد SKU تلقائي" : "Auto-generate SKU"}
                  onClick={async () => {
                    if (!formData.brand_code) {
                      toast({ title: "Error", description: language === "ar" ? "اختر البراند أولاً" : "Select a brand first", variant: "destructive" });
                      return;
                    }
                    try {
                      const { data: brandData } = await supabase
                        .from("brands")
                        .select("sku_start_with")
                        .eq("brand_code", formData.brand_code)
                        .single();
                      let prefix = (brandData as any)?.sku_start_with;
                      if (!prefix) {
                        // Fallback: use brand name's first 2 uppercase characters
                        const brandName = formData.brand_name || formData.brand_code || "";
                        prefix = brandName.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase();
                        if (!prefix) {
                          toast({ title: "Error", description: language === "ar" ? "لا يمكن توليد بادئة SKU" : "Cannot generate SKU prefix from brand", variant: "destructive" });
                          return;
                        }
                      }
                      const { data: existingProducts } = await supabase
                        .from("products")
                        .select("sku")
                        .like("sku", `${prefix}%`)
                        .not("sku", "is", null);
                      let maxNum = 0;
                      let padLength = 3;
                      if (existingProducts && existingProducts.length > 0) {
                        existingProducts.forEach((p: any) => {
                          if (p.sku) {
                            const numPart = p.sku.substring(prefix.length);
                            const num = parseInt(numPart, 10);
                            if (!isNaN(num)) {
                              if (num > maxNum) maxNum = num;
                              if (numPart.length > padLength) padLength = numPart.length;
                            }
                          }
                        });
                      }
                      const newSku = prefix + String(maxNum + 1).padStart(padLength, "0");
                      setFormData(prev => ({ ...prev, sku: newSku }));
                      toast({ title: language === "ar" ? "تم التوليد" : "Generated", description: `SKU: ${newSku}` });
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow_purchase"
                checked={formData.allow_purchase}
                onCheckedChange={(checked) => setFormData({ ...formData, allow_purchase: checked === true })}
              />
              <Label htmlFor="allow_purchase">Allow Purchase</Label>
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

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar"
                ? `هل تريد حذف ${selectedProducts.size} منتج؟`
                : `Delete ${selectedProducts.size} products?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? "سيتم حذف جميع المنتجات المحددة نهائياً. لا يمكن التراجع عن هذا الإجراء."
                : "All selected products will be permanently deleted. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting
                ? (language === "ar" ? "جاري الحذف..." : "Deleting...")
                : t("common.delete")}
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
      {/* Sync Test Debug Dialog */}
      <Dialog open={syncTestDialogOpen} onOpenChange={(open) => { if (!syncTestRunning) { setSyncTestDialogOpen(open); if (!open) setSyncTestSteps([]); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Odoo Sync Debug - {syncTestProduct?.product_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <div className="flex gap-2 text-muted-foreground mb-3">
              <span>SKU: <strong>{syncTestProduct?.sku || syncTestProduct?.product_id}</strong></span>
              <span>|</span>
              <span>Brand: <strong>{syncTestProduct?.brand_code}</strong></span>
              <span>|</span>
              <span>Odoo ID: <strong>{syncTestProduct?.odoo_product_id || 'N/A'}</strong></span>
            </div>
            {syncTestSteps.map((s, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded border ${
                s.status === 'success' ? 'border-green-500/30 bg-green-500/5' :
                s.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
                s.status === 'running' ? 'border-yellow-500/30 bg-yellow-500/5' :
                'border-border'
              }`}>
                <span className="mt-0.5">
                  {s.status === 'success' ? '✅' : s.status === 'error' ? '❌' : s.status === 'running' ? '⏳' : '⏸️'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{s.step}</div>
                  {s.detail && (
                    <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all font-mono bg-muted/50 p-2 rounded">
                      {s.detail}
                    </pre>
                  )}
                </div>
                {s.timestamp && <span className="text-xs text-muted-foreground shrink-0">{s.timestamp}</span>}
              </div>
            ))}
            {syncTestRunning && (
              <div className="flex items-center gap-2 text-muted-foreground p-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductSetup;
