import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Moon, Sun, Languages, LogOut, Home } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import edaraLogo from "@/assets/edara-logo.png";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Initialize idle timeout session manager (30 minutes)
  useIdleTimeout();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");

    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Redirect to auth if not logged in and not already on auth page
      if (!session && location.pathname !== "/auth") {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const wasLoggedIn = user !== null;
      setUser(session?.user ?? null);
      
      if (!session && location.pathname !== "/auth") {
        // Only show toast if user was previously logged in (session expired)
        if (wasLoggedIn && event === 'SIGNED_OUT') {
          toast({
            title: language === 'ar' ? 'انتهت الجلسة' : 'Session Expired',
            description: language === 'ar' ? 'تم تسجيل خروجك تلقائياً. يرجى تسجيل الدخول مرة أخرى.' : 'You have been automatically logged out. Please sign in again.',
            variant: "destructive",
          });
        }
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserName(data.user_name);
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Don't show sidebar and header on auth page
  if (location.pathname === "/auth") {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background to-muted/20">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className={language === "ar" ? "ml-4" : "mr-4"} />
              <img src={edaraLogo} alt="Edara Logo" className="w-10 h-10 object-contain" />
              <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t("app.name")}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  {userName && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground hidden sm:inline">
                        {userName}
                      </span>
                    </div>
                  )}
                  <NotificationBell />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/")}
                    className="rounded-full"
                    title={t("navigation.home")}
                  >
                    <Home className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="rounded-full"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLanguage}
                className="rounded-full"
                title={t("language.toggle")}
              >
                <Languages className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full"
                title={t("theme.toggle")}
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
            </div>
          </header>
          
          <div className="flex-1 overflow-auto p-6 w-full">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
