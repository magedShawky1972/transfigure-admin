import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { Shield } from "lucide-react";
import { z } from "zod";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
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

      // Check MFA status after successful password login
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerified = (factors?.totp ?? []).some((f: any) => f.status === 'verified');

      if (hasVerified) {
        setStep('verify');
      } else {
        // Always start a fresh setup to ensure QR/secret matches the app
        await handleSetupMFA();
      }
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

  const handleDevReset = async () => {
    if (!email) {
      toast({ title: 'Enter email first', description: 'Type your email, then click reset.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { email, new_password: '123456' },
      });
      if (error) throw error;
      toast({ title: 'Password reset', description: `Password set to 123456 for ${email}` });
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate passwords
      if (newPassword !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (newPassword.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Get current user id
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Update profile flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      // Continue to MFA setup/verification
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerified = (factors?.totp ?? []).some((f: any) => f.status === 'verified');
      
      if (hasVerified) {
        setStep('verify');
      } else {
        await handleSetupMFA();
      }
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

        // Ensure the factor still exists (avoid stale IDs after reset)
        const { data: listed } = await supabase.auth.mfa.listFactors();
        const exists = (listed?.totp ?? []).some((f: any) => f.id === mfaFactorId);
        if (!exists) {
          await handleSetupMFA();
          throw new Error("MFA setup refreshed. Please re-scan the new QR and try again.");
        }

        const code = totpCode.replace(/\D/g, "");

        // Try direct enrollment verification
        try {
          const verifyEnroll = await (supabase.auth.mfa.verify as any)({
            factorId: mfaFactorId,
            code,
          });
          if (verifyEnroll?.error) throw verifyEnroll.error;
        } catch (err: any) {
          // Some deployments require a challenge even during enrollment
          const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
          if (challenge.error) throw challenge.error;
          const verify = await supabase.auth.mfa.verify({
            factorId: mfaFactorId,
            challengeId: challenge.data.id,
            code,
          });
          if (verify.error) throw verify.error;
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
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Edara</CardTitle>
          <CardDescription>
            {step === "email" && "Sign in with your credentials"}
            {step === "change-password" && "Change your password"}
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? "Signing in..." : "Sign In"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleDevReset} disabled={loading}>
                Reset to default password (dev)
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                className="w-full" 
                onClick={async () => {
                  if (!email) {
                    toast({ title: 'Enter email first', variant: 'destructive' });
                    return;
                  }
                  setLoading(true);
                  try {
                    await supabase.functions.invoke('admin-reset-mfa', {
                      body: { email }
                    });
                    toast({ title: 'MFA reset', description: 'All MFA factors deleted. You can now sign in and set up fresh.' });
                  } catch (err: any) {
                    toast({ title: 'Error', description: err.message, variant: 'destructive' });
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
              >
                Reset MFA (dev)
              </Button>
            </form>
          )}

          {step === "change-password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? "Updating..." : "Change Password"}
              </Button>
            </form>
          )}

          {step === "setup" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-6 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-sm font-medium mb-4">Scan this QR code with Google Authenticator</p>
                {qrCode && (
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}
                <div className="mt-4 p-3 bg-background rounded border">
                  <p className="text-xs font-mono break-all">{secret}</p>
                  <p className="text-xs text-muted-foreground mt-1">Manual entry code</p>
                </div>
              </div>
              <form onSubmit={handleVerifyTOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="totp">Enter 6-digit code</Label>
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
                  {loading ? "Verifying..." : "Verify and Continue"}
                </Button>
              </form>
            </div>
          )}

          {step === "verify" && (
            <form onSubmit={handleVerifyTOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">Enter code from Google Authenticator</Label>
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
                {loading ? "Verifying..." : "Sign In"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleResetMFA} disabled={loading}>
                Can't access your app? Reset MFA
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
                Back to login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
