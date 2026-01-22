import { memo, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { History, Loader2, Trash2, RotateCcw, Play, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { OdooSyncRunDetailsDialog, type OdooSyncRunLite } from "@/components/OdooSyncRunDetailsDialog";

interface OdooSyncRun {
  id: string;
  from_date: string;
  to_date: string;
  status: string;
  total_orders: number | null;
  successful_orders: number | null;
  failed_orders: number | null;
  skipped_orders: number | null;
  created_at: string;
  sync_type?: string | null;
}

type Props = {
  language: "ar" | "en" | string;
};

export const OdooSyncHistoryDialog = memo(function OdooSyncHistoryDialog({
  language,
}: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<OdooSyncRun[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<OdooSyncRun | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRun, setDetailsRun] = useState<OdooSyncRunLite | null>(null);
  const [detailsFilter, setDetailsFilter] = useState<"failed" | "success">("failed");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("odoo_sync_runs")
        .select("*, background_sync_jobs(id, status, sync_type)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Map sync_type from related background_sync_jobs if available
      const mappedHistory = (data || []).map((run: any) => ({
        ...run,
        sync_type: run.background_sync_jobs?.[0]?.sync_type || null,
      }));
      
      setHistory(mappedHistory);
    } catch (error) {
      console.error("Error fetching Odoo sync history:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar"
            ? "فشل في تحميل السجل"
            : "Failed to load sync history",
      });
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, fetchHistory]);

  const handleDeleteClick = useCallback((run: OdooSyncRun) => {
    setRunToDelete(run);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!runToDelete) return;
    
    setDeleting(runToDelete.id);
    setDeleteDialogOpen(false);
    
    try {
      // Get the date range for this run
      const fromDateInt = parseInt(runToDelete.from_date.replace(/-/g, ""), 10);
      const toDateInt = parseInt(runToDelete.to_date.replace(/-/g, ""), 10);

      // Reset sendodoo flag for transactions in this date range
      const { error: updateError } = await supabase
        .from("purpletransaction")
        .update({ sendodoo: false })
        .gte("created_at_date_int", fromDateInt)
        .lte("created_at_date_int", toDateInt)
        .eq("sendodoo", true);

      if (updateError) {
        console.error("Error resetting sendodoo flag:", updateError);
      }

      // Delete aggregated order mappings for this date range
      const { error: mappingError } = await supabase
        .from("aggregated_order_mapping")
        .delete()
        .gte("aggregation_date", runToDelete.from_date)
        .lte("aggregation_date", runToDelete.to_date);

      if (mappingError) {
        console.error("Error deleting aggregated mappings:", mappingError);
        throw mappingError;
      }

      // Delete the sync run record
      const { error } = await supabase
        .from("odoo_sync_runs")
        .delete()
        .eq("id", runToDelete.id);

      if (error) {
        console.error("Error deleting sync run:", error);
        throw error;
      }

      setHistory((prev) => prev.filter((h) => h.id !== runToDelete.id));
      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description:
          language === "ar"
            ? "تم حذف السجل وإعادة تعيين علامات الإرسال"
            : "Record deleted and sync flags reset",
      });
    } catch (error) {
      console.error("Error deleting sync run:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar" ? "فشل في حذف السجل" : "Failed to delete record",
      });
    } finally {
      setDeleting(null);
      setRunToDelete(null);
    }
  }, [runToDelete, language]);

  const handleClearAll = useCallback(async () => {
    setClearingAll(true);
    setClearAllDialogOpen(false);
    
    try {
      // Reset all sendodoo flags
      const { error: updateError } = await supabase
        .from("purpletransaction")
        .update({ sendodoo: false })
        .eq("sendodoo", true);

      if (updateError) {
        console.error("Error resetting all sendodoo flags:", updateError);
      }

      // Delete all aggregated order mappings
      const { error: mappingError } = await supabase
        .from("aggregated_order_mapping")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (mappingError) {
        console.error("Error deleting all aggregated mappings:", mappingError);
        throw mappingError;
      }

      // Delete all sync runs
      const { error } = await supabase
        .from("odoo_sync_runs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) {
        console.error("Error deleting all sync runs:", error);
        throw error;
      }

      setHistory([]);
      toast({
        title: language === "ar" ? "تم المسح" : "Cleared",
        description:
          language === "ar"
            ? "تم مسح جميع السجلات وإعادة تعيين جميع علامات الإرسال"
            : "All records cleared and all sync flags reset",
      });
    } catch (error) {
      console.error("Error clearing all sync runs:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar"
            ? "فشل في مسح السجلات"
            : "Failed to clear records",
      });
    } finally {
      setClearingAll(false);
    }
  }, [language]);

  const handleContinueRun = useCallback(async (run: OdooSyncRun) => {
    setResuming(run.id);
    try {
      // Get or create a background job for this run
      const { data: existingJob } = await supabase
        .from("background_sync_jobs")
        .select("id, status, sync_type")
        .eq("sync_run_id", run.id)
        .single();

      if (existingJob) {
        // Resume existing job
        const isAggregated = existingJob.sync_type === 'aggregated';
        const functionName = isAggregated ? 'sync-aggregated-orders-background' : 'sync-orders-background';
        
        await supabase
          .from("background_sync_jobs")
          .update({ status: "running", force_kill: false })
          .eq("id", existingJob.id);

        const { error } = await supabase.functions.invoke(functionName, {
          body: {
            jobId: existingJob.id,
            fromDate: run.from_date,
            toDate: run.to_date,
          },
        });

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم استئناف المزامنة" : "Sync Resumed",
          description: language === "ar" 
            ? "جاري استكمال عملية المزامنة"
            : "Continuing the sync operation",
        });
      } else {
        // Navigate to sync page with the date range
        setOpen(false);
        navigate(`/odoo-sync-batch?from=${run.from_date}&to=${run.to_date}&resume=true`);
      }
    } catch (error) {
      console.error("Error resuming sync:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" 
          ? "فشل في استئناف المزامنة"
          : "Failed to resume sync",
      });
    } finally {
      setResuming(null);
    }
  }, [language, navigate]);

  const handleRetryErrors = useCallback(async (run: OdooSyncRun) => {
    setRetrying(run.id);
    try {
      // Get failed/partial details for this run using run_id column
      const query = supabase
        .from("odoo_sync_run_details")
        .select("id, order_number")
        .eq("run_id", run.id)
        // Some runs mark purchase issues as 'partial' (e.g. sales order ok, purchase failed)
        .in("sync_status", ["failed", "partial", "error"]);

      const { data, error: fetchError } = await query;
      const failedDetails = data as { id: string; order_number: string }[] | null;
      if (fetchError) throw fetchError;

      if (!failedDetails || failedDetails.length === 0) {
        toast({
          title: language === "ar" ? "لا توجد أخطاء" : "No Errors",
          description: language === "ar"
            ? "لا توجد طلبات بها أخطاء لإعادة المحاولة"
            : "No errored orders to retry",
        });
        return;
      }

      // Retry each failed detail
      let successCount = 0;
      let errorCount = 0;

      for (const detail of failedDetails) {
        try {
          const { error } = await supabase.functions.invoke("retry-odoo-sync-detail", {
            body: { detailId: detail.id, retryType: "all" },
          });
          if (error) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      // Refresh history
      await fetchHistory();

      toast({
        title: language === "ar" ? "اكتملت إعادة المحاولة" : "Retry Complete",
        description: language === "ar"
          ? `نجح: ${successCount}، فشل: ${errorCount}`
          : `Success: ${successCount}, Failed: ${errorCount}`,
      });
    } catch (error) {
      console.error("Error retrying failed orders:", error);
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar"
          ? "فشل في إعادة محاولة الطلبات الفاشلة"
          : "Failed to retry failed orders",
      });
    } finally {
      setRetrying(null);
    }
  }, [language, fetchHistory]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-600 text-white">
            {language === "ar" ? "مكتمل" : "Completed"}
          </Badge>
        );
      case "running":
        return (
          <Badge className="bg-blue-600 text-white">
            {language === "ar" ? "جاري" : "Running"}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            {language === "ar" ? "فشل" : "Failed"}
          </Badge>
        );
      case "paused":
        return (
          <Badge className="bg-yellow-600 text-white">
            {language === "ar" ? "متوقف" : "Paused"}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const openDetails = useCallback(
    (run: OdooSyncRun, filter: "failed" | "success") => {
      setDetailsRun({ id: run.id, from_date: run.from_date, to_date: run.to_date });
      setDetailsFilter(filter);
      setDetailsOpen(true);
    },
    []
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            {language === "ar" ? "سجل Odoo" : "Odoo History"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {language === "ar"
                ? "سجل إرسال البيانات إلى Odoo"
                : "Odoo Sync History"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "عرض جميع عمليات الإرسال السابقة. يمكنك حذف سجل لإعادة تعيين علامات الإرسال."
                : "View all previous sync operations. Delete a record to reset its sync flags."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end mb-2">
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setClearAllDialogOpen(true)}
              disabled={loading || clearingAll || history.length === 0}
            >
              {clearingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {language === "ar" ? "مسح الكل وإعادة التعيين" : "Clear All & Reset"}
            </Button>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا يوجد سجلات" : "No history found"}
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {run.from_date} → {run.to_date}
                        </span>
                        {getStatusBadge(run.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span>
                          {language === "ar" ? "إجمالي: " : "Total: "}
                          {run.total_orders || 0}
                        </span>
                        <span className="mx-2">|</span>
                        <span className="text-green-600">
                          <button
                            type="button"
                            className="underline underline-offset-4"
                            onClick={() => openDetails(run, "success")}
                          >
                            {language === "ar" ? "نجاح: " : "Success: "}
                            {run.successful_orders || 0}
                          </button>
                        </span>
                        <span className="mx-2">|</span>
                        <span className="text-red-600">
                          <button
                            type="button"
                            className="underline underline-offset-4"
                            onClick={() => openDetails(run, "failed")}
                          >
                            {language === "ar" ? "فشل: " : "Failed: "}
                            {run.failed_orders || 0}
                          </button>
                        </span>
                        <span className="mx-2">|</span>
                        <span>
                          {format(new Date(run.created_at), "yyyy-MM-dd HH:mm")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Continue/Resume button for paused or incomplete runs */}
                      {(run.status === "paused" || run.status === "running" || 
                        (run.status === "completed" && (run.successful_orders || 0) < (run.total_orders || 0) && (run.failed_orders || 0) === 0)) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          onClick={() => handleContinueRun(run)}
                          disabled={resuming === run.id}
                          title={language === "ar" ? "استئناف" : "Continue"}
                        >
                          {resuming === run.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      
                      {/* Retry Errors button for runs with failed orders */}
                      {(run.failed_orders || 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                          onClick={() => handleRetryErrors(run)}
                          disabled={retrying === run.id}
                          title={language === "ar" ? "إعادة المحاولة" : "Retry Errors"}
                        >
                          {retrying === run.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        onClick={() => handleDeleteClick(run)}
                        disabled={deleting === run.id}
                      >
                        {deleting === run.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Single Record Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? `سيتم حذف هذا السجل وإعادة تعيين علامات الإرسال لجميع المعاملات في الفترة ${runToDelete?.from_date} إلى ${runToDelete?.to_date}. هل تريد المتابعة؟`
                : `This will delete the record and reset sync flags for all transactions from ${runToDelete?.from_date} to ${runToDelete?.to_date}. Continue?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "ar" ? "حذف وإعادة تعيين" : "Delete & Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "تأكيد مسح الكل" : "Confirm Clear All"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? "سيتم حذف جميع سجلات الإرسال وإعادة تعيين علامات الإرسال لجميع المعاملات. هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟"
                : "This will delete all sync records and reset sync flags for ALL transactions. This action cannot be undone. Continue?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "ar" ? "مسح الكل" : "Clear All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OdooSyncRunDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        run={detailsRun}
        language={language}
        initialFilter={detailsFilter}
      />
    </>
  );
});
