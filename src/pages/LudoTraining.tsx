import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image as ImageIcon, Save, X, Loader2, BrainCircuit, BrainCog, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LudoProduct {
  sku: string;
  product_name: string;
  product_price: string | null;
}

interface TrainingData {
  id: string;
  product_sku: string;
  image_path: string;
  notes: string | null;
}

const LudoTraining = () => {
  const { language } = useLanguage();
  const [products, setProducts] = useState<LudoProduct[]>([]);
  const [trainingData, setTrainingData] = useState<Record<string, TrainingData>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const translations = {
    title: language === "ar" ? "تدريب AI - يلا لودو" : "AI Training - Yalla Ludo",
    subtitle: language === "ar" 
      ? "رفع صور الشحن لتدريب النظام على استخراج بيانات المعاملات تلقائياً" 
      : "Upload charging screenshots to train the system to extract transaction data automatically",
    productName: language === "ar" ? "اسم المنتج" : "Product Name",
    productSku: language === "ar" ? "رمز المنتج" : "Product SKU",
    uploadImage: language === "ar" ? "رفع صورة" : "Upload Image",
    viewImage: language === "ar" ? "عرض الصورة" : "View Image",
    deleteImage: language === "ar" ? "حذف الصورة" : "Delete Image",
    notes: language === "ar" ? "ملاحظات" : "Notes",
    saveNotes: language === "ar" ? "حفظ" : "Save",
    cancel: language === "ar" ? "إلغاء" : "Cancel",
    noImage: language === "ar" ? "لا توجد صورة" : "No Image",
    uploadSuccess: language === "ar" ? "تم رفع الصورة بنجاح" : "Image uploaded successfully",
    uploadError: language === "ar" ? "خطأ في رفع الصورة" : "Error uploading image",
    deleteSuccess: language === "ar" ? "تم حذف الصورة بنجاح" : "Image deleted successfully",
    deleteError: language === "ar" ? "خطأ في حذف الصورة" : "Error deleting image",
    notesUpdated: language === "ar" ? "تم تحديث الملاحظات" : "Notes updated",
    addNotes: language === "ar" ? "إضافة ملاحظات" : "Add Notes",
    editNotes: language === "ar" ? "تعديل الملاحظات" : "Edit Notes",
    aiTrained: language === "ar" ? "تم التدريب" : "AI Trained",
    aiNotTrained: language === "ar" ? "لم يتم التدريب" : "Not Trained",
    price: language === "ar" ? "السعر" : "Price",
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Ludo products (LUDOF001, LUDOL001)
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("sku, product_name, product_price")
        .in("sku", ["LUDOF001", "LUDOL001"])
        .eq("status", "active")
        .order("sku");

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch training data
      const { data: trainingDataResult, error: trainingError } = await supabase
        .from("ludo_training")
        .select("*");

      if (trainingError) throw trainingError;

      const trainingMap: Record<string, TrainingData> = {};
      trainingDataResult?.forEach((item) => {
        trainingMap[item.product_sku] = {
          id: item.id,
          product_sku: item.product_sku,
          image_path: item.image_path,
          notes: item.notes,
        };
      });
      setTrainingData(trainingMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (productSku: string, file: File) => {
    setUploading(productSku);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `training/${productSku}-${Date.now()}.${fileExt}`;

      // Delete old image if exists
      const existingData = trainingData[productSku];
      if (existingData?.image_path) {
        const oldPath = existingData.image_path.includes("/") 
          ? existingData.image_path 
          : `training/${existingData.image_path}`;
        await supabase.storage.from("ludo-receipts").remove([oldPath]);
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from("ludo-receipts")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = await supabase.storage
        .from("ludo-receipts")
        .createSignedUrl(fileName, 31536000); // 1 year

      const imageUrl = urlData?.signedUrl || fileName;

      // Upsert training record
      const { data: upsertData, error: upsertError } = await supabase
        .from("ludo_training")
        .upsert(
          {
            product_sku: productSku,
            image_path: imageUrl,
            notes: existingData?.notes || null,
          },
          { onConflict: "product_sku" }
        )
        .select()
        .single();

      if (upsertError) throw upsertError;

      setTrainingData((prev) => ({
        ...prev,
        [productSku]: {
          id: upsertData.id,
          product_sku: upsertData.product_sku,
          image_path: upsertData.image_path,
          notes: upsertData.notes,
        },
      }));

      toast.success(translations.uploadSuccess);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(translations.uploadError);
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteImage = async (productSku: string) => {
    const existingData = trainingData[productSku];
    if (!existingData) return;

    try {
      // Delete from storage
      if (existingData.image_path && !existingData.image_path.startsWith("http")) {
        await supabase.storage.from("ludo-receipts").remove([existingData.image_path]);
      }

      // Delete record
      const { error } = await supabase
        .from("ludo_training")
        .delete()
        .eq("product_sku", productSku);

      if (error) throw error;

      setTrainingData((prev) => {
        const newData = { ...prev };
        delete newData[productSku];
        return newData;
      });

      toast.success(translations.deleteSuccess);
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error(translations.deleteError);
    }
  };

  const handleSaveNotes = async (productSku: string) => {
    try {
      const existingData = trainingData[productSku];
      
      if (existingData) {
        const { error } = await supabase
          .from("ludo_training")
          .update({ notes: notesValue })
          .eq("product_sku", productSku);

        if (error) throw error;

        setTrainingData((prev) => ({
          ...prev,
          [productSku]: { ...prev[productSku], notes: notesValue },
        }));
      }

      toast.success(translations.notesUpdated);
      setEditingNotes(null);
      setNotesValue("");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الملاحظات" : "Error saving notes");
    }
  };

  const startEditingNotes = (productSku: string) => {
    const existingNotes = trainingData[productSku]?.notes || "";
    setNotesValue(existingNotes);
    setEditingNotes(productSku);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Gamepad2 className="h-8 w-8 text-orange-500" />
          {translations.title}
        </h1>
        <p className="text-muted-foreground">{translations.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {products.map((product) => {
          const data = trainingData[product.sku];
          const isUploading = uploading === product.sku;
          const isAiTrained = !!data?.image_path;

          return (
            <Card key={product.sku} className="overflow-hidden border-2 border-orange-200 dark:border-orange-900">
              <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/30 dark:to-yellow-950/30">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-orange-500" />
                    <div className="flex flex-col">
                      <span>{product.product_name}</span>
                      <span className="text-sm text-muted-foreground font-normal">
                        {product.sku} - {product.product_price} SAR
                      </span>
                    </div>
                  </CardTitle>
                  <Badge 
                    variant={isAiTrained ? "default" : "secondary"}
                    className={`flex items-center gap-1 text-xs ${
                      isAiTrained 
                        ? "bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30" 
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isAiTrained ? (
                      <BrainCircuit className="h-3 w-3" />
                    ) : (
                      <BrainCog className="h-3 w-3" />
                    )}
                    {isAiTrained ? translations.aiTrained : translations.aiNotTrained}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {/* Image Preview */}
                <div 
                  className="relative h-48 bg-muted rounded-lg flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-muted-foreground/25 hover:border-orange-500/50 transition-colors"
                  onClick={() => data?.image_path && setSelectedImage(data.image_path)}
                >
                  {data?.image_path ? (
                    <img
                      src={data.image_path}
                      alt={product.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-sm">{translations.noImage}</span>
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex gap-2">
                  <Label
                    htmlFor={`upload-${product.sku}`}
                    className="flex-1"
                  >
                    <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                      isUploading 
                        ? "bg-muted text-muted-foreground cursor-not-allowed" 
                        : "bg-orange-500 text-white hover:bg-orange-600"
                    }`}>
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {isUploading 
                          ? (language === "ar" ? "جاري الرفع..." : "Uploading...") 
                          : translations.uploadImage}
                      </span>
                    </div>
                    <Input
                      id={`upload-${product.sku}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(product.sku, file);
                      }}
                    />
                  </Label>
                  
                  {data?.image_path && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteImage(product.sku)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Notes Section */}
                {data?.image_path && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{translations.notes}</Label>
                      {editingNotes !== product.sku && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingNotes(product.sku)}
                        >
                          {data?.notes ? translations.editNotes : translations.addNotes}
                        </Button>
                      )}
                    </div>
                    
                    {editingNotes === product.sku ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder={language === "ar" ? "أضف ملاحظات حول الصورة..." : "Add notes about the image..."}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNotes(product.sku)}
                            className="flex items-center gap-1"
                          >
                            <Save className="h-3 w-3" />
                            {translations.saveNotes}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingNotes(null);
                              setNotesValue("");
                            }}
                            className="flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            {translations.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      data?.notes && (
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {data.notes}
                        </p>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{translations.viewImage}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Training"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LudoTraining;
