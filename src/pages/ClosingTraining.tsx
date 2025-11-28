import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image as ImageIcon, Save, X, Loader2, Sparkles, BrainCircuit, BrainCog, Gamepad2, Plus, Monitor, Smartphone, Tablet, Sun, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface TrainingImage {
  id: string;
  brand_id: string;
  image_path: string;
  notes: string | null;
  expected_number: number | null;
  device_type: string;
  display_mode: string;
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
  const [trainingImages, setTrainingImages] = useState<Record<string, TrainingImage[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [extracting, setExtracting] = useState<string | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<Record<string, string>>({});
  const [selectedDisplayMode, setSelectedDisplayMode] = useState<Record<string, string>>({});
  
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
    detectedSku: string | null;
    isValidApp: boolean;
  }>>({});

  const translations = {
    title: language === "ar" ? "تدريب الإغلاق" : "Closing Training",
    subtitle: language === "ar" 
      ? "رفع صور الإغلاق لكل ماركة من الفئة A - يمكن رفع عدة صور لكل ماركة (موبايل، تابلت، آيباد) وبأوضاع مختلفة (ليلي، نهاري)" 
      : "Upload closing screenshots for each A-class brand - you can upload multiple images per brand (mobile, tablet, iPad) with different modes (light, dark)",
    brandName: language === "ar" ? "اسم الماركة" : "Brand Name",
    brandCode: language === "ar" ? "كود الماركة" : "Brand Code",
    uploadImage: language === "ar" ? "رفع صورة" : "Upload Image",
    addImage: language === "ar" ? "إضافة صورة" : "Add Image",
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
    expectedNumber: language === "ar" ? "الرقم المتوقع" : "Expected Number",
    numberPlaceholder: language === "ar" ? "أدخل الرقم من الصورة" : "Enter number from image",
    numberSaved: language === "ar" ? "تم حفظ الرقم المتوقع" : "Expected number saved",
    saveNumber: language === "ar" ? "حفظ الرقم" : "Save Number",
    extracting: language === "ar" ? "جاري قراءة الرقم..." : "Reading number...",
    extractNumber: language === "ar" ? "قراءة الرقم بالذكاء الاصطناعي" : "Read Number with AI",
    numberExtracted: language === "ar" ? "تم قراءة الرقم تلقائياً" : "Number automatically extracted",
    extractionFailed: language === "ar" ? "فشل في قراءة الرقم - يرجى إدخاله يدوياً" : "Failed to read number - please enter manually",
    aiTrained: language === "ar" ? "تم التدريب" : "AI Trained",
    aiNotTrained: language === "ar" ? "لم يتم التدريب" : "Not Trained",
    imagesCount: language === "ar" ? "صورة" : "images",
    deviceType: language === "ar" ? "نوع الجهاز" : "Device Type",
    displayMode: language === "ar" ? "الوضع" : "Display Mode",
    mobile: language === "ar" ? "موبايل" : "Mobile",
    tablet: language === "ar" ? "تابلت" : "Tablet",
    ipad: language === "ar" ? "آيباد" : "iPad",
    desktop: language === "ar" ? "كمبيوتر" : "Desktop",
    lightMode: language === "ar" ? "نهاري" : "Light",
    darkMode: language === "ar" ? "ليلي" : "Dark",
    selectDeviceType: language === "ar" ? "اختر نوع الجهاز" : "Select device type",
    selectDisplayMode: language === "ar" ? "اختر الوضع" : "Select display mode",
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
    ludoSku: language === "ar" ? "رمز المنتج" : "Product SKU",
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

      // Fetch brand training data (now multiple images per brand)
      const { data: trainingDataResult, error: trainingError } = await supabase
        .from("brand_closing_training")
        .select("*")
        .order("created_at", { ascending: false });

      if (trainingError) throw trainingError;

      // Group images by brand_id
      const imagesMap: Record<string, TrainingImage[]> = {};
      trainingDataResult?.forEach((item) => {
        if (!imagesMap[item.brand_id]) {
          imagesMap[item.brand_id] = [];
        }
        imagesMap[item.brand_id].push({
          id: item.id,
          brand_id: item.brand_id,
          image_path: item.image_path,
          notes: item.notes,
          expected_number: item.expected_number,
          device_type: (item as any).device_type || 'unknown',
          display_mode: (item as any).display_mode || 'unknown',
        });
      });
      setTrainingImages(imagesMap);

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
    const deviceType = selectedDeviceType[brandId] || 'mobile';
    const displayMode = selectedDisplayMode[brandId] || 'light';
    
    setUploading(brandId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${brandId}-${deviceType}-${displayMode}-${Date.now()}.${fileExt}`;
      const filePath = `training/${fileName}`;

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from("closing-training")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("closing-training")
        .getPublicUrl(filePath);

      // Insert new training record (not upsert - allow multiple)
      const { data: insertData, error: insertError } = await supabase
        .from("brand_closing_training")
        .insert({
          brand_id: brandId,
          image_path: urlData.publicUrl,
          notes: null,
          expected_number: null,
          device_type: deviceType,
          display_mode: displayMode,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state
      setTrainingImages((prev) => ({
        ...prev,
        [brandId]: [
          {
            id: insertData.id,
            brand_id: insertData.brand_id,
            image_path: insertData.image_path,
            notes: insertData.notes,
            expected_number: insertData.expected_number,
            device_type: deviceType,
            display_mode: displayMode,
          },
          ...(prev[brandId] || []),
        ],
      }));

      toast.success(translations.uploadSuccess);
      
      // Auto-extract number from the uploaded image
      extractNumberFromImage(brandId, insertData.id, urlData.publicUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(translations.uploadError);
    } finally {
      setUploading(null);
    }
  };

  const extractNumberFromImage = async (brandId: string, imageId: string, imageUrl: string, retryCount = 0) => {
    setExtracting(imageId);
    let shouldClearExtracting = true;
    
    try {
      const brand = brands.find(b => b.id === brandId);
      const { data, error } = await supabase.functions.invoke("extract-closing-number", {
        body: { 
          imageUrl,
          brandId,
          brandName: brand?.brand_name,
          retryCount
        },
      });

      if (error) throw error;

      if (data?.extractedNumber !== null && data?.extractedNumber !== undefined) {
        // Auto-save the extracted number
        await supabase
          .from("brand_closing_training")
          .update({ expected_number: data.extractedNumber })
          .eq("id", imageId);
        
        setTrainingImages((prev) => ({
          ...prev,
          [brandId]: prev[brandId]?.map(img => 
            img.id === imageId 
              ? { ...img, expected_number: data.extractedNumber }
              : img
          ) || [],
        }));
        
        toast.success(translations.numberExtracted);
      } else if (data?.canRetry && retryCount < 2) {
        // Auto-retry if extraction failed - don't clear extracting since we're recursing
        shouldClearExtracting = false;
        console.log(`Retrying extraction for ${brandId}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await extractNumberFromImage(brandId, imageId, imageUrl, retryCount + 1);
      } else {
        toast.info(translations.extractionFailed);
      }
    } catch (error) {
      console.error("Error extracting number:", error);
      // Auto-retry on error if we haven't retried too many times
      if (retryCount < 2) {
        shouldClearExtracting = false;
        console.log(`Retrying extraction after error for ${brandId}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        await extractNumberFromImage(brandId, imageId, imageUrl, retryCount + 1);
      } else {
        toast.error(translations.extractionFailed);
      }
    } finally {
      if (shouldClearExtracting) {
        setExtracting(null);
      }
    }
  };

  const handleDeleteImage = async (brandId: string, imageId: string, imagePath: string) => {
    try {
      // Delete from storage
      const fileName = imagePath.split("/").pop();
      if (fileName) {
        await supabase.storage.from("closing-training").remove([`training/${fileName}`]);
      }

      // Delete record
      const { error } = await supabase
        .from("brand_closing_training")
        .delete()
        .eq("id", imageId);

      if (error) throw error;

      setTrainingImages((prev) => ({
        ...prev,
        [brandId]: prev[brandId]?.filter(img => img.id !== imageId) || [],
      }));

      toast.success(translations.deleteSuccess);
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error(translations.deleteError);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="h-3 w-3" />;
      case 'tablet': return <Tablet className="h-3 w-3" />;
      case 'ipad': return <Tablet className="h-3 w-3" />;
      case 'desktop': return <Monitor className="h-3 w-3" />;
      default: return <Smartphone className="h-3 w-3" />;
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'light': return <Sun className="h-3 w-3" />;
      case 'dark': return <Moon className="h-3 w-3" />;
      default: return <Sun className="h-3 w-3" />;
    }
  };

  const getDeviceLabel = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return translations.mobile;
      case 'tablet': return translations.tablet;
      case 'ipad': return translations.ipad;
      case 'desktop': return translations.desktop;
      default: return deviceType;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'light': return translations.lightMode;
      case 'dark': return translations.darkMode;
      default: return mode;
    }
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
        // Fetch product price from database based on detected SKU
        let amount: number | null = null;
        const skuToLookup = data.detectedSku || productSku;
        
        const { data: productData } = await supabase
          .from("products")
          .select("product_price")
          .eq("sku", skuToLookup)
          .maybeSingle();
        
        if (productData?.product_price) {
          amount = parseFloat(productData.product_price);
        }

        setLudoExtractedData((prev) => ({
          ...prev,
          [productSku]: {
            amount,
            playerId: data.playerId,
            transactionDate: data.transactionDate,
            detectedSku: data.detectedSku,
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
            detectedSku: null,
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
          const images = trainingImages[brand.id] || [];
          const isUploading = uploading === brand.id;
          const imageCount = images.length;
          const isAiTrained = imageCount > 0;

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
                    {imageCount > 0 ? `${imageCount} ${translations.imagesCount}` : translations.aiNotTrained}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Images Gallery */}
                {images.length > 0 ? (
                  <ScrollArea className="h-48">
                    <div className="grid grid-cols-2 gap-2">
                      {images.map((img) => (
                        <div 
                          key={img.id}
                          className="relative group rounded-lg overflow-hidden border border-border"
                        >
                          <img
                            src={img.image_path}
                            alt={brand.brand_name}
                            className="w-full h-24 object-cover cursor-pointer"
                            onClick={() => setSelectedImage(img.image_path)}
                          />
                          {/* Overlay with info */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                            <div className="flex items-center gap-1 text-white text-xs">
                              {getDeviceIcon(img.device_type)}
                              {getModeIcon(img.display_mode)}
                            </div>
                            {img.expected_number !== null && (
                              <span className="text-xs text-green-400 font-medium">
                                {img.expected_number}
                              </span>
                            )}
                          </div>
                          {/* Delete button */}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteImage(brand.id, img.id, img.image_path);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {/* Extracting indicator */}
                          {extracting === img.id && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-40 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-sm">{translations.noImage}</span>
                    </div>
                  </div>
                )}

                {/* Device Type & Display Mode Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={selectedDeviceType[brand.id] || 'mobile'}
                    onValueChange={(value) => setSelectedDeviceType(prev => ({ ...prev, [brand.id]: value }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={translations.selectDeviceType} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-3 w-3" />
                          {translations.mobile}
                        </div>
                      </SelectItem>
                      <SelectItem value="tablet">
                        <div className="flex items-center gap-2">
                          <Tablet className="h-3 w-3" />
                          {translations.tablet}
                        </div>
                      </SelectItem>
                      <SelectItem value="ipad">
                        <div className="flex items-center gap-2">
                          <Tablet className="h-3 w-3" />
                          {translations.ipad}
                        </div>
                      </SelectItem>
                      <SelectItem value="desktop">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-3 w-3" />
                          {translations.desktop}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedDisplayMode[brand.id] || 'light'}
                    onValueChange={(value) => setSelectedDisplayMode(prev => ({ ...prev, [brand.id]: value }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={translations.selectDisplayMode} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="h-3 w-3" />
                          {translations.lightMode}
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-3 w-3" />
                          {translations.darkMode}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Upload Button */}
                <Label htmlFor={`upload-${brand.id}`} className="w-full">
                  <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                    isUploading 
                      ? "bg-muted text-muted-foreground cursor-not-allowed" 
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}>
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span className="text-sm">
                      {isUploading 
                        ? (language === "ar" ? "جاري الرفع..." : "Uploading...") 
                        : translations.addImage}
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
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ludo Training Section */}
      <Separator className="my-8" />
      
      <div className="flex items-center gap-3 mb-4">
        <Gamepad2 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">{translations.ludoTitle}</h2>
          <p className="text-muted-foreground text-sm">{translations.ludoSubtitle}</p>
        </div>
      </div>

      {ludoProducts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          {language === "ar" ? "لا توجد منتجات يلا لودو" : "No Yalla Ludo products found"}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ludoProducts.map((product) => {
            const data = ludoTrainingData[product.sku];
            const isUploading = ludoUploading === product.sku;
            const isExtracting = ludoExtracting === product.sku;
            const extractedData = ludoExtractedData[product.sku];

            return (
              <Card key={product.sku} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Gamepad2 className="h-5 w-5 text-primary" />
                      <span>{product.product_name}</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {product.sku}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Image Preview */}
                  <div 
                    className={`relative h-40 bg-muted rounded-lg flex items-center justify-center cursor-pointer overflow-hidden border-2 transition-colors ${
                      extractedData?.isValidApp === false 
                        ? "border-destructive bg-destructive/10" 
                        : "border-dashed border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onClick={() => data?.image_path && setSelectedImage(data.image_path)}
                  >
                    {data?.image_path ? (
                      <>
                        <img
                          src={data.image_path}
                          alt={product.product_name}
                          className="w-full h-full object-cover"
                        />
                        {isExtracting && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2 text-white">
                              <Loader2 className="h-6 w-6 animate-spin" />
                              <span className="text-sm">{translations.ludoExtractingData}</span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-10 w-10" />
                        <span className="text-sm">{translations.noImage}</span>
                      </div>
                    )}
                  </div>

                  {/* Extracted Data Display */}
                  {extractedData && extractedData.isValidApp && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600">
                          {translations.ludoExtractionSuccess}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {extractedData.amount !== null && (
                          <div>
                            <span className="text-muted-foreground">{translations.ludoAmount}: </span>
                            <span className="font-medium">{extractedData.amount}</span>
                          </div>
                        )}
                        {extractedData.detectedSku && (
                          <div>
                            <span className="text-muted-foreground">{translations.ludoSku}: </span>
                            <span className="font-medium">{extractedData.detectedSku}</span>
                          </div>
                        )}
                        {extractedData.transactionDate && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">{translations.ludoDate}: </span>
                            <span className="font-medium">{extractedData.transactionDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {extractedData && !extractedData.isValidApp && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <span className="text-sm text-destructive">{translations.ludoInvalidImage}</span>
                    </div>
                  )}

                  {/* Upload Button */}
                  <div className="flex gap-2">
                    <Label
                      htmlFor={`ludo-upload-${product.sku}`}
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
                        id={`ludo-upload-${product.sku}`}
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

                  {/* Notes Section */}
                  {data?.image_path && (
                    <div className="space-y-2">
                      {ludoEditingNotes === product.sku ? (
                        <div className="space-y-2">
                          <Textarea
                            value={ludoNotesValue}
                            onChange={(e) => setLudoNotesValue(e.target.value)}
                            placeholder={translations.notes}
                            className="min-h-[60px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleLudoSaveNotes(product.sku)}
                              className="flex-1"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              {translations.saveNotes}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setLudoEditingNotes(null);
                                setLudoNotesValue("");
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => startLudoEditingNotes(product.sku)}
                        >
                          {data.notes ? translations.editNotes : translations.addNotes}
                        </Button>
                      )}
                      {data.notes && ludoEditingNotes !== product.sku && (
                        <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                          {data.notes}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{translations.viewImage}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Preview"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClosingTraining;
