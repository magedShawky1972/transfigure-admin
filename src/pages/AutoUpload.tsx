import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Play, History, Bot, CheckCircle2, AlertCircle, Clock, Ban, Loader2, Mail, FileSpreadsheet, Search, Database, Bell, CircleDot, CalendarDays, FileX, UploadCloud } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import edaraLogo from "@/assets/edara-logo.png";

interface FoundFile {
  index: number;
  uid?: number;
  subject: string;
  date: string | null;
  filename?: string | null;
  status: string;
  inserted: number;
  skipped: number;
}

interface AutoImportLog {
  id: string;
  import_date: string;
  records_inserted: number | null;
  records_skipped: number | null;
  missing_columns: string[] | null;
  extra_columns: string[] | null;
  status: string;
  error_message: string | null;
  email_subject: string | null;
  created_at: string;
  current_step: string | null;
  found_files: any[] | null;
  current_file_index: number | null;
  total_files: number | null;
}

interface AutoJob {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  functionName: string;
  schedule: string;
  icon: string;
}

const AUTO_JOBS: AutoJob[] = [
  {
    id: "riyad-bank",
    name: "Riyad Bank Statement",
    nameAr: "كشف بنك الرياض",
    description: "Auto-imports daily Riyad Bank merchant report from email (9910013@riyadbank.com)",
    descriptionAr: "استيراد تلقائي يومي لكشف بنك الرياض من البريد الإلكتروني",
    functionName: "sync-riyad-statement-background",
    schedule: "00:00 KSA Daily",
    icon: "🏦",
  },
];

const STEP_LABELS: Record<string, { en: string; ar: string }> = {
  checking_last_date: { en: "Checking last import date", ar: "فحص آخر تاريخ تحميل" },
  connecting_to_email: { en: "Connecting to email server", ar: "الاتصال بخادم البريد" },
  searching_emails: { en: "Searching for emails", ar: "البحث عن الرسائل" },
  scanning_emails: { en: "Scanning email headers", ar: "مسح عناوين الرسائل" },
  scan_complete: { en: "Scan complete - ready to upload", ar: "اكتمل الفحص - جاهز للتحميل" },
  batch_complete: { en: "Batch complete - processing next batch", ar: "اكتملت الدفعة - معالجة الدفعة التالية" },
  saving_last_date: { en: "Saving last import date", ar: "حفظ آخر تاريخ تحميل" },
  sending_notification: { en: "Sending notification", ar: "إرسال الإشعار" },
  completed: { en: "Completed", ar: "مكتمل" },
  error: { en: "Error", ar: "خطأ" },
};

type Phase = "idle" | "scanning" | "scanned" | "processing" | "completed" | "error";

