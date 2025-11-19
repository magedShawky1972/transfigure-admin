import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Moon, Sun, Languages, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import edaraLogo from "@/assets/edara-logo.png";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";

interface ReminderAlert {
  id: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  reminder_date: string;
  next_action: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderAlert[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      if (!session && location.pathname !== "/auth") {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (user) {
      fetchReminders();
    }
  }, [user]);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_customer_followup")
        .select("*")
        .lte("reminder_date", new Date().toISOString())
        .order("reminder_date", { ascending: true });

      if (error) throw error;

      if (data) {
        setReminders(data);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
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
                  <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full relative"
                        title={t("dashboard.crmReminder")}
                      >
                        <Bell className="h-5 w-5" />
                        {reminders.length > 0 && (
                          <Badge 
                            variant="destructive" 
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                          >
                            {reminders.length}
                          </Badge>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96" align="end">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-sm">{t("dashboard.crmReminder")}</h3>
                        {reminders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("dashboard.noReminders")}</p>
                        ) : (
                          <ScrollArea className="h-[400px]">
                            <div className="space-y-3">
                              {reminders.map((reminder) => (
                                <div 
                                  key={reminder.id} 
                                  className="p-3 rounded-lg border border-border bg-card space-y-1 text-sm"
                                >
                                  <div className="font-medium">
                                    {reminder.customer_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {reminder.customer_phone}
                                  </div>
                                  {reminder.notes && (
                                    <div className="text-xs">
                                      <strong>{t("dashboard.notes")}:</strong> {reminder.notes}
                                    </div>
                                  )}
                                  {reminder.next_action && (
                                    <div className="text-xs">
                                      <strong>{t("dashboard.nextAction")}:</strong> {reminder.next_action}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(reminder.reminder_date), "PPP")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
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
