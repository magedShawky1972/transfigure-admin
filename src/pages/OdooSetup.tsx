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
  customer_api_url_test: string;
  product_api_url: string;
  product_api_url_test: string;
  brand_api_url: string;
  brand_api_url_test: string;
  supplier_api_url: string;
  supplier_api_url_test: string;
  sales_order_api_url: string;
  sales_order_api_url_test: string;
  purchase_order_api_url: string;
  purchase_order_api_url_test: string;
  api_key: string;
  is_active: boolean;
}

const OdooSetup = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<OdooConfig>({
    customer_api_url: "",
    customer_api_url_test: "",
    product_api_url: "",
    product_api_url_test: "",
    brand_api_url: "",
    brand_api_url_test: "",
    supplier_api_url: "",
    supplier_api_url_test: "",
    sales_order_api_url: "",
    sales_order_api_url_test: "",
    purchase_order_api_url: "",
    purchase_order_api_url_test: "",
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
        setConfig({
          id: data.id,
          customer_api_url: data.customer_api_url || "",
          customer_api_url_test: (data as any).customer_api_url_test || "",
          product_api_url: data.product_api_url || "",
          product_api_url_test: (data as any).product_api_url_test || "",
          brand_api_url: data.brand_api_url || "",
          brand_api_url_test: (data as any).brand_api_url_test || "",
          supplier_api_url: (data as any).supplier_api_url || "",
          supplier_api_url_test: (data as any).supplier_api_url_test || "",
          sales_order_api_url: (data as any).sales_order_api_url || "",
          sales_order_api_url_test: (data as any).sales_order_api_url_test || "",
          purchase_order_api_url: (data as any).purchase_order_api_url || "",
          purchase_order_api_url_test: (data as any).purchase_order_api_url_test || "",
          api_key: data.api_key || "",
          is_active: data.is_active,
        });
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
    if (!config.api_key) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" 
          ? "يرجى إدخال مفتاح API" 
          : "Please enter the API key",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const saveData = {
        customer_api_url: config.customer_api_url,
        customer_api_url_test: config.customer_api_url_test,
        product_api_url: config.product_api_url,
        product_api_url_test: config.product_api_url_test,
        brand_api_url: config.brand_api_url,
        brand_api_url_test: config.brand_api_url_test,
        supplier_api_url: config.supplier_api_url,
        supplier_api_url_test: config.supplier_api_url_test,
        sales_order_api_url: config.sales_order_api_url,
        sales_order_api_url_test: config.sales_order_api_url_test,
        purchase_order_api_url: config.purchase_order_api_url,
        purchase_order_api_url_test: config.purchase_order_api_url_test,
        api_key: config.api_key,
        is_active: config.is_active,
      };

      if (config.id) {
        const { error } = await supabase
          .from("odoo_api_config")
          .update(saveData)
          .eq("id", config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("odoo_api_config")
          .insert(saveData);

        if (error) throw error;
      }

      toast({
        title: language === "ar" ? "نجح" : "Success",
        description: language === "ar" 
          ? "تم حفظ إعدادات Odoo بنجاح" 
          : "Odoo configuration saved successfully",
      });

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

  const renderUrlSection = (
    label: string,
    prodKey: keyof OdooConfig,
    testKey: keyof OdooConfig,
    placeholder: string
  ) => (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <Label className="text-base font-semibold">{label}</Label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={prodKey} className="text-sm text-muted-foreground">
            {language === "ar" ? "الإنتاج (Production)" : "Production"}
          </Label>
          <Input
            id={prodKey}
            type="url"
            placeholder={placeholder}
            value={config[prodKey] as string}
            onChange={(e) => setConfig({ ...config, [prodKey]: e.target.value })}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={testKey} className="text-sm text-muted-foreground">
            {language === "ar" ? "الاختبار (Test)" : "Test"}
          </Label>
          <Input
            id={testKey}
            type="url"
            placeholder={placeholder.replace("your-odoo-instance", "test-instance")}
            value={config[testKey] as string}
            onChange={(e) => setConfig({ ...config, [testKey]: e.target.value })}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {language === "ar" ? "إعداد Odoo API" : "Odoo API Setup"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "قم بتكوين إعدادات اتصال Odoo API للإنتاج والاختبار"
              : "Configure your Odoo API connection settings for production and test environments"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {renderUrlSection(
            language === "ar" ? "عنوان API للعملاء" : "Customer API URL",
            "customer_api_url",
            "customer_api_url_test",
            "https://your-odoo-instance.com/api/partners"
          )}

          {renderUrlSection(
            language === "ar" ? "عنوان API للمنتجات" : "Product API URL",
            "product_api_url",
            "product_api_url_test",
            "https://your-odoo-instance.com/api/products"
          )}

          {renderUrlSection(
            language === "ar" ? "عنوان API للعلامات التجارية" : "Brand API URL",
            "brand_api_url",
            "brand_api_url_test",
            "https://your-odoo-instance.com/api/product_categories"
          )}

          {renderUrlSection(
            language === "ar" ? "عنوان API للموردين" : "Supplier API URL",
            "supplier_api_url",
            "supplier_api_url_test",
            "https://your-odoo-instance.com/api/suppliers"
          )}

          {renderUrlSection(
            language === "ar" ? "عنوان API لأوامر البيع" : "Sales Order API URL",
            "sales_order_api_url",
            "sales_order_api_url_test",
            "https://your-odoo-instance.com/api/sales_orders"
          )}

          {renderUrlSection(
            language === "ar" ? "عنوان API لأوامر الشراء" : "Purchase Order API URL",
            "purchase_order_api_url",
            "purchase_order_api_url_test",
            "https://your-odoo-instance.com/api/purchase_orders"
          )}

          <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
            <Label htmlFor="api_key" className="text-base font-semibold">
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
