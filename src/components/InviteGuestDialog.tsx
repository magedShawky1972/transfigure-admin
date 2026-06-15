import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName?: string;
}

interface GuestRow {
  id: string;
  email: string;
  role: "editor" | "viewer";
  invited_at: string;
  accepted_at: string | null;
  invite_token: string;
}

const GUEST_SIGNUP_BASE_URL = "https://edaraasus.com";

export default function InviteGuestDialog({ open, onOpenChange, projectId, projectName }: Props) {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [sending, setSending] = useState(false);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(false);

  const t = {
    title: isRTL ? "دعوة ضيف خارجي" : "Invite External Guest",
    desc: isRTL ? `للمشروع: ${projectName || ""}` : `For project: ${projectName || ""}`,
    email: isRTL ? "البريد الإلكتروني" : "Email",
    role: isRTL ? "الصلاحيات" : "Permission",
    editor: isRTL ? "يمكنه التعديل والإضافة والمحادثة" : "Can edit, add tasks & chat",
    viewer: isRTL ? "عرض فقط" : "View only",
    send: isRTL ? "إرسال الدعوة" : "Send Invitation",
    sending: isRTL ? "جاري الإرسال..." : "Sending...",
    existing: isRTL ? "الضيوف الحاليون" : "Existing Guests",
    none: isRTL ? "لا يوجد ضيوف" : "No guests yet",
    pending: isRTL ? "بانتظار القبول" : "Pending",
    accepted: isRTL ? "تم القبول" : "Accepted",
    revoke: isRTL ? "إلغاء" : "Revoke",
    copyLink: isRTL ? "نسخ الرابط" : "Copy link",
    invalid: isRTL ? "بريد إلكتروني غير صالح" : "Invalid email",
    sent: isRTL ? "تم إرسال الدعوة" : "Invitation sent",
    revoked: isRTL ? "تم الإلغاء" : "Revoked",
    linkCopied: isRTL ? "تم نسخ الرابط" : "Link copied",
  };

  const loadGuests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_guests")
      .select("id,email,role,invited_at,accepted_at,invite_token")
      .eq("project_id", projectId)
      .order("invited_at", { ascending: false });
    if (!error && data) setGuests(data as GuestRow[]);
    setLoading(false);
  };

  useEffect(() => { if (open) loadGuests(); }, [open, projectId]);

  const send = async () => {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      toast({ title: t.invalid, variant: "destructive" });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("invite-project-guest", {
      body: { project_id: projectId, email: em, role },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ title: isRTL ? "خطأ" : "Error", description: (data as any)?.error || error?.message, variant: "destructive" });
      return;
    }
    const d = (data as any) || {};
    if (d.emailSent) {
      toast({ title: t.sent, description: d.signupUrl || "" });
    } else {
      toast({
        title: isRTL ? "تم إنشاء الدعوة لكن فشل إرسال البريد" : "Invite created but email failed",
        description: (d.emailError ? `${d.emailError}. ` : "") + (isRTL ? "انسخ الرابط يدويًا أدناه." : "Copy the link manually below."),
        variant: "destructive",
      });
    }
    setEmail("");
    loadGuests();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("project_guests").delete().eq("id", id);
    if (error) { toast({ title: isRTL ? "خطأ" : "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: t.revoked });
    loadGuests();
  };

  const copyLink = (token: string) => {
    const url = `${GUEST_SIGNUP_BASE_URL}/guest-signup?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: t.linkCopied, description: url });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-xl ${isRTL ? "rtl" : "ltr"}`}>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{t.desc}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t.email}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </div>
          <div className="space-y-2">
            <Label>{t.role}</Label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as any)}>
              <div className="flex items-center gap-2"><RadioGroupItem value="editor" id="r-ed" /><Label htmlFor="r-ed" className="font-normal cursor-pointer">{t.editor}</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="viewer" id="r-vw" /><Label htmlFor="r-vw" className="font-normal cursor-pointer">{t.viewer}</Label></div>
            </RadioGroup>
          </div>
          <Button onClick={send} disabled={sending} className="w-full">
            {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t.sending}</> : t.send}
          </Button>

          <div className="space-y-2 pt-4 border-t">
            <Label>{t.existing}</Label>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : guests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.none}</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {guests.map(g => (
                  <div key={g.id} className="flex items-center justify-between gap-2 p-2 rounded border">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{g.email}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{g.role === "editor" ? t.editor : t.viewer}</Badge>
                        <Badge variant={g.accepted_at ? "default" : "secondary"}>
                          {g.accepted_at ? t.accepted : t.pending}
                        </Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => copyLink(g.invite_token)} title={t.copyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => revoke(g.id)} title={t.revoke}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isRTL ? "إغلاق" : "Close"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
