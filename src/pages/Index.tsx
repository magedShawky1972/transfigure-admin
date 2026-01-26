import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import logo from "@/assets/edara-logo.png";
import { useAppVersion } from "@/hooks/useAppVersion";
import PendingApprovalsPopup from "@/components/PendingApprovalsPopup";
import { usePendingApprovalsCheck } from "@/hooks/usePendingApprovalsCheck";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const version = useAppVersion();
  const [userId, setUserId] = useState<string | null>(null);

  // Use the hook for automatic hourly checking (default: 1 hour = 3600000ms)
  const { showPopup, setShowPopup } = usePendingApprovalsCheck(userId, {
    intervalMs: 60 * 60 * 1000, // 1 hour
    checkOnMount: true,
  });

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          try {
            const { getSystemState } = await import("@/lib/systemState");
            const state = await getSystemState();
            if (state.needsRestore) {
              navigate("/system-restore", { replace: true });
              return;
            }
          } catch {
            // ignore and fall back to auth
          }

          navigate("/auth", { replace: true });
          return;
        }

        // Set user ID for pending approvals check
        setUserId(session.user.id);

        // Show landing page to all authenticated users
        setLoading(false);
      } catch (error) {
        console.error("Error checking access:", error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-background p-4 ${language === "ar" ? "rtl" : "ltr"}`}
    >
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center mb-4 space-y-2">
            <img src={logo} alt="Edara Logo" className="h-24 w-auto" />
            <p className="text-sm text-muted-foreground">{format(new Date(), "MMMM dd, yyyy")}</p>
          </div>
          <CardTitle className="text-3xl font-bold">{t("welcome.title")}</CardTitle>
          <CardDescription className="text-lg mt-4">{t("welcome.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {version && <p className="text-sm text-muted-foreground">Version {version}</p>}
        </CardContent>
      </Card>

      {/* Copyright Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Asus. {language === 'ar' ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}
        </p>
      </div>

      {/* Pending Approvals Popup - checks every hour automatically */}
      {userId && (
        <PendingApprovalsPopup
          open={showPopup}
          onOpenChange={setShowPopup}
          userId={userId}
        />
      )}
    </div>
  );
};

export default Index;
