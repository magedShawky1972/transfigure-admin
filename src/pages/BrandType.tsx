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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

interface BrandType {
  id: string;
  brand_code: string | null;
  brand_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const BrandType = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [brands, setBrands] = useState<BrandType[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandType | null>(null);
  const [formData, setFormData] = useState({
    brand_code: "",
    brand_name: "",
    status: "active",
  });
  const [filterBrandCode, setFilterBrandCode] = useState("");
  const [filterBrandName, setFilterBrandName] = useState("");

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("brand_name", { ascending: true });

      if (error) throw error;
      setBrands(data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingBrand) {
        const { error } = await supabase
          .from("brands")
          .update({
            brand_code: formData.brand_code || null,
            brand_name: formData.brand_name,
            status: formData.status,
          })
          .eq("id", editingBrand.id);

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("brandType.updated"),
        });
      } else {
        const { error } = await supabase
          .from("brands")
          .insert({
            brand_code: formData.brand_code || null,
            brand_name: formData.brand_name,
            status: formData.status,
          });

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("brandType.created"),
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchBrands();
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

  const handleEdit = (brand: BrandType) => {
    setEditingBrand(brand);
    setFormData({
      brand_code: brand.brand_code || "",
      brand_name: brand.brand_name,
      status: brand.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("brandType.deleteConfirm"))) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({
        title: t("common.success"),
        description: t("brandType.deleted"),
      });
      fetchBrands();
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

  const resetForm = () => {
    setFormData({
      brand_code: "",
      brand_name: "",
      status: "active",
    });
    setEditingBrand(null);
  };

  const handleAddNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const filteredBrands = brands.filter((brand) => {
    const matchesBrandCode = !filterBrandCode || 
      (brand.brand_code && brand.brand_code.toLowerCase().includes(filterBrandCode.toLowerCase()));
    const matchesBrandName = !filterBrandName || 
      brand.brand_name.toLowerCase().includes(filterBrandName.toLowerCase());
    
    return matchesBrandCode && matchesBrandName;
  });

  return (
    <>
      {loading && <LoadingOverlay progress={100} message={t("common.loading")} />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("brandType.title")}</h1>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t("brandType.addNew")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="filterBrandCode">{t("brandType.filterByCode")}</Label>
            <Input
              id="filterBrandCode"
              placeholder={t("brandType.filterByCodePlaceholder")}
              value={filterBrandCode}
              onChange={(e) => setFilterBrandCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterBrandName">{t("brandType.filterByName")}</Label>
            <Input
              id="filterBrandName"
              placeholder={t("brandType.filterByNamePlaceholder")}
              value={filterBrandName}
              onChange={(e) => setFilterBrandName(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("brandType.brandCode")}</TableHead>
                <TableHead>{t("brandType.brandName")}</TableHead>
                <TableHead>{t("brandType.status")}</TableHead>
                <TableHead>{t("brandType.createdDate")}</TableHead>
                <TableHead>{t("brandType.updatedDate")}</TableHead>
                <TableHead>{t("brandType.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {filterBrandCode || filterBrandName ? t("brandType.noMatches") : t("brandType.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.brand_code || '-'}</TableCell>
                    <TableCell>{brand.brand_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        brand.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {brand.status === 'active' ? t("brandType.active") : t("brandType.inactive")}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(brand.created_at), "PPp")}</TableCell>
                    <TableCell>{format(new Date(brand.updated_at), "PPp")}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(brand)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(brand.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBrand ? t("brandType.editBrand") : t("brandType.addNew")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand_code">{t("brandType.brandCode")}</Label>
                <Input
                  id="brand_code"
                  value={formData.brand_code}
                  onChange={(e) =>
                    setFormData({ ...formData, brand_code: e.target.value })
                  }
                  placeholder={t("brandType.brandCodePlaceholder")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand_name">{t("brandType.brandName")}</Label>
                <Input
                  id="brand_name"
                  value={formData.brand_name}
                  onChange={(e) =>
                    setFormData({ ...formData, brand_name: e.target.value })
                  }
                  placeholder={t("brandType.brandNamePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t("brandType.status")}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("brandType.active")}</SelectItem>
                    <SelectItem value="inactive">{t("brandType.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("brandType.cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? t("brandType.saving") : t("brandType.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default BrandType;