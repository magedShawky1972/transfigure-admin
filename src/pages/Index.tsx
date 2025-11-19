import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
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
    <div className={`min-h-screen flex items-center justify-center bg-background p-4 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex flex-col items-center mb-4 space-y-2">
            <img src={logo} alt="Edara Logo" className="h-24 w-auto" />
            <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM dd, yyyy')}</p>
          </div>
          <CardTitle className="text-3xl font-bold">{t('welcome.title')}</CardTitle>
          <CardDescription className="text-lg mt-4">
            {t('welcome.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">Version 1.0.2</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
