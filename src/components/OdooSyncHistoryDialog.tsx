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
import { History, Loader2, Trash2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

type Props = {
  language: "ar" | "en" | string;
};

export const OdooSyncHistoryDialog = memo(function OdooSyncHistoryDialog({
  language,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<OdooSyncRun[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [runToDelete, setRunToDelete] = useState<OdooSyncRun | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("odoo_sync_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setHistory(data || []);
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
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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
                          {language === "ar" ? "نجاح: " : "Success: "}
                          {run.successful_orders || 0}
                        </span>
                        <span className="mx-2">|</span>
                        <span className="text-red-600">
                          {language === "ar" ? "فشل: " : "Failed: "}
                          {run.failed_orders || 0}
                        </span>
                        <span className="mx-2">|</span>
                        <span>
                          {format(new Date(run.created_at), "yyyy-MM-dd HH:mm")}
                        </span>
                      </div>
                    </div>
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
    </>
  );
});
