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
import { Pencil, Trash2, Plus, RefreshCw, Truck } from "lucide-react";
import BrandSuppliersDialog from "@/components/BrandSuppliersDialog";
import { format } from "date-fns";

interface Brand {
  id: string;
  brand_name: string;
  brand_code?: string;
  short_name?: string;
  usd_value_for_coins?: number;
  recharge_usd_value?: number;
  leadtime?: number;
  safety_stock?: number;
  reorder_point?: number;
  average_consumption_per_month?: number;
  abc_analysis?: string;
  status: string;
  brand_type_id?: string;
  odoo_category_id?: number;
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
  const [brandTypes, setBrandTypes] = useState<BrandType[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingBrandId, setSyncingBrandId] = useState<string | null>(null);
  const [suppliersDialogBrand, setSuppliersDialogBrand] = useState<Brand | null>(null);
  
  // Load filters from localStorage or use defaults
  const [filterBrandName, setFilterBrandName] = useState(() => 
    localStorage.getItem("brandSetup_filterBrandName") || ""
  );
  const [filterShortName, setFilterShortName] = useState(() => 
    localStorage.getItem("brandSetup_filterShortName") || ""
  );
  const [filterABCAnalysis, setFilterABCAnalysis] = useState(() => 
    localStorage.getItem("brandSetup_filterABCAnalysis") || ""
  );
  const [filterBrandType, setFilterBrandType] = useState(() => 
    localStorage.getItem("brandSetup_filterBrandType") || ""
  );
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("brandSetup_filterBrandName", filterBrandName);
  }, [filterBrandName]);

  useEffect(() => {
    localStorage.setItem("brandSetup_filterShortName", filterShortName);
  }, [filterShortName]);

  useEffect(() => {
    localStorage.setItem("brandSetup_filterABCAnalysis", filterABCAnalysis);
  }, [filterABCAnalysis]);

  useEffect(() => {
    localStorage.setItem("brandSetup_filterBrandType", filterBrandType);
  }, [filterBrandType]);

  useEffect(() => {
    fetchBrands();
    fetchBrandTypes();
  }, []);

  const fetchBrandTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("brand_type")
        .select("*")
        .eq("status", "active")
        .order("type_name", { ascending: true });

      if (error) throw error;
      setBrandTypes(data || []);
    } catch (error: any) {
      console.error("Error fetching brand types:", error);
    }
  };

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

  const handleSyncToOdoo = async (brand: Brand) => {
    if (!brand.brand_code) {
      toast({
        title: t("common.error"),
        description: "Brand code is required for Odoo sync",
        variant: "destructive",
      });
      return;
    }

    setSyncingBrandId(brand.id);
    try {
      const { data, error } = await supabase.functions.invoke('sync-brand-to-odoo', {
        body: {
          brand_id: brand.id,
          brand_code: brand.brand_code,
          brand_name: brand.brand_name,
          status: brand.status,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t("common.success"),
          description: data.message || "Brand synced to Odoo successfully",
        });
        // Refresh brands to get updated odoo_category_id
        fetchBrands();
      } else {
        throw new Error(data.error || "Failed to sync brand to Odoo");
      }
    } catch (error: any) {
      console.error("Error syncing brand to Odoo:", error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to sync brand to Odoo",
        variant: "destructive",
      });
    } finally {
      setSyncingBrandId(null);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Filter and sort brands
  const filteredBrands = brands
    .filter((brand) => {
      const matchesBrandName = !filterBrandName || 
        brand.brand_name.toLowerCase().includes(filterBrandName.toLowerCase());
      const matchesShortName = !filterShortName || 
        (brand.short_name && brand.short_name.toLowerCase().includes(filterShortName.toLowerCase()));
      const matchesABCAnalysis = !filterABCAnalysis || 
        brand.abc_analysis === filterABCAnalysis;
      const matchesBrandType = !filterBrandType || 
        brand.brand_type_id === filterBrandType;
      
      return matchesBrandName && matchesShortName && matchesABCAnalysis && matchesBrandType;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      
      let aValue: any = a[sortColumn as keyof Brand];
      let bValue: any = b[sortColumn as keyof Brand];
      
      // Handle nested brand_type
      if (sortColumn === "brand_type") {
        aValue = (a as any).brand_type?.type_name || "";
        bValue = (b as any).brand_type?.type_name || "";
      }
      
      // Handle null/undefined values
      if (aValue == null) aValue = "";
      if (bValue == null) bValue = "";
      
      // Numeric comparison
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      // String comparison
      const comparison = String(aValue).localeCompare(String(bValue));
      return sortDirection === "asc" ? comparison : -comparison;
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="space-y-2">
            <Label htmlFor="filterABCAnalysis">Filter by ABC Analysis</Label>
            <select
              id="filterABCAnalysis"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={filterABCAnalysis}
              onChange={(e) => setFilterABCAnalysis(e.target.value)}
            >
              <option value="">All</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterBrandType">Filter by Brand Type</Label>
            <select
              id="filterBrandType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={filterBrandType}
              onChange={(e) => setFilterBrandType(e.target.value)}
            >
              <option value="">All</option>
              {brandTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.type_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("brand_name")}>
                  {t("brandSetup.brandName")} {sortColumn === "brand_name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("brand_code")}>
                  Brand Code {sortColumn === "brand_code" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("short_name")}>
                  Short Name {sortColumn === "short_name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("brand_type")}>
                  {t("brandSetup.brandType")} {sortColumn === "brand_type" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("abc_analysis")}>
                  ABC Analysis {sortColumn === "abc_analysis" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("usd_value_for_coins")}>
                  USD Value {sortColumn === "usd_value_for_coins" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("one_usd_to_coins")}>
                  1 USD=Coins {sortColumn === "one_usd_to_coins" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("recharge_usd_value")}>
                  Recharge USD {sortColumn === "recharge_usd_value" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("leadtime")}>
                  Lead Time {sortColumn === "leadtime" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("safety_stock")}>
                  Safety Stock {sortColumn === "safety_stock" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("reorder_point")}>
                  Reorder Point {sortColumn === "reorder_point" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("average_consumption_per_month")}>
                  Avg Consumption/Mo {sortColumn === "average_consumption_per_month" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("status")}>
                  {t("brandSetup.status")} {sortColumn === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer hover:bg-accent" onClick={() => handleSort("odoo_category_id")}>
                  Odoo ID {sortColumn === "odoo_category_id" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>{t("brandSetup.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                    {filterBrandName || filterShortName || filterABCAnalysis || filterBrandType ? "No brands match your filters" : t("brandSetup.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.brand_name}</TableCell>
                    <TableCell>{brand.brand_code || '-'}</TableCell>
                    <TableCell>{brand.short_name || '-'}</TableCell>
                    <TableCell>{(brand as any).brand_type?.type_name || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        brand.abc_analysis === 'A' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : brand.abc_analysis === 'B'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {brand.abc_analysis || 'C'}
                      </span>
                    </TableCell>
                    <TableCell>{brand.usd_value_for_coins || 0}</TableCell>
                    <TableCell>{(brand as any).one_usd_to_coins ? parseFloat((brand as any).one_usd_to_coins).toFixed(8) : '-'}</TableCell>
                    <TableCell>{brand.recharge_usd_value?.toFixed(3) || '0.000'}</TableCell>
                    <TableCell>{brand.leadtime || 0}</TableCell>
                    <TableCell>{brand.safety_stock || 0}</TableCell>
                    <TableCell>{brand.reorder_point || 0}</TableCell>
                    <TableCell>{brand.average_consumption_per_month || 0}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        brand.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {brand.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {brand.odoo_category_id ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {brand.odoo_category_id}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSuppliersDialogBrand(brand)}
                          title="Suppliers"
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncToOdoo(brand)}
                          disabled={syncingBrandId === brand.id || !brand.brand_code}
                          title="Sync to Odoo"
                        >
                          <RefreshCw className={`h-4 w-4 ${syncingBrandId === brand.id ? 'animate-spin' : ''}`} />
                        </Button>
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

      {suppliersDialogBrand && (
        <BrandSuppliersDialog
          open={!!suppliersDialogBrand}
          onOpenChange={(open) => !open && setSuppliersDialogBrand(null)}
          brandId={suppliersDialogBrand.id}
          brandName={suppliersDialogBrand.brand_name}
        />
      )}
    </>
  );
};

export default BrandSetup;
