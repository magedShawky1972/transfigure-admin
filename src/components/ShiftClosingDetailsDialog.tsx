import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ImageIcon } from "lucide-react";

interface ShiftClosingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftSessionId: string | null;
  userName: string;
  shiftName: string;
}

interface BrandBalance {
  id: string;
  brand_id: string;
  closing_balance: number;
  receipt_image_path: string | null;
  brand_name: string;
  imageUrl: string | null;
}

export default function ShiftClosingDetailsDialog({
  open,
  onOpenChange,
  shiftSessionId,
  userName,
  shiftName,
}: ShiftClosingDetailsDialogProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [brandBalances, setBrandBalances] = useState<BrandBalance[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (open && shiftSessionId) {
      fetchClosingDetails();
    }
  }, [open, shiftSessionId]);

  const fetchClosingDetails = async () => {
    if (!shiftSessionId) return;

    setLoading(true);
    try {
      // Fetch brand balances for this shift session
      const { data: balanceData, error: balanceError } = await supabase
        .from("shift_brand_balances")
        .select(`
          id,
          brand_id,
          closing_balance,
          receipt_image_path
        `)
        .eq("shift_session_id", shiftSessionId);

      if (balanceError) throw balanceError;

      if (!balanceData || balanceData.length === 0) {
        setBrandBalances([]);
        return;
      }

      // Fetch brand names
      const brandIds = balanceData.map((b) => b.brand_id);
      const { data: brandsData, error: brandsError } = await supabase
        .from("brands")
        .select("id, brand_name")
        .in("id", brandIds);

      if (brandsError) throw brandsError;

      const brandMap = new Map(brandsData?.map((b) => [b.id, b.brand_name]));

      // Generate signed URLs for images
      const enrichedBalances: BrandBalance[] = await Promise.all(
        balanceData.map(async (balance) => {
          let imageUrl: string | null = null;

          if (balance.receipt_image_path) {
            const { data: signedUrlData } = await supabase.storage
              .from("shift-receipts")
              .createSignedUrl(balance.receipt_image_path, 3600);

            imageUrl = signedUrlData?.signedUrl || null;
          }

          return {
            ...balance,
            brand_name: brandMap.get(balance.brand_id) || "Unknown",
            imageUrl,
          };
        })
      );

      setBrandBalances(enrichedBalances);
    } catch (error) {
      console.error("Error fetching closing details:", error);
    } finally {
      setLoading(false);
    }
  };

  const translations = {
    ar: {
      closingDetails: "تفاصيل الإغلاق",
      user: "الموظف",
      shift: "الوردية",
      brand: "العلامة التجارية",
      closingBalance: "رصيد الإغلاق",
      image: "الصورة",
      noClosingData: "لا توجد بيانات إغلاق",
      loading: "جاري التحميل...",
      clickToEnlarge: "انقر للتكبير",
      noImage: "لا توجد صورة",
    },
    en: {
      closingDetails: "Closing Details",
      user: "User",
      shift: "Shift",
      brand: "Brand",
      closingBalance: "Closing Balance",
      image: "Image",
      noClosingData: "No closing data available",
      loading: "Loading...",
      clickToEnlarge: "Click to enlarge",
      noImage: "No image",
    },
  };

  const text = translations[language as keyof typeof translations] || translations.en;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="text-xl">{text.closingDetails}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span><strong>{text.user}:</strong> {userName}</span>
              <span><strong>{text.shift}:</strong> {shiftName}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="mr-2">{text.loading}</span>
              </div>
            ) : brandBalances.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {text.noClosingData}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {brandBalances.map((balance) => (
                  <Card key={balance.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">{balance.brand_name}</h3>
                        <div className="text-2xl font-bold text-primary">
                          {balance.closing_balance.toLocaleString()}
                        </div>
                      </div>

                      {balance.imageUrl ? (
                        <div
                          className="relative cursor-pointer group"
                          onClick={() => setSelectedImage(balance.imageUrl)}
                        >
                          <img
                            src={balance.imageUrl}
                            alt={balance.brand_name}
                            className="w-full h-48 object-contain rounded-lg border bg-white"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm">{text.clickToEnlarge}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-center text-muted-foreground">
                            <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                            <span>{text.noImage}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enlarged Image Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] p-2">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Enlarged"
              className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
