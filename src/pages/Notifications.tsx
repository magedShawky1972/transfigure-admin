import { useState, useEffect } from "react";
import { Bell, Ticket, MessageSquare, Check, CheckCheck, Trash2, Filter, Reply } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow, format } from "date-fns";
import { ar } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { SendNotificationDialog } from "@/components/SendNotificationDialog";
import { NotificationReplyDialog } from "@/components/NotificationReplyDialog";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  ticket_id: string | null;
  email_id: string | null;
  is_read: boolean;
  created_at: string;
  sender_id: string | null;
  sender_name: string | null;
};

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        {
          event: "*",
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
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      toast({
        title: language === "ar" ? "تم" : "Done",
        description: language === "ar" ? "تم تحديد جميع الإشعارات كمقروءة" : "All notifications marked as read",
      });

      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف الإشعار" : "Notification deleted",
      });

      fetchNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.ticket_id) {
      navigate(`/tickets/${notification.ticket_id}`);
    } else if (notification.email_id) {
      navigate(`/email-manager?emailId=${notification.email_id}`);
    }
  };

  const isTicketNotification = (notification: Notification) => {
    return notification.ticket_id !== null;
  };

  const handleReplyClick = (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(notification.id);
    setSelectedNotification(notification);
    setReplyDialogOpen(true);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "tickets") return isTicketNotification(n);
    if (activeTab === "general") return !isTicketNotification(n);
    if (activeTab === "unread") return !n.is_read;
    return true;
  });

  const ticketCount = notifications.filter(isTicketNotification).length;
  const generalCount = notifications.filter((n) => !isTicketNotification(n)).length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-6 w-6" />
              {language === "ar" ? "الإشعارات" : "Notifications"}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <SendNotificationDialog />
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                {language === "ar" ? "تحديد الكل كمقروء" : "Mark All Read"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all" className="text-xs md:text-sm">
                {language === "ar" ? "الكل" : "All"}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {notifications.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="tickets" className="text-xs md:text-sm">
                <Ticket className="h-3 w-3 mr-1" />
                {language === "ar" ? "التذاكر" : "Tickets"}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {ticketCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="general" className="text-xs md:text-sm">
                <MessageSquare className="h-3 w-3 mr-1" />
                {language === "ar" ? "عام" : "General"}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {generalCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs md:text-sm">
                <Filter className="h-3 w-3 mr-1" />
                {language === "ar" ? "غير مقروء" : "Unread"}
                <Badge variant="destructive" className="ml-1 text-xs">
                  {unreadCount}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <ScrollArea className="h-[60vh]">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{language === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                          !notification.is_read
                            ? "bg-accent/50 border-primary/30"
                            : "hover:bg-accent/30"
                        } ${notification.ticket_id ? "cursor-pointer" : ""}`}
                        onClick={() => notification.ticket_id && handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          {/* Icon based on type */}
                          <div className={`p-2 rounded-full ${
                            isTicketNotification(notification)
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          }`}>
                            {isTicketNotification(notification) ? (
                              <Ticket className="h-4 w-4" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-sm truncate">
                                    {notification.title}
                                  </p>
                                  {!notification.is_read && (
                                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {isTicketNotification(notification)
                                      ? language === "ar" ? "تذكرة" : "Ticket"
                                      : language === "ar" ? "إشعار عام" : "General"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(notification.created_at), {
                                      addSuffix: true,
                                      locale: language === "ar" ? ar : undefined,
                                    })}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                {/* Reply button - always show for general notifications */}
                                {!isTicketNotification(notification) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${notification.sender_id ? "text-primary hover:text-primary" : "text-muted-foreground"}`}
                                    onClick={(e) => handleReplyClick(notification, e)}
                                    title={language === "ar" ? "رد" : "Reply"}
                                  >
                                    <Reply className="h-4 w-4" />
                                  </Button>
                                )}
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notification.id);
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={(e) => deleteNotification(notification.id, e)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <NotificationReplyDialog
        open={replyDialogOpen}
        onOpenChange={setReplyDialogOpen}
        notification={selectedNotification}
      />
    </div>
  );
};

export default Notifications;
