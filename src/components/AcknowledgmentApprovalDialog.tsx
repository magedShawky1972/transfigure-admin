import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Clock, CheckCircle, XCircle, Send } from "lucide-react";

interface Profile {
  user_id: string;
  user_name: string;
  email: string;
}

interface Approver {
  id: string;
  document_id: string;
  user_id: string;
  status: string;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  user_name?: string;
}

interface AcknowledgmentDocument {
  id: string;
  title: string;
  title_ar: string | null;
  approval_status?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: AcknowledgmentDocument | null;
  users: Profile[];
  onApprovalSent: () => void;
}

export const AcknowledgmentApprovalDialog = ({
  open,
  onOpenChange,
  document,
  users,
  onApprovalSent,
}: Props) => {
  const { language } = useLanguage();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [existingApprovers, setExistingApprovers] = useState<Approver[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const t = {
    ar: {
      title: "إرسال للموافقة",
      selectApprovers: "اختر المراجعين",
      currentApprovers: "المراجعين الحاليين",
      noApprovers: "لم يتم تعيين مراجعين",
      send: "إرسال للموافقة",
      cancel: "إلغاء",
      pending: "قيد الانتظار",
      approved: "موافق عليه",
      rejected: "مرفوض",
      remove: "إزالة",
      sentSuccess: "تم إرسال طلب الموافقة",
      selectAtLeastOne: "يرجى اختيار مراجع واحد على الأقل",
    },
    en: {
      title: "Send for Approval",
      selectApprovers: "Select Approvers",
      currentApprovers: "Current Approvers",
      noApprovers: "No approvers assigned",
      send: "Send for Approval",
      cancel: "Cancel",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      remove: "Remove",
      sentSuccess: "Approval request sent successfully",
      selectAtLeastOne: "Please select at least one approver",
    },
  };

  const texts = t[language as keyof typeof t] || t.en;

  useEffect(() => {
    if (open && document) {
      fetchExistingApprovers();
      setSelectedUserIds([]);
    }
  }, [open, document]);

  const fetchExistingApprovers = async () => {
    if (!document) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("acknowledgment_approvers")
        .select("*")
        .eq("document_id", document.id);

      if (error) throw error;

      const enriched = (data || []).map((approver) => ({
        ...approver,
        user_name: users.find((u) => u.user_id === approver.user_id)?.user_name || approver.user_id,
      }));

      setExistingApprovers(enriched);
    } catch (error) {
      console.error("Error fetching approvers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!document) return;
    if (selectedUserIds.length === 0) {
      toast.error(texts.selectAtLeastOne);
      return;
    }

    setSending(true);
    try {
      // Insert new approvers
      const newApprovers = selectedUserIds.map((userId) => ({
        document_id: document.id,
        user_id: userId,
        status: "pending",
      }));

      const { error: insertError } = await supabase
        .from("acknowledgment_approvers")
        .insert(newApprovers);

      if (insertError) throw insertError;

      // Update document status to pending_approval
      const { error: updateError } = await supabase
        .from("acknowledgment_documents")
        .update({ approval_status: "pending_approval" })
        .eq("id", document.id);

      if (updateError) throw updateError;

      toast.success(texts.sentSuccess);
      onApprovalSent();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const handleRemoveApprover = async (approverId: string) => {
    try {
      const { error } = await supabase
        .from("acknowledgment_approvers")
        .delete()
        .eq("id", approverId);

      if (error) throw error;
      
      setExistingApprovers(existingApprovers.filter((a) => a.id !== approverId));
      toast.success(language === "ar" ? "تم الإزالة" : "Removed");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            {texts.approved}
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            {texts.rejected}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            {texts.pending}
          </Badge>
        );
    }
  };

  const availableUsers = users.filter(
    (user) => !existingApprovers.some((a) => a.user_id === user.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {texts.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing Approvers */}
          {existingApprovers.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">
                {texts.currentApprovers}
              </Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                {existingApprovers.map((approver) => (
                  <Badge
                    key={approver.id}
                    variant="outline"
                    className="flex items-center gap-2 px-3 py-1"
                  >
                    <Users className="h-3 w-3" />
                    {approver.user_name}
                    {getStatusBadge(approver.status)}
                    {approver.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveApprover(approver.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Select New Approvers */}
          <div>
            <Label className="text-sm font-medium mb-2 block">
              {texts.selectApprovers}
            </Label>
            <ScrollArea className="h-64 border rounded-md p-2">
              {availableUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  {language === "ar" ? "لا يوجد مستخدمين متاحين" : "No available users"}
                </p>
              ) : (
                availableUsers.map((user) => (
                  <div key={user.user_id} className="flex items-center gap-2 py-2">
                    <Checkbox
                      id={`approver-${user.user_id}`}
                      checked={selectedUserIds.includes(user.user_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds([...selectedUserIds, user.user_id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter((id) => id !== user.user_id));
                        }
                      }}
                    />
                    <Label htmlFor={`approver-${user.user_id}`} className="cursor-pointer flex-1">
                      {user.user_name} ({user.email})
                    </Label>
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {texts.cancel}
          </Button>
          <Button onClick={handleSend} disabled={sending || selectedUserIds.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            {texts.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AcknowledgmentApprovalDialog;
