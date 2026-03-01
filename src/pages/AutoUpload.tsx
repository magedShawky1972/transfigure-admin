import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Play, History, Bot, CheckCircle2, AlertCircle, Clock, Ban, Loader2 } from "lucide-react";
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

const AutoUpload = () => {
  const { language, t } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/auto-upload");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AutoJob | null>(null);
  const [logs, setLogs] = useState<AutoImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());

  if (accessLoading) return null;
  if (hasAccess === false) return <AccessDenied />;

  const handleManualRun = async (job: AutoJob) => {
    if (runningJobs.has(job.id)) return;
    
    setRunningJobs((prev) => new Set(prev).add(job.id));
    const loadingId = toast.loading(language === "ar" ? `جاري تشغيل ${job.nameAr}...` : `Running ${job.name}...`);

    try {
      const { data, error } = await supabase.functions.invoke(job.functionName, {
        body: { time: "manual" },
      });

      if (error) throw error;

      toast.success(
        language === "ar"
          ? `تم التشغيل: ${data?.records_inserted ?? 0} سجل جديد, ${data?.records_skipped ?? 0} مكرر`
          : `Completed: ${data?.records_inserted ?? 0} inserted, ${data?.records_skipped ?? 0} skipped`
      );
    } catch (err: any) {
      toast.error(
        language === "ar"
          ? `خطأ: ${err.message}`
          : `Error: ${err.message}`
      );
    } finally {
      toast.dismiss(loadingId);
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
            <CardContent>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleManualRun(job)}
                  disabled={runningJobs.has(job.id)}
                  className="gap-2"
                >
                  {runningJobs.has(job.id) ? (
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
