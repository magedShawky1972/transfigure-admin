import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Moon, Sun, Languages, LogOut, Home, Clock, User, Key, Camera, Building2, Briefcase, LayoutGrid, PanelLeft } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { PushNotificationBar } from "@/components/PushNotificationBar";
import { MainPageMenu } from "@/components/MainPageMenu";
import { PendingAcknowledgmentDialog } from "@/components/PendingAcknowledgmentDialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import edaraLogo from "@/assets/edara-logo.png";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { getKSAGregorianDate, getKSADate } from "@/lib/ksaTime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarSelector from "@/components/AvatarSelector";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const getKSADateTime = () => {
  const ksaDate = getKSADate();
  
  const hours = ksaDate.getHours();
  const minutes = ksaDate.getMinutes().toString().padStart(2, '0');
  const seconds = ksaDate.getSeconds().toString().padStart(2, '0');
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  return {
    date: getKSAGregorianDate(),
    time: `${hour12.toString().padStart(2, '0')}:${minutes}:${seconds} ${ampm}`
  };
};

interface UserProfile {
  user_name: string;
  email: string;
  avatar_url: string | null;
  department_name: string | null;
  job_position_name: string | null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [ksaDateTime, setKsaDateTime] = useState(getKSADateTime());
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [isSysadminSession, setIsSysadminSession] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuMode, setMenuMode] = useState<"sidebar" | "mainpage">(() => {
    const saved = localStorage.getItem("menuMode") as "sidebar" | "mainpage" | null;
    if (saved) return saved;
    // Default to mainpage on mobile, sidebar on desktop
    return window.innerWidth < 768 ? "mainpage" : "sidebar";
  });
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const toggleMenuMode = () => {
    const newMode = menuMode === "sidebar" ? "mainpage" : "sidebar";
    setMenuMode(newMode);
    localStorage.setItem("menuMode", newMode);
  };
  
  // Initialize idle timeout session manager (30 minutes)
  useIdleTimeout();

  // Check for sysadmin session
  useEffect(() => {
    const sysadminSession = sessionStorage.getItem("sysadmin_session");
    setIsSysadminSession(sysadminSession === "true");
  }, []);

  // Update KSA time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setKsaDateTime(getKSADateTime());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide header on scroll
  useEffect(() => {
    const handleScroll = () => {
      const mainElement = document.querySelector('main .overflow-auto');
      if (!mainElement) return;
      
      const currentScrollY = mainElement.scrollTop;
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setHeaderVisible(false);
      } else {
        setHeaderVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    const mainElement = document.querySelector('main .overflow-auto');
    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => mainElement.removeEventListener('scroll', handleScroll);
    }
  }, [lastScrollY]);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "dark";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");

    // Check for sysadmin session first
    const sysadminSession = sessionStorage.getItem("sysadmin_session");
    if (sysadminSession === "true") {
      (async () => {
        try {
          const { getSystemState } = await import("@/lib/systemState");
          const state = await getSystemState();
          if (state.needsRestore) {
            navigate("/system-restore", { replace: true });
            return;
          }
        } catch (e) {
          console.error("Error checking system state (sysadmin session):", e);
        }

        setIsSysadminSession(true);
        setUserName("sysadmin");
        setLoading(false);
      })();
      return;
    }

    const redirectWhenNoSession = async (wasLoggedIn: boolean, event?: string) => {
      // Never redirect away from auth/system restore screens
      if (location.pathname === "/auth" || location.pathname === "/system-restore") return;
      
      // Don't redirect if first login is being processed
      if (sessionStorage.getItem('first_login_processing') === 'true') return;

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

      // Only show toast if user was previously logged in (session expired)
      if (wasLoggedIn && event === "SIGNED_OUT") {
        toast({
          title: language === "ar" ? "انتهت الجلسة" : "Session Expired",
          description:
            language === "ar"
              ? "تم تسجيل خروجك تلقائياً. يرجى تسجيل الدخول مرة أخرى."
              : "You have been automatically logged out. Please sign in again.",
          variant: "destructive",
        });
      }

      navigate("/auth", { replace: true });
    };

    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (!session) {
        void redirectWhenNoSession(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const wasLoggedIn = user !== null;
      setUser(session?.user ?? null);

      if (!session) {
        void redirectWhenNoSession(wasLoggedIn, event);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname, language, toast, user]);

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile(user.id);
    }
  }, [user?.id]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          user_name,
          email,
          avatar_url,
          default_department:departments(department_name),
          job_position:job_positions(position_name)
        `)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // Only log if it's not a network error during initial load
        if (!error.message?.includes('Failed to fetch')) {
          console.error("Error fetching user profile:", error);
        }
        return;
      }

      if (data) {
        setUserName(data.user_name);
        setUserProfile({
          user_name: data.user_name,
          email: data.email,
          avatar_url: data.avatar_url,
          department_name: (data.default_department as any)?.department_name || null,
          job_position_name: (data.job_position as any)?.position_name || null,
        });
      }
    } catch (error: any) {
      // Silently ignore network errors during page transitions
      if (!error?.message?.includes('Failed to fetch')) {
        console.error("Error fetching user profile:", error);
      }
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
      // Update login history with logout time
      const sessionId = localStorage.getItem("current_login_session_id");
      if (sessionId) {
        const { data: loginSession } = await supabase
          .from("login_history")
          .select("login_at")
          .eq("id", sessionId)
          .single();

        if (loginSession) {
          const loginAt = new Date(loginSession.login_at);
          const now = new Date();
          const durationMinutes = Math.round((now.getTime() - loginAt.getTime()) / 60000);

          await supabase.from("login_history").update({
            logout_at: now.toISOString(),
            session_duration_minutes: durationMinutes,
            is_active: false,
          }).eq("id", sessionId);
        }
        
        localStorage.removeItem("current_login_session_id");
      }

      // Clear sysadmin session if exists
      if (isSysadminSession) {
        sessionStorage.removeItem("sysadmin_session");
        setIsSysadminSession(false);
        toast({
          title: "Success",
          description: "Logged out successfully",
        });
        navigate("/auth");
        return;
      }

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

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم" : "Success",
        description: language === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully",
      });
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    setSavingAvatar(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", user.id);

      if (error) throw error;

      setUserProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      toast({
        title: language === "ar" ? "تم" : "Success",
        description: language === "ar" ? "تم تحديث الصورة بنجاح" : "Avatar updated successfully",
      });
      setAvatarDialogOpen(false);
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingAvatar(false);
    }
  };

  // Don't show sidebar and header on auth page or system-restore page (when no auth)
  if (location.pathname === "/auth" || (location.pathname === "/system-restore" && !user && !isSysadminSession)) {
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
    <SidebarProvider defaultOpen={menuMode === "sidebar"}>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-background to-muted/20">
        {menuMode === "sidebar" && <AppSidebar />}
        
        <main className="flex-1 flex flex-col min-w-0">
          {/* Push Notification Enable Bar */}
          {(user || isSysadminSession) && <PushNotificationBar />}
          
          <header className={`border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10 transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            {/* Main header row */}
            <div className="h-12 flex items-center justify-between px-3 md:px-4">
              <div className="flex items-center gap-3">
                {menuMode === "sidebar" && (
                  <SidebarTrigger className={language === "ar" ? "ml-4" : "mr-4"} />
                )}
                <img src={edaraLogo} alt="Edara Logo" className="w-10 h-10 object-contain" />
                <h1 className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {t("app.name")}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {(user || isSysadminSession) && (
                  <>
                    {/* KSA Date & Time Display - Desktop only */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                      <Clock className="h-4 w-4 text-primary" />
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-medium text-foreground">{ksaDateTime.date}</span>
                        <span className="text-xs text-muted-foreground">{ksaDateTime.time}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">KSA</span>
                    </div>
                    
                    {/* User Profile Dropdown */}
                    {userName && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border hover:bg-muted transition-colors cursor-pointer">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={userProfile?.avatar_url || ""} />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                {userName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-foreground hidden sm:inline">
                              {userName}
                            </span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>
                            {language === "ar" ? "حسابي" : "My Account"}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {!isSysadminSession && (
                            <>
                              <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                                <User className="h-4 w-4 me-2" />
                                {language === "ar" ? "الملف الشخصي" : "Profile"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setAvatarDialogOpen(true)}>
                                <Camera className="h-4 w-4 me-2" />
                                {language === "ar" ? "تغيير الصورة" : "Change Picture"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                                <Key className="h-4 w-4 me-2" />
                                {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    
                    <NotificationBell />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleMenuMode}
                          className="rounded-full"
                        >
                          {menuMode === "sidebar" ? (
                            <LayoutGrid className="h-5 w-5" />
                          ) : (
                            <PanelLeft className="h-5 w-5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {menuMode === "sidebar" 
                          ? (language === "ar" ? "التبديل إلى قائمة الأيقونات" : "Switch to Icon Grid Menu")
                          : (language === "ar" ? "التبديل إلى القائمة الجانبية" : "Switch to Sidebar Menu")
                        }
                      </TooltipContent>
                    </Tooltip>
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
            </div>
            
            {/* Mobile KSA Date & Time - shown under logo on mobile */}
            {user && (
              <div className="md:hidden flex items-center justify-center gap-2 px-4 pb-2 border-t border-border/50">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">{ksaDateTime.date}</span>
                <span className="text-xs text-muted-foreground">{ksaDateTime.time}</span>
                <span className="text-[10px] text-muted-foreground">KSA</span>
              </div>
            )}
          </header>
          
          <div className="flex-1 overflow-auto p-2 w-full">
            {menuMode === "mainpage" && location.pathname === "/" ? (
              <MainPageMenu />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Pending Acknowledgment Documents Dialog */}
      {user && <PendingAcknowledgmentDialog />}

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "الملف الشخصي" : "Profile"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Avatar className="w-20 h-20">
                <AvatarImage src={userProfile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-2xl">
                  {userName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{language === "ar" ? "الاسم" : "Name"}</p>
                  <p className="font-medium">{userProfile?.user_name || "-"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{language === "ar" ? "القسم" : "Department"}</p>
                  <p className="font-medium">{userProfile?.department_name || (language === "ar" ? "غير محدد" : "Not assigned")}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{language === "ar" ? "المسمى الوظيفي" : "Job Position"}</p>
                  <p className="font-medium">{userProfile?.job_position_name || (language === "ar" ? "غير محدد" : "Not assigned")}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تغيير كلمة المرور" : "Change Password"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={language === "ar" ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={language === "ar" ? "أعد إدخال كلمة المرور" : "Re-enter password"}
              />
            </div>
            <Button 
              onClick={handleChangePassword} 
              disabled={changingPassword}
              className="w-full"
            >
              {changingPassword 
                ? (language === "ar" ? "جاري التغيير..." : "Changing...") 
                : (language === "ar" ? "تغيير كلمة المرور" : "Change Password")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Avatar Dialog */}
      <Dialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen}>
        <DialogContent dir={language === "ar" ? "rtl" : "ltr"} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تغيير الصورة" : "Change Picture"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <AvatarSelector
              currentAvatar={userProfile?.avatar_url || null}
              onAvatarChange={(url) => {
                if (url) handleAvatarSelect(url);
              }}
              userName={userName}
              language={language}
            />
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
