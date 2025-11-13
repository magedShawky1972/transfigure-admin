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
  type_code: string;
  type_name: string;
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
    type_code: "",
    type_name: "",
    status: "active",
  });
  const [filterTypeCode, setFilterTypeCode] = useState("");
  const [filterTypeName, setFilterTypeName] = useState("");

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("brand_type")
        .select("*")
        .order("type_name", { ascending: true });

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
          .from("brand_type")
          .update({
            type_code: formData.type_code,
            type_name: formData.type_name,
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
          .from("brand_type")
          .insert({
            type_code: formData.type_code,
            type_name: formData.type_name,
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
      type_code: brand.type_code,
      type_name: brand.type_name,
      status: brand.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("brandType.deleteConfirm"))) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("brand_type")
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
      type_code: "",
      type_name: "",
      status: "active",
    });
    setEditingBrand(null);
  };

  const handleAddNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const filteredBrands = brands.filter((brand) => {
    const matchesTypeCode = !filterTypeCode || 
      brand.type_code.toLowerCase().includes(filterTypeCode.toLowerCase());
    const matchesTypeName = !filterTypeName || 
      brand.type_name.toLowerCase().includes(filterTypeName.toLowerCase());
    
    return matchesTypeCode && matchesTypeName;
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
            <Label htmlFor="filterTypeCode">{t("brandType.filterByCode")}</Label>
            <Input
              id="filterTypeCode"
              placeholder={t("brandType.filterByCodePlaceholder")}
              value={filterTypeCode}
              onChange={(e) => setFilterTypeCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterTypeName">{t("brandType.filterByName")}</Label>
            <Input
              id="filterTypeName"
              placeholder={t("brandType.filterByNamePlaceholder")}
              value={filterTypeName}
              onChange={(e) => setFilterTypeName(e.target.value)}
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
                    {filterTypeCode || filterTypeName ? t("brandType.noMatches") : t("brandType.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.type_code}</TableCell>
                    <TableCell>{brand.type_name}</TableCell>
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
                <Label htmlFor="type_code">{t("brandType.brandCode")}</Label>
                <Input
                  id="type_code"
                  value={formData.type_code}
                  onChange={(e) =>
                    setFormData({ ...formData, type_code: e.target.value })
                  }
                  placeholder={t("brandType.brandCodePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type_name">{t("brandType.brandName")}</Label>
                <Input
                  id="type_name"
                  value={formData.type_name}
                  onChange={(e) =>
                    setFormData({ ...formData, type_name: e.target.value })
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
