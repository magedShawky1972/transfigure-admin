import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CalendarIcon, CheckCircle, Clock, Database, Eye, Loader2, Pause, Play, RefreshCw, RotateCcw, Send, XCircle } from "lucide-react";
import { dateToInt, getKoonEndpointStatus, intToDateIntString, isValidKoonBackfillRange, KOON_BACKFILL_PAGE_SIZE, type KoonEndpointProgress } from "@/lib/koonBackfill";

interface BackfillRun {
  id: string;
  from_date_int: number;
  to_date_int: number;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  skipped_counts?: Record<string, number>;
  current_phase: number;
  current_endpoint?: string;
  error_message?: string;
}
type EndpointStat = KoonEndpointProgress;
interface BackfillSummary { run: BackfillRun; endpoints: EndpointStat[]; batch?: unknown[] }
interface BackfillError {
  id: string;
  endpoint: string;
  record_key: string;
  attempt_count: number;
  response_status: number;
  response_message: string;
}

const ENDPOINT_LABELS: Record<string, { en: string; ar: string }> = {
  "api-customer": { en: "Customers", ar: "العملاء" },
  "api-brand": { en: "Brands", ar: "العلامات التجارية" },
  "api-product": { en: "Products", ar: "المنتجات" },
  "api-salesheader": { en: "Sales Headers", ar: "رؤوس الطلبات" },
  "api-salesline": { en: "Sales Lines", ar: "بنود الطلبات" },
  "api-payment": { en: "Payments", ar: "المدفوعات" },
};
const PHASE_ENDPOINTS = ["api-customer", "api-brand", "api-product", "api-salesheader", "api-salesline", "api-payment"];

