import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function GuestSignup() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{ email: string; role: string; project_name: string | null; project_id: string; accepted: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Missing invite token"); setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("accept-project-guest", {
        body: { action: "lookup", token },
      });
      if (error || (data as any)?.error) {
        setError((data as any)?.error || error?.message || "Invalid invite");
      } else {
        setInfo(data as any);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (password.length < 8) { toast({ title: "Password must be at least 8 characters", variant: "destructive" }); return; }
    if (password !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("accept-project-guest", {
      body: { action: "accept", token, password },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    // Sign in
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: (data as any).email,
      password,
    });
    if (signInErr) {
      toast({ title: signInErr.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }
    navigate(`/projects-tasks?projectId=${(data as any).project_id}`, { replace: true });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept Project Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-destructive">{error}</p>
          ) : info?.accepted ? (
            <div className="space-y-3">
              <p>This invitation has already been used.</p>
              <Button onClick={() => navigate("/auth", { replace: true })} className="w-full">Sign in</Button>
            </div>
          ) : info ? (
            <>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Project:</span> <strong>{info.project_name}</strong></p>
                <p><span className="text-muted-foreground">Email:</span> <strong>{info.email}</strong></p>
                <p><span className="text-muted-foreground">Role:</span> <strong>{info.role === "editor" ? "Editor" : "View only"}</strong></p>
              </div>
              <div className="space-y-2">
                <Label>Create Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button onClick={submit} disabled={submitting} className="w-full">
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Create Account & Continue"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
