import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { SendNotificationDialog } from "./SendNotificationDialog";
import { NotificationDetailDialog } from "./NotificationDetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  ticket_id: string | null;
  email_id: string | null;
  is_read: boolean;
  created_at: string;
  sender_id?: string | null;
  sender_name?: string | null;
};

type ReminderAlert = {
  id: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  reminder_date: string;
  next_action: string;
};

export const NotificationBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reminders, setReminders] = useState<ReminderAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();

  useEffect(() => {
    fetchNotifications();
    fetchReminders();

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(data || []);
      updateUnreadCount(data || [], reminders);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_customer_followup")
        .select("*")
        .lte("reminder_date", new Date().toISOString())
        .order("reminder_date", { ascending: true });

      if (error) throw error;

      setReminders(data || []);
      updateUnreadCount(notifications, data || []);
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  };

  const updateUnreadCount = (notifs: Notification[], rems: ReminderAlert[]) => {
    const unreadNotifications = notifs.filter((n) => !n.is_read).length;
    const activeReminders = rems.length;
    setUnreadCount(unreadNotifications + activeReminders);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.ticket_id) {
      // For ticket notifications, navigate to ticket
      navigate(`/tickets/${notification.ticket_id}`);
    } else if (notification.email_id) {
      // For email notifications, navigate to email manager with the email selected
      navigate(`/email-manager?emailId=${notification.email_id}`);
    } else {
      // For general notifications, open detail dialog
      setSelectedNotification(notification);
      setDetailDialogOpen(true);
    }
  };

  const handleViewAll = () => {
    navigate("/notifications");
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="end">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 
                className="font-semibold cursor-pointer hover:text-primary transition-colors"
                onClick={handleViewAll}
              >
                {language === "ar" ? "الإشعارات" : "Notifications"}
              </h3>
              {!isSubscribed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={subscribe}
                  className="text-xs"
                >
                  <Bell className="h-3 w-3 mr-1" />
                  {language === "ar" ? "تفعيل التنبيهات" : "Enable Push"}
                </Button>
              )}
              {isSubscribed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={unsubscribe}
                  className="text-xs"
                >
                  <BellOff className="h-3 w-3 mr-1" />
                  {language === "ar" ? "إيقاف التنبيهات" : "Disable Push"}
                </Button>
              )}
            </div>
            
            {/* Send Notification Option */}
            <div className="mb-3">
              <SendNotificationDialog />
            </div>
            
            <ScrollArea className="h-[350px]">
              {notifications.length === 0 && reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {language === "ar"
                    ? "لا توجد إشعارات"
                    : "No notifications"}
                </p>
              ) : (
                <div className="space-y-4">
                  {reminders.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                        {language === "ar" ? "تذكيرات العملاء" : "Customer Reminders"}
                      </h4>
                      <div className="space-y-2">
                        {reminders.map((reminder) => (
                          <div
                            key={reminder.id}
                            className="p-3 rounded-lg border bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{reminder.customer_name}</p>
                                <p className="text-xs text-muted-foreground">{reminder.customer_phone}</p>
                              </div>
                              <span className="text-xs text-orange-600 dark:text-orange-400">
                                {format(new Date(reminder.reminder_date), "MMM dd, yyyy")}
                              </span>
                            </div>
                            {reminder.notes && (
                              <p className="text-xs text-muted-foreground mb-2">{reminder.notes}</p>
                            )}
                            {reminder.next_action && (
                              <div className="text-xs">
                                <span className="font-medium">
                                  {language === "ar" ? "الإجراء التالي: " : "Next Action: "}
                                </span>
                                <span className="text-muted-foreground">{reminder.next_action}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {notifications.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                        {language === "ar" ? "الإشعارات" : "Notifications"}
                      </h4>
                      <div className="space-y-2">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                              !notification.is_read ? "bg-accent/50" : ""
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(notification.created_at), {
                                    addSuffix: true,
                                    locale: language === "ar" ? ar : undefined,
                                  })}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
            
            {/* View All Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleViewAll}
            >
              {language === "ar" ? "عرض جميع الإشعارات" : "View All Notifications"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Notification Detail Dialog */}
      <NotificationDetailDialog
        notification={selectedNotification}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onNotificationUpdated={fetchNotifications}
      />
    </>
  );
};
