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

export const ResetSajelSyncDialog = memo(function ResetSajelSyncDialog({
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

      // Sajel sync uses the same sendodoo flag + aggregated_order_mapping table,
      // so reuse the reset-odoo-sync edge function to clear the aggregation state.
      const { data, error } = await supabase.functions.invoke("reset-odoo-sync", {
        body: { fromDateInt, toDateInt },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: language === "ar" ? "تم إعادة تعيين Sajel" : "Sajel Reset Complete",
        description:
          language === "ar"
            ? `تم إعادة تعيين ${data?.updatedCount || 0} معاملة و ${data?.deletedMappingsCount || 0} تجميع`
            : `${data?.updatedCount || 0} transaction(s) and ${data?.deletedMappingsCount || 0} aggregated mapping(s) reset`,
      });
    } catch (error) {
      console.error("Error resetting Sajel sync:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar" ? "فشل في إعادة تعيين Sajel" : "Failed to reset Sajel sync",
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
        ? `سيتم إعادة تعيين جميع الطلبات المجمعة المرسلة إلى Sajel في الفترة:\n${period}\n\nهل تريد المتابعة؟`
        : `This will reset all aggregated orders sent to Sajel in the period:\n${period}\n\nContinue?`;

    const ok = window.confirm(message);
    if (!ok) return;

    void runReset();
  }, [fromDate, toDate, language, resetting, runReset]);

  return (
    <Button
      variant="outline"
      className="gap-2 text-purple-600 border-purple-600 hover:bg-purple-50 hover:text-purple-700"
      onClick={handleClick}
      disabled={resetting}
    >
      {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {language === "ar" ? "إعادة تعيين Sajel" : "Reset Sajel Sync"}
    </Button>
  );
});
