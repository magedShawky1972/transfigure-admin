import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Mail, Shield } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "setup" | "verify">("email");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if email exists in profiles table via edge function
      const { data: checkData, error: checkError } = await supabase.functions.invoke('check-email', {
        body: { email }
      });

      if (checkError) {
        console.error('Error checking email:', checkError);
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

      // Sign in with OTP to create session
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;

      toast({
        title: "Check your email",
        description: "We sent you a verification link. Click it to continue.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupMFA = async () => {
    setLoading(true);
    try {
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

      if (enrollError) throw enrollError;

      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setStep("setup");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      
      if (!factors?.totp?.[0]) {
        throw new Error("No TOTP factor found");
      }

      const factorId = factors.totp[0].id;

      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: totpCode,
      });

      if (verify.error) throw verify.error;

      toast({
        title: "Success",
        description: "Logged in successfully",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Finalize magic link/callbacks, then check session/MFA
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log('Session detected, checking MFA status');
        const { data: factors } = await supabase.auth.mfa.listFactors();
        if (factors?.totp?.length) {
          console.log('MFA enrolled, showing verify step');
          setStep('verify');
        } else {
          console.log('No MFA enrolled, starting setup');
          await handleSetupMFA();
        }
      }
    };

    const finalizeFromUrl = async () => {
      try {
        const url = new URL(window.location.href);
        // 1) Handle error from redirect
        const errorDesc = url.searchParams.get('error_description');
        if (errorDesc) {
          toast({ title: 'Login error', description: errorDesc, variant: 'destructive' });
          // Clean URL
          window.history.replaceState({}, document.title, url.pathname);
          return;
        }

        // 2) New flow: code query param
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('exchangeCodeForSession error:', error);
            toast({ title: 'Login error', description: error.message, variant: 'destructive' });
          }
          window.history.replaceState({}, document.title, url.pathname);
          return;
        }

        // 3) Legacy/hash flow: access_token + refresh_token in URL hash
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              console.error('setSession from hash error:', error);
              toast({ title: 'Login error', description: error.message, variant: 'destructive' });
            }
            // Clean hash
            window.history.replaceState({}, document.title, url.pathname);
            return;
          }
        }
      } catch (e: any) {
        console.error('Finalize auth error:', e);
      }
    };

    // Listen first, then finalize and check
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        setTimeout(() => {
          checkSession();
        }, 0);
      }
    });

    (async () => {
      await finalizeFromUrl();
      await checkSession();
    })();

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Edara</CardTitle>
          <CardDescription>
            {step === "email" && "Enter your email to continue"}
            {step === "setup" && "Set up Google Authenticator"}
            {step === "verify" && "Enter code from Google Authenticator"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Mail className="mr-2 h-4 w-4" />
                {loading ? "Verifying..." : "Continue"}
              </Button>
            </form>
          )}

          {step === "setup" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-sm font-medium mb-4">Scan this QR code with Google Authenticator</p>
                {qrCode && (
                  <img src={qrCode} alt="QR Code" className="mx-auto mb-4" />
                )}
                <p className="text-xs text-muted-foreground">Secret: {secret}</p>
              </div>
              <form onSubmit={handleVerifyTOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp">Enter 6-digit code</Label>
                  <InputOTP
                    maxLength={6}
                    value={totpCode}
                    onChange={setTotpCode}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSeparator />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={loading || totpCode.length !== 6}>
                  <Shield className="mr-2 h-4 w-4" />
                  {loading ? "Verifying..." : "Verify and Continue"}
                </Button>
              </form>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">Enter code from Google Authenticator</Label>
                <InputOTP
                  maxLength={6}
                  value={totpCode}
                  onChange={setTotpCode}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSeparator />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full" disabled={loading || totpCode.length !== 6}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? "Verifying..." : "Sign In"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setEmail("");
                  setTotpCode("");
                }}
              >
                Use different email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
