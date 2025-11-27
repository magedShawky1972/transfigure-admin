import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Image as ImageIcon, Save, X, Loader2 } from "lucide-react";
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

  const translations = {
    title: language === "ar" ? "تدريب الإغلاق" : "Closing Training",
    subtitle: language === "ar" 
      ? "رفع صور الإغلاق لكل ماركة من الفئة A مع تحديد الرقم المطلوب" 
      : "Upload closing screenshots for each A-class brand with the required number highlighted",
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

      // Fetch training data
      const { data: trainingDataResult, error: trainingError } = await supabase
        .from("brand_closing_training")
        .select("*");

      if (trainingError) throw trainingError;

      const trainingMap: Record<string, TrainingData> = {};
      trainingDataResult?.forEach((item) => {
        trainingMap[item.brand_id] = item as TrainingData;
      });
      setTrainingData(trainingMap);
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
          },
          { onConflict: "brand_id" }
        )
        .select()
        .single();

      if (upsertError) throw upsertError;

      setTrainingData((prev) => ({
        ...prev,
        [brandId]: upsertData as TrainingData,
      }));

      toast.success(translations.uploadSuccess);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(translations.uploadError);
    } finally {
      setUploading(null);
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

  const startEditingNotes = (brandId: string) => {
    const existingNotes = trainingData[brandId]?.notes || "";
    setNotesValue(existingNotes);
    setEditingNotes(brandId);
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

          return (
            <Card key={brand.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>{brand.brand_name}</span>
                  {brand.brand_code && (
                    <span className="text-sm text-muted-foreground font-normal">
                      {brand.brand_code}
                    </span>
                  )}
                </CardTitle>
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