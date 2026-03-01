import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Play, History, Bot, CheckCircle2, AlertCircle, Clock, Ban, Loader2, Mail, Download, FileSpreadsheet, Search, Database, Link2, Bell, CircleDot, CalendarDays, FileX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import edaraLogo from "@/assets/edara-logo.png";

interface FoundFile {
  index: number;
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

const STEP_LABELS: Record<string, { en: string; ar: string; icon: typeof Mail }> = {
  checking_last_date: { en: "Checking last import date", ar: "فحص آخر تاريخ تحميل", icon: CalendarDays },
  connecting_to_email: { en: "Connecting to email server", ar: "الاتصال بخادم البريد", icon: Mail },
  searching_emails: { en: "Searching for emails", ar: "البحث عن الرسائل", icon: Search },
  scanning_emails: { en: "Scanning email headers", ar: "مسح عناوين الرسائل", icon: Search },
  saving_last_date: { en: "Saving last import date", ar: "حفظ آخر تاريخ تحميل", icon: Database },
  sending_notification: { en: "Sending notification", ar: "إرسال الإشعار", icon: Bell },
  completed: { en: "Completed", ar: "مكتمل", icon: CheckCircle2 },
  error: { en: "Error", ar: "خطأ", icon: AlertCircle },
};

const AutoUpload = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/auto-upload");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AutoJob | null>(null);
  const [logs, setLogs] = useState<AutoImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [liveLog, setLiveLog] = useState<AutoImportLog | null>(null);
  const channelRef = useRef<any>(null);

  // Subscribe to realtime updates
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

          if (updated.status === 'completed' || updated.status === 'error' || updated.status === 'no_email' || updated.status === 'empty') {
            setRunningJobs(prev => {
              const next = new Set(prev);
              next.delete("riyad-bank");
              return next;
            });

            if (updated.status === 'completed') {
              toast.success(
                language === "ar"
                  ? `تم: ${updated.records_inserted ?? 0} سجل جديد, ${updated.records_skipped ?? 0} مكرر (${updated.total_files ?? 0} ملف)`
                  : `Done: ${updated.records_inserted ?? 0} inserted, ${updated.records_skipped ?? 0} skipped (${updated.total_files ?? 0} files)`
              );
            } else if (updated.status === 'error') {
              toast.error(updated.error_message || "Error");
            } else if (updated.status === 'no_email') {
              toast.info(language === "ar" ? "لا توجد رسائل جديدة" : "No new emails found");
            }
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

  const handleManualRun = async (job: AutoJob) => {
    if (runningJobs.has(job.id)) return;

    setRunningJobs((prev) => new Set(prev).add(job.id));
    setLiveLog(null);

    try {
      const invokePromise = supabase.functions.invoke(job.functionName, {
        body: { time: "manual" },
      });

      // Poll for log entry
      await new Promise(resolve => setTimeout(resolve, 1500));
      const { data: latestLog } = await supabase
        .from("riyad_statement_auto_imports")
        .select("*")
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (latestLog) {
        setActiveLogId(latestLog.id);
        setLiveLog(latestLog as unknown as AutoImportLog);
      }

      const { error } = await invokePromise;
      if (error) throw error;

    } catch (err: any) {
      toast.error(err.message);
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
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

  const isRunning = runningJobs.has("riyad-bank");
  const currentStep = liveLog?.current_step || "";
  const isFileStep = currentStep.startsWith("downloading_file_") || currentStep.startsWith("processing_file_");

  // Determine the overall step for the top-level progress
  const getMainStepLabel = () => {
    if (isFileStep) {
      const fileIdx = (liveLog?.current_file_index ?? 0) + 1;
      const total = liveLog?.total_files ?? 0;
      const en = `Processing file ${fileIdx} of ${total}`;
      const ar = `معالجة الملف ${fileIdx} من ${total}`;
      return language === "ar" ? ar : en;
    }
    const info = STEP_LABELS[currentStep];
    if (info) return language === "ar" ? info.ar : info.en;
    return currentStep;
  };

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
                <Button
                  onClick={() => handleManualRun(job)}
                  disabled={isRunning}
                  className="gap-2"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {language === "ar" ? "تشغيل يدوي" : "Manual Run"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleShowHistory(job)}
                  className="gap-2"
                >
                  <History className="h-4 w-4" />
                  {language === "ar" ? "السجل" : "History"}
                </Button>
              </div>

              {/* Live Progress Panel */}
              {(isRunning || (liveLog && liveLog.status === "completed")) && liveLog && (
                <Card className="border bg-muted/30">
                  <CardContent className="pt-4 pb-3 space-y-3">
                    {/* Current Step Indicator */}
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {liveLog.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      )}
                      <span>{getMainStepLabel()}</span>
                    </div>

                    {/* Totals bar */}
                    {(liveLog.records_inserted != null || liveLog.records_skipped != null) && (
                      <div className="flex gap-4 text-xs text-muted-foreground px-1">
                        <span>📥 {language === "ar" ? "مضاف" : "Inserted"}: <span className="font-mono font-bold text-foreground">{liveLog.records_inserted ?? 0}</span></span>
                        <span>🔄 {language === "ar" ? "مكرر" : "Skipped"}: <span className="font-mono font-bold text-foreground">{liveLog.records_skipped ?? 0}</span></span>
                        {liveLog.total_files && (
                          <span>📄 {language === "ar" ? "ملفات" : "Files"}: <span className="font-mono font-bold text-foreground">{liveLog.total_files}</span></span>
                        )}
                      </div>
                    )}

                    {/* Found Files List */}
                    {liveLog.found_files && liveLog.found_files.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                          {language === "ar" ? "الملفات المكتشفة" : "Found Files"}
                        </p>
                        {(liveLog.found_files as FoundFile[]).map((file, idx) => {
                          const isCurrent = liveLog.current_file_index === idx && isFileStep;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all ${
                                isCurrent
                                  ? "bg-primary/10 border border-primary/30"
                                  : file.status === "completed"
                                  ? "opacity-80"
                                  : file.status === "pending"
                                  ? "opacity-50"
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
                      </div>
                    )}
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