const AutoUpload = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/auto-upload");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AutoJob | null>(null);
  const [logs, setLogs] = useState<AutoImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Two-phase state
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [foundFiles, setFoundFiles] = useState<FoundFile[]>([]);
  const [liveLog, setLiveLog] = useState<AutoImportLog | null>(null);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const processingRef = useRef(false);

  // Subscribe to realtime updates on the active log
  useEffect(() => {
    if (!activeLogId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`auto-import-${activeLogId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'riyad_statement_auto_imports',
          filter: `id=eq.${activeLogId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setLiveLog(updated as AutoImportLog);

          if (updated.found_files) {
            setFoundFiles(updated.found_files as FoundFile[]);
          }

          if (updated.status === 'completed') {
            setPhase("completed");
            toast.success(
              language === "ar"
                ? `تم: ${updated.records_inserted ?? 0} سجل جديد, ${updated.records_skipped ?? 0} مكرر`
                : `Done: ${updated.records_inserted ?? 0} inserted, ${updated.records_skipped ?? 0} skipped`
            );
          } else if (updated.status === 'error') {
            setPhase("error");
            toast.error(updated.error_message || "Error");
          } else if (updated.status === 'no_email') {
            setPhase("completed");
            toast.info(language === "ar" ? "لا توجد رسائل جديدة" : "No new emails found");
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeLogId, language]);

  if (accessLoading) return null;
  if (hasAccess === false) return <AccessDenied />;

  // Phase 1: Scan emails
  const handleScan = async (job: AutoJob) => {
    if (phase === "scanning" || phase === "processing") return;
    
    setPhase("scanning");
    setFoundFiles([]);
    setLiveLog(null);
    setLastDate(null);

    try {
      const { data, error } = await supabase.functions.invoke(job.functionName, {
        body: { mode: "scan" },
      });

      if (error) throw error;

      const logId = data?.log_id;
      if (logId) setActiveLogId(logId);

      if (data?.found_files && data.found_files.length > 0) {
        setFoundFiles(data.found_files);
        setLastDate(data.last_date || null);
        setPhase("scanned");
        toast.success(
          language === "ar"
            ? `تم العثور على ${data.found_files.length} ملف`
            : `Found ${data.found_files.length} files`
        );
      } else {
        setPhase("completed");
        toast.info(language === "ar" ? "لا توجد ملفات جديدة" : "No new files found");
      }
    } catch (err: any) {
      toast.error(err.message);
      setPhase("error");
    }
  };

  // Phase 2: Process files in batches
  const handleStartProcessing = async () => {
    if (!activeLogId || phase !== "scanned" || processingRef.current) return;
    
    processingRef.current = true;
    setPhase("processing");

    try {
      let done = false;
      let retries = 0;
      while (!done) {
        try {
          const { data, error } = await supabase.functions.invoke("sync-riyad-statement-background", {
            body: { mode: "process", log_id: activeLogId },
          });

          if (error) throw error;
          retries = 0; // reset on success

          if (data?.files) {
            setFoundFiles(data.files);
          }

          done = data?.done === true;

          if (!done) {
            // Small delay between files
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (batchErr: any) {
          retries++;
          if (retries >= 3) throw batchErr;
          // Retry after a longer delay on transient errors
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (err: any) {
      toast.error(err.message);
      setPhase("error");
    } finally {
      processingRef.current = false;
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setFoundFiles([]);
    setLiveLog(null);
    setActiveLogId(null);
    setLastDate(null);
  };

  const handleShowHistory = async (job: AutoJob) => {
    setSelectedJob(job);
    setHistoryDialogOpen(true);
    setLogsLoading(true);

    try {
      const { data, error } = await supabase
        .from("riyad_statement_auto_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs((data as unknown as AutoImportLog[]) || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />{language === "ar" ? "مكتمل" : "Completed"}</Badge>;
      case "processing":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{language === "ar" ? "قيد التنفيذ" : "Processing"}</Badge>;
      case "scanning":
      case "scanned":
        return <Badge variant="secondary"><Search className="h-3 w-3 mr-1" />{language === "ar" ? "فحص" : "Scanning"}</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{language === "ar" ? "خطأ" : "Error"}</Badge>;
      case "no_email":
        return <Badge variant="outline"><Ban className="h-3 w-3 mr-1" />{language === "ar" ? "لا يوجد بريد" : "No Email"}</Badge>;
      case "empty":
        return <Badge variant="outline"><Ban className="h-3 w-3 mr-1" />{language === "ar" ? "فارغ" : "Empty"}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "processing": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "no_attachment": return <FileX className="h-4 w-4 text-destructive" />;
      case "pending": return <CircleDot className="h-4 w-4 text-muted-foreground" />;
      default: return <CircleDot className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const currentStep = liveLog?.current_step || "";
  const isFileStep = currentStep.startsWith("downloading_file_") || currentStep.startsWith("processing_file_");

  const getStepLabel = () => {
    if (isFileStep) {
      const fileIdx = (liveLog?.current_file_index ?? 0) + 1;
      const total = liveLog?.total_files ?? foundFiles.length;
      return language === "ar" ? `معالجة الملف ${fileIdx} من ${total}` : `Processing file ${fileIdx} of ${total}`;
    }
    const info = STEP_LABELS[currentStep];
    if (info) return language === "ar" ? info.ar : info.en;
    return currentStep;
  };

  const isActive = phase === "scanning" || phase === "processing";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {language === "ar" ? "التحميل التلقائي" : "Auto Upload"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar"
            ? "إدارة ومراقبة عمليات التحميل التلقائية المجدولة"
            : "Manage and monitor scheduled automatic upload jobs"}
        </p>
      </div>

      <div className="grid gap-4">
        {AUTO_JOBS.map((job) => (
          <Card key={job.id} className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{job.icon}</div>
                  <div className="flex items-center gap-2">
                    <img src={edaraLogo} alt="Edara" className="h-6 w-6 rounded-full" />
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {language === "ar" ? job.nameAr : job.name}
                    </CardTitle>
                    <CardDescription>
                      {language === "ar" ? job.descriptionAr : job.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {job.schedule}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {/* Phase 1: Scan Button */}
                {(phase === "idle" || phase === "completed" || phase === "error") && (
                  <Button
                    onClick={() => handleScan(job)}
                    disabled={isActive}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {language === "ar" ? "فحص البريد" : "Scan Emails"}
                  </Button>
                )}

                {/* Phase 2: Start Upload Button - shown after scan */}
                {phase === "scanned" && foundFiles.length > 0 && (
                  <Button
                    onClick={handleStartProcessing}
                    className="gap-2"
                    variant="default"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {language === "ar"
                      ? `تحميل ${foundFiles.length} ملف`
                      : `Upload ${foundFiles.length} Files`}
                  </Button>
                )}

                {/* Scanning indicator */}
                {phase === "scanning" && (
                  <Button disabled className="gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === "ar" ? "جاري الفحص..." : "Scanning..."}
                  </Button>
                )}

                {/* Processing indicator */}
                {phase === "processing" && (
                  <Button disabled className="gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === "ar" ? "جاري التحميل..." : "Uploading..."}
                  </Button>
                )}

                {/* Reset button */}
                {(phase === "scanned" || phase === "completed" || phase === "error") && (
                  <Button variant="outline" onClick={handleReset} className="gap-2">
                    {language === "ar" ? "إعادة" : "Reset"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => handleShowHistory(job)}
                  className="gap-2"
                >
                  <History className="h-4 w-4" />
                  {language === "ar" ? "السجل" : "History"}
                </Button>
              </div>

              {/* Step indicator during scanning/processing */}
              {isActive && liveLog && currentStep && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{getStepLabel()}</span>
                </div>
              )}

              {/* Last date info */}
              {phase === "scanned" && lastDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {language === "ar" ? `آخر تاريخ تحميل: ${lastDate}` : `Last import date: ${lastDate}`}
                  </span>
                </div>
              )}

              {/* Totals bar during/after processing */}
              {(phase === "processing" || phase === "completed") && liveLog && (liveLog.records_inserted != null || liveLog.records_skipped != null) && (
                <div className="flex gap-4 text-xs text-muted-foreground px-1">
                  <span>📥 {language === "ar" ? "مضاف" : "Inserted"}: <span className="font-mono font-bold text-foreground">{liveLog.records_inserted ?? 0}</span></span>
                  <span>🔄 {language === "ar" ? "مكرر" : "Skipped"}: <span className="font-mono font-bold text-foreground">{liveLog.records_skipped ?? 0}</span></span>
                </div>
              )}

              {/* Found Files List */}
              {foundFiles.length > 0 && (
                <Card className="border bg-muted/30">
                  <CardContent className="pt-4 pb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        {language === "ar"
                          ? `الملفات المكتشفة (${foundFiles.length})`
                          : `Found Files (${foundFiles.length})`}
                      </p>
                      {phase === "completed" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    {foundFiles.map((file, idx) => {
                      const isCurrent = liveLog?.current_file_index === idx && isFileStep;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                            isCurrent
                              ? "bg-primary/10 border border-primary/30"
                              : file.status === "completed"
                              ? "opacity-80"
                              : file.status === "pending"
                              ? ""
                              : ""
                          }`}
                        >
                          {getFileStatusIcon(file.status)}
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className={`truncate block ${isCurrent ? "font-semibold" : ""}`}>
                              {file.filename || file.subject}
                            </span>
                          </div>
                          {file.date && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              {file.date}
                            </Badge>
                          )}
                          {file.status === "completed" && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              +{file.inserted} / {file.skipped} {language === "ar" ? "مكرر" : "dup"}
                            </span>
                          )}
                          {file.status === "no_attachment" && (
                            <Badge variant="destructive" className="text-xs">
                              {language === "ar" ? "لا مرفق" : "No attachment"}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {language === "ar"
                ? `سجل ${selectedJob?.nameAr}`
                : `${selectedJob?.name} History`}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "آخر 50 عملية تحميل تلقائية"
                : "Last 50 auto import runs"}
            </DialogDescription>
          </DialogHeader>

          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا توجد سجلات" : "No records found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "ملفات" : "Files"}</TableHead>
                  <TableHead>{language === "ar" ? "سجلات جديدة" : "Inserted"}</TableHead>
                  <TableHead>{language === "ar" ? "مكررة" : "Skipped"}</TableHead>
                  <TableHead>{language === "ar" ? "عنوان البريد" : "Email Subject"}</TableHead>
                  <TableHead>{language === "ar" ? "خطأ" : "Error"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="font-mono">
                      {log.total_files ?? (log.found_files ? (log.found_files as any[]).length : "-")}
                    </TableCell>
                    <TableCell className="font-mono">
                      {log.records_inserted ?? 0}
                    </TableCell>
                    <TableCell className="font-mono">
                      {log.records_skipped ?? 0}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {log.email_subject || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-destructive">
                      {log.error_message || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoUpload;
