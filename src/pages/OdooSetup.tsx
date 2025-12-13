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
  api_key_test: string;
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
    api_key_test: "",
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
          api_key_test: (data as any).api_key_test || "",
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
          ? "يرجى إدخال مفتاح API للإنتاج" 
          : "Please enter the Production API key",
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
        api_key_test: config.api_key_test,
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
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <Label className="text-base font-semibold">{label}</Label>
      
      <div className="space-y-2">
        <Label htmlFor={prodKey} className="text-sm text-muted-foreground flex items-center gap-2">
          <span className="bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs font-medium">
            {language === "ar" ? "الإنتاج" : "Production"}
          </span>
        </Label>
        <Input
          id={prodKey}
          type="url"
          placeholder={placeholder}
          value={config[prodKey] as string}
          onChange={(e) => setConfig({ ...config, [prodKey]: e.target.value })}
          disabled={loading}
          className="font-mono text-sm"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor={testKey} className="text-sm text-muted-foreground flex items-center gap-2">
          <span className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded text-xs font-medium">
            {language === "ar" ? "الاختبار" : "Test"}
          </span>
        </Label>
        <Input
          id={testKey}
          type="url"
          placeholder={placeholder.replace("your-odoo-instance", "test-instance")}
          value={config[testKey] as string}
          onChange={(e) => setConfig({ ...config, [testKey]: e.target.value })}
          disabled={loading}
          className="font-mono text-sm"
        />
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
          {/* API Keys Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base font-semibold">
              {language === "ar" ? "مفاتيح API" : "API Keys"}
              <span className="text-destructive ml-1">*</span>
            </Label>
            
            <div className="space-y-2">
              <Label htmlFor="api_key" className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs font-medium">
                  {language === "ar" ? "الإنتاج" : "Production"}
                </span>
              </Label>
              <Input
                id="api_key"
                type="password"
                placeholder="Enter production API key"
                value={config.api_key}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api_key_test" className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded text-xs font-medium">
                  {language === "ar" ? "الاختبار" : "Test"}
                </span>
              </Label>
              <Input
                id="api_key_test"
                type="password"
                placeholder="Enter test API key"
                value={config.api_key_test}
                onChange={(e) => setConfig({ ...config, api_key_test: e.target.value })}
                disabled={loading}
              />
            </div>
            
            <p className="text-sm text-muted-foreground">
              {language === "ar"
                ? "أدخل مفاتيح API الخاصة بك لـ Odoo"
                : "Enter your API keys for Odoo authentication"}
            </p>
          </div>

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
