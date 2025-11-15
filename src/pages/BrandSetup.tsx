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
import { Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

interface Brand {
  id: string;
  brand_name: string;
  short_name?: string;
  usd_value_for_coins?: number;
  recharge_usd_value?: number;
  leadtime?: number;
  safety_stock?: number;
  reorder_point?: number;
  status: string;
  brand_type_id?: string;
  created_at: string;
  updated_at: string;
}

interface BrandType {
  id: string;
  type_code: string;
  type_name: string;
  status: string;
}

const BrandSetup = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
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
        .select(`
          *,
          brand_type:brand_type_id (
            id,
            type_name
          )
        `)
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

  const handleEdit = (brand: Brand) => {
    navigate(`/brand-setup/edit?id=${brand.id}`);
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

  const handleAddNew = () => {
    navigate("/brand-setup/edit");
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
                <TableHead>{t("brandSetup.brandType")}</TableHead>
                <TableHead>USD Value</TableHead>
                <TableHead>Recharge USD</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Safety Stock</TableHead>
                <TableHead>Reorder Point</TableHead>
                <TableHead>{t("brandSetup.status")}</TableHead>
                <TableHead>{t("brandSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {filterBrandName || filterShortName ? "No brands match your filters" : t("brandSetup.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.brand_name}</TableCell>
                    <TableCell>{brand.short_name || '-'}</TableCell>
                    <TableCell>{(brand as any).brand_type?.type_name || '-'}</TableCell>
                    <TableCell>{brand.usd_value_for_coins || 0}</TableCell>
                    <TableCell>{brand.recharge_usd_value?.toFixed(3) || '0.000'}</TableCell>
                    <TableCell>{brand.leadtime || 0}</TableCell>
                    <TableCell>{brand.safety_stock || 0}</TableCell>
                    <TableCell>{brand.reorder_point || 0}</TableCell>
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
      </div>
    </>
  );
};

export default BrandSetup;
