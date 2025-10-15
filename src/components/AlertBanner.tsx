import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface AlertItem {
  id: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  reminder_date: string;
  next_action: string;
}

export function AlertBanner() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { t } = useLanguage();

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("crm_customer_followup")
        .select("*")
        .lte("reminder_date", new Date().toISOString())
        .order("reminder_date", { ascending: true });

      if (error) throw error;

      if (data) {
        setAlerts(data);
      }
    } catch (error) {
      console.error("Error fetching reminders:", error);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed([...dismissed, id]);
  };

  const visibleAlerts = alerts.filter((alert) => !dismissed.includes(alert.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="w-full space-y-2 px-6 pt-4">
      {visibleAlerts.map((alert) => (
        <Alert key={alert.id} className="bg-primary/10 border-primary/20">
          <Bell className="h-4 w-4 text-primary" />
          <AlertTitle className="flex items-center justify-between">
            <span className="text-primary font-semibold">
              {t("dashboard.crmReminder")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleDismiss(alert.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-1">
            <div>
              <strong>{t("dashboard.customer")}:</strong> {alert.customer_name} ({alert.customer_phone})
            </div>
            {alert.notes && (
              <div>
                <strong>{t("dashboard.notes")}:</strong> {alert.notes}
              </div>
            )}
            {alert.next_action && (
              <div>
                <strong>{t("dashboard.nextAction")}:</strong> {alert.next_action}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              {t("dashboard.reminderDate")}: {format(new Date(alert.reminder_date), "PPP")}
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
