import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw } from "lucide-react";

export type OdooSyncRunLite = {
  id: string;
  from_date: string;
  to_date: string;
};

type DetailRow = {
  id: string;
  order_number: string;
  sync_status: string;
  error_message: string | null;
  step_customer: string | null;
  step_brand: string | null;
  step_product: string | null;
  step_order: string | null;
  step_purchase: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: OdooSyncRunLite | null;
  language: "ar" | "en" | string;
  initialFilter: "failed" | "success";
};

export function OdooSyncRunDetailsDialog({
  open,
  onOpenChange,
  run,
  language,
  initialFilter,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!run) return;
    setLoading(true);
    try {
      // Cast to avoid excessively-deep TS instantiation from generated types
      const result: any = await supabase
        .from("odoo_sync_run_details")
        .select(
          "id, order_number, sync_status, error_message, step_customer, step_brand, step_product, step_order, step_purchase"
        )
        .eq("run_id", run.id)
        .order("created_at", { ascending: true });

      if (result.error) throw result.error;
      setRows((result.data || []) as DetailRow[]);
    } catch (e) {
      console.error("Error loading run details", e);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar"
            ? "فشل في تحميل تفاصيل الإرسال"
            : "Failed to load run details",
      });
    } finally {
      setLoading(false);
    }
  }, [run, language]);

  useEffect(() => {
    if (open) fetchDetails();
  }, [open, fetchDetails]);

  const computed = useMemo(() => {
    const success = rows.filter((r) => r.sync_status === "success").length;
    const failed = rows.filter((r) => ["failed", "partial", "error"].includes(r.sync_status)).length;
    return { success, failed, total: rows.length };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (initialFilter === "success") return rows.filter((r) => r.sync_status === "success");
    return rows.filter((r) => ["failed", "partial", "error"].includes(r.sync_status));
  }, [rows, initialFilter]);

  const getStatusBadge = (status: string) => {
    if (status === "success") return <Badge>{language === "ar" ? "نجاح" : "Success"}</Badge>;
    if (status === "partial") return <Badge variant="secondary">{language === "ar" ? "جزئي" : "Partial"}</Badge>;
    if (status === "failed" || status === "error") return <Badge variant="destructive">{language === "ar" ? "فشل" : "Failed"}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const retryDetail = useCallback(
    async (detailId: string) => {
      setRetryingId(detailId);
      try {
        const { error } = await supabase.functions.invoke("retry-odoo-sync-detail", {
          body: { detailId, retryType: "all" },
        });
        if (error) throw error;
        await fetchDetails();
        toast({
          title: language === "ar" ? "تمت إعادة المحاولة" : "Retried",
          description:
            language === "ar"
              ? "تم تحديث حالة السجل"
              : "Record status updated",
        });
      } catch (e) {
        console.error("Retry failed", e);
        toast({
          variant: "destructive",
          title: language === "ar" ? "خطأ" : "Error",
          description:
            language === "ar"
              ? "فشل في إعادة المحاولة"
              : "Failed to retry",
        });
      } finally {
        setRetryingId(null);
      }
    },
    [fetchDetails, language]
  );

  const retryAll = useCallback(async () => {
    const errored = rows.filter((r) => ["failed", "partial", "error"].includes(r.sync_status));
    if (errored.length === 0) return;

    setRetryingId("__all__");
    try {
      let ok = 0;
      let bad = 0;
      for (const r of errored) {
        const { error } = await supabase.functions.invoke("retry-odoo-sync-detail", {
          body: { detailId: r.id, retryType: "all" },
        });
        if (error) bad++;
        else ok++;
      }
      await fetchDetails();
      toast({
        title: language === "ar" ? "اكتملت إعادة المحاولة" : "Retry Complete",
        description:
          language === "ar" ? `نجح: ${ok}، فشل: ${bad}` : `Success: ${ok}, Failed: ${bad}`,
      });
    } finally {
      setRetryingId(null);
    }
  }, [rows, fetchDetails, language]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {language === "ar" ? "تفاصيل الإرسال" : "Run Details"} — {run?.from_date} → {run?.to_date}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {language === "ar" ? "الإجمالي" : "Total"}: {computed.total} · {language === "ar" ? "نجاح" : "Success"}: {computed.success} · {language === "ar" ? "فشل/جزئي" : "Failed/Partial"}: {computed.failed}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDetails}
              disabled={loading || retryingId !== null}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : language === "ar" ? "تحديث" : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={retryAll}
              disabled={retryingId !== null || rows.every((r) => r.sync_status === "success")}
            >
              {retryingId === "__all__" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {language === "ar" ? "إعادة محاولة الكل" : "Retry All"}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[520px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {language === "ar" ? "لا توجد سجلات" : "No records"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((r) => {
                const isErrored = ["failed", "partial", "error"].includes(r.sync_status);
                return (
                  <div key={r.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.order_number}</span>
                          {getStatusBadge(r.sync_status)}
                        </div>
                        {r.error_message ? (
                          <div className="text-sm text-muted-foreground mt-1 break-words">
                            {r.error_message}
                          </div>
                        ) : null}
                        {isErrored ? (
                          <div className="text-xs text-muted-foreground mt-2">
                            {language === "ar" ? "الخطوات" : "Steps"}: {r.step_customer || "-"} / {r.step_brand || "-"} / {r.step_product || "-"} / {r.step_order || "-"} / {r.step_purchase || "-"}
                          </div>
                        ) : null}
                      </div>

                      {isErrored ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0 gap-2"
                          onClick={() => retryDetail(r.id)}
                          disabled={retryingId !== null}
                        >
                          {retryingId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          {language === "ar" ? "إعادة المحاولة" : "Retry"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
