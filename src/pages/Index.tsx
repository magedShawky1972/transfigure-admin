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

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();
  const version = useAppVersion();
  const [userId, setUserId] = useState<string | null>(null);
  const [showPendingApprovals, setShowPendingApprovals] = useState(false);

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
        
        // Check if this is a fresh login (within the last 5 seconds)
        const lastLogin = sessionStorage.getItem("lastLoginCheck");
        const now = Date.now();
        
        if (!lastLogin || (now - parseInt(lastLogin)) > 5000) {
          // Mark this as checked to avoid showing popup on every page load
          sessionStorage.setItem("lastLoginCheck", now.toString());
          
          // Check if user is a department admin
          const { data: adminData } = await supabase
            .from("department_admins")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1);
          
          if (adminData && adminData.length > 0) {
            // User is an admin, show pending approvals popup
            setShowPendingApprovals(true);
          }
        }

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

      {/* Pending Approvals Popup */}
      {userId && (
        <PendingApprovalsPopup
          open={showPendingApprovals}
          onOpenChange={setShowPendingApprovals}
          userId={userId}
        />
      )}
    </div>
  );
};

export default Index;
