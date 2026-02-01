import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface PendingDocument {
  id: string;
  title: string;
  title_ar: string | null;
  content: string;
  content_ar: string | null;
  requires_signature: boolean;
}

export const PendingAcknowledgmentDialog = () => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const t = {
    ar: {
      title: "إقرار مطلوب",
      description: "يرجى قراءة والموافقة على الإقرار التالي للمتابعة",
      agree: "أوافق على محتوى هذا الإقرار",
      approve: "موافقة وتوقيع",
      next: "التالي",
      previous: "السابق",
      docOf: "من",
    },
    en: {
      title: "Acknowledgment Required",
      description: "Please read and approve the following document to continue",
      agree: "I agree to the contents of this document",
      approve: "Approve & Sign",
      next: "Next",
      previous: "Previous",
      docOf: "of",
    },
  };

  const texts = t[language as keyof typeof t] || t.en;

  useEffect(() => {
    checkPendingDocuments();
  }, []);

  const checkPendingDocuments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's job position
      const { data: profile } = await supabase
        .from("profiles")
        .select("job_position_id")
        .eq("user_id", user.id)
        .single();

      // Get documents already signed by this user
      const { data: signedDocs } = await supabase
        .from("acknowledgment_signatures")
        .select("document_id")
        .eq("user_id", user.id);

      const signedDocIds = (signedDocs || []).map((s) => s.document_id);

      // Get all active documents
      const { data: allDocs } = await supabase
        .from("acknowledgment_documents")
        .select("id, title, title_ar, content, content_ar, requires_signature")
        .eq("is_active", true);

      if (!allDocs) return;

      // Get recipients for these documents
      const { data: recipients } = await supabase
        .from("acknowledgment_recipients")
        .select("document_id, user_id, job_position_id");

      if (!recipients) return;

      // Filter documents that are assigned to this user (by user_id or job_position_id) and not yet signed
      const pending = allDocs.filter((doc) => {
        if (signedDocIds.includes(doc.id)) return false;

        const docRecipients = recipients.filter((r) => r.document_id === doc.id);
        return docRecipients.some(
          (r) =>
            r.user_id === user.id ||
            (profile?.job_position_id && r.job_position_id === profile.job_position_id)
        );
      });

      if (pending.length > 0) {
        setPendingDocs(pending);
        setCurrentIndex(0);
        setAgreed(false);
        setOpen(true);
      }
    } catch (error) {
      console.error("Error checking pending documents:", error);
    }
  };

  const handleSign = async () => {
    if (!agreed) {
      toast.error(language === "ar" ? "يرجى الموافقة أولاً" : "Please agree first");
      return;
    }

    setSigning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentDoc = pendingDocs[currentIndex];

      const { error } = await supabase.from("acknowledgment_signatures").insert({
        document_id: currentDoc.id,
        user_id: user.id,
        ip_address: null, // Could be captured via edge function if needed
        user_agent: navigator.userAgent,
      });

      if (error) throw error;

      toast.success(language === "ar" ? "تم التوقيع بنجاح" : "Signed successfully");

      // Move to next document or close
      if (currentIndex < pendingDocs.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setAgreed(false);
      } else {
        setOpen(false);
        setPendingDocs([]);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSigning(false);
    }
  };

  if (!open || pendingDocs.length === 0) return null;

  const currentDoc = pendingDocs[currentIndex];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {texts.title}
            {pendingDocs.length > 1 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({currentIndex + 1} {texts.docOf} {pendingDocs.length})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {language === "ar" && currentDoc.title_ar ? currentDoc.title_ar : currentDoc.title}
          </h3>

          <ScrollArea className="h-[400px] border rounded-md p-4">
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: language === "ar" && currentDoc.content_ar ? currentDoc.content_ar : currentDoc.content,
              }}
            />
          </ScrollArea>

          <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(!!checked)}
            />
            <Label htmlFor="agree" className="cursor-pointer font-medium">
              {texts.agree}
            </Label>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {currentIndex > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentIndex(currentIndex - 1);
                  setAgreed(false);
                }}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {texts.previous}
              </Button>
            )}
          </div>
          <Button onClick={handleSign} disabled={!agreed || signing}>
            <FileCheck className="h-4 w-4 mr-2" />
            {texts.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PendingAcknowledgmentDialog;
