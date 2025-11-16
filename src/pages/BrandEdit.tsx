import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";

interface BrandType {
  id: string;
  type_code: string;
  type_name: string;
  status: string;
}

const BrandEdit = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const brandId = searchParams.get("id");
  const [brandTypes, setBrandTypes] = useState<BrandType[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand_name: "",
    brand_code: "",
    short_name: "",
    usd_value_for_coins: "",
    recharge_usd_value: "",
    leadtime: "",
    safety_stock: "",
    reorder_point: "",
    average_consumption_per_month: "",
    average_consumption_per_day: "",
    abc_analysis: "C",
    brand_type_id: "none",
    status: "active",
  });

  useEffect(() => {
    fetchBrandTypes();
    if (brandId) {
      fetchBrand();
    }
  }, [brandId]);

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

  const fetchBrand = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .single();

      if (error) throw error;
      
      if (data) {
        setFormData({
          brand_name: data.brand_name,
          brand_code: data.brand_code || "",
          short_name: data.short_name || "",
          usd_value_for_coins: data.usd_value_for_coins?.toString() || "",
          recharge_usd_value: data.recharge_usd_value?.toString() || "",
          leadtime: data.leadtime?.toString() || "",
          safety_stock: data.safety_stock?.toString() || "",
          reorder_point: data.reorder_point?.toString() || "",
          average_consumption_per_month: data.average_consumption_per_month?.toString() || "",
          average_consumption_per_day: data.average_consumption_per_day?.toString() || "",
          abc_analysis: data.abc_analysis || "C",
          brand_type_id: data.brand_type_id || "none",
          status: data.status,
        });
      }
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
      if (brandId) {
        const { error } = await supabase
          .from("brands")
          .update({
            brand_name: formData.brand_name,
            brand_code: formData.brand_code || null,
            short_name: formData.short_name,
            usd_value_for_coins: formData.usd_value_for_coins ? parseFloat(formData.usd_value_for_coins) : 0,
            recharge_usd_value: formData.recharge_usd_value ? parseFloat(formData.recharge_usd_value) : 0,
            leadtime: formData.leadtime ? parseFloat(formData.leadtime) : 0,
            safety_stock: formData.safety_stock ? parseFloat(formData.safety_stock) : 0,
            reorder_point: formData.reorder_point ? parseFloat(formData.reorder_point) : 0,
            average_consumption_per_month: formData.average_consumption_per_month ? parseFloat(formData.average_consumption_per_month) : 0,
            average_consumption_per_day: formData.average_consumption_per_day ? parseFloat(formData.average_consumption_per_day) : 0,
            abc_analysis: formData.abc_analysis,
            brand_type_id: formData.brand_type_id === "none" ? null : formData.brand_type_id,
            status: formData.status,
          })
          .eq("id", brandId);

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
            brand_code: formData.brand_code || null,
            short_name: formData.short_name,
            usd_value_for_coins: formData.usd_value_for_coins ? parseFloat(formData.usd_value_for_coins) : 0,
            recharge_usd_value: formData.recharge_usd_value ? parseFloat(formData.recharge_usd_value) : 0,
            leadtime: formData.leadtime ? parseFloat(formData.leadtime) : 0,
            safety_stock: formData.safety_stock ? parseFloat(formData.safety_stock) : 0,
            reorder_point: formData.reorder_point ? parseFloat(formData.reorder_point) : 0,
            average_consumption_per_month: formData.average_consumption_per_month ? parseFloat(formData.average_consumption_per_month) : 0,
            average_consumption_per_day: formData.average_consumption_per_day ? parseFloat(formData.average_consumption_per_day) : 0,
            abc_analysis: formData.abc_analysis,
            brand_type_id: formData.brand_type_id === "none" ? null : formData.brand_type_id,
            status: formData.status,
          });

        if (error) throw error;
        toast({
          title: t("common.success"),
          description: t("brandSetup.created"),
        });
      }

      navigate("/brand-setup");
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

  return (
    <>
      {loading && <LoadingOverlay progress={100} message={t("common.loading")} />}
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/brand-setup")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {brandId ? t("brandSetup.editBrand") : t("brandSetup.addNew")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
            <Label htmlFor="brand_code">Brand Code</Label>
            <Input
              id="brand_code"
              value={formData.brand_code}
              onChange={(e) =>
                setFormData({ ...formData, brand_code: e.target.value })
              }
              placeholder="Enter brand code"
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
            <Label htmlFor="recharge_usd_value">Recharge USD Value</Label>
            <Input
              id="recharge_usd_value"
              type="number"
              step="0.001"
              value={formData.recharge_usd_value}
              onChange={(e) =>
                setFormData({ ...formData, recharge_usd_value: e.target.value })
              }
              placeholder="Enter recharge USD value"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leadtime">Lead Time (Days)</Label>
            <Input
              id="leadtime"
              type="number"
              min="0"
              step="1"
              value={formData.leadtime}
              onChange={(e) =>
                setFormData({ ...formData, leadtime: e.target.value })
              }
              placeholder="Enter lead time in days"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="safety_stock">Safety Stock</Label>
            <Input
              id="safety_stock"
              type="number"
              min="0"
              step="1"
              value={formData.safety_stock}
              onChange={(e) =>
                setFormData({ ...formData, safety_stock: e.target.value })
              }
              placeholder="Enter safety stock quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reorder_point">Reorder Point</Label>
            <Input
              id="reorder_point"
              type="number"
              min="0"
              step="1"
              value={formData.reorder_point}
              onChange={(e) =>
                setFormData({ ...formData, reorder_point: e.target.value })
              }
              placeholder="Enter reorder point quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="average_consumption_per_month">Average Consumption Per Month</Label>
            <Input
              id="average_consumption_per_month"
              type="number"
              min="0"
              step="0.01"
              value={formData.average_consumption_per_month}
              onChange={(e) =>
                setFormData({ ...formData, average_consumption_per_month: e.target.value })
              }
              placeholder="Enter average consumption per month"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="average_consumption_per_day">Average Consumption Per Day</Label>
            <Input
              id="average_consumption_per_day"
              type="number"
              min="0"
              step="0.01"
              value={formData.average_consumption_per_day}
              onChange={(e) =>
                setFormData({ ...formData, average_consumption_per_day: e.target.value })
              }
              placeholder="Enter average consumption per day"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand_type_id">{t("brandSetup.brandType")}</Label>
            <Select
              value={formData.brand_type_id}
              onValueChange={(value) =>
                setFormData({ ...formData, brand_type_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("brandSetup.selectBrandType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("brandSetup.noBrandType")}</SelectItem>
                {brandTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.type_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="abc_analysis">ABC Analysis</Label>
            <Select
              value={formData.abc_analysis}
              onValueChange={(value) =>
                setFormData({ ...formData, abc_analysis: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">A - High Value</SelectItem>
                <SelectItem value="B">B - Medium Value</SelectItem>
                <SelectItem value="C">C - Low Value</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="flex gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/brand-setup")}
            >
              {t("brandSetup.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("brandSetup.saving") : t("brandSetup.save")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

export default BrandEdit;
