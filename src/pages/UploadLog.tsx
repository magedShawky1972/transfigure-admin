import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, FileSpreadsheet, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface UploadLog {
  id: string;
  upload_date: string;
  file_name: string;
  user_name: string;
  status: string;
  records_processed: number;
  error_message: string | null;
  excel_dates: any;
  new_customers_count: number;
  new_products_count: number;
  new_brands_count: number;
  total_value: number;
  date_range_start: string | null;
  date_range_end: string | null;
}

interface UploadSummary {
  newCustomers: number;
  newProducts: number;
  newBrands: number;
  totalValue: number;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  recordsProcessed: number;
}

const UploadLog = () => {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showDatesDialog, setShowDatesDialog] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<UploadSummary | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [isUpdatingFees, setIsUpdatingFees] = useState(false);

  useEffect(() => {
    loadUploadLogs();
  }, []);

  const loadUploadLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("upload_logs")
      .select("*")
      .order("upload_date", { ascending: false });

    if (error) {
      toast.error("Error loading upload logs: " + error.message);
    } else {
      setLogs(data || []);
    }
    setIsLoading(false);
  };

  const showExcelDates = (dates: any) => {
    if (dates && Array.isArray(dates) && dates.length > 0) {
      setSelectedDates(dates);
      setShowDatesDialog(true);
    }
  };

  const showSummary = (log: UploadLog) => {
    setSelectedSummary({
      newCustomers: log.new_customers_count || 0,
      newProducts: log.new_products_count || 0,
      newBrands: log.new_brands_count || 0,
      totalValue: log.total_value || 0,
      dateRangeStart: log.date_range_start,
      dateRangeEnd: log.date_range_end,
      recordsProcessed: log.records_processed || 0,
    });
    setShowSummaryDialog(true);
  };

  const updateBankFees = async () => {
    if (isUpdatingFees) return;
    setIsUpdatingFees(true);

    let totalUpdated = 0;
    let totalMatched = 0;
    let cycles = 0;
    const maxCycles = 50; // safety cap

    const loadingId = toast.loading(t("uploadLog.updatingBankFees"));

    try {
      // Run the chunked edge function repeatedly until it reports completion
      while (cycles < maxCycles) {
        cycles++;
        const { data, error } = await supabase.functions.invoke('update-bank-fees', { body: {} });
        if (error) throw error;

        const { updatedCount = 0, matchedCount = 0, remainingCount, needsMoreRuns } = (data as any) || {};
        totalUpdated += updatedCount;
        totalMatched += matchedCount;

        toast.message(`${t('uploadLog.updatingBankFees')} - Batch ${cycles}: +${updatedCount} (remaining: ${remainingCount ?? 'unknown'})`);

        if (!needsMoreRuns) break;
        // brief pause to avoid hammering the function
        await new Promise((r) => setTimeout(r, 250));
      }

      toast.success(`${t('uploadLog.bankFeesUpdated')} ${totalUpdated} (${totalMatched} matched)`);
    } catch (err: any) {
      console.error('Error updating bank fees (edge function):', err);
      toast.error(t('uploadLog.bankFeesUpdateError') + ': ' + (err?.message || 'Unknown error'));
    } finally {
      toast.dismiss(loadingId);
      setIsUpdatingFees(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />{t("uploadLog.completed")}</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{t("uploadLog.failed")}</Badge>;
      case "processing":
        return <Badge variant="secondary">{t("uploadLog.processing")}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("uploadLog.title")}</h1>
        <p className="text-muted-foreground">
          {t("uploadLog.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("uploadLog.title")}</CardTitle>
          <CardDescription>
            {t("uploadLog.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading upload logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No uploads found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("uploadLog.date")}</TableHead>
                    <TableHead>{t("uploadLog.fileName")}</TableHead>
                    <TableHead>{t("uploadLog.uploadedBy")}</TableHead>
                    <TableHead>{t("uploadLog.status")}</TableHead>
                    <TableHead>{t("uploadLog.recordsProcessed")}</TableHead>
                    <TableHead>{t("uploadLog.newCustomers")}</TableHead>
                    <TableHead>{t("uploadLog.excelDates")}</TableHead>
                    <TableHead>{t("uploadLog.errors")}</TableHead>
                    <TableHead>{t("uploadLog.summary")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(log.upload_date), "MMM dd, yyyy HH:mm")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                          <span className="font-medium">{log.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {log.user_name}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <span className="font-mono">{log.records_processed}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono">{log.new_customers_count || 0}</span>
                      </TableCell>
                      <TableCell>
                        {log.excel_dates && log.excel_dates.length > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showExcelDates(log.excel_dates)}
                          >
                            {t("uploadLog.view")} ({log.excel_dates.length})
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">No dates</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <span className="text-destructive text-xs">{log.error_message}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.status === "completed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showSummary(log)}
                          >
                            {t("uploadLog.viewSummary")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDatesDialog} onOpenChange={setShowDatesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("uploadLog.excelDatesTitle")}</DialogTitle>
            <DialogDescription>
              {t("uploadLog.subtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              {selectedDates.map((date, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-md bg-secondary"
                >
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-mono text-sm">
                    {format(new Date(date), "MMM dd, yyyy")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">{t("uploadLog.uploadSummary")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("uploadLog.summaryDescription")}
            </DialogDescription>
          </DialogHeader>
          
          {selectedSummary && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("uploadLog.recordsProcessed")}</p>
                <p className="text-3xl font-bold text-primary">{selectedSummary.recordsProcessed.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{t("uploadLog.newCustomers")}</p>
                  <p className="text-xl font-semibold">{selectedSummary.newCustomers}</p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">{t("uploadLog.newProducts")}</p>
                  <p className="text-xl font-semibold">{selectedSummary.newProducts}</p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">New Brands</p>
                  <p className="text-xl font-semibold">{selectedSummary.newBrands}</p>
                </div>
              </div>

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">{t("uploadLog.totalValue")}</p>
                <p className="text-2xl font-bold text-primary">
                  {selectedSummary.totalValue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              {selectedSummary.dateRangeStart && selectedSummary.dateRangeEnd && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">{t("uploadLog.dateRange")}</p>
                  <p className="text-sm font-medium">
                    {new Date(selectedSummary.dateRangeStart).toLocaleDateString()} - {new Date(selectedSummary.dateRangeEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Button 
              onClick={updateBankFees}
              className="w-full"
              disabled={isUpdatingFees}
            >
              {t("uploadLog.updateBankFees")}
            </Button>
            
            <Button 
              onClick={() => setShowSummaryDialog(false)}
              className="w-full bg-gradient-to-r from-primary to-accent"
            >
              {t("uploadLog.close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UploadLog;
