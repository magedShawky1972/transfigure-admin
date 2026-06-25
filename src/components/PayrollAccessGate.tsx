import { ReactNode } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useHRBusinessUnitScope } from "@/hooks/useHRBusinessUnitScope";

/**
 * Gates access to a payroll screen. Only the master admin or any
 * user listed in hr_managers may view payroll data. Other users
 * see a no-access notice instead of an empty screen.
 */
export function PayrollAccessGate({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const { loading, isMaster, isHRManager } = useHRBusinessUnitScope();

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
      </div>
    );
  }

  if (!isMaster && !isHRManager) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <div className="font-semibold">
              {language === "ar" ? "لا تملك صلاحية الوصول" : "Access Restricted"}
            </div>
            <div className="text-sm text-muted-foreground max-w-md">
              {language === "ar"
                ? "شاشات الرواتب متاحة فقط لمديري الموارد البشرية المعينين على وحدات العمل."
                : "Payroll screens are only available to HR Managers assigned to Working Business Units."}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