const KoonBackfill = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [runs, setRuns] = useState<BackfillRun[]>([]);
  const [summary, setSummary] = useState<BackfillSummary | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<string>();
  const [activePhase, setActivePhase] = useState(0);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [errors, setErrors] = useState<BackfillError[]>([]);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const stopRef = useRef(false);

  const getError = async (error: unknown, fallback: string) => {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      return body?.error || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  };
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("koon-backfill", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };
  const statusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      preparing: { en: "Preparing", ar: "جارٍ التحضير" },
      ready: { en: "Ready", ar: "جاهز" },
      running: { en: "Running", ar: "قيد الإرسال" },
      completed: { en: "Completed", ar: "مكتمل" },
      completed_with_errors: { en: "Completed with errors", ar: "مكتمل مع أخطاء" },
      failed: { en: "Failed", ar: "فشل" },
    };
    return labels[status]?.[language] || status;
  };
  const statusBadge = (status: string) => {
    if (status === "completed") return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />{statusLabel(status)}</Badge>;
    if (status === "failed" || status === "completed_with_errors") return <Badge variant="destructive">{statusLabel(status)}</Badge>;
    return <Badge variant="outline">{statusLabel(status)}</Badge>;
  };
  const endpointStatusBadge = (stat: EndpointStat) => {
    if (!summary) return null;
    const status = getKoonEndpointStatus(stat, summary.run.status, summary.run.current_phase, activeEndpoint);
    const labels = {
      waiting: isAr ? "بالانتظار" : "Waiting",
      running: isAr ? "يعمل الآن" : "Running",
      pending: isAr ? "في قائمة الإرسال" : "Queued",
      completed: isAr ? "مكتمل" : "Completed",
      failed: isAr ? "فشل" : "Failed",
    };
    return <Badge variant={status === "failed" ? "destructive" : status === "completed" ? "secondary" : "outline"} className="whitespace-nowrap">
      {status === "running" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
      {status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
      {labels[status]}
    </Badge>;
  };

  const loadRuns = async () => {
    setLoadingRuns(true);
    try {
      const data = await call({ action: "list" });
      setRuns(data.runs || []);
    } catch (error) {
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشل تحميل العمليات" : "Failed to load backfill runs"), variant: "destructive" });
    } finally {
      setLoadingRuns(false);
    }
  };
  useEffect(() => { if (hasAccess) loadRuns(); }, [hasAccess]);

  const openRun = async (runId: string) => {
    try {
      const data = await call({ action: "get", runId });
      setSummary(data);
      return data as BackfillSummary;
    } catch (error) {
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشل تحميل العملية" : "Failed to load run"), variant: "destructive" });
      return undefined;
    }
  };

  const processRun = async (runId: string, initialSummary?: BackfillSummary) => {
    setProcessing(true);
    stopRef.current = false;
    let currentSummary = initialSummary || summary || undefined;
    try {
      let shouldContinue = true;
      while (!stopRef.current && shouldContinue) {
        const nextApi = currentSummary?.endpoints.find((stat) => stat.pending > 0);
        setActiveEndpoint(nextApi?.endpoint);
        setActivePhase(nextApi?.phase || 0);
        const data = await call({ action: "process", runId, batchSize: KOON_BACKFILL_PAGE_SIZE }) as BackfillSummary;
        currentSummary = data;
        setSummary(data);
        const status = data.run.status;
        shouldContinue = !["completed", "completed_with_errors", "failed"].includes(status) && (data.batch?.length || 0) > 0;
      }
      await loadRuns();
    } catch (error) {
      toast({ title: isAr ? "توقف الإرسال" : "Sending stopped", description: await getError(error, isAr ? "يمكنك متابعة العملية لاحقاً" : "You can resume this run later"), variant: "destructive" });
      await openRun(runId);
    } finally {
      setProcessing(false);
      setActiveEndpoint(undefined);
      setActivePhase(0);
    }
  };

  const preparePhases = async (runId: string, initialSummary: BackfillSummary) => {
    let currentSummary = initialSummary;
    for (let phase = 1; phase <= 6 && !stopRef.current; phase += 1) {
      setActivePhase(phase);
      setActiveEndpoint(PHASE_ENDPOINTS[phase - 1]);
      currentSummary = await call({ action: "prepare", runId, phase }) as BackfillSummary;
      setSummary(currentSummary);
    }
    return currentSummary;
  };

  const finishPreparation = async (runId: string, data: BackfillSummary) => {
    toast({ title: isAr ? "تم التحضير" : "Backfill prepared", description: isAr ? `${data.run.total_items} سجل للإرسال، ${data.run.skipped_items} تم تخطيه` : `${data.run.total_items} to send, ${data.run.skipped_items} already delivered` });
    await loadRuns();
    setPreparing(false);
    setActiveEndpoint(undefined);
    setActivePhase(0);
    if (data.run.total_items > 0) await processRun(runId, data);
  };

  const retryFailed = async () => {
    if (!summary || processing) return;
    try {
      await call({ action: "retry", runId: summary.run.id });
      await processRun(summary.run.id);
    } catch (error) {
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشلت إعادة المحاولة" : "Failed to retry deliveries"), variant: "destructive" });
    }
  };

  const restartPreparation = async () => {
    if (!summary || preparing || processing) return;
    const runId = summary.run.id;
    setPreparing(true);
    stopRef.current = false;
    try {
      const data = await call({ action: "restart", runId }) as BackfillSummary;
      setSummary(data);
      const prepared = await preparePhases(runId, data);
      if (!stopRef.current) await finishPreparation(runId, prepared);
    } catch (error) {
      await openRun(runId);
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشل تحضير العملية" : "Failed to prepare backfill"), variant: "destructive" });
    } finally {
      setPreparing(false);
      setActiveEndpoint(undefined);
      setActivePhase(0);
    }
  };

  const startBackfill = async () => {
    if (!isValidKoonBackfillRange(fromDate, toDate)) {
      toast({ title: isAr ? "خطأ" : "Error", description: isAr ? "اختر فترة صحيحة" : "Select a valid From and To date", variant: "destructive" });
      return;
    }
    setPreparing(true);
    stopRef.current = false;
    let runId: string | undefined;
    try {
      const data = await call({ action: "create", fromDateInt: dateToInt(fromDate!), toDateInt: dateToInt(toDate!) }) as BackfillSummary;
      runId = data.run.id;
      setSummary(data);
      const prepared = await preparePhases(runId, data);
      if (!stopRef.current) await finishPreparation(runId, prepared);
    } catch (error) {
      if (runId) await openRun(runId);
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشل تحضير العملية" : "Failed to prepare backfill"), variant: "destructive" });
    } finally {
      setPreparing(false);
      setActiveEndpoint(undefined);
      setActivePhase(0);
    }
  };

  const showErrors = async () => {
    if (!summary) return;
    setLoadingErrors(true);
    setErrorsOpen(true);
    try {
      const data = await call({ action: "errors", runId: summary.run.id });
      setErrors(data.errors || []);
    } catch (error) {
      toast({ title: isAr ? "خطأ" : "Error", description: await getError(error, isAr ? "فشل تحميل الأخطاء" : "Failed to load errors"), variant: "destructive" });
    } finally {
      setLoadingErrors(false);
    }
  };

  if (accessLoading || hasAccess === null) return <AccessDenied isLoading />;
  if (!hasAccess) return <AccessDenied />;

  const run = summary?.run;
  const endpointStats = summary?.endpoints || [];
  const progress = run && run.total_items > 0 ? Math.round((run.processed_items / run.total_items) * 100) : run?.status === "completed" ? 100 : 0;
  const canResume = run && ["ready", "running"].includes(run.status) && run.processed_items < run.total_items;
  const canRestartPreparation = run && ["failed", "preparing"].includes(run.status) && run.processed_items === 0;
  const activeLabel = activeEndpoint ? ENDPOINT_LABELS[activeEndpoint]?.[language] || activeEndpoint : "";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><Send className="h-7 w-7 text-primary" />{isAr ? "إرسال البيانات السابقة إلى KOON" : "KOON Backfill"}</h1>
          <p className="text-muted-foreground mt-1">{isAr ? "إرسال جميع الطلبات والبيانات المرتبطة بها حسب الفترة" : "Send every order and its related data for a selected date range"}</p>
        </div>
        <Button variant="outline" onClick={() => { setSummary(null); stopRef.current = true; }} disabled={preparing || processing}>
          <RotateCcw className="h-4 w-4 mr-2" />{isAr ? "عملية جديدة" : "New Backfill"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "فترة الطلبات" : "Order Date Range"}</CardTitle>
          <CardDescription>{isAr ? "يشمل العملاء والعلامات والمنتجات المرتبطة بالطلبات فقط. يتم تخطي السجلات التي نجح إرسالها سابقاً." : "Includes only customers, brands, and products related to selected orders. Earlier successful KOON deliveries are skipped."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {([{ date: fromDate, setDate: setFromDate, open: fromOpen, setOpen: setFromOpen, label: isAr ? "من تاريخ" : "From Date" }, { date: toDate, setDate: setToDate, open: toOpen, setOpen: setToOpen, label: isAr ? "إلى تاريخ" : "To Date" }] as const).map((field, index) => (
              <div className="space-y-2" key={index}>
                <label className="text-sm font-medium">{field.label}</label>
                <Popover open={field.open} onOpenChange={field.setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" disabled={preparing || processing}>
                      <CalendarIcon className="h-4 w-4 mr-2" />{field.date ? format(field.date, "dd/MM/yyyy") : isAr ? "اختر التاريخ" : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.date} onSelect={(date) => { field.setDate(date); field.setOpen(false); }} captionLayout="dropdown" fromYear={2020} toYear={2100} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm flex gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <p>{isAr ? "المدفوعات لا تُعاد تلقائياً بعد الفشل. راجع نتيجة KOON قبل متابعة العملية لتجنب التكرار." : "Failed payments are not automatically retried. Check KOON before resuming to avoid duplicates."}</p>
          </div>
          <Button onClick={startBackfill} disabled={preparing || processing || !fromDate || !toDate}>
            {preparing || processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {preparing ? isAr ? "جارٍ التحضير..." : "Preparing..." : processing ? isAr ? "جارٍ الإرسال..." : "Sending..." : isAr ? "بدء الإرسال" : "Start Backfill"}
          </Button>
        </CardContent>
      </Card>

      {run && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>{intToDateIntString(run.from_date_int)} – {intToDateIntString(run.to_date_int)}</CardTitle>
                  <CardDescription>{isAr ? "تقدم التحضير والإرسال" : "Preparation and delivery progress"}</CardDescription>
                </div>
                <div className="flex items-center gap-2">{statusBadge(run.status)}</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {(preparing || processing) && activeEndpoint && <div className="rounded-md border border-primary/30 bg-primary/5 p-4 flex items-center gap-3" aria-live="polite">
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                <div>
                  <p className="font-medium">{preparing ? isAr ? `جارٍ تحضير ${activeLabel}` : `Preparing ${activeLabel}` : isAr ? `جارٍ إرسال ${activeLabel}` : `Sending ${activeLabel}`}</p>
                  <p className="text-sm text-muted-foreground">{isAr ? `الخطوة ${activePhase} من 6` : `Step ${activePhase} of 6`} · <span className="font-mono">{activeEndpoint}</span></p>
                </div>
              </div>}
              {run.error_message && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{run.error_message}</div>}
              <div className="space-y-2"><Progress value={progress} className="h-3" /><p className="text-sm text-muted-foreground">{progress}% · {run.processed_items} / {run.total_items}</p></div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[{ label: isAr ? "الإجمالي" : "Total", value: run.total_items, icon: Database }, { label: isAr ? "ناجح" : "Sent", value: run.successful_items, icon: CheckCircle }, { label: isAr ? "فشل" : "Failed", value: run.failed_items, icon: XCircle }, { label: isAr ? "متبقٍ" : "Remaining", value: run.total_items - run.processed_items, icon: Clock }, { label: isAr ? "تم تخطيه" : "Already sent", value: run.skipped_items, icon: CheckCircle }].map((stat, index) => (
                  <div className="rounded-lg border p-3" key={index}><stat.icon className="h-4 w-4 text-primary mb-2" /><p className="text-2xl font-bold">{stat.value}</p><p className="text-xs text-muted-foreground">{stat.label}</p></div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {processing ? <Button variant="outline" onClick={() => { stopRef.current = true; }}><Pause className="h-4 w-4 mr-2" />{isAr ? "إيقاف مؤقت" : "Pause"}</Button> : canResume ? <Button onClick={() => processRun(run.id, summary || undefined)}><Play className="h-4 w-4 mr-2" />{isAr ? "متابعة" : "Resume"}</Button> : null}
                <Button variant="outline" onClick={() => openRun(run.id)} disabled={preparing || processing}><RefreshCw className="h-4 w-4 mr-2" />{isAr ? "تحديث" : "Refresh"}</Button>
                {canRestartPreparation && <Button onClick={restartPreparation} disabled={preparing || processing}><RotateCcw className="h-4 w-4 mr-2" />{run.status === "preparing" ? isAr ? "متابعة تحضير العملية" : "Resume Preparation" : isAr ? "إعادة تحضير العملية" : "Retry Preparation"}</Button>}
                {run.status === "completed_with_errors" && run.failed_items > 0 && <Button onClick={retryFailed} disabled={processing}><RotateCcw className="h-4 w-4 mr-2" />{isAr ? "إعادة محاولة الفاشل" : "Retry Failed"}</Button>}
                {run.failed_items > 0 && <Button variant="outline" onClick={showErrors}><Eye className="h-4 w-4 mr-2" />{isAr ? "عرض الأخطاء" : "View Errors"}</Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{isAr ? "حالة كل خطوة و API" : "Status of each step and API"}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto"><Table className="min-w-[800px]"><TableHeader><TableRow><TableHead>API</TableHead><TableHead>{isAr ? "الحالة" : "Status"}</TableHead><TableHead>{isAr ? "الإجمالي" : "Total"}</TableHead><TableHead>{isAr ? "ناجح" : "Sent"}</TableHead><TableHead>{isAr ? "فشل" : "Failed"}</TableHead><TableHead>{isAr ? "متبقٍ" : "Pending"}</TableHead><TableHead>{isAr ? "تم تخطيه" : "Skipped"}</TableHead></TableRow></TableHeader>
                <TableBody>{endpointStats.map((stat) => <TableRow key={stat.endpoint}><TableCell className="font-medium"><span className="text-muted-foreground mr-2">{stat.phase}.</span>{ENDPOINT_LABELS[stat.endpoint]?.[language] || stat.endpoint}<div className="text-xs text-muted-foreground font-mono">{stat.endpoint}</div></TableCell><TableCell>{endpointStatusBadge(stat)}</TableCell><TableCell>{stat.total}</TableCell><TableCell>{stat.success}</TableCell><TableCell>{stat.failed}</TableCell><TableCell>{stat.pending}</TableCell><TableCell>{run.skipped_counts?.[stat.endpoint] || 0}</TableCell></TableRow>)}</TableBody>
              </Table></div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>{isAr ? "العمليات السابقة" : "Backfill History"}</CardTitle><CardDescription>{isAr ? "افتح أي عملية لعرض التقدم أو المتابعة" : "Open a run to view progress or resume"}</CardDescription></CardHeader>
        <CardContent>
          {loadingRuns ? <Loader2 className="h-5 w-5 animate-spin" /> : runs.length === 0 ? <p className="text-sm text-muted-foreground">{isAr ? "لا توجد عمليات" : "No backfill runs yet"}</p> : <div className="overflow-x-auto"><Table className="min-w-[700px]"><TableHeader><TableRow><TableHead>{isAr ? "الفترة" : "Date Range"}</TableHead><TableHead>{isAr ? "الحالة" : "Status"}</TableHead><TableHead>{isAr ? "التقدم" : "Progress"}</TableHead><TableHead>{isAr ? "فشل" : "Failed"}</TableHead><TableHead>{isAr ? "تم تخطيه" : "Skipped"}</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>{runs.map((item) => <TableRow key={item.id}><TableCell>{intToDateIntString(item.from_date_int)} – {intToDateIntString(item.to_date_int)}</TableCell><TableCell>{statusBadge(item.status)}{item.current_endpoint && ["preparing", "running"].includes(item.status) && <div className="text-xs text-muted-foreground font-mono mt-1">{item.current_endpoint}</div>}</TableCell><TableCell>{item.processed_items} / {item.total_items}</TableCell><TableCell>{item.failed_items}</TableCell><TableCell>{item.skipped_items}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => openRun(item.id)} disabled={preparing || processing}><Eye className="h-4 w-4 mr-1" />{isAr ? "فتح" : "Open"}</Button></TableCell></TableRow>)}</TableBody>
          </Table></div>}
        </CardContent>
      </Card>

      <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
        <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isAr ? "أخطاء الإرسال" : "Delivery Errors"}</DialogTitle><DialogDescription>{isAr ? "تحقق من KOON قبل متابعة المدفوعات الفاشلة" : "Verify KOON before resuming failed payments"}</DialogDescription></DialogHeader>
          {loadingErrors ? <Loader2 className="h-5 w-5 animate-spin" /> : errors.length === 0 ? <p>{isAr ? "لا توجد أخطاء" : "No errors"}</p> : <div className="space-y-3">{errors.map((item) => <div className="rounded-lg border p-3 space-y-1" key={item.id}><div className="flex flex-wrap justify-between gap-2"><Badge variant="outline">{item.endpoint}</Badge><Badge variant="destructive">{item.response_status}</Badge></div><p className="font-mono text-sm break-all">{item.record_key}</p><p className="text-sm text-muted-foreground break-all">{item.response_message}</p><p className="text-xs">{isAr ? "المحاولات" : "Attempts"}: {item.attempt_count}</p></div>)}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KoonBackfill;
