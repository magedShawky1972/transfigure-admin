import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image as ImageIcon, Save, X, Loader2, Sparkles, BrainCircuit, BrainCog, Gamepad2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Brand {
  id: string;
  brand_name: string;
  brand_code: string | null;
  short_name: string | null;
}

interface TrainingData {
  id: string;
  brand_id: string;
  image_path: string;
  notes: string | null;
  expected_number: number | null;
}

interface LudoProduct {
  sku: string;
  product_name: string;
  product_price: string | null;
}

interface LudoTrainingData {
  id: string;
  product_sku: string;
  image_path: string;
  notes: string | null;
}

const ClosingTraining = () => {
  const { language } = useLanguage();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [trainingData, setTrainingData] = useState<Record<string, TrainingData>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [expectedNumbers, setExpectedNumbers] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState<string | null>(null);
  
  // Ludo state
  const [ludoProducts, setLudoProducts] = useState<LudoProduct[]>([]);
  const [ludoTrainingData, setLudoTrainingData] = useState<Record<string, LudoTrainingData>>({});
  const [ludoUploading, setLudoUploading] = useState<string | null>(null);
  const [ludoEditingNotes, setLudoEditingNotes] = useState<string | null>(null);
  const [ludoNotesValue, setLudoNotesValue] = useState("");
  const [ludoExtracting, setLudoExtracting] = useState<string | null>(null);
  const [ludoExtractedData, setLudoExtractedData] = useState<Record<string, {
    amount: number | null;
    playerId: string | null;
    transactionDate: string | null;
    isValidApp: boolean;
  }>>({});

  const translations = {
    title: language === "ar" ? "تدريب الإغلاق" : "Closing Training",
    subtitle: language === "ar" 
      ? "رفع صور الإغلاق لكل ماركة من الفئة A - سيتم قراءة الرقم تلقائياً من المربع الأصفر" 
      : "Upload closing screenshots for each A-class brand - number will be automatically read from yellow square",
    brandName: language === "ar" ? "اسم الماركة" : "Brand Name",
    brandCode: language === "ar" ? "كود الماركة" : "Brand Code",
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
    expectedNumber: language === "ar" ? "الرقم المتوقع (المربع الأصفر)" : "Expected Number (Yellow Square)",
    numberPlaceholder: language === "ar" ? "أدخل الرقم من الصورة" : "Enter number from image",
    numberSaved: language === "ar" ? "تم حفظ الرقم المتوقع" : "Expected number saved",
    saveNumber: language === "ar" ? "حفظ الرقم" : "Save Number",
    extracting: language === "ar" ? "جاري قراءة الرقم..." : "Reading number...",
    extractNumber: language === "ar" ? "قراءة الرقم بالذكاء الاصطناعي" : "Read Number with AI",
    numberExtracted: language === "ar" ? "تم قراءة الرقم تلقائياً" : "Number automatically extracted",
    extractionFailed: language === "ar" ? "فشل في قراءة الرقم - يرجى إدخاله يدوياً" : "Failed to read number - please enter manually",
    aiTrained: language === "ar" ? "تم التدريب" : "AI Trained",
    aiNotTrained: language === "ar" ? "لم يتم التدريب" : "Not Trained",
    // Ludo translations
    ludoTitle: language === "ar" ? "تدريب AI - يلا لودو" : "AI Training - Yalla Ludo",
    ludoSubtitle: language === "ar" 
      ? "رفع صور الشحن لتدريب النظام على استخراج بيانات المعاملات تلقائياً" 
      : "Upload charging screenshots to train the system to extract transaction data automatically",
    brandsSection: language === "ar" ? "تدريب إغلاق الماركات" : "Brand Closing Training",
    ludoSection: language === "ar" ? "تدريب يلا لودو" : "Yalla Ludo Training",
    ludoAmount: language === "ar" ? "المبلغ" : "Amount",
    ludoPlayerId: language === "ar" ? "رقم اللاعب" : "Player ID",
    ludoDate: language === "ar" ? "التاريخ" : "Date",
    ludoExtractingData: language === "ar" ? "جاري استخراج البيانات..." : "Extracting data...",
    ludoExtractionSuccess: language === "ar" ? "تم استخراج البيانات بنجاح" : "Data extracted successfully",
    ludoExtractionFailed: language === "ar" ? "فشل استخراج البيانات" : "Failed to extract data",
    ludoInvalidImage: language === "ar" ? "الصورة ليست من تطبيق يلا لودو" : "Image is not from Yalla Ludo app",
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch A-class brands
      const { data: brandsData, error: brandsError } = await supabase
        .from("brands")
        .select("id, brand_name, brand_code, short_name")
        .eq("abc_analysis", "A")
        .eq("status", "active")
        .order("brand_name");

      if (brandsError) throw brandsError;
      setBrands(brandsData || []);

      // Fetch brand training data
      const { data: trainingDataResult, error: trainingError } = await supabase
        .from("brand_closing_training")
        .select("*");

      if (trainingError) throw trainingError;

      const trainingMap: Record<string, TrainingData> = {};
      const numbersMap: Record<string, string> = {};
      trainingDataResult?.forEach((item) => {
        trainingMap[item.brand_id] = {
          id: item.id,
          brand_id: item.brand_id,
          image_path: item.image_path,
          notes: item.notes,
          expected_number: item.expected_number,
        };
        if (item.expected_number !== null) {
          numbersMap[item.brand_id] = item.expected_number.toString();
        }
      });
      setTrainingData(trainingMap);
      setExpectedNumbers(numbersMap);

      // Fetch Ludo products
      const { data: ludoProductsData, error: ludoProductsError } = await supabase
        .from("products")
        .select("sku, product_name, product_price")
        .or("sku.ilike.LUDOF001%,sku.ilike.LUDOL001%")
        .eq("status", "active")
        .order("sku");

      if (ludoProductsError) throw ludoProductsError;
      setLudoProducts(ludoProductsData || []);

      // Fetch Ludo training data
      const { data: ludoTrainingResult, error: ludoTrainingError } = await supabase
        .from("ludo_training")
        .select("*");

      if (ludoTrainingError) throw ludoTrainingError;

      const ludoTrainingMap: Record<string, LudoTrainingData> = {};
      ludoTrainingResult?.forEach((item) => {
        ludoTrainingMap[item.product_sku] = {
          id: item.id,
          product_sku: item.product_sku,
          image_path: item.image_path,
          notes: item.notes,
        };
      });
      setLudoTrainingData(ludoTrainingMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (brandId: string, file: File) => {
    setUploading(brandId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${brandId}-${Date.now()}.${fileExt}`;
      const filePath = `training/${fileName}`;

      // Delete old image if exists
      const existingData = trainingData[brandId];
      if (existingData?.image_path) {
        const oldPath = existingData.image_path.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("closing-training").remove([`training/${oldPath}`]);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from("closing-training")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("closing-training")
        .getPublicUrl(filePath);

      // Upsert training record
      const { data: upsertData, error: upsertError } = await supabase
        .from("brand_closing_training")
        .upsert(
          {
            brand_id: brandId,
            image_path: urlData.publicUrl,
            notes: existingData?.notes || null,
            expected_number: existingData?.expected_number || null,
          },
          { onConflict: "brand_id" }
        )
        .select()
        .single();

      if (upsertError) throw upsertError;

      setTrainingData((prev) => ({
        ...prev,
        [brandId]: {
          id: upsertData.id,
          brand_id: upsertData.brand_id,
          image_path: upsertData.image_path,
          notes: upsertData.notes,
          expected_number: upsertData.expected_number,
        },
      }));

      toast.success(translations.uploadSuccess);
      
      // Auto-extract number from the uploaded image
      extractNumberFromImage(brandId, urlData.publicUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(translations.uploadError);
    } finally {
      setUploading(null);
    }
  };

  const extractNumberFromImage = async (brandId: string, imageUrl: string) => {
    setExtracting(brandId);
    try {
      const { data, error } = await supabase.functions.invoke("extract-closing-number", {
        body: { imageUrl },
      });

      if (error) throw error;

      if (data?.extractedNumber !== null && data?.extractedNumber !== undefined) {
        const numberStr = data.extractedNumber.toString();
        setExpectedNumbers((prev) => ({
          ...prev,
          [brandId]: numberStr,
        }));
        
        // Auto-save the extracted number
        await supabase
          .from("brand_closing_training")
          .update({ expected_number: data.extractedNumber })
          .eq("brand_id", brandId);
        
        setTrainingData((prev) => ({
          ...prev,
          [brandId]: { ...prev[brandId], expected_number: data.extractedNumber },
        }));
        
        toast.success(translations.numberExtracted);
      } else {
        toast.info(translations.extractionFailed);
      }
    } catch (error) {
      console.error("Error extracting number:", error);
      toast.error(translations.extractionFailed);
    } finally {
      setExtracting(null);
    }
  };

  const handleDeleteImage = async (brandId: string) => {
    const existingData = trainingData[brandId];
    if (!existingData) return;

    try {
      // Delete from storage
      const fileName = existingData.image_path.split("/").pop();
      if (fileName) {
        await supabase.storage.from("closing-training").remove([`training/${fileName}`]);
      }

      // Delete record
      const { error } = await supabase
        .from("brand_closing_training")
        .delete()
        .eq("brand_id", brandId);

      if (error) throw error;

      setTrainingData((prev) => {
        const newData = { ...prev };
        delete newData[brandId];
        return newData;
      });

      setExpectedNumbers((prev) => {
        const newData = { ...prev };
        delete newData[brandId];
        return newData;
      });

      toast.success(translations.deleteSuccess);
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error(translations.deleteError);
    }
  };

  const handleSaveNotes = async (brandId: string) => {
    try {
      const existingData = trainingData[brandId];
      
      if (existingData) {
        // Update existing record
        const { error } = await supabase
          .from("brand_closing_training")
          .update({ notes: notesValue })
          .eq("brand_id", brandId);

        if (error) throw error;

        setTrainingData((prev) => ({
          ...prev,
          [brandId]: { ...prev[brandId], notes: notesValue },
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

  const handleSaveExpectedNumber = async (brandId: string) => {
    try {
      const existingData = trainingData[brandId];
      const numberValue = expectedNumbers[brandId] ? parseFloat(expectedNumbers[brandId]) : null;
      
      if (existingData) {
        const { error } = await supabase
          .from("brand_closing_training")
          .update({ expected_number: numberValue })
          .eq("brand_id", brandId);

        if (error) throw error;

        setTrainingData((prev) => ({
          ...prev,
          [brandId]: { ...prev[brandId], expected_number: numberValue },
        }));

        toast.success(translations.numberSaved);
      }
    } catch (error) {
      console.error("Error saving expected number:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الرقم" : "Error saving number");
    }
  };

  const startEditingNotes = (brandId: string) => {
    const existingNotes = trainingData[brandId]?.notes || "";
    setNotesValue(existingNotes);
    setEditingNotes(brandId);
  };

  // Ludo handlers
  const handleLudoImageUpload = async (productSku: string, file: File) => {
    setLudoUploading(productSku);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `training/${productSku}-${Date.now()}.${fileExt}`;

      // Delete old image if exists
      const existingData = ludoTrainingData[productSku];
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

      // Get signed URL
      const { data: urlData } = await supabase.storage
        .from("ludo-receipts")
        .createSignedUrl(fileName, 31536000);

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

      setLudoTrainingData((prev) => ({
        ...prev,
        [productSku]: {
          id: upsertData.id,
          product_sku: upsertData.product_sku,
          image_path: upsertData.image_path,
          notes: upsertData.notes,
        },
      }));

      toast.success(translations.uploadSuccess);
      
      // Auto-extract data from uploaded image
      extractLudoData(productSku, imageUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(translations.uploadError);
    } finally {
      setLudoUploading(null);
    }
  };

  const extractLudoData = async (productSku: string, imageUrl: string) => {
    setLudoExtracting(productSku);
    try {
      const { data, error } = await supabase.functions.invoke("extract-ludo-transaction", {
        body: { imageUrl, productSku },
      });

      if (error) throw error;

      if (data?.isValidApp) {
        setLudoExtractedData((prev) => ({
          ...prev,
          [productSku]: {
            amount: data.amount,
            playerId: data.playerId,
            transactionDate: data.transactionDate,
            isValidApp: true,
          },
        }));
        toast.success(translations.ludoExtractionSuccess);
      } else {
        setLudoExtractedData((prev) => ({
          ...prev,
          [productSku]: {
            amount: null,
            playerId: null,
            transactionDate: null,
            isValidApp: false,
          },
        }));
        toast.error(data?.invalidReason || translations.ludoInvalidImage);
      }
    } catch (error) {
      console.error("Error extracting Ludo data:", error);
      toast.error(translations.ludoExtractionFailed);
    } finally {
      setLudoExtracting(null);
    }
  };

  const handleLudoDeleteImage = async (productSku: string) => {
    const existingData = ludoTrainingData[productSku];
    if (!existingData) return;

    try {
      if (existingData.image_path && !existingData.image_path.startsWith("http")) {
        await supabase.storage.from("ludo-receipts").remove([existingData.image_path]);
      }

      const { error } = await supabase
        .from("ludo_training")
        .delete()
        .eq("product_sku", productSku);

      if (error) throw error;

      setLudoTrainingData((prev) => {
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

  const handleLudoSaveNotes = async (productSku: string) => {
    try {
      const existingData = ludoTrainingData[productSku];
      
      if (existingData) {
        const { error } = await supabase
          .from("ludo_training")
          .update({ notes: ludoNotesValue })
          .eq("product_sku", productSku);

        if (error) throw error;

        setLudoTrainingData((prev) => ({
          ...prev,
          [productSku]: { ...prev[productSku], notes: ludoNotesValue },
        }));
      }

      toast.success(translations.notesUpdated);
      setLudoEditingNotes(null);
      setLudoNotesValue("");
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error(language === "ar" ? "خطأ في حفظ الملاحظات" : "Error saving notes");
    }
  };

  const startLudoEditingNotes = (productSku: string) => {
    const existingNotes = ludoTrainingData[productSku]?.notes || "";
    setLudoNotesValue(existingNotes);
    setLudoEditingNotes(productSku);
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
        <h1 className="text-3xl font-bold">{translations.title}</h1>
        <p className="text-muted-foreground">{translations.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map((brand) => {
          const data = trainingData[brand.id];
          const isUploading = uploading === brand.id;
          const isExtracting = extracting === brand.id;
          const isAiTrained = data?.image_path && data?.expected_number !== null;

          return (
            <Card key={brand.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{brand.brand_name}</span>
                    {brand.brand_code && (
                      <span className="text-sm text-muted-foreground font-normal">
                        {brand.brand_code}
                      </span>
                    )}
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
              <CardContent className="space-y-3">
                {/* Image Preview */}
                <div 
                  className="relative h-40 bg-muted rounded-lg flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors"
                  onClick={() => data?.image_path && setSelectedImage(data.image_path)}
                >
                  {data?.image_path ? (
                    <img
                      src={data.image_path}
                      alt={brand.brand_name}
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
                    htmlFor={`upload-${brand.id}`}
                    className="flex-1"
                  >
                    <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                      isUploading 
                        ? "bg-muted text-muted-foreground cursor-not-allowed" 
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}>
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {isUploading 
                          ? (language === "ar" ? "جاري الرفع..." : "Uploading...") 
                          : translations.uploadImage}
                      </span>
                    </div>
                    <Input
                      id={`upload-${brand.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(brand.id, file);
                      }}
                    />
                  </Label>
                  
                  {data?.image_path && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteImage(brand.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Expected Number Input */}
                {data?.image_path && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{translations.expectedNumber}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder={translations.numberPlaceholder}
                        value={expectedNumbers[brand.id] || ""}
                        onChange={(e) => setExpectedNumbers((prev) => ({
                          ...prev,
                          [brand.id]: e.target.value,
                        }))}
                        className="flex-1"
                        disabled={isExtracting}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveExpectedNumber(brand.id)}
                        disabled={isExtracting}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => extractNumberFromImage(brand.id, data.image_path)}
                        disabled={isExtracting}
                        className="flex-1"
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            {translations.extracting}
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-1" />
                            {translations.extractNumber}
                          </>
                        )}
                      </Button>
                    </div>
                    {data.expected_number !== null && (
                      <p className="text-xs text-muted-foreground">
                        {language === "ar" ? "الرقم المحفوظ:" : "Saved:"} {data.expected_number}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes Section */}
                {data?.image_path && (
                  <div className="space-y-2">
                    {editingNotes === brand.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder={translations.notes}
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSaveNotes(brand.id)}
                            className="flex-1"
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {translations.saveNotes}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingNotes(null);
                              setNotesValue("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {data.notes ? (
                          <div 
                            className="p-2 bg-muted rounded text-sm cursor-pointer hover:bg-muted/80"
                            onClick={() => startEditingNotes(brand.id)}
                          >
                            <p className="text-muted-foreground mb-1 text-xs">{translations.notes}:</p>
                            <p>{data.notes}</p>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => startEditingNotes(brand.id)}
                          >
                            {translations.addNotes}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {brands.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "لا توجد ماركات من الفئة A" 
              : "No A-class brands found"}
          </p>
        </Card>
      )}

      {/* Ludo Section */}
      <Separator className="my-8" />
      
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Gamepad2 className="h-7 w-7 text-orange-500" />
          {translations.ludoTitle}
        </h2>
        <p className="text-muted-foreground">{translations.ludoSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ludoProducts.map((product) => {
          const data = ludoTrainingData[product.sku];
          const extractedData = ludoExtractedData[product.sku];
          const isUploading = ludoUploading === product.sku;
          const isExtractingData = ludoExtracting === product.sku;
          const isAiTrained = !!data?.image_path && extractedData?.isValidApp;

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
                    htmlFor={`upload-ludo-${product.sku}`}
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
                      id={`upload-ludo-${product.sku}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLudoImageUpload(product.sku, file);
                      }}
                    />
                  </Label>
                  
                  {data?.image_path && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleLudoDeleteImage(product.sku)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Extracted Data Section */}
                {data?.image_path && (
                  <div className="space-y-3 pt-3 border-t border-orange-200 dark:border-orange-900/50">
                    {isExtractingData ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-orange-600">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">{translations.ludoExtractingData}</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{translations.ludoPlayerId}</Label>
                            <Input
                              value={extractedData?.playerId || ""}
                              readOnly
                              className="bg-muted/50 font-mono text-sm"
                              placeholder={language === "ar" ? "سيظهر هنا بعد الرفع" : "Will appear after upload"}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{translations.ludoAmount}</Label>
                              <Input
                                value={extractedData?.amount !== null ? extractedData.amount.toString() : ""}
                                readOnly
                                className="bg-muted/50 font-mono text-sm"
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{translations.ludoDate}</Label>
                              <Input
                                value={extractedData?.transactionDate || ""}
                                readOnly
                                className="bg-muted/50 font-mono text-xs"
                                placeholder="YYYY-MM-DD"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Re-extract button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                          onClick={() => {
                            if (data?.image_path) {
                              extractLudoData(product.sku, data.image_path);
                            }
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          {language === "ar" ? "إعادة استخراج البيانات" : "Re-extract Data"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Notes Section */}
                {data?.image_path && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">{translations.notes}</Label>
                      {ludoEditingNotes !== product.sku && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startLudoEditingNotes(product.sku)}
                        >
                          {data?.notes ? translations.editNotes : translations.addNotes}
                        </Button>
                      )}
                    </div>
                    
                    {ludoEditingNotes === product.sku ? (
                      <div className="space-y-2">
                        <Textarea
                          value={ludoNotesValue}
                          onChange={(e) => setLudoNotesValue(e.target.value)}
                          placeholder={language === "ar" ? "أضف ملاحظات حول الصورة..." : "Add notes about the image..."}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleLudoSaveNotes(product.sku)}
                            className="flex items-center gap-1"
                          >
                            <Save className="h-3 w-3" />
                            {translations.saveNotes}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLudoEditingNotes(null);
                              setLudoNotesValue("");
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

      {ludoProducts.length === 0 && (
        <Card className="p-8 text-center border-orange-200 dark:border-orange-900">
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "لا توجد منتجات يلا لودو (LUDOF001, LUDOL001)" 
              : "No Yalla Ludo products found (LUDOF001, LUDOL001)"}
          </p>
        </Card>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{translations.viewImage}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex items-center justify-center">
              <img
                src={selectedImage}
                alt="Training Image"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClosingTraining;