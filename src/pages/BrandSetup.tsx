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

interface Brand {
  id: string;
  brand_name: string;
  short_name?: string;
  usd_value_for_coins?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const BrandSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    brand_name: "",
    short_name: "",
    usd_value_for_coins: "",
    status: "active",
  });
  const [filterBrandName, setFilterBrandName] = useState("");
  const [filterShortName, setFilterShortName] = useState("");

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
            brand_name: formData.brand_name,
            short_name: formData.short_name,
            usd_value_for_coins: formData.usd_value_for_coins ? parseFloat(formData.usd_value_for_coins) : 0,
            status: formData.status,
          })
          .eq("id", editingBrand.id);

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("brandSetup.updated"),
        });
      } else {
        const { error } = await supabase
          .from("brands")
          .insert({
            brand_name: formData.brand_name,
            short_name: formData.short_name,
            usd_value_for_coins: formData.usd_value_for_coins ? parseFloat(formData.usd_value_for_coins) : 0,
            status: formData.status,
          });

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("brandSetup.created"),
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

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      brand_name: brand.brand_name,
      short_name: brand.short_name || "",
      usd_value_for_coins: brand.usd_value_for_coins?.toString() || "",
      status: brand.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("brandSetup.deleteConfirm"))) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("brands")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({
        title: t("common.success"),
        description: t("brandSetup.deleted"),
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
      brand_name: "",
      short_name: "",
      usd_value_for_coins: "",
      status: "active",
    });
    setEditingBrand(null);
  };

  const handleAddNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  // Filter brands based on search criteria
  const filteredBrands = brands.filter((brand) => {
    const matchesBrandName = !filterBrandName || 
      brand.brand_name.toLowerCase().includes(filterBrandName.toLowerCase());
    const matchesShortName = !filterShortName || 
      (brand.short_name && brand.short_name.toLowerCase().includes(filterShortName.toLowerCase()));
    
    return matchesBrandName && matchesShortName;
  });

  return (
    <>
      {loading && <LoadingOverlay progress={100} message={t("common.loading")} />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">{t("brandSetup.title")}</h1>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            {t("brandSetup.addNew")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="filterBrandName">Filter by Brand Name</Label>
            <Input
              id="filterBrandName"
              placeholder="Search brand name..."
              value={filterBrandName}
              onChange={(e) => setFilterBrandName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterShortName">Filter by Short Name</Label>
            <Input
              id="filterShortName"
              placeholder="Search short name..."
              value={filterShortName}
              onChange={(e) => setFilterShortName(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("brandSetup.brandName")}</TableHead>
                <TableHead>Short Name</TableHead>
                <TableHead>USD Value For Coins</TableHead>
                <TableHead>{t("brandSetup.status")}</TableHead>
                <TableHead>{t("brandSetup.createdDate")}</TableHead>
                <TableHead>{t("brandSetup.updatedDate")}</TableHead>
                <TableHead>{t("brandSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {filterBrandName || filterShortName ? "No brands match your filters" : t("brandSetup.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.brand_name}</TableCell>
                    <TableCell>{brand.short_name || '-'}</TableCell>
                    <TableCell>{brand.usd_value_for_coins || 0}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        brand.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {brand.status}
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
                {editingBrand ? t("brandSetup.editBrand") : t("brandSetup.addNew")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brand_name">{t("brandSetup.brandName")}</Label>
                <Input
                  id="brand_name"
                  value={formData.brand_name}
                  onChange={(e) =>
                    setFormData({ ...formData, brand_name: e.target.value })
                  }
                  placeholder={t("brandSetup.brandNamePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_name">Short Name</Label>
                <Input
                  id="short_name"
                  value={formData.short_name}
                  onChange={(e) =>
                    setFormData({ ...formData, short_name: e.target.value })
                  }
                  placeholder="Enter short name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usd_value_for_coins">USD Value For Coins</Label>
                <Input
                  id="usd_value_for_coins"
                  type="number"
                  step="0.01"
                  value={formData.usd_value_for_coins}
                  onChange={(e) =>
                    setFormData({ ...formData, usd_value_for_coins: e.target.value })
                  }
                  placeholder="Enter USD value for coins"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t("brandSetup.status")}</Label>
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
                    <SelectItem value="active">{t("brandSetup.active")}</SelectItem>
                    <SelectItem value="inactive">{t("brandSetup.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("brandSetup.cancel")}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? t("brandSetup.saving") : t("brandSetup.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default BrandSetup;
