import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Play, History, Bot, CheckCircle2, AlertCircle, Clock, Ban, Loader2, Mail, Download, FileSpreadsheet, Search, Database, Link2, Bell, CircleDot } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import edaraLogo from "@/assets/edara-logo.png";

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

const STEPS = [
  { key: "connecting_to_email", label: "Connecting to Email Server", labelAr: "الاتصال بخادم البريد", icon: Mail },
  { key: "searching_emails", label: "Searching for Emails", labelAr: "البحث عن الرسائل", icon: Search },
  { key: "downloading_attachment", label: "Downloading Attachment", labelAr: "تحميل المرفق", icon: Download },
  { key: "parsing_excel", label: "Parsing Excel File", labelAr: "تحليل ملف Excel", icon: FileSpreadsheet },
  { key: "checking_duplicates", label: "Checking Duplicates", labelAr: "فحص التكرارات", icon: Database },
  { key: "inserting_records", label: "Inserting Records", labelAr: "إدراج السجلات", icon: Database },
  { key: "matching_bank_ledger", label: "Matching Bank Ledger", labelAr: "مطابقة سجل البنك", icon: Link2 },
  { key: "sending_notification", label: "Sending Notification", labelAr: "إرسال الإشعار", icon: Bell },
  { key: "completed", label: "Completed", labelAr: "مكتمل", icon: CheckCircle2 },
];

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

  // Subscribe to realtime updates for the active log
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
          const updated = payload.new as AutoImportLog;
          setLiveLog(updated);
          
          if (updated.status === 'completed' || updated.status === 'error' || updated.status === 'no_email' || updated.status === 'empty') {
            // Job finished
            setRunningJobs(prev => {
              const next = new Set(prev);
              next.delete("riyad-bank");
              return next;
            });
            
            if (updated.status === 'completed') {
              toast.success(
                language === "ar"
                  ? `تم: ${updated.records_inserted ?? 0} سجل جديد, ${updated.records_skipped ?? 0} مكرر`
                  : `Done: ${updated.records_inserted ?? 0} inserted, ${updated.records_skipped ?? 0} skipped`
              );
            } else if (updated.status === 'error') {
              toast.error(updated.error_message || "Error");
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
      // First, find the latest "processing" log entry (created when edge function starts)
      // We invoke the function and then poll for the log ID
      const invokePromise = supabase.functions.invoke(job.functionName, {
        body: { time: "manual" },
      });

      // Poll for the new log entry
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
        setLiveLog(latestLog as AutoImportLog);
      }

      // Wait for the function to complete
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
      setLogs((data as AutoImportLog[]) || []);
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

  const currentStepIndex = liveLog?.current_step
    ? STEPS.findIndex(s => s.key === liveLog.current_step)
    : -1;

  const isRunning = runningJobs.has("riyad-bank");

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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {job.schedule}
                  </Badge>
                </div>
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

              {/* Live Step Progress */}
              {isRunning && liveLog && (
                <Card className="border bg-muted/30">
                  <CardContent className="pt-4 pb-3">
                    {/* Email Subject / Date */}
                    {liveLog.email_subject && (
                      <div className="mb-4 p-3 rounded-lg bg-background border">
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-primary" />
                          <span className="font-medium">{language === "ar" ? "موضوع البريد:" : "Email Subject:"}</span>
                          <span className="text-muted-foreground">{liveLog.email_subject}</span>
                        </div>
                      </div>
                    )}

                    {/* Steps */}
                    <div className="space-y-1">
                      {STEPS.map((step, idx) => {
                        const StepIcon = step.icon;
                        const isActive = idx === currentStepIndex;
                        const isDone = idx < currentStepIndex;
                        const isPending = idx > currentStepIndex;

                        return (
                          <div
                            key={step.key}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-all ${
                              isActive
                                ? "bg-primary/10 border border-primary/30"
                                : isDone
                                ? "opacity-70"
                                : "opacity-40"
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : isActive ? (
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                              ) : (
                                <CircleDot className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <StepIcon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`text-sm ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                              {language === "ar" ? step.labelAr : step.label}
                            </span>
                            {isActive && liveLog.records_inserted != null && step.key === "inserting_records" && (
                              <Badge variant="secondary" className="ml-auto text-xs">
                                {liveLog.records_inserted} {language === "ar" ? "سجل" : "records"}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary when done */}
                    {liveLog.status === "completed" && (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-primary font-medium">
                            ✅ {language === "ar" ? "مكتمل" : "Completed"}
                          </span>
                          <span>{liveLog.records_inserted ?? 0} {language === "ar" ? "سجل جديد" : "inserted"}</span>
                          <span>{liveLog.records_skipped ?? 0} {language === "ar" ? "مكرر" : "skipped"}</span>
                        </div>
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
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
