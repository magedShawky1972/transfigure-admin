import { useState, useEffect } from "react";
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
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Product {
  id: string;
  product_id: string | null;
  product_name: string;
  product_price: string | null;
  product_cost: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const ProductSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  
  // Filter states
  const [filterName, setFilterName] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    product_id: "",
    product_name: "",
    product_price: "",
    product_cost: "",
    status: "active",
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const nameMatch = !filterName || product.product_name.toLowerCase().includes(filterName.toLowerCase());
    const statusMatch = filterStatus === "all" || product.status === filterStatus;
    return nameMatch && statusMatch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update({
            product_id: formData.product_id || null,
            product_name: formData.product_name,
            product_price: formData.product_price || null,
            product_cost: formData.product_cost || null,
            status: formData.status,
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
            product_name: formData.product_name,
            product_price: formData.product_price || null,
            product_cost: formData.product_cost || null,
            status: formData.status,
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
      product_name: product.product_name,
      product_price: product.product_price || "",
      product_cost: product.product_cost || "",
      status: product.status,
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
      product_name: "",
      product_price: "",
      product_cost: "",
      status: "active",
    });
    setEditingProduct(null);
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
          <Button onClick={() => setDialogOpen(true)}>
            {t("productSetup.addNew")}
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-md border">
          <Input
            placeholder={t("productSetup.filterByName")}
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
          />
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

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("productSetup.productId")}</TableHead>
                <TableHead>{t("productSetup.productName")}</TableHead>
                <TableHead>{t("productSetup.productPrice")}</TableHead>
                <TableHead>{t("productSetup.productCost")}</TableHead>
                <TableHead>{t("productSetup.status")}</TableHead>
                <TableHead>{t("productSetup.createdDate")}</TableHead>
                <TableHead className="text-right">{t("productSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
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
    </>
  );
};

export default ProductSetup;
