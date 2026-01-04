import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationBar() {
  const { language } = useLanguage();
  const { permission, isSubscribed, subscribe } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if bar was dismissed in this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem("push_bar_dismissed");
    if (dismissed === "true") {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("push_bar_dismissed", "true");
  };

  const handleEnablePush = async () => {
    setIsLoading(true);
    try {
      await subscribe();
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if already subscribed, dismissed, or permission denied permanently
  if (isSubscribed || isDismissed || permission === "denied") {
    return null;
  }

  // Check if push notifications are supported
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 flex-1">
        <Bell className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          {language === "ar" 
            ? "فعّل الإشعارات للبقاء على اطلاع بآخر التحديثات"
            : "Enable notifications to stay updated with the latest alerts"}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleEnablePush}
          disabled={isLoading}
          className="h-8 px-4 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <Bell className="h-3.5 w-3.5 me-1.5" />
          {isLoading 
            ? (language === "ar" ? "جاري التفعيل..." : "Enabling...")
            : (language === "ar" ? "تفعيل الإشعارات" : "Enable Push")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
