import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Check, ImageIcon } from "lucide-react";

interface UploadMissingImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftSessionId: string | null;
  userName: string;
  shiftName: string;
  onImagesUploaded?: () => void;
}

interface BrandWithImage {
  id: string;
  brand_id: string;
  brand_name: string;
  receipt_image_path: string | null;
  opening_image_path: string | null;
}

export default function UploadMissingImagesDialog({
  open,
  onOpenChange,
  shiftSessionId,
  userName,
  shiftName,
  onImagesUploaded,
}: UploadMissingImagesDialogProps) {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState<BrandWithImage[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const text = {
    ar: {
      title: "رفع الصور الناقصة",
      user: "الموظف",
      shift: "الوردية",
      brand: "العلامة التجارية",
      closingImage: "صورة الإغلاق",
      uploaded: "تم الرفع",
      missing: "ناقصة",
      upload: "رفع صورة",
      uploading: "جاري الرفع...",
      loading: "جاري التحميل...",
      noMissing: "جميع الصور مرفوعة ✅",
      success: "تم رفع الصورة بنجاح",
      error: "فشل في رفع الصورة",
    },
    en: {
      title: "Upload Missing Images",
      user: "User",
      shift: "Shift",
      brand: "Brand",
      closingImage: "Closing Image",
      uploaded: "Uploaded",
      missing: "Missing",
      upload: "Upload Image",
      uploading: "Uploading...",
      loading: "Loading...",
      noMissing: "All images uploaded ✅",
      success: "Image uploaded successfully",
      error: "Failed to upload image",
    },
  };

  const t = text[language as keyof typeof text] || text.en;

  useEffect(() => {
    if (open && shiftSessionId) {
      fetchBrandsAndImages();
    }
  }, [open, shiftSessionId]);

  const fetchBrandsAndImages = async () => {
    if (!shiftSessionId) return;
    setLoading(true);
    try {
      // Fetch required brands (A-class, non-Ludo)
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, brand_name")
        .eq("status", "active")
        .eq("abc_analysis", "A");

      const requiredBrands = brandsData?.filter((brand) => {
        const name = brand.brand_name.toLowerCase();
        return !name.includes("yalla ludo") && !name.includes("يلا لودو") && !name.includes("ludo");
      }) || [];

      // Fetch existing balances for this session
      const { data: balancesData } = await supabase
        .from("shift_brand_balances")
        .select("id, brand_id, receipt_image_path, opening_image_path")
        .eq("shift_session_id", shiftSessionId);

      const balanceMap = new Map(balancesData?.map((b) => [b.brand_id, b]) || []);

      const brandsWithImages: BrandWithImage[] = requiredBrands.map((brand) => {
        const balance = balanceMap.get(brand.id);
        return {
          id: balance?.id || "",
          brand_id: brand.id,
          brand_name: brand.brand_name,
          receipt_image_path: balance?.receipt_image_path || null,
          opening_image_path: balance?.opening_image_path || null,
        };
      });

      setBrands(brandsWithImages);
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadImage = async (brandId: string, file: File) => {
    if (!shiftSessionId) return;
    setUploading((prev) => ({ ...prev, [brandId]: true }));

    try {
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      // Upload to Cloudinary
      const publicId = `${shiftSessionId}/${brandId}-closing-supervisor`;
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: {
          imageBase64: base64Image,
          folder: "Edara_Shifts_Images",
          publicId,
        },
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.url) throw new Error("Failed to get image URL");

      const cloudinaryUrl = uploadData.url;

      // Check if a balance record already exists for this brand
      const { data: existing } = await supabase
        .from("shift_brand_balances")
        .select("id")
        .eq("shift_session_id", shiftSessionId)
        .eq("brand_id", brandId)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("shift_brand_balances")
          .update({ receipt_image_path: cloudinaryUrl })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from("shift_brand_balances")
          .insert({
            shift_session_id: shiftSessionId,
            brand_id: brandId,
            closing_balance: 0,
            opening_balance: 0,
            receipt_image_path: cloudinaryUrl,
          });
        if (error) throw error;
      }

      toast.success(t.success);
      // Refresh data
      await fetchBrandsAndImages();
      onImagesUploaded?.();
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(t.error);
    } finally {
      setUploading((prev) => ({ ...prev, [brandId]: false }));
    }
  };

  const missingBrands = brands.filter((b) => !b.receipt_image_path);
  const uploadedBrands = brands.filter((b) => !!b.receipt_image_path);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t.title}
          </DialogTitle>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>{t.user}:</strong> {userName}</p>
            <p><strong>{t.shift}:</strong> {shiftName}</p>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="mr-2">{t.loading}</span>
          </div>
        ) : missingBrands.length === 0 ? (
          <div className="text-center py-8 text-green-600 font-medium text-lg">
            {t.noMissing}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Missing brands */}
            {missingBrands.map((brand) => (
              <Card key={brand.brand_id} className="border-amber-300 bg-amber-50/50 dark:bg-amber-900/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-amber-600" />
                    <span className="font-medium">{brand.brand_name}</span>
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      {t.missing}
                    </Badge>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => { fileInputRefs.current[brand.brand_id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(brand.brand_id, file);
                        e.target.value = "";
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploading[brand.brand_id]}
                      onClick={() => fileInputRefs.current[brand.brand_id]?.click()}
                    >
                      {uploading[brand.brand_id] ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin ml-1" />
                          {t.uploading}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 ml-1" />
                          {t.upload}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Already uploaded brands */}
            {uploadedBrands.length > 0 && (
              <div className="pt-2 border-t">
                {uploadedBrands.map((brand) => (
                  <Card key={brand.brand_id} className="border-green-300 bg-green-50/50 dark:bg-green-900/10 mb-2">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-600" />
                        <span className="font-medium">{brand.brand_name}</span>
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          {t.uploaded}
                        </Badge>
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => { fileInputRefs.current[brand.brand_id] = el; }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImage(brand.brand_id, file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={uploading[brand.brand_id]}
                          onClick={() => fileInputRefs.current[brand.brand_id]?.click()}
                        >
                          {uploading[brand.brand_id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
