import { memo, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Props = {
  fromDate: Date;
  toDate: Date;
  language: "ar" | "en" | string;
};

export const ResetOdooSyncDialog = memo(function ResetOdooSyncDialog({
  fromDate,
  toDate,
  language,
}: Props) {
  const [resetting, setResetting] = useState(false);

  const runReset = useCallback(async () => {
    setResetting(true);
    try {
      const fromDateInt = parseInt(format(fromDate, "yyyyMMdd"), 10);
      const toDateInt = parseInt(format(toDate, "yyyyMMdd"), 10);

      const { data, error } = await supabase.functions.invoke("reset-odoo-sync", {
        body: { fromDateInt, toDateInt },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: language === "ar" ? "تم إعادة التعيين" : "Reset Complete",
        description:
          language === "ar"
            ? `تم إعادة تعيين ${data?.updatedCount || 0} معاملة بنجاح`
            : `${data?.updatedCount || 0} transaction(s) reset successfully`,
      });
    } catch (error) {
      console.error("Error resetting Odoo sync:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar" ? "فشل في إعادة التعيين" : "Failed to reset Odoo sync flag",
      });
    } finally {
      setResetting(false);
    }
  }, [fromDate, toDate, language]);

  const handleClick = useCallback(() => {
    if (resetting) return;

    const period = `${format(fromDate, "yyyy-MM-dd")} → ${format(toDate, "yyyy-MM-dd")}`;
    const message =
      language === "ar"
        ? `سيتم إعادة تعيين علامة الإرسال لجميع المعاملات في الفترة:\n${period}\n\nهل تريد المتابعة؟`
        : `This will reset the Odoo sync flag for all transactions in the period:\n${period}\n\nContinue?`;

    const ok = window.confirm(message);
    if (!ok) return;

    void runReset();
  }, [fromDate, toDate, language, resetting, runReset]);

  return (
    <Button
      variant="outline"
      className="gap-2 text-orange-600 border-orange-600 hover:bg-orange-50 hover:text-orange-700"
      onClick={handleClick}
      disabled={resetting}
    >
      {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {language === "ar" ? "إعادة تعيين Odoo" : "Reset Odoo Sync"}
    </Button>
  );
});
