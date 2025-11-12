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
import { ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Product {
  id: string;
  product_id: string | null;
  product_name: string;
  product_price: string | null;
  product_cost: string | null;
  brand_name: string | null;
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
  const [status, setStatus] = useState("active");

  // Stock section
  const [quantity, setQuantity] = useState("0");
  const [notifyQty, setNotifyQty] = useState("1");
  const [minOrderQty, setMinOrderQty] = useState("1");
  const [maxOrderQty, setMaxOrderQty] = useState("10");

  // Pricing section
  const [costPrice, setCostPrice] = useState("");
  const [retailPrice, setRetailPrice] = useState("");

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

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
        setSku(data.sku || "");
        setDescription(data.description || "");
        setCategory(data.category || "");
        setBarcode(data.barcode || "");
        setWeight(data.weight?.toString() || "");
        setSupplier(data.supplier || "");
        setNotes(data.notes || "");
        setProductName(data.product_name);
        setBrandName(data.brand_name || "");
        setStatus(data.status);
        setQuantity(data.stock_quantity?.toString() || "0");
        setNotifyQty(data.reorder_point?.toString() || "1");
        setMinOrderQty(data.minimum_order_quantity?.toString() || "1");
        setCostPrice(data.product_cost || "");
        setRetailPrice(data.product_price || "");
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

  const handleSave = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("products")
        .update({
          sku,
          description,
          category,
          barcode,
          weight: weight ? parseFloat(weight) : null,
          supplier,
          notes,
          stock_quantity: quantity ? parseFloat(quantity) : 0,
          reorder_point: notifyQty ? parseFloat(notifyQty) : 1,
          minimum_order_quantity: minOrderQty ? parseFloat(minOrderQty) : 1,
          product_cost: costPrice,
          product_price: retailPrice,
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
            {/* Product Information */}
            <Card>
              <CardHeader>
                <CardTitle className={isRTL ? 'text-right' : ''}>{t("productSetup.productInformation")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default ProductDetails;
