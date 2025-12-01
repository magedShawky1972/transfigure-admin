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
import { ArrowLeft, Calculator } from "lucide-react";

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
  const [initialBrandTypeId, setInitialBrandTypeId] = useState<string | null>(null);
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

  // Format number with thousand separators and 2 decimal places
  const formatNumber = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return "0.00";
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Parse formatted number back to raw value
  const parseFormattedNumber = (value: string): string => {
    return value.replace(/,/g, '');
  };

  // Calculate safety stock when leadtime or average_consumption_per_day changes
  const calculateSafetyStock = (leadtime: string, avgDaily: string): string => {
    const lt = parseFloat(leadtime) || 0;
    const daily = parseFloat(avgDaily) || 0;
    return (lt * daily).toFixed(2);
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchBrandTypes();
      if (brandId) {
        await fetchBrand();
      }
    };
    loadData();
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

  const generateBrandCode = async (brandTypeId: string) => {
    if (brandTypeId === "none") {
      setFormData(prev => ({ ...prev, brand_code: "" }));
      return;
    }

    try {
      // Get the brand type code
      const brandType = brandTypes.find(bt => bt.id === brandTypeId);
      if (!brandType) return;

      // Get the highest existing brand code for this brand type
      const { data, error } = await supabase
        .from("brands")
        .select("brand_code")
        .ilike("brand_code", `${brandType.type_code}%`)
        .order("brand_code", { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0 && data[0].brand_code) {
        // Extract the numeric part from the last code
        const lastCode = data[0].brand_code;
        const numericPart = lastCode.substring(brandType.type_code.length);
        const lastNumber = parseInt(numericPart, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Format with leading zeros (3 digits)
      const newCode = `${brandType.type_code}${nextNumber.toString().padStart(3, '0')}`;
      setFormData(prev => ({ ...prev, brand_code: newCode }));
    } catch (error: any) {
      console.error("Error generating brand code:", error);
      toast({
        title: t("common.error"),
        description: "Failed to generate brand code",
        variant: "destructive",
      });
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
        setInitialBrandTypeId(data.brand_type_id || "none");
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

  const calculateConsumption = async () => {
    if (!formData.brand_code) {
      toast({
        title: t("common.error"),
        description: "Brand code is required to calculate consumption",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get daily consumption data for the last 90 days
      const { data, error } = await supabase
        .from("purpletransaction")
        .select("created_at_date, coins_number")
        .eq("brand_code", formData.brand_code)
        .gte("created_at_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "No transactions found for this brand in the last 90 days",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Group by date and sum coins
      const dailyTotals: Record<string, number> = {};
      data.forEach((tx: any) => {
        if (tx.created_at_date) {
          const dateKey = tx.created_at_date.split("T")[0].split(" ")[0];
          dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + (tx.coins_number || 0);
        }
      });

      const dailyValues = Object.values(dailyTotals);
      const daysCount = dailyValues.length;
      
      if (daysCount === 0) {
        toast({
          title: "No Data",
          description: "No valid transaction dates found",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const totalCoins = dailyValues.reduce((sum, val) => sum + val, 0);
      const avgDaily = totalCoins / daysCount;
      const avgMonthly = avgDaily * 30;

      const newSafetyStock = calculateSafetyStock(formData.leadtime, avgDaily.toFixed(2));
      setFormData(prev => ({
        ...prev,
        average_consumption_per_day: avgDaily.toFixed(2),
        average_consumption_per_month: avgMonthly.toFixed(2),
        safety_stock: newSafetyStock,
      }));

      toast({
        title: t("common.success"),
        description: `Calculated from ${daysCount} days of data. Daily: ${avgDaily.toLocaleString()}, Monthly: ${avgMonthly.toLocaleString()}`,
      });
    } catch (error: any) {
      console.error("Error calculating consumption:", error);
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

        <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                placeholder="Auto-generated from brand type"
                disabled={!!brandId}
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
                onChange={(e) => {
                  const newLeadtime = e.target.value;
                  const newSafetyStock = calculateSafetyStock(newLeadtime, formData.average_consumption_per_day);
                  setFormData({ ...formData, leadtime: newLeadtime, safety_stock: newSafetyStock });
                }}
                placeholder="Enter lead time in days"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="safety_stock">Safety Stock ({formatNumber(formData.safety_stock)})</Label>
              <Input
                id="safety_stock"
                type="number"
                min="0"
                step="0.01"
                value={formData.safety_stock}
                onChange={(e) =>
                  setFormData({ ...formData, safety_stock: e.target.value })
                }
                placeholder="Auto-calculated: Lead Time × Daily Avg"
                className="bg-muted"
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
              <Label htmlFor="average_consumption_per_month">Average Consumption Per Month ({formatNumber(formData.average_consumption_per_month)})</Label>
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
              <Label htmlFor="average_consumption_per_day">Average Consumption Per Day ({formatNumber(formData.average_consumption_per_day)})</Label>
              <Input
                id="average_consumption_per_day"
                type="number"
                min="0"
                step="0.01"
                value={formData.average_consumption_per_day}
                onChange={(e) => {
                  const newAvgDaily = e.target.value;
                  const newSafetyStock = calculateSafetyStock(formData.leadtime, newAvgDaily);
                  setFormData({ ...formData, average_consumption_per_day: newAvgDaily, safety_stock: newSafetyStock });
                }}
                placeholder="Enter average consumption per day"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>&nbsp;</Label>
              <Button 
                type="button" 
                variant="outline" 
                onClick={calculateConsumption}
                disabled={loading || !formData.brand_code}
                className="w-full md:w-auto"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Consumption from Transactions (90 days)
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand_type_id">{t("brandSetup.brandType")}</Label>
              <Select
                value={formData.brand_type_id}
                onValueChange={async (value) => {
                  setFormData({ ...formData, brand_type_id: value });
                  // Generate code for new brands or when type changes in edit mode
                  if (!brandId || (brandId && value !== initialBrandTypeId)) {
                    await generateBrandCode(value);
                  }
                }}
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
