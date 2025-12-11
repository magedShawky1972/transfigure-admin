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
import LudoTransactionsSection from "@/components/LudoTransactionsSection";
import { 
  getKSADateString, 
  getKSATimeInMinutes, 
  getKSAHijriDate, 
  getKSAGregorianDate, 
  getKSAWeekdayArabic, 
  getKSATimeFormatted 
} from "@/lib/ksaTime";

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
  user_id: string;
}

interface BrandBalance {
  brand_id: string;
  closing_balance: number;
  receipt_image_path: string | null;
  opening_balance: number;
  opening_image_path: string | null;
}

const ShiftSession = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [shiftSession, setShiftSession] = useState<ShiftSession | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [balances, setBalances] = useState<Record<string, BrandBalance>>({});
  const [openingBalances, setOpeningBalances] = useState<Record<string, BrandBalance>>({});
  const [userName, setUserName] = useState("");
  const [currentDateHijri, setCurrentDateHijri] = useState("");
  const [currentDateGregorian, setCurrentDateGregorian] = useState("");
  const [currentWeekday, setCurrentWeekday] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [hasActiveAssignment, setHasActiveAssignment] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackPassword, setRollbackPassword] = useState("");
  const [extractingBrands, setExtractingBrands] = useState<Record<string, boolean>>({});
  const [extractingOpeningBrands, setExtractingOpeningBrands] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [brandErrors, setBrandErrors] = useState<Record<string, string | null>>({});
  const [openingBrandErrors, setOpeningBrandErrors] = useState<Record<string, string | null>>({});
  const [openingImageUrls, setOpeningImageUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    checkShiftAssignmentAndLoadData();
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateDateTime = () => {
    // Use centralized KSA timezone functions
    setCurrentDateHijri(getKSAHijriDate());
    setCurrentDateGregorian(getKSAGregorianDate());
    setCurrentWeekday(getKSAWeekdayArabic());
    setCurrentTime(getKSATimeFormatted());
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

      // CRITICAL: First check if user has ANY open shift session (from any day)
      const { data: anyOpenSession } = await supabase
        .from("shift_sessions")
        .select(`
          *,
          shift_assignments (
            assignment_date,
            shifts (
              shift_name
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyOpenSession) {
        // User has an open shift - show it regardless of date
        setShiftSession(anyOpenSession);
        setHasActiveAssignment(true);
        await loadBrandBalances(anyOpenSession.id);
        
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
        return;
      }

      // No open session - check for today's assignment
      const today = getKSADateString();
      const { data: assignments } = await supabase
        .from("shift_assignments")
        .select("id, shift_id, shifts(shift_name, shift_start_time, shift_end_time, shift_order)")
        .eq("user_id", user.id)
        .eq("assignment_date", today)
        .order("shifts(shift_order)", { ascending: true });

      if (!assignments || assignments.length === 0) {
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
      const openingBalancesMap: Record<string, BrandBalance> = {};
      data?.forEach((balance) => {
        balancesMap[balance.brand_id] = {
          brand_id: balance.brand_id,
          closing_balance: balance.closing_balance,
          receipt_image_path: balance.receipt_image_path,
          opening_balance: balance.opening_balance || 0,
          opening_image_path: balance.opening_image_path,
        };
        openingBalancesMap[balance.brand_id] = {
          brand_id: balance.brand_id,
          closing_balance: balance.closing_balance,
          receipt_image_path: balance.receipt_image_path,
          opening_balance: balance.opening_balance || 0,
          opening_image_path: balance.opening_image_path,
        };
      });
      setBalances(balancesMap);
      setOpeningBalances(openingBalancesMap);
      
      // Load opening image URLs
      const urls: Record<string, string | null> = {};
      for (const brandId of Object.keys(openingBalancesMap)) {
        const imagePath = openingBalancesMap[brandId]?.opening_image_path;
        if (imagePath) {
          urls[brandId] = await getImageUrl(imagePath);
        }
      }
      setOpeningImageUrls(urls);
    } catch (error: any) {
      console.error("Error loading balances:", error);
    }
  };

  const handleOpeningImageUpload = async (brandId: string, file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      // Upload to Cloudinary
      const tempSessionId = `opening-${user.id}-${new Date().toISOString().split('T')[0]}`;
      const publicId = `${user.id}/${tempSessionId}/${brandId}-opening`;

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { 
          imageBase64: base64Image, 
          folder: "shift-receipts",
          publicId 
        },
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.url) throw new Error("Failed to get image URL from Cloudinary");

      const cloudinaryUrl = uploadData.url;
      const newBalance = openingBalances[brandId]?.opening_balance || 0;
      
      setOpeningBalances((prev) => ({
        ...prev,
        [brandId]: {
          ...prev[brandId],
          brand_id: brandId,
          closing_balance: 0,
          receipt_image_path: null,
          opening_balance: newBalance,
          opening_image_path: cloudinaryUrl,
        },
      }));

      // Set URL directly for display (Cloudinary URLs are public)
      setOpeningImageUrls((prev) => ({ ...prev, [brandId]: cloudinaryUrl }));

      toast({
        title: t("success"),
        description: t("imageUploadedSuccessfully"),
      });

      // Clear any previous error for this brand
      setOpeningBrandErrors((prev) => ({ ...prev, [brandId]: null }));

      // Get brand name for AI validation
      const brand = brands.find(b => b.id === brandId);
      const brandName = brand?.short_name || brand?.brand_name || "unknown";

      // Automatically extract number using AI
      await extractOpeningNumberFromImage(brandId, file, cloudinaryUrl, brandName);
    } catch (error: any) {
      console.error("Error uploading opening image:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteOpeningImage = async (brandId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Note: Cloudinary deletion is optional - images will be overwritten on re-upload
      const currentBalance = openingBalances[brandId]?.opening_balance || 0;

      setOpeningBalances((prev) => ({
        ...prev,
        [brandId]: {
          ...prev[brandId],
          brand_id: brandId,
          closing_balance: 0,
          receipt_image_path: null,
          opening_balance: currentBalance,
          opening_image_path: null,
        },
      }));

      // Clear the image URL and error
      setOpeningImageUrls((prev) => ({ ...prev, [brandId]: null }));
      setOpeningBrandErrors((prev) => ({ ...prev, [brandId]: null }));

      toast({
        title: t("success"),
        description: t("imageDeletedSuccessfully") || "تم حذف الصورة بنجاح",
      });
    } catch (error: any) {
      console.error("Error deleting opening image:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const extractOpeningNumberFromImage = async (brandId: string, file: File, imagePath: string, brandName: string) => {
    setExtractingOpeningBrands((prev) => ({ ...prev, [brandId]: true }));
    
    try {
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

      if (data?.isValidBrand === false) {
        const errorMsg = data.brandMismatchReason || "صورة لعلامة تجارية مختلفة";
        setOpeningBrandErrors((prev) => ({ ...prev, [brandId]: `صورة خاطئة: ${errorMsg}` }));
        toast({
          title: t("error") || "خطأ",
          description: `الصورة المرفوعة ليست لـ ${brandName}. يرجى رفع الصورة الصحيحة.`,
          variant: "destructive",
        });
        return;
      }

      if (data?.extractedNumber !== null && data?.extractedNumber !== undefined) {
        setOpeningBalances((prev) => ({
          ...prev,
          [brandId]: {
            ...prev[brandId],
            brand_id: brandId,
            closing_balance: 0,
            receipt_image_path: null,
            opening_balance: data.extractedNumber,
            opening_image_path: imagePath,
          },
        }));

        toast({
          title: t("success"),
          description: `تم استخراج الرقم: ${data.extractedNumber}`,
        });
      } else {
        setOpeningBrandErrors((prev) => ({ ...prev, [brandId]: "لم يتم العثور على الرقم في الصورة" }));
        toast({
          title: t("error") || "خطأ",
          description: "لم يتم العثور على رقم الفتح. يرجى التأكد من الصورة أو إدخال الرقم يدوياً.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error extracting opening number:", error);
      setOpeningBrandErrors((prev) => ({ ...prev, [brandId]: "فشل في قراءة الصورة - يرجى المحاولة مرة أخرى" }));
      toast({
        title: t("error") || "خطأ",
        description: "فشل في قراءة الصورة. يرجى رفع صورة أخرى.",
        variant: "destructive",
      });
    } finally {
      setExtractingOpeningBrands((prev) => ({ ...prev, [brandId]: false }));
    }
  };

  const handleOpeningBalanceChange = (brandId: string, value: string) => {
    const newBalance = parseFloat(value) || 0;
    const imagePath = openingBalances[brandId]?.opening_image_path || null;
    
    setOpeningBalances((prev) => ({
      ...prev,
      [brandId]: {
        ...prev[brandId],
        brand_id: brandId,
        closing_balance: 0,
        receipt_image_path: null,
        opening_balance: newBalance,
        opening_image_path: imagePath,
      },
    }));
  };

  const handleOpenShift = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Filter only non-Ludo brands for validation
      const requiredBrands = brands.filter((brand) => {
        const brandNameLower = brand.brand_name.toLowerCase();
        return !brandNameLower.includes("yalla ludo") && 
               !brandNameLower.includes("يلا لودو") && 
               !brandNameLower.includes("ludo");
      });

      // Check if all required brands have uploaded opening images
      const missingOpeningBrands = requiredBrands.filter((brand) => {
        const balance = openingBalances[brand.id];
        return !balance?.opening_image_path;
      });

      if (missingOpeningBrands.length > 0) {
        const missingNames = missingOpeningBrands.map((b) => b.brand_name).join("، ");
        toast({
          title: t("error") || "خطأ",
          description: `يجب رفع صور الفتح لجميع العلامات التجارية التالية: ${missingNames}`,
          variant: "destructive",
        });
        return;
      }

      // CRITICAL: Check if user has ANY open shift session (from any day) before opening a new one
      const { data: anyOpenSession } = await supabase
        .from("shift_sessions")
        .select("id, shift_assignments(assignment_date, shifts(shift_name))")
        .eq("user_id", user.id)
        .eq("status", "open")
        .maybeSingle();

      if (anyOpenSession) {
        const assignmentData = anyOpenSession.shift_assignments as any;
        const shiftName = assignmentData?.shifts?.shift_name || "";
        const assignmentDate = assignmentData?.assignment_date || "";
        toast({
          title: t("error"),
          description: t("existingOpenShift") || `لديك وردية مفتوحة بالفعل (${shiftName} - ${assignmentDate}). يجب إغلاقها أولاً`,
          variant: "destructive",
        });
        // Reload to show the existing open session
        await checkShiftAssignmentAndLoadData();
        return;
      }

      // Use KSA date since all shifts are based on KSA timezone
      const today = getKSADateString();
      const { data: assignments } = await supabase
        .from("shift_assignments")
        .select("id, shift_id, shifts(shift_name, shift_start_time, shift_end_time, shift_order)")
        .eq("user_id", user.id)
        .eq("assignment_date", today)
        .order("shifts(shift_order)", { ascending: true });

      if (!assignments || assignments.length === 0) {
        toast({
          title: t("error"),
          description: t("noShiftAssignment"),
          variant: "destructive",
        });
        return;
      }

      // Find an assignment without any session (open or closed) for today
      let assignment = assignments[0];

      // Check if current time is after shift end time
      const shiftData = assignment.shifts as { shift_name: string; shift_end_time: string; shift_start_time?: string } | null;
      if (shiftData?.shift_end_time) {
        // Get current time in KSA using centralized function
        const currentTimeInMinutes = getKSATimeInMinutes();
        
        const [endHours, endMinutes] = shiftData.shift_end_time.split(':').map(Number);
        const endTimeInMinutes = endHours * 60 + endMinutes;
        
        const [startHours, startMinutes] = (shiftData.shift_start_time || "00:00:00").split(':').map(Number);
        const startTimeInMinutes = startHours * 60 + startMinutes;
        
        // Check if this is an overnight shift (end time < start time, e.g., 17:00 - 00:59)
        const isOvernightShift = endTimeInMinutes < startTimeInMinutes;
        
        let isShiftEnded = false;
        
        if (isOvernightShift) {
          // For overnight shifts (e.g., 17:00 - 00:59):
          // Since this is TODAY's assignment, the shift runs from today's start time to tomorrow's end time
          // The shift has "ended" only if we're past midnight but before the early morning cutoff
          // e.g., at 02:00 AM today, yesterday's shift (assigned yesterday) has ended
          // But at 10:00 AM today, today's shift just hasn't started yet - don't block as "ended"
          // 
          // For today's assignment: only block if current time is AFTER end time AND in early morning (0:00-05:00)
          // This covers the case where someone tries to open yesterday's already-closed shift
          if (currentTimeInMinutes > endTimeInMinutes && currentTimeInMinutes < 300) { // 300 = 5:00 AM
            isShiftEnded = true;
          }
          // If current time is >= start time OR <= end time, the shift is active/openable
          // If current time is between end time and start time (daytime for overnight shifts), 
          // user just needs to wait - don't block as "ended"
        } else {
          // For regular shifts, simply check if current time is past end time
          if (currentTimeInMinutes > endTimeInMinutes) {
            isShiftEnded = true;
          }
        }
        
        if (isShiftEnded) {
          toast({
            title: t("error"),
            description: t("shiftTimeEnded") || "انتهى وقت الوردية - لا يمكن فتح الوردية بعد انتهاء وقتها",
            variant: "destructive",
          });
          return;
        }
      }

      // Check if there's already an open session for this assignment (prevent duplicates)
      const { data: existingOpenSession } = await supabase
        .from("shift_sessions")
        .select("id")
        .eq("shift_assignment_id", assignment.id)
        .eq("status", "open")
        .maybeSingle();

      if (existingOpenSession) {
        toast({
          title: t("error"),
          description: t("shiftAlreadyOpen") || "الوردية مفتوحة بالفعل",
          variant: "destructive",
        });
        // Reload to show the existing session
        await checkShiftAssignmentAndLoadData();
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

      // Save opening balances for all brands
      const openingBalanceRecords = Object.values(openingBalances)
        .filter(b => b.opening_image_path)
        .map((balance) => ({
          shift_session_id: newSession.id,
          brand_id: balance.brand_id,
          opening_balance: balance.opening_balance,
          opening_image_path: balance.opening_image_path,
          closing_balance: 0,
          receipt_image_path: null,
        }));

      if (openingBalanceRecords.length > 0) {
        const { error: balanceError } = await supabase
          .from("shift_brand_balances")
          .insert(openingBalanceRecords);
        
        if (balanceError) {
          console.error("Error saving opening balances:", balanceError);
        }
      }

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
      await loadBrandBalances(newSession.id);
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

      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      // Upload to Cloudinary
      const publicId = `${user.id}/${shiftSession.id}/${brandId}`;

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { 
          imageBase64: base64Image, 
          folder: "shift-receipts",
          publicId 
        },
      });

      if (uploadError) throw uploadError;
      if (!uploadData?.url) throw new Error("Failed to get image URL from Cloudinary");

      const cloudinaryUrl = uploadData.url;
      const newBalance = balances[brandId]?.closing_balance || 0;
      
      setBalances((prev) => ({
        ...prev,
        [brandId]: {
          ...prev[brandId],
          brand_id: brandId,
          closing_balance: newBalance,
          receipt_image_path: cloudinaryUrl,
        },
      }));

      // Set URL directly for display (Cloudinary URLs are public)
      setImageUrls((prev) => ({ ...prev, [brandId]: cloudinaryUrl }));

      // Save to database immediately
      await saveBalanceToDb(brandId, newBalance, cloudinaryUrl);

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
      await extractNumberFromImage(brandId, file, cloudinaryUrl, brandName);
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

      // Note: Cloudinary deletion is optional - images will be overwritten on re-upload
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
    // For Cloudinary URLs, return them directly as they are already public
    if (!imagePath) return null;
    
    // If it's already a Cloudinary URL (starts with https://res.cloudinary.com), return as-is
    if (imagePath.startsWith('https://res.cloudinary.com') || imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Fallback for old Supabase storage paths (backward compatibility)
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

  const printShiftCloseReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const balanceRows = brands.map(brand => {
      const balance = balances[brand.id];
      return `
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${brand.short_name || brand.brand_name}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${balance?.closing_balance?.toFixed(2) || '0.00'}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${balance?.receipt_image_path ? '✓' : '✗'}</td>
        </tr>
      `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير إغلاق الوردية</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
          h1 { color: #dc2626; text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 10px; }
          .info-section { margin: 20px 0; padding: 15px; background-color: #f0f9ff; border-right: 4px solid #0284c7; }
          .info-section p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #059669; color: white; padding: 12px; border: 1px solid #059669; }
          td { padding: 12px; border: 1px solid #e5e7eb; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>تقرير إغلاق الوردية</h1>
        
        <div class="info-section">
          <p><strong>الموظف:</strong> ${userName}</p>
          <p><strong>اليوم:</strong> ${currentWeekday}</p>
          <p><strong>التاريخ الهجري:</strong> ${currentDateHijri}</p>
          <p><strong>التاريخ الميلادي:</strong> ${currentDateGregorian}</p>
          <p><strong>وقت الإغلاق:</strong> ${currentTime}</p>
        </div>

        <h3 style="color: #059669;">أرصدة العلامات التجارية عند الإغلاق</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align: right;">العلامة التجارية</th>
              <th style="text-align: center;">الرصيد النهائي</th>
              <th style="text-align: center;">صورة الإيصال</th>
            </tr>
          </thead>
          <tbody>
            ${balanceRows}
          </tbody>
        </table>

        <div style="margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px;">
          <p>تم إنشاء هذا التقرير تلقائياً من نظام إدارة الورديات</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

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

      // CRITICAL: Ensure brands are loaded before allowing close
      if (brands.length === 0) {
        toast({
          title: t("error") || "خطأ",
          description: "يرجى الانتظار حتى يتم تحميل العلامات التجارية",
          variant: "destructive",
        });
        return;
      }

      // Filter only non-Ludo brands for validation
      const requiredBrands = brands.filter((brand) => {
        const brandNameLower = brand.brand_name.toLowerCase();
        return !brandNameLower.includes("yalla ludo") && 
               !brandNameLower.includes("يلا لودو") && 
               !brandNameLower.includes("ludo");
      });

      // Check if all required brands have uploaded images
      const missingBrands = requiredBrands.filter((brand) => {
        const balance = balances[brand.id];
        return !balance?.receipt_image_path;
      });

      if (missingBrands.length > 0) {
        const missingNames = missingBrands.map((b) => b.brand_name).join("، ");
        toast({
          title: t("error") || "خطأ",
          description: `يجب رفع صور الإغلاق لجميع العلامات التجارية التالية: ${missingNames}`,
          variant: "destructive",
        });
        return;
      }

      // Check for unconfirmed Ludo temp transactions
      const { data: unconfirmedLudo, error: ludoCheckError } = await supabase
        .from("temp_ludo_transactions")
        .select("id")
        .eq("shift_session_id", shiftSession.id);

      if (ludoCheckError) {
        console.error("Error checking temp ludo transactions:", ludoCheckError);
      }

      if (unconfirmedLudo && unconfirmedLudo.length > 0) {
        toast({
          title: t("error") || "خطأ",
          description: `يوجد ${unconfirmedLudo.length} معاملات لودو غير مؤكدة. يرجى تأكيد المعاملات أو حذفها قبل إغلاق الوردية.`,
          variant: "destructive",
        });
        return;
      }

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
        const today = getKSADateString();
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

      // Auto print shift close report
      printShiftCloseReport();

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get today's assignment (using KSA date)
      const today = getKSADateString();
      const { data: assignment } = await supabase
        .from("shift_assignments")
        .select("id")
        .eq("user_id", user.id)
        .eq("assignment_date", today)
        .single();

      if (!assignment) return;

      // Get all open sessions for this assignment
      const { data: openSessions } = await supabase
        .from("shift_sessions")
        .select("id")
        .eq("shift_assignment_id", assignment.id)
        .eq("status", "open");

      if (openSessions && openSessions.length > 0) {
        const sessionIds = openSessions.map(s => s.id);

        // Delete brand balances for all open sessions
        const { error: balanceError } = await supabase
          .from("shift_brand_balances")
          .delete()
          .in("shift_session_id", sessionIds);

        if (balanceError) throw balanceError;

        // Delete all open shift sessions
        const { error: sessionError } = await supabase
          .from("shift_sessions")
          .delete()
          .in("id", sessionIds);

        if (sessionError) throw sessionError;
      }

      toast({
        title: t("success"),
        description: "تم إلغاء الوردية بنجاح",
      });

      // Reset state
      setShiftSession(null);
      setBalances({});
      setImageUrls({});
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
      <div className="container mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-base sm:text-lg">{t("noShiftAssignmentMessage")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">{t("shiftSession")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs sm:text-sm">{t("userName")}</Label>
              <Input value={userName} disabled className="h-8 sm:h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">{t("weekday")}</Label>
              <Input value={currentWeekday} disabled className="h-8 sm:h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">{t("hijriDate")}</Label>
              <Input value={currentDateHijri} disabled className="h-8 sm:h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">{t("gregorianDate")}</Label>
              <Input value={currentDateGregorian} disabled className="h-8 sm:h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">{t("time")}</Label>
              <Input value={currentTime} disabled className="h-8 sm:h-9 text-sm" />
            </div>
          </div>

          {!shiftSession ? (
            <div className="space-y-4">
              {/* Opening Balance Section - Before Opening Shift */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{t("openingBalance") || "رصيد الفتح"}</h3>
                <p className="text-sm text-muted-foreground">{t("uploadOpeningImagesMessage") || "يجب رفع صور الفتح لجميع العلامات التجارية قبل فتح الوردية"}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {brands.filter((brand) => {
                  const brandNameLower = brand.brand_name.toLowerCase();
                  return !brandNameLower.includes("yalla ludo") && 
                         !brandNameLower.includes("يلا لودو") && 
                         !brandNameLower.includes("ludo");
                }).map((brand) => (
                  <Card 
                    key={brand.id}
                    className={openingBrandErrors[brand.id] ? "border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20" : ""}
                  >
                    <CardHeader className="p-3 sm:p-4">
                      <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                        <span className="truncate">{brand.short_name || brand.brand_name}</span>
                        {openingBrandErrors[brand.id] && (
                          <span className="text-xs font-normal text-destructive">⚠️</span>
                        )}
                      </CardTitle>
                      {openingBrandErrors[brand.id] && (
                        <p className="text-xs text-destructive">{openingBrandErrors[brand.id]}</p>
                      )}
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 space-y-3">
                      <div>
                        <Label>{t("openingBalance") || "رصيد الفتح"}</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={openingBalances[brand.id]?.opening_balance || ""}
                            onChange={(e) => handleOpeningBalanceChange(brand.id, e.target.value)}
                            placeholder="0.00"
                            disabled={extractingOpeningBrands[brand.id]}
                          />
                          {extractingOpeningBrands[brand.id] && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        {extractingOpeningBrands[brand.id] && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            جاري قراءة الرقم...
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("receiptImage") || "صورة الإيصال"}</Label>
                        
                        {/* Image Preview */}
                        {openingBalances[brand.id]?.opening_image_path && openingImageUrls[brand.id] && (
                          <div className="relative rounded-lg overflow-hidden border bg-muted">
                            <img
                              src={openingImageUrls[brand.id] || ""}
                              alt={brand.brand_name}
                              className="w-full h-32 object-cover cursor-pointer"
                              onClick={() => setSelectedImage(openingImageUrls[brand.id] || null)}
                            />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-7 w-7 bg-background/80 hover:bg-background"
                                onClick={() => setSelectedImage(openingImageUrls[brand.id] || null)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-7 w-7"
                                onClick={() => handleDeleteOpeningImage(brand.id)}
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
                              if (file) handleOpeningImageUpload(brand.id, file);
                            }}
                            className="hidden"
                            id={`opening-file-${brand.id}`}
                            disabled={extractingOpeningBrands[brand.id]}
                          />
                          <Label
                            htmlFor={`opening-file-${brand.id}`}
                            className={`flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 hover:bg-accent w-full justify-center ${extractingOpeningBrands[brand.id] ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            {extractingOpeningBrands[brand.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {openingBalances[brand.id]?.opening_image_path ? t("changeImage") : t("uploadImage")}
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={handleOpenShift} className="w-full">
                {t("openShift")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="font-semibold">{t("shiftOpenedAt")}: {new Date(shiftSession.opened_at).toLocaleString('ar-SA')}</p>
              </div>

              {/* Opening Balances - Read Only */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{t("openingBalance") || "أرصدة الفتح"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {brands.filter((brand) => {
                    const brandNameLower = brand.brand_name.toLowerCase();
                    return !brandNameLower.includes("yalla ludo") && 
                           !brandNameLower.includes("يلا لودو") && 
                           !brandNameLower.includes("ludo");
                  }).map((brand) => (
                    <Card key={`opening-${brand.id}`} className="bg-muted/30">
                      <CardHeader className="p-3 sm:p-4 pb-2">
                        <CardTitle className="text-sm font-medium">{brand.short_name || brand.brand_name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">{t("openingBalance") || "رصيد الفتح"}:</span>
                          <span className="font-semibold">{balances[brand.id]?.opening_balance?.toFixed(2) || "0.00"}</span>
                        </div>
                        {balances[brand.id]?.opening_image_path && openingImageUrls[brand.id] && (
                          <div className="relative rounded-lg overflow-hidden border h-20 cursor-pointer" onClick={() => setSelectedImage(openingImageUrls[brand.id] || null)}>
                            <img
                              src={openingImageUrls[brand.id] || ""}
                              alt={brand.brand_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Closing Balances */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{t("closingBalance") || "أرصدة الإغلاق"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {brands.map((brand) => (
                    <Card 
                      key={brand.id}
                      className={brandErrors[brand.id] ? "border-2 border-destructive bg-destructive/5 ring-2 ring-destructive/20" : ""}
                    >
                      <CardHeader className="p-3 sm:p-4">
                        <CardTitle className="text-base sm:text-lg flex items-center justify-between">
                          <span className="truncate">{brand.short_name || brand.brand_name}</span>
                          {brandErrors[brand.id] && (
                            <span className="text-xs font-normal text-destructive">⚠️</span>
                          )}
                        </CardTitle>
                        {brandErrors[brand.id] && (
                          <p className="text-xs text-destructive">{brandErrors[brand.id]}</p>
                        )}
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4 space-y-3">
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
              </div>

              {/* Ludo Manual Transactions Section */}
              <LudoTransactionsSection 
                shiftSessionId={shiftSession.id} 
                userId={shiftSession.user_id} 
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={handleCloseShift} 
                  className="flex-1" 
                  variant="destructive"
                  disabled={brands.length === 0}
                >
                  {t("closeShift")}
                </Button>
                <Button 
                  onClick={() => setShowRollbackDialog(true)} 
                  variant="outline"
                  className="flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>إلغاء الوردية</span>
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
