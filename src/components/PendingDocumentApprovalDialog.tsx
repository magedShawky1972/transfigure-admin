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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileCheck, CheckCircle, XCircle, Clock } from "lucide-react";

interface PendingApproval {
  id: string;
  document_id: string;
  status: string;
  document: {
    id: string;
    title: string;
    title_ar: string | null;
    content: string;
    content_ar: string | null;
    created_by: string;
  } | null;
}

export const PendingDocumentApprovalDialog = () => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const t = {
    ar: {
      title: "مراجعة الإقرار",
      description: "يرجى مراجعة الإقرار التالي والموافقة عليه أو رفضه",
      approve: "موافقة",
      reject: "رفض",
      notes: "ملاحظات (اختياري)",
      notesPlaceholder: "أضف ملاحظات حول قرارك...",
      docOf: "من",
      approvedSuccess: "تمت الموافقة بنجاح",
      rejectedSuccess: "تم الرفض",
    },
    en: {
      title: "Review Document",
      description: "Please review the following document and approve or reject it",
      approve: "Approve",
      reject: "Reject",
      notes: "Notes (optional)",
      notesPlaceholder: "Add notes about your decision...",
      docOf: "of",
      approvedSuccess: "Approved successfully",
      rejectedSuccess: "Rejected successfully",
    },
  };

  const texts = t[language as keyof typeof t] || t.en;

  useEffect(() => {
    checkPendingApprovals();
  }, []);

  const checkPendingApprovals = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("acknowledgment_approvers")
        .select(`
          id,
          document_id,
          status,
          document:document_id (
            id,
            title,
            title_ar,
            content,
            content_ar,
            created_by
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "pending");

      if (error) throw error;

      if (data && data.length > 0) {
        setPendingApprovals(data as PendingApproval[]);
        setCurrentIndex(0);
        setReviewNotes("");
        setOpen(true);
      }
    } catch (error) {
      console.error("Error checking pending approvals:", error);
    }
  };

  const handleDecision = async (decision: "approved" | "rejected") => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentApproval = pendingApprovals[currentIndex];

      // Update the approver record
      const { error: updateError } = await supabase
        .from("acknowledgment_approvers")
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq("id", currentApproval.id);

      if (updateError) throw updateError;

      // Check if all approvers have approved
      if (decision === "approved") {
        const { data: allApprovers } = await supabase
          .from("acknowledgment_approvers")
          .select("status")
          .eq("document_id", currentApproval.document_id);

        const allApproved = allApprovers?.every((a) => 
          a.status === "approved" || (a.status === "pending" && currentApproval.id === currentApproval.id)
        );

        // If this was the last pending approval, update document status
        const pendingCount = allApprovers?.filter(a => a.status === "pending").length || 0;
        
        if (pendingCount <= 1) {
          // This is the last one being approved
          await supabase
            .from("acknowledgment_documents")
            .update({
              approval_status: "approved",
              approved_at: new Date().toISOString(),
              approved_by: user.id,
            })
            .eq("id", currentApproval.document_id);
        }
      } else {
        // If rejected, update document status to rejected
        await supabase
          .from("acknowledgment_documents")
          .update({ approval_status: "rejected" })
          .eq("id", currentApproval.document_id);
      }

      toast.success(decision === "approved" ? texts.approvedSuccess : texts.rejectedSuccess);

      // Move to next or close
      if (currentIndex < pendingApprovals.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setReviewNotes("");
      } else {
        setOpen(false);
        setPendingApprovals([]);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || pendingApprovals.length === 0) return null;

  const currentApproval = pendingApprovals[currentIndex];
  const doc = currentApproval.document;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh]" 
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {texts.title}
            {pendingApprovals.length > 1 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({currentIndex + 1} {texts.docOf} {pendingApprovals.length})
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{texts.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {doc && (
            <>
              <h3 className="text-lg font-semibold">
                {language === "ar" && doc.title_ar ? doc.title_ar : doc.title}
              </h3>

              <ScrollArea className="h-[350px] border rounded-md p-4">
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: language === "ar" && doc.content_ar ? doc.content_ar : doc.content,
                  }}
                />
              </ScrollArea>

              <div>
                <Label>{texts.notes}</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={texts.notesPlaceholder}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => handleDecision("rejected")}
            disabled={submitting}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {texts.reject}
          </Button>
          <Button
            onClick={() => handleDecision("approved")}
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {texts.approve}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PendingDocumentApprovalDialog;
