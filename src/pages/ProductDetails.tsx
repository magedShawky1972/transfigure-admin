import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Save, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface Product {
  id: string;
  product_id: string | null;
  product_name: string;
  product_price: string | null;
  product_cost: string | null;
  brand_name: string | null;
  brand_code: string | null;
  brand_type: string | null;
  status: string;
  sku?: string | null;
  description?: string | null;
  category?: string | null;
  stock_quantity?: number | null;
  minimum_order_quantity?: number | null;
  reorder_point?: number | null;
  weight?: number | null;
  barcode?: string | null;
  supplier?: string | null;
  notes?: string | null;
}

interface FreeCoin {
  coins_number: string;
  coins_price: string;
}

interface ProductOption {
  option_id: string;
  required: boolean;
}

interface CustomerGroupPrice {
  group_name: string;
  price: string;
  discount_type: string;
  min_quantity: string;
  max_quantity: string;
  sale_price: string;
  purchase_price: string;
}

interface Discount {
  store: string;
  group_name: string;
  amount_type: string;
  amount: string;
  start_date: string;
  end_date: string;
}

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isRTL = language === "ar";
  const [loading, setLoading] = useState(true);

  // Product info section
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weight, setWeight] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [productName, setProductName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandCode, setBrandCode] = useState("");
  const [brandType, setBrandType] = useState("");
  const [brands, setBrands] = useState<Array<{
    id: string;
    brand_name: string;
    brand_code: string | null;
    brand_type_id: string | null;
    brand_type?: { type_name: string };
  }>>([]);
  const [status, setStatus] = useState("active");
  const [productId, setProductId] = useState("");
  const [odooProductId, setOdooProductId] = useState("");
  const [leadtime, setLeadtime] = useState("");
  const [safetyStock, setSafetyStock] = useState("");
  const [abcAnalysis, setAbcAnalysis] = useState("C");

  // Stock section
  const [quantity, setQuantity] = useState("0");
  const [coinsNumber, setCoinsNumber] = useState("4000000");
  const [notifyQty, setNotifyQty] = useState("1");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("10");
  const [minCoins, setMinCoins] = useState("0");
  const [maxCoins, setMaxCoins] = useState("0");

  // Pricing section
  const [costPrice, setCostPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");
  const [taxType, setTaxType] = useState("tax_included");

  // Mobile toggle
  const [mobileEnabled, setMobileEnabled] = useState(true);
  
  // Non-stock toggle
  const [nonStock, setNonStock] = useState(false);

  // Free coins section
  const [freeCoins, setFreeCoins] = useState<FreeCoin[]>([
    { coins_number: "", coins_price: "" }
  ]);

  // Options section
  const [options, setOptions] = useState<ProductOption[]>([
    { option_id: "Account ID", required: true }
  ]);

  // Customer group prices
  const [customerGroupPrices, setCustomerGroupPrices] = useState<CustomerGroupPrice[]>([
    { group_name: "", price: "", discount_type: "%", min_quantity: "", max_quantity: "", sale_price: "", purchase_price: "" }
  ]);

  // Discounts
  const [discounts, setDiscounts] = useState<Discount[]>([
    { store: "purple_store", group_name: "all_customers_groups", amount_type: "fixed", amount: "", start_date: "", end_date: "" }
  ]);

  // SEO section
  const [metaTitleAr, setMetaTitleAr] = useState("");
  const [metaKeywordsAr, setMetaKeywordsAr] = useState("");
  const [metaDescriptionAr, setMetaDescriptionAr] = useState("");
  const [metaTitleEn, setMetaTitleEn] = useState("");
  const [metaKeywordsEn, setMetaKeywordsEn] = useState("");
  const [metaDescriptionEn, setMetaDescriptionEn] = useState("");

  useEffect(() => {
    fetchBrands();
    fetchProductDetails();
  }, [id]);

  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase
        .from("brands")
        .select(`
          id,
          brand_name,
          brand_code,
          brand_type_id,
          brand_type:brand_type_id (
            type_name
          )
        `)
        .eq("status", "active")
        .order("brand_name", { ascending: true });

      if (error) throw error;
      setBrands(data || []);
    } catch (error: any) {
      console.error("Error fetching brands:", error);
    }
  };

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        setProductId(data.product_id || "");
        setOdooProductId(data.odoo_product_id?.toString() || "");
        setSku(data.sku || "");
        setDescription(data.description || "");
        setCategory(data.category || "");
        setBarcode(data.barcode || "");
        setWeight(data.weight?.toString() || "");
        setSupplier(data.supplier || "");
        setNotes(data.notes || "");
        setLeadtime(data.leadtime?.toString() || "0");
        setSafetyStock(data.safety_stock?.toString() || "0");
        setAbcAnalysis(data.abc_analysis || "C");
        setProductName(data.product_name);
        setBrandName(data.brand_name || "");
        setBrandCode(data.brand_code || "");
        setBrandType(data.brand_type || "");
        setStatus(data.status);
        setQuantity(data.stock_quantity?.toString() || "0");
        setNotifyQty(data.reorder_point?.toString() || "1");
        setMinOrderQty(data.minimum_order_quantity?.toString() || "1");
        setMaxOrderQty(data.maximum_order_quantity?.toString() || "10");
        setCostPrice(data.product_cost || "");
        setRetailPrice(data.product_price || "");
        
        // Load new fields
        setMobileEnabled(data.mobile_enabled ?? true);
        setNonStock(data.non_stock ?? false);
        setCoinsNumber(data.coins_number?.toString() || "4000000");
        setMinCoins(data.min_coins?.toString() || "0");
        setMaxCoins(data.max_coins?.toString() || "0");
        setTaxType(data.tax_type || "tax_included");
        
        // Load JSON fields
        if (data.free_coins && Array.isArray(data.free_coins) && data.free_coins.length > 0) {
          setFreeCoins(data.free_coins as unknown as FreeCoin[]);
        }
        if (data.options && Array.isArray(data.options) && data.options.length > 0) {
          setOptions(data.options as unknown as ProductOption[]);
        }
        if (data.customer_group_prices && Array.isArray(data.customer_group_prices) && data.customer_group_prices.length > 0) {
          setCustomerGroupPrices(data.customer_group_prices as unknown as CustomerGroupPrice[]);
        }
        if (data.discounts && Array.isArray(data.discounts) && data.discounts.length > 0) {
          setDiscounts(data.discounts as unknown as Discount[]);
        }
        
        // Load SEO fields
        setMetaTitleAr(data.meta_title_ar || "");
        setMetaKeywordsAr(data.meta_keywords_ar || "");
        setMetaDescriptionAr(data.meta_description_ar || "");
        setMetaTitleEn(data.meta_title_en || "");
        setMetaKeywordsEn(data.meta_keywords_en || "");
        setMetaDescriptionEn(data.meta_description_en || "");
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
      navigate("/product-setup");
    } finally {
      setLoading(false);
    }
  };

  const addFreeCoin = () => {
    setFreeCoins([...freeCoins, { coins_number: "", coins_price: "" }]);
  };

  const removeFreeCoin = (index: number) => {
    setFreeCoins(freeCoins.filter((_, i) => i !== index));
  };

  const addOption = () => {
    setOptions([...options, { option_id: "", required: false }]);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const addCustomerGroupPrice = () => {
    setCustomerGroupPrices([...customerGroupPrices, { group_name: "", price: "", discount_type: "%", min_quantity: "", max_quantity: "", sale_price: "", purchase_price: "" }]);
  };

  const removeCustomerGroupPrice = (index: number) => {
    setCustomerGroupPrices(customerGroupPrices.filter((_, i) => i !== index));
  };

  const addDiscount = () => {
    setDiscounts([...discounts, { store: "purple_store", group_name: "all_customers_groups", amount_type: "fixed", amount: "", start_date: "", end_date: "" }]);
  };

  const removeDiscount = (index: number) => {
    setDiscounts(discounts.filter((_, i) => i !== index));
  };

  const handleBrandChange = (selectedBrandName: string) => {
    const selectedBrand = brands.find(b => b.brand_name === selectedBrandName);
    setBrandName(selectedBrandName);
    setBrandCode(selectedBrand?.brand_code || "");
    setBrandType(selectedBrand?.brand_type?.type_name || "");
  };

  const getSelectedBrandType = () => {
    const selectedBrand = brands.find(b => b.brand_name === brandName);
    return selectedBrand?.brand_type?.type_name || "";
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("products")
        .update({
          product_id: productId,
          sku,
          description,
          category,
          barcode,
          weight: weight ? parseFloat(weight) : null,
          supplier,
          notes,
          leadtime: leadtime ? parseFloat(leadtime) : 0,
          safety_stock: safetyStock ? parseFloat(safetyStock) : 0,
          abc_analysis: abcAnalysis,
          brand_name: brandName || null,
          brand_code: brandCode || null,
          brand_type: brandType || null,
          stock_quantity: quantity ? parseFloat(quantity) : 0,
          reorder_point: notifyQty ? parseFloat(notifyQty) : 1,
          minimum_order_quantity: minOrderQty ? parseFloat(minOrderQty) : 1,
          maximum_order_quantity: maxOrderQty ? parseFloat(maxOrderQty) : 10,
          product_cost: costPrice,
          product_price: retailPrice,
          mobile_enabled: mobileEnabled,
          non_stock: nonStock,
          coins_number: coinsNumber ? parseFloat(coinsNumber) : 0,
          min_coins: minCoins ? parseFloat(minCoins) : 0,
          max_coins: maxCoins ? parseFloat(maxCoins) : 0,
          tax_type: taxType,
          free_coins: freeCoins as any,
          options: options as any,
          customer_group_prices: customerGroupPrices as any,
          discounts: discounts as any,
          meta_title_ar: metaTitleAr,
          meta_keywords_ar: metaKeywordsAr,
          meta_description_ar: metaDescriptionAr,
          meta_title_en: metaTitleEn,
          meta_keywords_en: metaKeywordsEn,
          meta_description_en: metaDescriptionEn,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("productSetup.updated"),
      });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">{t("common.loading")}...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header with Back Button */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/product-setup")}
                className="gap-2"
              >
                {isRTL ? <ArrowLeft className="h-4 w-4 rotate-180" /> : <ArrowLeft className="h-4 w-4" />}
                {t("common.back")}
              </Button>
              <div className={isRTL ? 'text-right' : ''}>
                <h1 className="text-2xl font-bold">{productName}</h1>
                <p className="text-sm text-muted-foreground">{brandName}</p>
              </div>
            </div>
            <Button onClick={handleSave} disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {t("productSetup.save")}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-80px)]">
        <div className="container mx-auto px-4 py-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Mobile Toggle */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t("productSetup.mobile")}</Label>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-sm text-muted-foreground">
                      {mobileEnabled ? t("productSetup.enabled") : t("productSetup.disabled")}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={mobileEnabled ? "default" : "outline"}
                      onClick={() => setMobileEnabled(!mobileEnabled)}
                      className="w-16"
                    >
                      {mobileEnabled ? t("productSetup.on") : t("productSetup.off")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Non-Stock Toggle */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    {language === "ar" ? "منتج بدون مخزون" : "Non-Stock Product"}
                  </Label>
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Checkbox
                      checked={nonStock}
                      onCheckedChange={(checked) => setNonStock(checked === true)}
                      className="h-5 w-5"
                    />
                    <span className="text-sm text-muted-foreground">
                      {nonStock ? (language === "ar" ? "نعم" : "Yes") : (language === "ar" ? "لا" : "No")}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Information */}
            <Card>
              <CardHeader>
                <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.productInformation")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productId" className={isRTL ? 'text-right block' : ''}>{t("productSetup.productId")}</Label>
                    <Input
                      id="productId"
                      className={isRTL ? 'text-right' : ''}
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      placeholder={isRTL ? "معرف المنتج" : "Product ID"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="odooProductId" className={isRTL ? 'text-right block' : ''}>Odoo Product ID</Label>
                    <Input
                      id="odooProductId"
                      className={`${isRTL ? 'text-right' : ''} bg-muted`}
                      value={odooProductId}
                      disabled
                      placeholder={isRTL ? "معرف منتج أودو" : "Odoo Product ID"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brandName" className={isRTL ? 'text-right block' : ''}>{t("brandSetup.brandName")}</Label>
                    <Select value={brandName} onValueChange={handleBrandChange}>
                      <SelectTrigger className={isRTL ? 'text-right' : ''}>
                        <SelectValue placeholder={isRTL ? "اختر العلامة التجارية" : "Select brand"} />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.brand_name}>
                            {brand.brand_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brandType" className={isRTL ? 'text-right block' : ''}>Brand Type</Label>
                    <Input
                      id="brandType"
                      className={isRTL ? 'text-right' : ''}
                      value={brandType}
                      disabled
                      placeholder={isRTL ? "نوع العلامة التجارية" : "Brand type"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brandCode" className={isRTL ? 'text-right block' : ''}>Brand Code</Label>
                    <Input
                      id="brandCode"
                      className={isRTL ? 'text-right' : ''}
                      value={brandCode}
                      disabled
                      placeholder={isRTL ? "رمز العلامة التجارية" : "Brand code"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku" className={isRTL ? 'text-right block' : ''}>SKU</Label>
                    <Input
                      id="sku"
                      className={isRTL ? 'text-right' : ''}
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder={isRTL ? "أدخل SKU" : "Enter SKU"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode" className={isRTL ? 'text-right block' : ''}>{t("productSetup.barcode")}</Label>
                    <Input
                      id="barcode"
                      className={isRTL ? 'text-right' : ''}
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder={isRTL ? "أدخل الباركود" : "Enter barcode"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className={isRTL ? 'text-right block' : ''}>{t("productSetup.category")}</Label>
                    <Input
                      id="category"
                      className={isRTL ? 'text-right' : ''}
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder={isRTL ? "أدخل الفئة" : "Enter category"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="abcAnalysis" className={isRTL ? 'text-right block' : ''}>{t("productSetup.abcAnalysis")}</Label>
                    <Select value={abcAnalysis} onValueChange={setAbcAnalysis}>
                      <SelectTrigger id="abcAnalysis" className={isRTL ? 'justify-end text-right' : ''}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A - {isRTL ? "عالي القيمة" : "High Value"}</SelectItem>
                        <SelectItem value="B">B - {isRTL ? "متوسط القيمة" : "Medium Value"}</SelectItem>
                        <SelectItem value="C">C - {isRTL ? "منخفض القيمة" : "Low Value"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leadtime" className={isRTL ? 'text-right block' : ''}>{t("productSetup.leadtime")}</Label>
                    <Input
                      id="leadtime"
                      type="number"
                      step="1"
                      className={isRTL ? 'text-right' : ''}
                      value={leadtime}
                      onChange={(e) => setLeadtime(e.target.value)}
                      placeholder={isRTL ? "أدخل مدة التسليم (بالأيام)" : "Enter lead time (days)"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="safetyStock" className={isRTL ? 'text-right block' : ''}>{t("productSetup.safetyStock")}</Label>
                    <Input
                      id="safetyStock"
                      type="number"
                      step="1"
                      className={isRTL ? 'text-right' : ''}
                      value={safetyStock}
                      onChange={(e) => setSafetyStock(e.target.value)}
                      placeholder={isRTL ? "أدخل مخزون الأمان" : "Enter safety stock"}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight" className={isRTL ? 'text-right block' : ''}>{t("productSetup.weight")}</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.01"
                      className={isRTL ? 'text-right' : ''}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder={isRTL ? "أدخل الوزن" : "Enter weight"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier" className={isRTL ? 'text-right block' : ''}>{t("productSetup.supplier")}</Label>
                    <Input
                      id="supplier"
                      className={isRTL ? 'text-right' : ''}
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder={isRTL ? "أدخل اسم المورد" : "Enter supplier name"}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className={isRTL ? 'text-right block' : ''}>{t("productSetup.description")}</Label>
                  <Textarea
                    id="description"
                    className={isRTL ? 'text-right' : ''}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={isRTL ? "أدخل وصف المنتج" : "Enter product description"}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className={isRTL ? 'text-right block' : ''}>{t("productSetup.notes")}</Label>
                  <Textarea
                    id="notes"
                    className={isRTL ? 'text-right' : ''}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={isRTL ? "أدخل الملاحظات الداخلية" : "Enter internal notes"}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Stock Management */}
            <Card>
              <CardHeader>
                <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.stockManagement")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className={isRTL ? 'text-right block' : ''}>{t("productSetup.stockQuantity")} *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder={isRTL ? "أدخل الكمية" : "Enter quantity"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coinsNumber" className={isRTL ? 'text-right block' : ''}>{t("productSetup.coinsGiven")}</Label>
                    <Input
                      id="coinsNumber"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={coinsNumber}
                      onChange={(e) => setCoinsNumber(e.target.value)}
                      placeholder={isRTL ? "عدد النقاط" : "Coins number"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notifyQty" className={isRTL ? 'text-right block' : ''}>{t("productSetup.reorderPoint")} *</Label>
                    <Input
                      id="notifyQty"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={notifyQty}
                      onChange={(e) => setNotifyQty(e.target.value)}
                      placeholder={isRTL ? "مستوى إعادة الطلب" : "Stock level to reorder"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minOrderQty" className={isRTL ? 'text-right block' : ''}>{t("productSetup.minQuantity")} *</Label>
                    <Input
                      id="minOrderQty"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={minOrderQty}
                      onChange={(e) => setMinOrderQty(e.target.value)}
                      placeholder={isRTL ? "الحد الأدنى للكمية" : "Minimum quantity"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxOrderQty" className={isRTL ? 'text-right block' : ''}>{t("productSetup.maxQuantity")} *</Label>
                    <Input
                      id="maxOrderQty"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={maxOrderQty}
                      onChange={(e) => setMaxOrderQty(e.target.value)}
                      placeholder={isRTL ? "الحد الأقصى للكمية" : "Maximum quantity"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minCoins" className={isRTL ? 'text-right block' : ''}>{t("productSetup.minCoins")} *</Label>
                    <Input
                      id="minCoins"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={minCoins}
                      onChange={(e) => setMinCoins(e.target.value)}
                      placeholder={isRTL ? "الحد الأدنى للنقاط" : "Minimum coins"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxCoins" className={isRTL ? 'text-right block' : ''}>{t("productSetup.maxCoins")} *</Label>
                    <Input
                      id="maxCoins"
                      type="number"
                      className={isRTL ? 'text-right' : ''}
                      value={maxCoins}
                      onChange={(e) => setMaxCoins(e.target.value)}
                      placeholder={isRTL ? "الحد الأقصى للنقاط" : "Maximum coins"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.pricing")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="costPrice" className={isRTL ? 'text-right block' : ''}>{t("productSetup.productCost")} *</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      className={isRTL ? 'text-right' : ''}
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder={isRTL ? "أدخل سعر التكلفة" : "Enter cost price"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retailPrice" className={isRTL ? 'text-right block' : ''}>{t("productSetup.productPrice")} *</Label>
                    <Input
                      id="retailPrice"
                      type="number"
                      step="0.01"
                      className={isRTL ? 'text-right' : ''}
                      value={retailPrice}
                      onChange={(e) => setRetailPrice(e.target.value)}
                      placeholder={isRTL ? "أدخل سعر البيع" : "Enter retail price"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxType" className={isRTL ? 'text-right block' : ''}>{t("productSetup.taxClass")}</Label>
                  <Select value={taxType} onValueChange={setTaxType}>
                    <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tax_included">{t("productSetup.taxIncluded")}</SelectItem>
                      <SelectItem value="tax_excluded">{t("productSetup.taxExcluded")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Free Coins */}
            <Card>
              <CardHeader>
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.freeCoins")}</CardTitle>
                  <Button type="button" size="sm" onClick={addFreeCoin} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("common.add")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {freeCoins.map((coin, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg relative">
                    <div className={`absolute ${isRTL ? '-top-2 -left-2' : '-top-2 -right-2'}`}>
                      <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        #{index + 1}
                      </span>
                    </div>
                    {freeCoins.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`absolute ${isRTL ? 'top-2 right-2' : 'top-2 left-2'} h-6 w-6`}
                        onClick={() => removeFreeCoin(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.coinsNumber")} *</Label>
                      <Input
                        type="number"
                        className={isRTL ? 'text-right' : ''}
                        value={coin.coins_number}
                        onChange={(e) => {
                          const newFreeCoins = [...freeCoins];
                          newFreeCoins[index].coins_number = e.target.value;
                          setFreeCoins(newFreeCoins);
                        }}
                        placeholder={isRTL ? "عدد النقاط" : "Coins number"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.coinsPrice")} *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className={isRTL ? 'text-right' : ''}
                        value={coin.coins_price}
                        onChange={(e) => {
                          const newFreeCoins = [...freeCoins];
                          newFreeCoins[index].coins_price = e.target.value;
                          setFreeCoins(newFreeCoins);
                        }}
                        placeholder={isRTL ? "سعر النقاط" : "Coins price"}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.options")}</CardTitle>
                  <Button type="button" size="sm" onClick={addOption} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("common.add")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {options.map((option, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg relative">
                    <div className={`absolute ${isRTL ? '-top-2 -left-2' : '-top-2 -right-2'}`}>
                      <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        #{index + 1}
                      </span>
                    </div>
                    {options.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`absolute ${isRTL ? 'top-2 right-2' : 'top-2 left-2'} h-6 w-6`}
                        onClick={() => removeOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.optionId")} *</Label>
                      <Input
                        className={isRTL ? 'text-right' : ''}
                        value={option.option_id}
                        onChange={(e) => {
                          const newOptions = [...options];
                          newOptions[index].option_id = e.target.value;
                          setOptions(newOptions);
                        }}
                        placeholder={isRTL ? "معرف الخيار" : "Option ID"}
                      />
                    </div>
                    <div className="space-y-2 flex items-center gap-2">
                      <Checkbox
                        id={`required-${index}`}
                        checked={option.required}
                        onCheckedChange={(checked) => {
                          const newOptions = [...options];
                          newOptions[index].required = checked as boolean;
                          setOptions(newOptions);
                        }}
                      />
                      <Label htmlFor={`required-${index}`} className="cursor-pointer">
                        {t("productSetup.required")}
                      </Label>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Customer Group Prices */}
            <Card>
              <CardHeader>
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.customerGroupPrices")}</CardTitle>
                  <Button type="button" size="sm" onClick={addCustomerGroupPrice} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("common.add")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {customerGroupPrices.map((price, index) => (
                  <div key={index} className="p-4 bg-muted/30 rounded-lg relative space-y-4">
                    <div className={`absolute ${isRTL ? '-top-2 -left-2' : '-top-2 -right-2'}`}>
                      <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        #{index + 1}
                      </span>
                    </div>
                    {customerGroupPrices.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`absolute ${isRTL ? 'top-2 right-2' : 'top-2 left-2'} h-6 w-6`}
                        onClick={() => removeCustomerGroupPrice(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.groupName")} *</Label>
                        <Input
                          className={isRTL ? 'text-right' : ''}
                          value={price.group_name}
                          onChange={(e) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].group_name = e.target.value;
                            setCustomerGroupPrices(newPrices);
                          }}
                          placeholder={isRTL ? "اسم المجموعة" : "Group name"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.price")} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className={isRTL ? 'text-right' : ''}
                          value={price.price}
                          onChange={(e) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].price = e.target.value;
                            setCustomerGroupPrices(newPrices);
                          }}
                          placeholder={isRTL ? "السعر" : "Price"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.discountType")} *</Label>
                        <Select
                          value={price.discount_type}
                          onValueChange={(value) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].discount_type = value;
                            setCustomerGroupPrices(newPrices);
                          }}
                        >
                          <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="%">%</SelectItem>
                            <SelectItem value="fixed">{t("productSetup.fixed")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.minQuantity")}</Label>
                        <Input
                          type="number"
                          className={isRTL ? 'text-right' : ''}
                          value={price.min_quantity}
                          onChange={(e) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].min_quantity = e.target.value;
                            setCustomerGroupPrices(newPrices);
                          }}
                          placeholder={isRTL ? "الحد الأدنى" : "Min"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.maxQuantity")}</Label>
                        <Input
                          type="number"
                          className={isRTL ? 'text-right' : ''}
                          value={price.max_quantity}
                          onChange={(e) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].max_quantity = e.target.value;
                            setCustomerGroupPrices(newPrices);
                          }}
                          placeholder={isRTL ? "الحد الأقصى" : "Max"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.salePrice")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className={isRTL ? 'text-right' : ''}
                          value={price.sale_price}
                          onChange={(e) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].sale_price = e.target.value;
                            setCustomerGroupPrices(newPrices);
                          }}
                          placeholder={isRTL ? "سعر البيع" : "Sale price"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.purchasePrice")}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className={isRTL ? 'text-right' : ''}
                          value={price.purchase_price}
                          onChange={(e) => {
                            const newPrices = [...customerGroupPrices];
                            newPrices[index].purchase_price = e.target.value;
                            setCustomerGroupPrices(newPrices);
                          }}
                          placeholder={isRTL ? "سعر الشراء" : "Purchase price"}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Discounts */}
            <Card>
              <CardHeader>
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.discounts")}</CardTitle>
                  <Button type="button" size="sm" onClick={addDiscount} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("common.add")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {discounts.map((discount, index) => (
                  <div key={index} className="p-4 bg-muted/30 rounded-lg relative space-y-4">
                    <div className={`absolute ${isRTL ? '-top-2 -left-2' : '-top-2 -right-2'}`}>
                      <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        #{index + 1}
                      </span>
                    </div>
                    {discounts.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`absolute ${isRTL ? 'top-2 right-2' : 'top-2 left-2'} h-6 w-6`}
                        onClick={() => removeDiscount(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.store")} *</Label>
                        <Input
                          className={isRTL ? 'text-right' : ''}
                          value={discount.store}
                          onChange={(e) => {
                            const newDiscounts = [...discounts];
                            newDiscounts[index].store = e.target.value;
                            setDiscounts(newDiscounts);
                          }}
                          placeholder={isRTL ? "المتجر" : "Store"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.groupName")} *</Label>
                        <Input
                          className={isRTL ? 'text-right' : ''}
                          value={discount.group_name}
                          onChange={(e) => {
                            const newDiscounts = [...discounts];
                            newDiscounts[index].group_name = e.target.value;
                            setDiscounts(newDiscounts);
                          }}
                          placeholder={isRTL ? "اسم المجموعة" : "Group name"}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.amountType")} *</Label>
                        <Select
                          value={discount.amount_type}
                          onValueChange={(value) => {
                            const newDiscounts = [...discounts];
                            newDiscounts[index].amount_type = value;
                            setDiscounts(newDiscounts);
                          }}
                        >
                          <SelectTrigger className={isRTL ? 'justify-end text-right' : ''}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">{t("productSetup.fixed")}</SelectItem>
                            <SelectItem value="percentage">%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.amount")} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className={isRTL ? 'text-right' : ''}
                          value={discount.amount}
                          onChange={(e) => {
                            const newDiscounts = [...discounts];
                            newDiscounts[index].amount = e.target.value;
                            setDiscounts(newDiscounts);
                          }}
                          placeholder={isRTL ? "المبلغ" : "Amount"}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.startDate")} *</Label>
                        <Input
                          type="date"
                          className={isRTL ? 'text-right' : ''}
                          value={discount.start_date}
                          onChange={(e) => {
                            const newDiscounts = [...discounts];
                            newDiscounts[index].start_date = e.target.value;
                            setDiscounts(newDiscounts);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.endDate")} *</Label>
                        <Input
                          type="date"
                          className={isRTL ? 'text-right' : ''}
                          value={discount.end_date}
                          onChange={(e) => {
                            const newDiscounts = [...discounts];
                            newDiscounts[index].end_date = e.target.value;
                            setDiscounts(newDiscounts);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* SEO */}
            <Card>
              <CardHeader>
                <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.seo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className={`font-semibold ${isRTL ? 'text-right' : ''}`}>{t("productSetup.arabic")}</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaTitle")}</Label>
                      <Input
                        className={isRTL ? 'text-right' : ''}
                        value={metaTitleAr}
                        onChange={(e) => setMetaTitleAr(e.target.value)}
                        placeholder={isRTL ? "عنوان الميتا بالعربية" : "Meta title in Arabic"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaKeywords")}</Label>
                      <Input
                        className={isRTL ? 'text-right' : ''}
                        value={metaKeywordsAr}
                        onChange={(e) => setMetaKeywordsAr(e.target.value)}
                        placeholder={isRTL ? "كلمات مفتاحية بالعربية" : "Meta keywords in Arabic"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaDescription")}</Label>
                      <Textarea
                        className={isRTL ? 'text-right' : ''}
                        value={metaDescriptionAr}
                        onChange={(e) => setMetaDescriptionAr(e.target.value)}
                        placeholder={isRTL ? "وصف الميتا بالعربية" : "Meta description in Arabic"}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className={`font-semibold ${isRTL ? 'text-right' : ''}`}>{t("productSetup.english")}</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaTitle")}</Label>
                      <Input
                        className={isRTL ? 'text-right' : ''}
                        value={metaTitleEn}
                        onChange={(e) => setMetaTitleEn(e.target.value)}
                        placeholder={isRTL ? "عنوان الميتا بالإنجليزية" : "Meta title in English"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaKeywords")}</Label>
                      <Input
                        className={isRTL ? 'text-right' : ''}
                        value={metaKeywordsEn}
                        onChange={(e) => setMetaKeywordsEn(e.target.value)}
                        placeholder={isRTL ? "كلمات مفتاحية بالإنجليزية" : "Meta keywords in English"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className={isRTL ? 'text-right block' : ''}>{t("productSetup.metaDescription")}</Label>
                      <Textarea
                        className={isRTL ? 'text-right' : ''}
                        value={metaDescriptionEn}
                        onChange={(e) => setMetaDescriptionEn(e.target.value)}
                        placeholder={isRTL ? "وصف الميتا بالإنجليزية" : "Meta description in English"}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProductDetails;
