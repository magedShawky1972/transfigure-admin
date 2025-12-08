import { useState } from "react";
import { Reply, Check, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  ticket_id: string | null;
  is_read: boolean;
  created_at: string;
  sender_id?: string | null;
  sender_name?: string | null;
};

interface NotificationDetailDialogProps {
  notification: Notification | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotificationUpdated: () => void;
}

export const NotificationDetailDialog = ({
  notification,
  open,
  onOpenChange,
  onNotificationUpdated,
}: NotificationDetailDialogProps) => {
  const { language } = useLanguage();
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const markAsRead = async () => {
    if (!notification || notification.is_read) return;
    
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
      
      onNotificationUpdated();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleSendReply = async () => {
    if (!notification || !replyMessage.trim()) {
      toast.error(language === "ar" ? "الرجاء إدخال رسالة الرد" : "Please enter a reply message");
      return;
    }

    if (!notification.sender_id) {
      toast.error(language === "ar" ? "لا يمكن الرد على هذا الإشعار - لا يوجد مرسل" : "Cannot reply to this notification - no sender");
      return;
    }

    setIsReplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      // Send push notification
      await supabase.functions.invoke("send-push-notification", {
        body: {
          userId: notification.sender_id,
          title: language === "ar" ? "رد على إشعارك" : "Reply to your notification",
          body: replyMessage,
        },
      });

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: notification.sender_id,
        title: language === "ar" ? "رد على إشعارك" : "Reply to your notification",
        message: replyMessage,
        type: "custom",
        sender_id: user.id,
        sender_name: senderProfile?.user_name || user.email,
        parent_notification_id: notification.id,
      });

      toast.success(language === "ar" ? "تم إرسال الرد بنجاح" : "Reply sent successfully");
      setReplyMessage("");
      setShowReplyForm(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error(language === "ar" ? "فشل في إرسال الرد" : "Failed to send reply");
    } finally {
      setIsReplying(false);
    }
  };

  // Mark as read when dialog opens
  if (open && notification && !notification.is_read) {
    markAsRead();
  }

  if (!notification) return null;

  const isTicketNotification = notification.type === "ticket" || notification.ticket_id;
  const canReply = !isTicketNotification && notification.sender_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {notification.is_read ? (
              <Check className="h-4 w-4 text-muted-foreground" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-primary" />
            )}
            {notification.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sender Info */}
          {notification.sender_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>
                {language === "ar" ? "من: " : "From: "}
                {notification.sender_name}
              </span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(notification.created_at), "PPpp", {
                locale: language === "ar" ? ar : undefined,
              })}
            </span>
          </div>

          <Separator />

          {/* Message Content */}
          <div className="py-2">
            <p className="text-sm whitespace-pre-wrap">{notification.message}</p>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!notification.is_read && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAsRead}
                className="w-full"
              >
                <Check className="h-4 w-4 mr-2" />
                {language === "ar" ? "تحديد كمقروء" : "Mark as Read"}
              </Button>
            )}

            {/* Reply Section */}
            {!isTicketNotification && (
              <>
                {!showReplyForm ? (
                  <Button
                    variant={canReply ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowReplyForm(true)}
                    disabled={!canReply}
                    className="w-full"
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    {language === "ar" ? "رد" : "Reply"}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      placeholder={language === "ar" ? "اكتب ردك هنا..." : "Write your reply here..."}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowReplyForm(false);
                          setReplyMessage("");
                        }}
                        className="flex-1"
                      >
                        {language === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendReply}
                        disabled={isReplying || !replyMessage.trim()}
                        className="flex-1"
                      >
                        {isReplying
                          ? language === "ar"
                            ? "جاري الإرسال..."
                            : "Sending..."
                          : language === "ar"
                          ? "إرسال"
                          : "Send"}
                      </Button>
                    </div>
                  </div>
                )}

                {!canReply && !showReplyForm && (
                  <p className="text-xs text-muted-foreground text-center">
                    {language === "ar"
                      ? "لا يمكن الرد - إشعار النظام"
                      : "Cannot reply - system notification"}
                  </p>
                )}
              </>
            )}

            {isTicketNotification && notification.ticket_id && (
              <p className="text-xs text-muted-foreground text-center">
                {language === "ar"
                  ? "انقر لعرض تفاصيل التذكرة"
                  : "Click to view ticket details"}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
