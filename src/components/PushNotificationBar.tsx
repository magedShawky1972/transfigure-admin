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
  const [isSupported, setIsSupported] = useState(true);

  // Check browser support on mount
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setIsSupported(false);
    }
    
    // Check if dismissed today - use sessionStorage so it resets on new sessions
    const dismissedAt = sessionStorage.getItem("push_bar_dismissed_at");
    if (dismissedAt) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("push_bar_dismissed_at", new Date().toISOString());
  };

  const handleEnablePush = async () => {
    setIsLoading(true);
    try {
      const success = await subscribe();
      if (success) {
        sessionStorage.removeItem("push_bar_dismissed_at");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if:
  // - Already subscribed to push notifications
  // - Bar was dismissed (within 24 hours)
  // - Permission was permanently denied
  // - Push not supported
  if (!isSupported || permission === "denied") {
    return null;
  }
  
  if (isSubscribed) {
    return null;
  }
  
  if (isDismissed) {
    return null;
  }

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-4">
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
