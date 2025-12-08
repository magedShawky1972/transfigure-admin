import { useState } from "react";
import { Reply, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type NotificationReplyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: {
    id: string;
    title: string;
    message: string;
    sender_id: string | null;
    sender_name: string | null;
  } | null;
};

export const NotificationReplyDialog = ({
  open,
  onOpenChange,
  notification,
}: NotificationReplyDialogProps) => {
  const [replyMessage, setReplyMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { language } = useLanguage();
  const { toast } = useToast();

  const handleSendReply = async () => {
    if (!notification?.sender_id) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "لا يمكن الرد على هذا الإشعار" : "Cannot reply to this notification",
        variant: "destructive",
      });
      return;
    }

    if (!replyMessage.trim()) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى إدخال الرسالة" : "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current user's profile for sender_name
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .single();

      const senderName = profile?.user_name || user.email || "Unknown";

      // Send push notification to original sender
      await supabase.functions.invoke("send-push-notification", {
        body: {
          userId: notification.sender_id,
          title: language === "ar" ? `رد من ${senderName}` : `Reply from ${senderName}`,
          body: replyMessage,
        },
      });

      // Create in-app notification for original sender
      await supabase.from("notifications").insert({
        user_id: notification.sender_id,
        title: language === "ar" ? `رد على: ${notification.title}` : `Reply to: ${notification.title}`,
        message: replyMessage,
        type: "custom",
        is_read: false,
        sender_id: user.id,
        sender_name: senderName,
        parent_notification_id: notification.id,
      });

      toast({
        title: language === "ar" ? "تم الإرسال" : "Sent",
        description: language === "ar" ? "تم إرسال الرد بنجاح" : "Reply sent successfully",
      });

      setReplyMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending reply:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في إرسال الرد" : "Failed to send reply",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!notification) return null;

  const canReply = notification.sender_id !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="h-5 w-5" />
            {language === "ar" ? "الرد على الإشعار" : "Reply to Notification"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Original notification info */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="font-medium text-sm mb-1">{notification.title}</p>
            <p className="text-sm text-muted-foreground line-clamp-3">{notification.message}</p>
            {notification.sender_name && (
              <p className="text-xs text-muted-foreground mt-2">
                {language === "ar" ? "من:" : "From:"} {notification.sender_name}
              </p>
            )}
          </div>

          {canReply ? (
            <>
              {/* Reply Field */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "الرد" : "Your Reply"}</Label>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={language === "ar" ? "اكتب ردك هنا..." : "Write your reply here..."}
                  rows={4}
                />
              </div>

              {/* Send Button */}
              <Button
                onClick={handleSendReply}
                disabled={isLoading}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {isLoading
                  ? language === "ar"
                    ? "جاري الإرسال..."
                    : "Sending..."
                  : language === "ar"
                  ? "إرسال الرد"
                  : "Send Reply"}
              </Button>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p>{language === "ar" ? "لا يمكن الرد على هذا الإشعار (إشعار نظام)" : "Cannot reply to this notification (system notification)"}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
