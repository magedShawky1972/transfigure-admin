import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface OdooConfig {
  id?: string;
  customer_api_url: string;
  product_api_url: string;
  api_key: string;
  is_active: boolean;
}

const OdooSetup = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<OdooConfig>({
    customer_api_url: "",
    product_api_url: "",
    api_key: "",
    is_active: true,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("odoo_api_config")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error("Error fetching Odoo config:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" 
          ? "فشل في تحميل إعدادات Odoo" 
          : "Failed to load Odoo configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.customer_api_url || !config.product_api_url || !config.api_key) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" 
          ? "يرجى ملء جميع الحقول المطلوبة" 
          : "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (config.id) {
        // Update existing config
        const { error } = await supabase
          .from("odoo_api_config")
          .update({
            customer_api_url: config.customer_api_url,
            product_api_url: config.product_api_url,
            api_key: config.api_key,
            is_active: config.is_active,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from("odoo_api_config")
          .insert({
            customer_api_url: config.customer_api_url,
            product_api_url: config.product_api_url,
            api_key: config.api_key,
            is_active: config.is_active,
          });

        if (error) throw error;
      }

      toast({
        title: language === "ar" ? "نجح" : "Success",
        description: language === "ar" 
          ? "تم حفظ إعدادات Odoo بنجاح" 
          : "Odoo configuration saved successfully",
      });

      // Refresh the config
      fetchConfig();
    } catch (error) {
      console.error("Error saving Odoo config:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" 
          ? "فشل في حفظ إعدادات Odoo" 
          : "Failed to save Odoo configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {language === "ar" ? "إعداد Odoo API" : "Odoo API Setup"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "قم بتكوين إعدادات اتصال Odoo API"
              : "Configure your Odoo API connection settings"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="customer_api_url">
              {language === "ar" ? "عنوان API للعملاء" : "Customer API URL"}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="customer_api_url"
              type="url"
              placeholder="https://your-odoo-instance.com/api/partners"
              value={config.customer_api_url}
              onChange={(e) => setConfig({ ...config, customer_api_url: e.target.value })}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              {language === "ar"
                ? "أدخل عنوان URL الكامل لنقطة نهاية API الخاصة بالعملاء"
                : "Enter the full URL of the customer API endpoint"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_api_url">
              {language === "ar" ? "عنوان API للمنتجات" : "Product API URL"}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="product_api_url"
              type="url"
              placeholder="https://your-odoo-instance.com/api/products"
              value={config.product_api_url}
              onChange={(e) => setConfig({ ...config, product_api_url: e.target.value })}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              {language === "ar"
                ? "أدخل عنوان URL الكامل لنقطة نهاية API الخاصة بالمنتجات"
                : "Enter the full URL of the product API endpoint"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api_key">
              {language === "ar" ? "مفتاح API" : "API Key"}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="api_key"
              type="password"
              placeholder="Enter your API key"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              {language === "ar"
                ? "أدخل مفتاح API الخاص بك لـ Odoo"
                : "Enter your API key for Odoo authentication"}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading
                ? language === "ar"
                  ? "جارٍ الحفظ..."
                  : "Saving..."
                : language === "ar"
                ? "حفظ"
                : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={fetchConfig}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {language === "ar" ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OdooSetup;
