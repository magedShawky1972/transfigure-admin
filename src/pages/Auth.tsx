import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Shield, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logo from "@/assets/edara-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
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

  const authSchema = z.object({
    email: z.string().email("Invalid email address").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(100),
  });

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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
      const { data: checkData, error: checkError } = await supabase.functions.invoke('check-email', {
        body: { email }
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
        .from('profiles')
        .select('must_change_password')
        .eq('email', email)
        .single();

      if (profile?.must_change_password) {
        setStep('change-password');
        return;
      }

      // Skip MFA and go directly to dashboard
      toast({
        title: t('common.success'),
        description: t('auth.signInButton'),
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
        title: t('auth.enterEmailFirst'), 
        variant: 'destructive' 
      });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-password-reset', {
        body: { email },
      });
      if (error) throw error;
      toast({ 
        title: t('common.success'), 
        description: t('auth.passwordResetSent')
      });
    } catch (err: any) {
      toast({ 
        title: t('common.error'), 
        description: t('auth.passwordResetError'), 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: language === 'ar' ? "كلمات المرور غير متطابقة" : "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: language === 'ar' ? "يجب أن تكون كلمة المرور 6 أحرف على الأقل" : "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      // Update the must_change_password flag
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('user_id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }

      toast({
        title: t('common.success'),
        description: language === 'ar' ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully",
      });
      
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: t('common.error'),
        description: error.message || (language === 'ar' ? "حدث خطأ أثناء تغيير كلمة المرور" : "Error changing password"),
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
        title: t('common.error'),
        description: language === 'ar' ? "يرجى إدخال البريد الإلكتروني" : "Please enter your email",
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
        title: t('common.success'),
        description: language === 'ar' ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني" : "Password reset link sent to your email",
      });
      
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast({
        title: t('common.error'),
        description: error.message || (language === 'ar' ? "حدث خطأ أثناء إرسال البريد الإلكتروني" : "Error sending reset email"),
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
      if (existingListed.some((f) => f.status === 'verified')) {
        setStep('verify');
        return;
      }

      // Remove any lingering unverified factors to avoid mismatched secrets
      for (const f of existingListed) {
        if (f.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
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
          setQrCode((first as any).totp?.qr_code ?? '');
          setSecret((first as any).totp?.secret ?? '');
          setStep('setup');
          return;
        }
        throw enrollError;
      }

      setMfaFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setStep('setup');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
        factorType: 'totp',
        // give it a unique friendly name to avoid collisions
        friendlyName: `authenticator-${Date.now()}` as any,
      } as any);
      if (enrollError) throw enrollError;

      setMfaFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setTotpCode('');
      setStep('setup');

      toast({ title: 'MFA reset', description: 'New QR generated. Please re‑scan and enter the code.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
          const latest = (listed?.totp ?? []).find((f: any) => f.status === 'unverified');
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

      const code = totpCode.replace(/\D/g, '');
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If we have a full session with MFA verified, redirect to dashboard
        navigate("/");
      }
    };

    checkExistingSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="Edara Logo" className="h-16 w-auto" />
          </div>
          <CardTitle className="text-2xl">{t('auth.welcome')}</CardTitle>
          <CardDescription>
            {step === "email" && t('auth.signIn')}
            {step === "change-password" && t('auth.changePassword')}
            {step === "setup" && t('auth.setupMFA')}
            {step === "verify" && t('auth.verifyMFA')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth.passwordPlaceholder')}
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
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-primary hover:underline p-0 h-auto"
                  onClick={() => setShowForgotPassword(true)}
                >
                  {language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                </Button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? t('auth.signingIn') : t('auth.signInButton')}
              </Button>
            </form>
          )}

          {step === "change-password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('auth.newPassword')}</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder={t('auth.newPasswordPlaceholder')}
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
                <Label htmlFor="confirm-password">{t('auth.confirmPassword')}</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
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
                {loading ? t('auth.updating') : t('auth.changePasswordButton')}
              </Button>
            </form>
          )}

          {step === "setup" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-6 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-sm font-medium mb-4">{t('auth.scanQR')}</p>
                {qrCode && (
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}
                <div className="mt-4 p-3 bg-background rounded border">
                  <p className="text-xs font-mono break-all">{secret}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('auth.manualEntry')}</p>
                </div>
              </div>
              <form onSubmit={handleVerifyTOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp">{t('auth.enterCode')}</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={totpCode}
                      onChange={setTotpCode}
                    >
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
                  {loading ? t('auth.verifying') : t('auth.verifyButton')}
                </Button>
              </form>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">{t('auth.enterCode')}</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={totpCode}
                    onChange={setTotpCode}
                  >
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
                {loading ? t('auth.verifying') : t('auth.signInButton')}
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
                {t('auth.backToLogin')}
              </Button>
            </form>
          )}
          
          <div className="text-center mt-6 space-y-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM dd, yyyy')}</p>
            <p className="text-sm text-muted-foreground">Version 1.0.8</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={language === 'ar' ? 'text-right' : ''}>
              {language === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}
            </DialogTitle>
            <DialogDescription className={language === 'ar' ? 'text-right' : ''}>
              {language === 'ar' 
                ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور'
                : 'Enter your email and we will send you a link to reset your password'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className={language === 'ar' ? 'text-right block' : ''}>
                {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder={language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                required
                disabled={isResetting}
                className={language === 'ar' ? 'text-right' : ''}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isResetting}>
              {isResetting 
                ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') 
                : (language === 'ar' ? 'إرسال رابط إعادة التعيين' : 'Send Reset Link')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
