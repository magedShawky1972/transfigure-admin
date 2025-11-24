import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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

  const handleBalanceChange = (brandId: string, value: string) => {
    setBalances((prev) => ({
      ...prev,
      [brandId]: {
        ...prev[brandId],
        brand_id: brandId,
        closing_balance: parseFloat(value) || 0,
        receipt_image_path: prev[brandId]?.receipt_image_path || null,
      },
    }));
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

      setBalances((prev) => ({
        ...prev,
        [brandId]: {
          ...prev[brandId],
          brand_id: brandId,
          closing_balance: prev[brandId]?.closing_balance || 0,
          receipt_image_path: fileName,
        },
      }));

      toast({
        title: t("success"),
        description: t("imageUploadedSuccessfully"),
      });
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast({
        title: t("error"),
        description: error.message,
        variant: "destructive",
      });
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
                  <Card key={brand.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {brand.short_name || brand.brand_name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label>{t("closingBalance")}</Label>
                        <Input
                          type="number"
                          value={balances[brand.id]?.closing_balance || ""}
                          onChange={(e) => handleBalanceChange(brand.id, e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>{t("receiptImage")}</Label>
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
                          />
                          <Label
                            htmlFor={`file-${brand.id}`}
                            className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 hover:bg-accent"
                          >
                            <Upload className="h-4 w-4" />
                            {balances[brand.id]?.receipt_image_path ? t("changeImage") : t("uploadImage")}
                          </Label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={handleCloseShift} className="w-full" variant="destructive">
                {t("closeShift")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftSession;
