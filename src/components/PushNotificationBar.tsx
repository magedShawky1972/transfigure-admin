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
  const [isReady, setIsReady] = useState(false);

  // Check if bar was dismissed and if push is supported
  useEffect(() => {
    // Small delay to let the push hook initialize
    const timer = setTimeout(() => {
      const dismissed = localStorage.getItem("push_bar_dismissed");
      const dismissedAt = localStorage.getItem("push_bar_dismissed_at");
      
      // Re-show bar after 7 days if dismissed
      if (dismissed === "true" && dismissedAt) {
        const dismissedDate = new Date(dismissedAt);
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceDismissed < 7) {
          setIsDismissed(true);
        } else {
          // Clear old dismissal
          localStorage.removeItem("push_bar_dismissed");
          localStorage.removeItem("push_bar_dismissed_at");
        }
      } else if (dismissed === "true") {
        setIsDismissed(true);
      }
      
      // Check browser support
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setIsSupported(false);
      }
      
      setIsReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("push_bar_dismissed", "true");
    localStorage.setItem("push_bar_dismissed_at", new Date().toISOString());
  };

  const handleEnablePush = async () => {
    setIsLoading(true);
    try {
      const success = await subscribe();
      if (success) {
        // Remove dismissed flag on successful subscription
        localStorage.removeItem("push_bar_dismissed");
        localStorage.removeItem("push_bar_dismissed_at");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Wait for ready state
  if (!isReady) {
    return null;
  }

  // Don't show if:
  // - Already subscribed to push notifications
  // - Bar was dismissed (within 7 days)
  // - Permission was permanently denied
  // - Push not supported
  if (isSubscribed || isDismissed || permission === "denied" || !isSupported) {
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
