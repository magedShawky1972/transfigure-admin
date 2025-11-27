import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, RotateCcw, Loader2, Sparkles, Trash2, Image as ImageIcon, Eye } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Brand {
  id: string;
  brand_name: string;
  short_name: string | null;
  abc_analysis: string;
}

interface ShiftSession {
  id: string;
  opened_at: string;
  status: string;
}

interface BrandBalance {
  brand_id: string;
  closing_balance: number;
  receipt_image_path: string | null;
}

const ShiftSession = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [shiftSession, setShiftSession] = useState<ShiftSession | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [balances, setBalances] = useState<Record<string, BrandBalance>>({});
  const [userName, setUserName] = useState("");
  const [currentDateHijri, setCurrentDateHijri] = useState("");
  const [currentDateGregorian, setCurrentDateGregorian] = useState("");
  const [currentWeekday, setCurrentWeekday] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [hasActiveAssignment, setHasActiveAssignment] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackPassword, setRollbackPassword] = useState("");
const [extractingBrands, setExtractingBrands] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [brandErrors, setBrandErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    checkShiftAssignmentAndLoadData();
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateDateTime = () => {
    const now = new Date();
    setCurrentDateHijri(now.toLocaleDateString('ar-SA-u-ca-islamic'));
    setCurrentDateGregorian(now.toLocaleDateString('en-GB'));
    setCurrentWeekday(now.toLocaleDateString('ar-SA', { weekday: 'long' }));
    setCurrentTime(now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }));
  };

  const checkShiftAssignmentAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: t("error"),
          description: t("userNotAuthenticated"),
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        setUserName(profile.user_name);
      }

      // Check if user has active shift assignment for today
      const today = new Date().toISOString().split('T')[0];
      const { data: assignment } = await supabase
        .from("shift_assignments")
        .select("id")
        .eq("user_id", user.id)
        .eq("assignment_date", today)
        .single();

      if (!assignment) {
        toast({
          title: t("noShiftAssignment"),
          description: t("noShiftAssignmentMessage"),
          variant: "destructive",
        });
        setHasActiveAssignment(false);
        setLoading(false);
        return;
      }

      setHasActiveAssignment(true);

      // Check for existing open shift session
      const { data: existingSession } = await supabase
        .from("shift_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("shift_assignment_id", assignment.id)
        .eq("status", "open")
        .single();

      if (existingSession) {
        setShiftSession(existingSession);
        await loadBrandBalances(existingSession.id);
      }

      // Load A-Class brands
      const { data: brandsData, error: brandsError } = await supabase
        .from("brands")
        .select("*")
        .eq("status", "active")
        .eq("abc_analysis", "A")
        .order("brand_name");

      if (brandsError) throw brandsError;
      setBrands(brandsData || []);

      setLoading(false);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const loadBrandBalances = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from("shift_brand_balances")
        .select("*")
        .eq("shift_session_id", sessionId);

      if (error) throw error;

      const balancesMap: Record<string, BrandBalance> = {};
      data?.forEach((balance) => {
        balancesMap[balance.brand_id] = balance;
      });
      setBalances(balancesMap);
    } catch (error: any) {
      console.error("Error loading balances:", error);
    }
  };

  const handleOpenShift = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      const { data: assignment } = await supabase
        .from("shift_assignments")
        .select("id, shift_id, shifts(shift_name)")
        .eq("user_id", user.id)
        .eq("assignment_date", today)
        .single();

      if (!assignment) {
        toast({
          title: t("error"),
          description: t("noShiftAssignment"),
          variant: "destructive",
        });
        return;
      }

      const { data: newSession, error } = await supabase
        .from("shift_sessions")
        .insert({
          user_id: user.id,
          shift_assignment_id: assignment.id,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      // Send notifications to shift admins
      try {
        await supabase.functions.invoke("send-shift-open-notification", {
          body: {
            shiftId: assignment.shift_id,
            userId: user.id,
            shiftSessionId: newSession.id,
          },
        });
      } catch (notifError) {
        console.error("Error sending notifications:", notifError);
      }

      setShiftSession(newSession);
      toast({
        title: t("success"),
        description: t("shiftOpenedSuccessfully"),
      });
    } catch (error: any) {
      console.error("Error opening shift:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Helper function to save balance to database
  const saveBalanceToDb = async (brandId: string, closingBalance: number, receiptImagePath: string | null) => {
    if (!shiftSession) return;
    
    try {
      const { error } = await supabase
        .from("shift_brand_balances")
        .upsert({
          shift_session_id: shiftSession.id,
          brand_id: brandId,
          closing_balance: closingBalance,
          receipt_image_path: receiptImagePath,
        }, { onConflict: "shift_session_id,brand_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Error saving balance to database:", error);
    }
  };

  const handleBalanceChange = (brandId: string, value: string) => {
    const newBalance = parseFloat(value) || 0;
    const receiptPath = balances[brandId]?.receipt_image_path || null;
    
    setBalances((prev) => ({
      ...prev,
      [brandId]: {
        ...prev[brandId],
        brand_id: brandId,
        closing_balance: newBalance,
        receipt_image_path: receiptPath,
      },
    }));
  };

  // Save balance when input loses focus
  const handleBalanceBlur = async (brandId: string) => {
    const balance = balances[brandId];
    if (balance) {
      await saveBalanceToDb(brandId, balance.closing_balance, balance.receipt_image_path);
    }
  };

  const handleImageUpload = async (brandId: string, file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !shiftSession) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${shiftSession.id}/${brandId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("shift-receipts")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const newBalance = balances[brandId]?.closing_balance || 0;
      
      setBalances((prev) => ({
        ...prev,
        [brandId]: {
          ...prev[brandId],
          brand_id: brandId,
          closing_balance: newBalance,
          receipt_image_path: fileName,
        },
      }));

      // Get signed URL immediately for display
      const signedUrl = await getImageUrl(fileName);
      setImageUrls((prev) => ({ ...prev, [brandId]: signedUrl }));

      // Save to database immediately
      await saveBalanceToDb(brandId, newBalance, fileName);

      toast({
        title: t("success"),
        description: t("imageUploadedSuccessfully"),
      });

      // Clear any previous error for this brand
      setBrandErrors((prev) => ({ ...prev, [brandId]: null }));

      // Get brand name for AI validation
      const brand = brands.find(b => b.id === brandId);
      const brandName = brand?.short_name || brand?.brand_name || "unknown";

      // Automatically extract number using AI
      await extractNumberFromImage(brandId, file, fileName, brandName);
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteImage = async (brandId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !shiftSession) return;

      const existingPath = balances[brandId]?.receipt_image_path;
      if (existingPath) {
        await supabase.storage.from("shift-receipts").remove([existingPath]);
      }

      const currentBalance = balances[brandId]?.closing_balance || 0;

      setBalances((prev) => ({
        ...prev,
        [brandId]: {
          ...prev[brandId],
          brand_id: brandId,
          closing_balance: currentBalance,
          receipt_image_path: null,
        },
      }));

      // Clear the image URL and error
      setImageUrls((prev) => ({ ...prev, [brandId]: null }));
      setBrandErrors((prev) => ({ ...prev, [brandId]: null }));

      // Save to database immediately
      await saveBalanceToDb(brandId, currentBalance, null);

      toast({
        title: t("success"),
        description: t("imageDeletedSuccessfully") || "تم حذف الصورة بنجاح",
      });
    } catch (error: any) {
      console.error("Error deleting image:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getImageUrl = async (imagePath: string | null): Promise<string | null> => {
    if (!imagePath) return null;
    const { data, error } = await supabase.storage.from("shift-receipts").createSignedUrl(imagePath, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  };

  // State to store signed URLs for images
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});

  // Load signed URLs when balances change
  useEffect(() => {
    const loadImageUrls = async () => {
      const urls: Record<string, string | null> = {};
      for (const brandId of Object.keys(balances)) {
        const imagePath = balances[brandId]?.receipt_image_path;
        if (imagePath) {
          urls[brandId] = await getImageUrl(imagePath);
        }
      }
      setImageUrls(urls);
    };
    loadImageUrls();
  }, [balances]);

  const extractNumberFromImage = async (brandId: string, file: File, imagePath: string, brandName: string) => {
    setExtractingBrands((prev) => ({ ...prev, [brandId]: true }));
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      const { data, error } = await supabase.functions.invoke("extract-shift-closing-number", {
        body: { imageUrl: base64Image, brandId, brandName },
      });

      if (error) throw error;

      // Check if image is for wrong brand
      if (data?.isValidBrand === false) {
        const errorMsg = data.brandMismatchReason || "صورة لعلامة تجارية مختلفة";
        setBrandErrors((prev) => ({ ...prev, [brandId]: `صورة خاطئة: ${errorMsg}` }));
        toast({
          title: t("error") || "خطأ",
          description: `الصورة المرفوعة ليست لـ ${brandName}. يرجى رفع الصورة الصحيحة.`,
          variant: "destructive",
        });
        return;
      }

      if (data?.extractedNumber !== null && data?.extractedNumber !== undefined) {
        setBalances((prev) => ({
          ...prev,
          [brandId]: {
            ...prev[brandId],
            brand_id: brandId,
            closing_balance: data.extractedNumber,
            receipt_image_path: imagePath,
          },
        }));

        // Save extracted number to database immediately
        await saveBalanceToDb(brandId, data.extractedNumber, imagePath);

        toast({
          title: t("success"),
          description: `تم استخراج الرقم: ${data.extractedNumber}`,
        });
      } else {
        // Set error for not found number
        setBrandErrors((prev) => ({ ...prev, [brandId]: "لم يتم العثور على الرقم في الصورة" }));
        toast({
          title: t("error") || "خطأ",
          description: "لم يتم العثور على رقم الإغلاق. يرجى التأكد من الصورة أو إدخال الرقم يدوياً.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error extracting number:", error);
      // Set error for extraction failure
      setBrandErrors((prev) => ({ ...prev, [brandId]: "فشل في قراءة الصورة - يرجى المحاولة مرة أخرى" }));
      toast({
        title: t("error") || "خطأ",
        description: "فشل في قراءة الصورة. يرجى رفع صورة أخرى.",
        variant: "destructive",
      });
    } finally {
      setExtractingBrands((prev) => ({ ...prev, [brandId]: false }));
    }
  };

  const handleCloseShift = async () => {
    try {
      if (!shiftSession) return;

      // Save all balances
      const balanceRecords = Object.values(balances).map((balance) => ({
        shift_session_id: shiftSession.id,
        brand_id: balance.brand_id,
        closing_balance: balance.closing_balance,
        receipt_image_path: balance.receipt_image_path,
      }));

      const { error: balanceError } = await supabase
        .from("shift_brand_balances")
        .upsert(balanceRecords, { onConflict: "shift_session_id,brand_id" });

      if (balanceError) throw balanceError;

      // Close the shift session
      const { error: sessionError } = await supabase
        .from("shift_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", shiftSession.id);

      if (sessionError) throw sessionError;

      // Send notifications to shift admins
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const today = new Date().toISOString().split('T')[0];
        const { data: assignment } = await supabase
          .from("shift_assignments")
          .select("shift_id")
          .eq("user_id", user?.id)
          .eq("assignment_date", today)
          .single();

        if (assignment) {
          await supabase.functions.invoke("send-shift-close-notification", {
            body: {
              shiftId: assignment.shift_id,
              userId: user?.id,
              shiftSessionId: shiftSession.id,
            },
          });
        }
      } catch (notifError) {
        console.error("Error sending close notifications:", notifError);
      }

      toast({
        title: t("success"),
        description: t("shiftClosedSuccessfully"),
      });

      // Reset state
      setShiftSession(null);
      setBalances({});
    } catch (error: any) {
      console.error("Error closing shift:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRollbackShift = async () => {
    if (rollbackPassword !== "123@123qw") {
      toast({
        title: t("error"),
        description: "كلمة المرور غير صحيحة",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!shiftSession) return;

      // Delete brand balances
      const { error: balanceError } = await supabase
        .from("shift_brand_balances")
        .delete()
        .eq("shift_session_id", shiftSession.id);

      if (balanceError) throw balanceError;

      // Delete shift session
      const { error: sessionError } = await supabase
        .from("shift_sessions")
        .delete()
        .eq("id", shiftSession.id);

      if (sessionError) throw sessionError;

      toast({
        title: t("success"),
        description: "تم إلغاء الوردية بنجاح",
      });

      // Reset state
      setShiftSession(null);
      setBalances({});
      setShowRollbackDialog(false);
      setRollbackPassword("");
    } catch (error: any) {
      console.error("Error rolling back shift:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">{t("loading")}...</div>
      </div>
    );
  }

  if (!hasActiveAssignment) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-lg">{t("noShiftAssignmentMessage")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("shiftSession")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>{t("userName")}</Label>
              <Input value={userName} disabled />
            </div>
            <div>
              <Label>{t("weekday")}</Label>
              <Input value={currentWeekday} disabled />
            </div>
            <div>
              <Label>{t("hijriDate")}</Label>
              <Input value={currentDateHijri} disabled />
            </div>
            <div>
              <Label>{t("gregorianDate")}</Label>
              <Input value={currentDateGregorian} disabled />
            </div>
            <div>
              <Label>{t("time")}</Label>
              <Input value={currentTime} disabled />
            </div>
          </div>

          {!shiftSession ? (
            <Button onClick={handleOpenShift} className="w-full">
              {t("openShift")}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="font-semibold">{t("shiftOpenedAt")}: {new Date(shiftSession.opened_at).toLocaleString('ar-SA')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map((brand) => (
                  <Card 
                    key={brand.id}
                    className={brandErrors[brand.id] ? "border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20" : ""}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>{brand.short_name || brand.brand_name}</span>
                        {brandErrors[brand.id] && (
                          <span className="text-xs font-normal text-destructive">⚠️ خطأ</span>
                        )}
                      </CardTitle>
                      {brandErrors[brand.id] && (
                        <p className="text-xs text-destructive">{brandErrors[brand.id]}</p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>{t("closingBalance")}</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={balances[brand.id]?.closing_balance || ""}
                            onChange={(e) => handleBalanceChange(brand.id, e.target.value)}
                            onBlur={() => handleBalanceBlur(brand.id)}
                            placeholder="0.00"
                            disabled={extractingBrands[brand.id]}
                          />
                          {extractingBrands[brand.id] && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        {extractingBrands[brand.id] && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            جاري قراءة الرقم...
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("receiptImage")}</Label>
                        
                        {/* Image Preview */}
                        {balances[brand.id]?.receipt_image_path && imageUrls[brand.id] && (
                          <div className="relative rounded-lg overflow-hidden border bg-muted">
                            <img
                              src={imageUrls[brand.id] || ""}
                              alt={brand.brand_name}
                              className="w-full h-32 object-cover cursor-pointer"
                              onClick={() => setSelectedImage(imageUrls[brand.id] || null)}
                            />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/80 hover:bg-background"
                                onClick={() => setSelectedImage(imageUrls[brand.id] || null)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-7 w-7"
                                onClick={() => handleDeleteImage(brand.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Upload Button */}
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(brand.id, file);
                            }}
                            className="hidden"
                            id={`file-${brand.id}`}
                            disabled={extractingBrands[brand.id]}
                          />
                          <Label
                            htmlFor={`file-${brand.id}`}
                            className={`flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 hover:bg-accent w-full justify-center ${extractingBrands[brand.id] ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            {extractingBrands[brand.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {balances[brand.id]?.receipt_image_path ? t("changeImage") : t("uploadImage")}
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCloseShift} className="flex-1" variant="destructive">
                  {t("closeShift")}
                </Button>
                <Button 
                  onClick={() => setShowRollbackDialog(true)} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  إلغاء الوردية
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الوردية</DialogTitle>
            <DialogDescription>
              يرجى إدخال كلمة المرور للتأكيد على إلغاء الوردية. سيتم حذف جميع البيانات المسجلة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rollback-password">كلمة المرور</Label>
              <Input
                id="rollback-password"
                type="password"
                value={rollbackPassword}
                onChange={(e) => setRollbackPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRollbackDialog(false);
                setRollbackPassword("");
              }}
            >
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleRollbackShift}>
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("receiptImage")}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Receipt"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftSession;
