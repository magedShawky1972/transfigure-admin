import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { CheckCircle, Circle, Clock, User, Mail, FileCheck, UserPlus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  ticket_id: string;
  activity_type: string;
  user_id: string | null;
  user_name: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  description: string | null;
  created_at: string;
}

interface TicketActivityLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketNumber: string;
}

const TicketActivityLogDialog = ({
  open,
  onOpenChange,
  ticketId,
  ticketNumber,
}: TicketActivityLogDialogProps) => {
  const { language } = useLanguage();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && ticketId) {
      fetchActivities();
    }
  }, [open, ticketId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ticket_activity_logs")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "ticket_created":
        return <Circle className="h-5 w-5 text-primary" />;
      case "email_sent":
        return <Mail className="h-5 w-5 text-blue-500" />;
      case "approved_by_email":
      case "approved_by_app":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected_by_email":
      case "rejected_by_app":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "ticket_assigned":
        return <UserPlus className="h-5 w-5 text-purple-500" />;
      case "notification_sent":
        return <Mail className="h-5 w-5 text-amber-500" />;
      case "ticket_closed":
        return <FileCheck className="h-5 w-5 text-green-600" />;
      case "passed_to_next_level":
        return <User className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getActivityLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      ticket_created: { ar: "تم إنشاء التذكرة", en: "Ticket Created" },
      email_sent: { ar: "تم إرسال البريد الإلكتروني", en: "Email Sent" },
      approved_by_email: { ar: "تمت الموافقة عبر البريد", en: "Approved via Email" },
      approved_by_app: { ar: "تمت الموافقة عبر التطبيق", en: "Approved via App" },
      rejected_by_email: { ar: "تم الرفض عبر البريد", en: "Rejected via Email" },
      rejected_by_app: { ar: "تم الرفض عبر التطبيق", en: "Rejected via App" },
      ticket_assigned: { ar: "تم تعيين التذكرة", en: "Ticket Assigned" },
      notification_sent: { ar: "تم إرسال الإشعار", en: "Notification Sent" },
      ticket_closed: { ar: "تم إغلاق التذكرة", en: "Ticket Closed" },
      passed_to_next_level: { ar: "تم تمرير للمستوى التالي", en: "Passed to Next Level" },
      ticket_approved: { ar: "تمت الموافقة النهائية", en: "Final Approval" },
    };
    return labels[type]?.[language] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            {language === "ar"
              ? `سجل العمليات - ${ticketNumber}`
              : `Activity Log - ${ticketNumber}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar"
                ? "لا توجد سجلات للعمليات"
                : "No activity logs found"}
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div
                className={cn(
                  "absolute top-0 bottom-0 w-0.5 bg-border",
                  language === "ar" ? "right-[18px]" : "left-[18px]"
                )}
              />

              <div className="space-y-6">
                {activities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className={cn(
                      "relative flex gap-4",
                      language === "ar" ? "flex-row-reverse" : ""
                    )}
                  >
                    {/* Icon */}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background border-2 border-border">
                      {getActivityIcon(activity.activity_type)}
                    </div>

                    {/* Content */}
                    <div
                      className={cn(
                        "flex-1 rounded-lg border bg-card p-4 shadow-sm",
                        index === activities.length - 1 && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle
                          className={cn(
                            "h-4 w-4",
                            index === activities.length - 1
                              ? "text-green-500"
                              : "text-green-500"
                          )}
                        />
                        <span className="font-semibold text-sm">
                          {getActivityLabel(activity.activity_type)}
                        </span>
                      </div>

                      {activity.user_name && (
                        <p className="text-sm text-muted-foreground mb-1">
                          <span className="font-medium">
                            {language === "ar" ? "بواسطة: " : "By: "}
                          </span>
                          {activity.user_name}
                        </p>
                      )}

                      {activity.recipient_name && (
                        <p className="text-sm text-muted-foreground mb-1">
                          <span className="font-medium">
                            {language === "ar" ? "إلى: " : "To: "}
                          </span>
                          {activity.recipient_name}
                        </p>
                      )}

                      {activity.description && (
                        <p className="text-sm text-muted-foreground mb-1">
                          {activity.description}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(activity.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TicketActivityLogDialog;
