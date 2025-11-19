import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import logo from "@/assets/edara-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { t, language } = useLanguage();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          navigate("/auth");
          return;
        }

        // Fetch dashboard permissions
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_permissions?user_id=eq.${session.user.id}&parent_menu=eq.dashboard&select=menu_item,has_access`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${session.access_token}`,
            }
          }
        );

        if (response.ok) {
          const permsData = await response.json();
          
          // If no permissions are set, deny access by default
          // Only allow access if there's at least one permission with has_access === true
          const hasAnyAccess = permsData.length > 0 && permsData.some((p: any) => p.has_access === true);
          
          if (hasAnyAccess) {
            navigate("/dashboard");
          } else {
            // User has no dashboard access - show welcome page
            setLoading(false);
          }
        } else {
          // If permissions check fails, show welcome page (deny access)
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking access:", error);
        navigate("/dashboard");
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
    <div className={`min-h-screen flex items-center justify-center bg-background p-4 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Edara Logo" className="h-24 w-auto" />
          </div>
          <CardTitle className="text-3xl font-bold">{t('welcome.title')}</CardTitle>
          <CardDescription className="text-lg mt-4">
            {t('welcome.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {t('welcome.noAccess')}
          </p>
          <p className="text-muted-foreground">
            {t('welcome.contactAdmin')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
