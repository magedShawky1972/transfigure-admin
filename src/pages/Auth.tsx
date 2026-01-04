import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Shield, Eye, EyeOff, Loader2, AlertTriangle, Database } from "lucide-react";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logo from "@/assets/edara-logo.png";
import { useAppVersion } from "@/hooks/useAppVersion";
import CertificateUploadDialog from "@/components/CertificateUploadDialog";

// Sysadmin username (password is stored server-side only)
const SYSADMIN_USERNAME = "sysadmin";

interface SystemState {
  tableExists: boolean;
  usersCount: number;
  needsRestore: boolean;
  needsInitialUser: boolean;
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const version = useAppVersion();
  const [loading, setLoading] = useState(false);
  const [checkingSystem, setCheckingSystem] = useState(true);
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"email" | "change-password" | "setup" | "verify">("email");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isSysadminSession, setIsSysadminSession] = useState(false);
  const [isFirstLoginProcessing, setIsFirstLoginProcessing] = useState(false);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [certificateDialogType, setCertificateDialogType] = useState<"missing" | "expired">("missing");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const authSchema = z.object({
    // Allow "sysadmin" as a special username (no @) in addition to normal emails
    email: z
      .string()
      .max(255)
      .refine(
        (val) => val.toLowerCase() === SYSADMIN_USERNAME || z.string().email().safeParse(val).success,
        "Invalid email address"
      ),
    password: z.string().min(6, "Password must be at least 6 characters").max(100),
  });

  // Check system state on mount and handle URL parameters
  useEffect(() => {
    checkSystemState();
    
    // Handle first login link from URL (auto-login with default password)
    const firstLoginPayload = searchParams.get("firstlogin");
    const mode = searchParams.get("mode");
    const emailParam = searchParams.get("email");
    const tokenParam = searchParams.get("token");

    // New format: /auth?firstlogin=<base64(json:{email,password})>
    if (firstLoginPayload) {
      try {
        const decoded = JSON.parse(atob(firstLoginPayload)) as { email?: string; password?: string };
        if (decoded?.email && decoded?.password) {
          handleFirstLogin(decoded.email, btoa(decoded.password));
          return;
        }
      } catch {
        // fall back to old format below
      }
    }

    // Old format: /auth?mode=firstlogin&email=...&token=...
    if (mode === "firstlogin" && emailParam && tokenParam) {
      handleFirstLogin(emailParam, tokenParam);
    } else if (mode === "reset" && emailParam) {
      setEmail(emailParam);
      setShowForgotPassword(true);
      setResetEmail(emailParam);
    }
  }, [searchParams]);

  const handleFirstLogin = async (emailParam: string, tokenParam: string) => {
    setIsFirstLoginProcessing(true);
    // Set a flag so Layout knows not to redirect
    sessionStorage.setItem('first_login_processing', 'true');
    setLoading(true);
    try {
      const defaultPassword = atob(tokenParam);
      
      // Try to sign in with the default password
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailParam,
        password: defaultPassword,
      });

      if (error) {
        toast({
          title: language === 'ar' ? 'فشل تسجيل الدخول' : 'Login Failed',
          description: language === 'ar' ? 'بيانات الدخول غير صحيحة أو تم تغيير كلمة المرور مسبقاً' : 'Invalid credentials or password was already changed',
          variant: 'destructive',
        });
        sessionStorage.removeItem('first_login_processing');
        setIsFirstLoginProcessing(false);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Set email and move to change password step
        setEmail(emailParam);
        setStep('change-password');
        toast({
          title: language === 'ar' ? 'مرحباً' : 'Welcome',
          description: language === 'ar' ? 'الرجاء تغيير كلمة المرور الخاصة بك' : 'Please change your password',
        });
      }
    } catch (error) {
      console.error('First login error:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during login',
        variant: 'destructive',
      });
      sessionStorage.removeItem('first_login_processing');
      setIsFirstLoginProcessing(false);
    } finally {
      setLoading(false);
    }
  };

  const checkSystemState = async () => {
    setCheckingSystem(true);
    try {
      const { getSystemState } = await import("@/lib/systemState");
      const data = await getSystemState();

      setSystemState(data);

      // If database needs restore, redirect to system restore page
      // The restore page will handle showing the confirmation message
      if (data.needsRestore) {
        navigate("/system-restore", { replace: true });
        return;
      }
    } catch (error) {
      console.error("Error checking system state:", error);
      // If we can't check, don't force navigation here.
      setSystemState({
        tableExists: true,
        usersCount: 1,
        needsRestore: false,
        needsInitialUser: false,
      });
    } finally {
      setCheckingSystem(false);
    }
  };

  // Generate device fingerprint
  const getDeviceFingerprint = (): string => {
    const stored = localStorage.getItem('device_fingerprint');
    if (stored) return stored;
    
    // Generate new fingerprint based on device characteristics
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';
    
    const fingerprint = btoa(JSON.stringify({
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      renderer: renderer,
      timestamp: Date.now()
    })).slice(0, 64);
    
    localStorage.setItem('device_fingerprint', fingerprint);
    return fingerprint;
  };

  const getDeviceName = (): string => {
    const ua = navigator.userAgent;
    if (/Mobile|Android|iPhone|iPad/.test(ua)) {
      if (/iPhone/.test(ua)) return 'iPhone';
      if (/iPad/.test(ua)) return 'iPad';
      if (/Android/.test(ua)) return 'Android Device';
      return 'Mobile Device';
    }
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux PC';
    return 'Unknown Device';
  };

  // Check if current device is activated for user
  const checkDeviceActivation = async (userId: string): Promise<boolean> => {
    try {
      const fingerprint = getDeviceFingerprint();
      
      const { data: activation, error } = await supabase
        .from("user_device_activations")
        .select("*, user_certificates!inner(is_active, expires_at)")
        .eq("user_id", userId)
        .eq("device_fingerprint", fingerprint)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error checking device activation:", error);
        setCertificateDialogType("missing");
        setShowCertificateDialog(true);
        return false;
      }

      if (!activation) {
        // Device not activated - require certificate upload
        setCertificateDialogType("missing");
        setShowCertificateDialog(true);
        return false;
      }

      // Check if linked certificate is still valid
      const cert = activation.user_certificates;
      if (!cert?.is_active || new Date(cert.expires_at) < new Date()) {
        setCertificateDialogType("expired");
        setShowCertificateDialog(true);
        return false;
      }

      // Update last login time
      await supabase
        .from("user_device_activations")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", activation.id);

      return true; // Device is activated and certificate is valid
    } catch (error) {
      console.error("Device activation check error:", error);
      setCertificateDialogType("missing");
      setShowCertificateDialog(true);
      return false;
    }
  };

  // Record login in login_history table
  const recordLoginHistory = async (userId: string) => {
    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const { data, error } = await supabase.from("login_history").insert({
        user_id: userId,
        login_at: new Date().toISOString(),
        ip_address: null, // Can't get client IP from browser
        user_agent: navigator.userAgent,
        device_info: deviceInfo,
        device_name: getDeviceName(),
        is_active: true,
      }).select("id").single();

      if (error) {
        console.error("Error recording login history:", error);
        return;
      }

      // Store session ID for logout tracking
      if (data?.id) {
        localStorage.setItem("current_login_session_id", data.id);
      }
    } catch (error) {
      console.error("Error recording login:", error);
    }
  };

  const handleCertificateSuccess = async () => {
    setShowCertificateDialog(false);
    
    // Record login history after certificate validation
    if (pendingUserId) {
      await recordLoginHistory(pendingUserId);
    }
    
    setPendingUserId(null);
    toast({
      title: t("common.success"),
      description: language === "ar" ? "تم التحقق من الشهادة بنجاح" : "Certificate verified successfully",
    });
    navigate("/");
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const isSysadminLogin = normalizedEmail === SYSADMIN_USERNAME;

      // Allow sysadmin to login without email format (no @)
      if (isSysadminLogin) {
        // Validate sysadmin password via server-side edge function
        try {
          const { data, error } = await supabase.functions.invoke("verify-sysadmin", {
            body: { password },
          });

          if (error || !data?.success) {
            toast({
              title: language === "ar" ? "فشل تسجيل الدخول" : "Login Failed",
              description: language === "ar" ? "كلمة مرور مدير النظام غير صحيحة" : "Incorrect sysadmin password",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }

          // Store the session token from server
          setIsSysadminSession(true);
          sessionStorage.setItem("sysadmin_session", data.sessionToken || "true");

          toast({
            title: language === "ar" ? "مرحباً مدير النظام" : "Welcome System Admin",
            description: language === "ar" ? "تم تسجيل الدخول كمدير النظام" : "Signed in as system admin",
          });

          // If database needs restore, redirect directly to restore page
          try {
            const { getSystemState } = await import("@/lib/systemState");
            const state = await getSystemState();
            if (state.needsRestore) {
              navigate("/system-restore", { replace: true });
              return;
            }
          } catch (e) {
            console.error("Error checking system state after sysadmin login:", e);
          }

          navigate("/user-setup");
          return;

        } catch (err: any) {
          console.error("Sysadmin auth error:", err);
          toast({
            title: language === "ar" ? "فشل تسجيل الدخول" : "Login Failed",
            description: language === "ar" ? "خطأ في المصادقة" : "Authentication error",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Check if this is sysadmin initial setup login (when no users exist)
      if (systemState?.needsInitialUser) {
        toast({
          title: language === "ar" ? "لا يوجد مستخدمين" : "No users found",
          description:
            language === "ar"
              ? "استخدم sysadmin لإنشاء المستخدمين" 
              : "Use sysadmin to create users",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Regular login flow
      // Validate input
      const validation = authSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      // Check if email exists in profiles table
      const { data: checkData, error: checkError } = await supabase.functions.invoke("check-email", {
        body: { email },
      });

      if (checkError) {
        toast({
          title: "Error",
          description: "Failed to verify email. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!checkData?.exists) {
        toast({
          title: "Access Denied",
          description: "Email not found in the system. Please contact your administrator.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Sign in with email + password
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if password change is required
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password, user_id")
        .eq("email", email)
        .single();

      if (profile?.must_change_password) {
        setStep("change-password");
        return;
      }

      // Check if device is activated for this user
      const userId = profile?.user_id;
      if (userId) {
        const deviceActivated = await checkDeviceActivation(userId);
        if (!deviceActivated) {
          setPendingUserId(userId);
          setPendingUserId(userId);
          return; // Dialog will be shown, don't navigate yet
        }

        // Record login in history
        await recordLoginHistory(userId);
      }

      // Certificate is valid, proceed to dashboard
      toast({
        title: t("common.success"),
        description: t("auth.signInButton"),
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      toast({
        title: t("auth.enterEmailFirst"),
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email },
      });
      if (error) throw error;
      toast({
        title: t("common.success"),
        description: t("auth.passwordResetSent"),
      });
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: t("auth.passwordResetError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t("common.error"),
        description:
          language === "ar" ? "يجب أن تكون كلمة المرور 6 أحرف على الأقل" : "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Update the must_change_password flag
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("user_id", user.id);

        if (profileError) {
          console.error("Error updating profile:", profileError);
        }

        // Log password change to password_access_logs
        try {
          await supabase.from("password_access_logs").insert({
            user_id: user.id,
            user_email: email || user.email || "unknown",
            access_type: "password_change",
            accessed_table: "auth.users",
            accessed_record_id: user.id,
            user_agent: navigator.userAgent,
          });
        } catch (logError) {
          console.error("Error logging password change:", logError);
        }
      }

      // Clear the first login processing flag
      sessionStorage.removeItem('first_login_processing');
      
      toast({
        title: t("common.success"),
        description: language === "ar" ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully",
      });

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: t("common.error"),
        description:
          error.message || (language === "ar" ? "حدث خطأ أثناء تغيير كلمة المرور" : "Error changing password"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resetEmail) {
      toast({
        title: t("common.error"),
        description: language === "ar" ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description:
          language === "ar"
            ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
            : "Password reset link sent to your email",
      });

      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast({
        title: t("common.error"),
        description:
          error.message || (language === "ar" ? "حدث خطأ أثناء إرسال البريد الإلكتروني" : "Error sending reset email"),
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSetupMFA = async () => {
    setLoading(true);
    try {
      // Always start fresh when no verified factor exists
      const { data: listed } = await supabase.auth.mfa.listFactors();
      const existingListed = (listed?.totp ?? []) as any[];
      if (existingListed.some((f) => f.status === "verified")) {
        setStep("verify");
        return;
      }

      // Remove any lingering unverified factors to avoid mismatched secrets
      for (const f of existingListed) {
        if (f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `authenticator-${Date.now()}` as any,
      } as any);

      if (enrollError) {
        // If enrollment fails (e.g., duplicate name), fall back to using existing factors
        const { data: after } = await supabase.auth.mfa.listFactors();
        const totp = (after?.totp ?? []) as any[];
        const first = totp[0];
        if (first) {
          setMfaFactorId(first.id);
          // If API didn't return QR again, keep setup step without QR and ask to verify
          setQrCode((first as any).totp?.qr_code ?? "");
          setSecret((first as any).totp?.secret ?? "");
          setStep("setup");
          return;
        }
        throw enrollError;
      }

      setMfaFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setStep("setup");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetMFA = async () => {
    setLoading(true);
    try {
      // Unenroll ALL existing TOTP factors to force a fresh QR
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.totp ?? []) as any[];
      for (const f of totp) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      // Enroll a new factor to get a brand new QR
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        // give it a unique friendly name to avoid collisions
        friendlyName: `authenticator-${Date.now()}` as any,
      } as any);
      if (enrollError) throw enrollError;

      setMfaFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setTotpCode("");
      setStep("setup");

      toast({ title: "MFA reset", description: "New QR generated. Please re‑scan and enter the code." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (step === "setup") {
        if (!mfaFactorId) {
          throw new Error("TOTP setup not initialized. Please re-scan the QR code.");
        }

        const code = totpCode.replace(/\D/g, "");

        // Always verify a pending TOTP with direct verify (no challenge needed in setup)
        let factorIdToUse = mfaFactorId;
        const tryVerify = async (fid: string) => {
          const res = await (supabase.auth.mfa.verify as any)({ factorId: fid, code });
          if (res?.error) throw res.error;
        };

        try {
          await tryVerify(factorIdToUse);
        } catch (e1: any) {
          // If current factor id is stale, fetch latest unverified factor and retry once
          const { data: listed } = await supabase.auth.mfa.listFactors();
          const latest = (listed?.totp ?? []).find((f: any) => f.status === "unverified");
          if (!latest) throw e1;
          factorIdToUse = latest.id;
          setMfaFactorId(factorIdToUse);
          await tryVerify(factorIdToUse);
        }

        toast({ title: "Success", description: "Authenticator linked successfully" });
        navigate("/");
        return;
      }

      // During login: challenge the verified factor then verify with challengeId
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactors = (factors?.totp ?? []) as any[];
      if (!totpFactors.length) {
        throw new Error("No TOTP factor found");
      }

      const factorId = totpFactors[0].id as string;
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const code = totpCode.replace(/\D/g, "");
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });

      if (verify.error) throw verify.error;

      toast({ title: "Success", description: "Logged in successfully" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Check if already logged in
  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // If we have a full session with MFA verified, redirect to dashboard
        navigate("/");
      }
    };

    checkExistingSession();
  }, [navigate]);

  // Show loading while checking system state
  if (checkingSystem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">
              {language === "ar" ? "جاري فحص حالة النظام..." : "Checking system state..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show message if system needs restore (shouldn't reach here as we redirect above)
  if (systemState?.needsRestore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Database className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">
              {language === "ar" ? "قاعدة البيانات فارغة" : "Empty Database"}
            </CardTitle>
            <CardDescription>
              {language === "ar" 
                ? "لم يتم العثور على هيكل قاعدة البيانات. يرجى استعادة النظام أولاً." 
                : "Database structure not found. Please restore the system first."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate("/system-restore")}
            >
              <Database className="mr-2 h-4 w-4" />
              {language === "ar" ? "الذهاب إلى استعادة النظام" : "Go to System Restore"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Edara Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl">{t("auth.welcome")}</CardTitle>
          <CardDescription>
            {step === "email" && (
              systemState?.needsInitialUser ? (
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <span className="text-warning">
                    {language === "ar" 
                      ? "لا يوجد مستخدمين. سجل دخول كمدير نظام (sysadmin/sysadmin)" 
                      : "No users found. Login as sysadmin (sysadmin/sysadmin)"}
                  </span>
                </div>
              ) : t("auth.signIn")
            )}
            {step === "change-password" && t("auth.changePassword")}
            {step === "setup" && t("auth.setupMFA")}
            {step === "verify" && t("auth.verifyMFA")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {systemState?.needsInitialUser 
                    ? (language === "ar" ? "اسم المستخدم" : "Username")
                    : t("auth.email")}
                </Label>
                <Input
                  id="email"
                  type={systemState?.needsInitialUser || email.toLowerCase() === "sysadmin" ? "text" : "email"}
                  placeholder={systemState?.needsInitialUser 
                    ? (language === "ar" ? "أدخل اسم المستخدم" : "Enter username")
                    : t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              {!systemState?.needsInitialUser && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-primary hover:underline p-0 h-auto"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    {language === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                  </Button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? t("auth.signingIn") : t("auth.signInButton")}
              </Button>
            </form>
          )}

          {step === "change-password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("auth.newPassword")}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t("auth.newPasswordPlaceholder")}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t("auth.confirmPassword")}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? t("auth.updating") : t("auth.changePasswordButton")}
              </Button>
            </form>
          )}

          {step === "setup" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-6 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-sm font-medium mb-4">{t("auth.scanQR")}</p>
                {qrCode && (
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}
                <div className="mt-4 p-3 bg-background rounded border">
                  <p className="text-xs font-mono break-all">{secret}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("auth.manualEntry")}</p>
                </div>
              </div>
              <form onSubmit={handleVerifyTOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp">{t("auth.enterCode")}</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading || totpCode.length !== 6}>
                  <Shield className="mr-2 h-4 w-4" />
                  {loading ? t("auth.verifying") : t("auth.verifyButton")}
                </Button>
              </form>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">{t("auth.enterCode")}</Label>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || totpCode.length !== 6}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? t("auth.verifying") : t("auth.signInButton")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setEmail("");
                  setPassword("");
                  setTotpCode("");
                }}
              >
                {t("auth.backToLogin")}
              </Button>
            </form>
          )}

          <div className="text-center mt-6 space-y-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">{format(new Date(), "MMMM dd, yyyy")}</p>
            {version && <p className="text-sm text-muted-foreground">Version {version}</p>}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={language === "ar" ? "text-right" : ""}>
              {language === "ar" ? "إعادة تعيين كلمة المرور" : "Reset Password"}
            </DialogTitle>
            <DialogDescription className={language === "ar" ? "text-right" : ""}>
              {language === "ar"
                ? "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور"
                : "Enter your email and we will send you a link to reset your password"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className={language === "ar" ? "text-right block" : ""}>
                {language === "ar" ? "البريد الإلكتروني" : "Email"}
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder={language === "ar" ? "أدخل بريدك الإلكتروني" : "Enter your email"}
                required
                disabled={isResetting}
                className={language === "ar" ? "text-right" : ""}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isResetting}>
              {isResetting
                ? language === "ar"
                  ? "جاري الإرسال..."
                  : "Sending..."
                : language === "ar"
                  ? "إرسال رابط إعادة التعيين"
                  : "Send Reset Link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Certificate Upload Dialog */}
      {pendingUserId && (
        <CertificateUploadDialog
          open={showCertificateDialog}
          onOpenChange={(open) => {
            if (!open) {
              // If user closes dialog without validating, sign them out
              supabase.auth.signOut();
              setPendingUserId(null);
            }
            setShowCertificateDialog(open);
          }}
          userId={pendingUserId}
          onSuccess={handleCertificateSuccess}
          type={certificateDialogType}
        />
      )}
    </div>
  );
};

export default Auth;
