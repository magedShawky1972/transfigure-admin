import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Eye, X, Pause, Play, StopCircle, Trash2, RefreshCw, History, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface BackgroundJob {
  id: string;
  from_date: string;
  to_date: string;
  status: string;
  total_orders: number;
  processed_orders: number;
  successful_orders: number;
  failed_orders: number;
  skipped_orders: number;
  current_order_number: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  user_email: string;
  user_name: string;
  user_id: string;
  sync_run_id?: string | null;
}

interface SyncDetail {
  id: string;
  run_id: string;
  order_number: string;
  order_date: string | null;
  customer_phone: string | null;
  product_names: string | null;
  total_amount: number | null;
  sync_status: string;
  error_message: string | null;
  step_customer: string | null;
  step_brand: string | null;
  step_product: string | null;
  step_order: string | null;
  step_purchase: string | null;
  payment_method: string | null;
  payment_brand: string | null;
}

export const BackgroundSyncStatusCard = () => {
  const { language } = useLanguage();
  const [activeJob, setActiveJob] = useState<BackgroundJob | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [syncDetails, setSyncDetails] = useState<SyncDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCompletedJob, setShowCompletedJob] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [allJobs, setAllJobs] = useState<BackgroundJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryJob, setSelectedHistoryJob] = useState<BackgroundJob | null>(null);

  useEffect(() => {
    // Fetch active/recent job
    const fetchActiveJob = async () => {
      if (isDeleted) return;
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data, error } = await supabase
        .from('background_sync_jobs')
        .select('*')
        .eq('user_id', user.user.id)
        .in('status', ['pending', 'running', 'paused', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveJob(data as BackgroundJob);
      }
    };

    fetchActiveJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('background_sync_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'background_sync_jobs',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setActiveJob(null);
            setIsDeleted(true);
            return;
          }
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setIsDeleted(false);
            const job = payload.new as BackgroundJob;
            if (job.status === 'pending' || job.status === 'running') {
              setActiveJob(job);
              setShowCompletedJob(false);
            } else if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
              // Job finished - update UI to show final status
              setActiveJob(job);
              setShowCompletedJob(true);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isDeleted]);

  // Fetch sync details for the job
  const fetchSyncDetails = async (jobId: string) => {
    setLoadingDetails(true);
    try {
      // First, get the job including sync_run_id
      const { data: job } = await supabase
        .from('background_sync_jobs')
        .select('from_date, to_date, started_at, sync_run_id')
        .eq('id', jobId)
        .single();

      if (!job) return;

      let runId = job.sync_run_id;

      // If no direct link, try to find matching sync run by date and time
      if (!runId) {
        const { data: run } = await supabase
          .from('odoo_sync_runs')
          .select('id')
          .eq('from_date', job.from_date)
          .eq('to_date', job.to_date)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        runId = run?.id;
      }

      if (runId) {
        const { data: details } = await supabase
          .from('odoo_sync_run_details')
          .select('*')
          .eq('run_id', runId)
          .order('created_at', { ascending: true });

        setSyncDetails((details as SyncDetail[]) || []);
      } else {
        setSyncDetails([]);
      }
    } catch (error) {
      console.error('Error fetching sync details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = (job?: BackgroundJob) => {
    const targetJob = job || activeJob;
    if (targetJob) {
      setSelectedHistoryJob(job || null);
      fetchSyncDetails(targetJob.id);
      setShowDetailsDialog(true);
    }
  };

  const handleViewCurrentDetails = () => {
    handleViewDetails();
  };

  // Fetch all historical jobs
  const fetchAllJobs = async () => {
    setLoadingHistory(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data, error } = await supabase
        .from('background_sync_jobs')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setAllJobs(data as BackgroundJob[]);
      }
    } catch (error) {
      console.error('Error fetching job history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleShowHistory = () => {
    fetchAllJobs();
    setShowHistoryDialog(true);
  };

  const handleSelectHistoryJob = (job: BackgroundJob) => {
    setShowHistoryDialog(false);
    handleViewDetails(job);
  };

  const [actionLoading, setActionLoading] = useState(false);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

  const handleDismiss = () => {
    setActiveJob(null);
    setShowCompletedJob(false);
  };

  const handleDeleteJob = async () => {
    if (!activeJob || actionLoading) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('background_sync_jobs')
        .delete()
        .eq('id', activeJob.id);

      if (error) throw error;
      
      toast.success(language === 'ar' ? 'تم حذف المهمة' : 'Job deleted');
      setIsDeleted(true);
      setActiveJob(null);
      setShowCompletedJob(false);
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error(language === 'ar' ? 'فشل حذف المهمة' : 'Failed to delete job');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseSync = async () => {
    if (!activeJob || actionLoading) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('background_sync_jobs')
        .update({ status: 'paused' })
        .eq('id', activeJob.id);

      if (error) throw error;
      
      toast.success(language === 'ar' ? 'تم إيقاف المزامنة مؤقتاً' : 'Sync paused');
      setActiveJob({ ...activeJob, status: 'paused' });
    } catch (error) {
      console.error('Error pausing sync:', error);
      toast.error(language === 'ar' ? 'فشل إيقاف المزامنة مؤقتاً' : 'Failed to pause sync');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSync = async () => {
    if (!activeJob || actionLoading) return;
    
    setActionLoading(true);
    try {
      // Update status to running
      const { error } = await supabase
        .from('background_sync_jobs')
        .update({ status: 'running' })
        .eq('id', activeJob.id);

      if (error) throw error;

      // Call the edge function to resume processing
      const { error: fnError } = await supabase.functions.invoke('sync-orders-background', {
        body: {
          jobId: activeJob.id,
          fromDate: activeJob.from_date,
          toDate: activeJob.to_date,
          userId: activeJob.user_id,
          userEmail: activeJob.user_email,
          userName: activeJob.user_name,
          resumeFrom: activeJob.processed_orders,
        },
      });

      if (fnError) throw fnError;
      
      toast.success(language === 'ar' ? 'تم استئناف المزامنة' : 'Sync resumed');
      setActiveJob({ ...activeJob, status: 'running' });
    } catch (error) {
      console.error('Error resuming sync:', error);
      toast.error(language === 'ar' ? 'فشل استئناف المزامنة' : 'Failed to resume sync');
    } finally {
      setActionLoading(false);
    }
  };

  // Retry failed sync for a single order
  const handleRetrySync = async (detail: SyncDetail) => {
    if (retryingOrderId) return;

    setRetryingOrderId(detail.id);
    try {
      const { data, error } = await supabase.functions.invoke('retry-odoo-sync-detail', {
        body: { detailId: detail.id },
      });

      if (error) throw error;

      // Refresh the sync details (read-only query from client)
      if (activeJob) {
        await fetchSyncDetails(activeJob.id);
      }

      if (data?.success) {
        toast.success(language === 'ar' ? 'تمت إعادة المزامنة بنجاح' : 'Sync retry successful');
      } else {
        const msg = data?.error || (language === 'ar' ? 'فشلت إعادة المحاولة' : 'Retry failed');
        toast.error(language === 'ar' ? `فشلت إعادة المحاولة: ${msg}` : `Retry failed: ${msg}`);
      }
    } catch (error: any) {
      console.error('Error retrying sync:', error);
      toast.error(language === 'ar' ? `فشلت إعادة المحاولة: ${error.message}` : `Retry failed: ${error.message}`);
    } finally {
      setRetryingOrderId(null);
    }
  };

  if (!activeJob) return null;

  const progress = activeJob.total_orders > 0 
    ? Math.round((activeJob.processed_orders / activeJob.total_orders) * 100) 
    : 0;

  const isRunning = activeJob.status === 'running' || activeJob.status === 'pending';
  const isPaused = activeJob.status === 'paused';
  const isCancelled = activeJob.status === 'cancelled';
  const isCompleted = activeJob.status === 'completed';
  const isFailed = activeJob.status === 'failed';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="h-3 w-3" />{language === 'ar' ? 'نجح' : 'Success'}</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{language === 'ar' ? 'فشل' : 'Failed'}</Badge>;
      case 'skipped':
        return <Badge variant="secondary">{language === 'ar' ? 'تخطي' : 'Skipped'}</Badge>;
      default:
        return <Badge variant="outline">{language === 'ar' ? 'جاري' : 'Processing'}</Badge>;
    }
  };

  const getStepIcon = (status: string | null) => {
    switch (status) {
      case 'found':
      case 'created':
      case 'sent':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-destructive" />;
      case 'skipped':
        return <span className="text-muted-foreground text-xs">-</span>;
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      default:
        return <span className="text-muted-foreground text-xs">•</span>;
    }
  };

  return (
    <>
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {isPaused && <Pause className="h-4 w-4 text-orange-500" />}
              {isCancelled && <StopCircle className="h-4 w-4 text-orange-500" />}
              {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
              <span className="font-medium">
                {language === 'ar' ? 'مزامنة Odoo في الخلفية' : 'Background Odoo Sync'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isRunning ? 'default' : isPaused || isCancelled ? 'outline' : isCompleted ? 'secondary' : 'destructive'}>
                {isRunning 
                  ? (language === 'ar' ? 'جاري التشغيل' : 'Running')
                  : isPaused
                    ? (language === 'ar' ? 'متوقف مؤقتاً' : 'Paused')
                    : isCancelled
                      ? (language === 'ar' ? 'تم الإيقاف' : 'Stopped')
                      : isCompleted 
                        ? (language === 'ar' ? 'مكتمل' : 'Completed')
                        : (language === 'ar' ? 'فشل' : 'Failed')
                }
              </Badge>
              {isRunning && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-orange-500 hover:text-orange-600 hover:bg-orange-100" 
                    onClick={handlePauseSync}
                    disabled={actionLoading}
                    title={language === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive hover:bg-destructive/10" 
                    onClick={async () => {
                      if (!activeJob || actionLoading) return;
                      setActionLoading(true);
                      try {
                        const { error } = await supabase
                          .from('background_sync_jobs')
                          .update({ status: 'cancelled' })
                          .eq('id', activeJob.id);
                        if (error) throw error;
                        toast.success(language === 'ar' ? 'تم إيقاف المزامنة' : 'Sync stopped');
                        setActiveJob({ ...activeJob, status: 'cancelled' });
                      } catch (e) {
                        console.error(e);
                        toast.error(language === 'ar' ? 'فشل إيقاف المزامنة' : 'Failed to stop sync');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    title={language === 'ar' ? 'إيقاف' : 'Stop'}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                  </Button>
                </>
              )}
              {isPaused && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-100" 
                  onClick={handleResumeSync}
                  disabled={actionLoading}
                  title={language === 'ar' ? 'استئناف' : 'Resume'}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
              )}
              {(showCompletedJob || isPaused || isCancelled) && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-destructive hover:bg-destructive/10" 
                    onClick={handleDeleteJob}
                    disabled={actionLoading}
                    title={language === 'ar' ? 'حذف' : 'Delete'}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-2">
            {activeJob.from_date} → {activeJob.to_date}
          </div>

          {(isRunning || isPaused) && (
            <>
              <Progress value={progress} className="h-2 mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {language === 'ar' 
                    ? `${activeJob.processed_orders} من ${activeJob.total_orders} طلب`
                    : `${activeJob.processed_orders} of ${activeJob.total_orders} orders`
                  }
                </span>
                <span>{progress}%</span>
              </div>
              {activeJob.current_order_number && isRunning && (
                <div className="text-xs text-muted-foreground mt-1">
                  {language === 'ar' ? 'الطلب الحالي: ' : 'Current: '}
                  {activeJob.current_order_number}
                </div>
              )}
            </>
          )}

          {(isCompleted || isFailed || isCancelled) && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">
                ✓ {activeJob.successful_orders}
              </span>
              {activeJob.failed_orders > 0 && (
                <span className="text-destructive">
                  ✗ {activeJob.failed_orders}
                </span>
              )}
              {activeJob.skipped_orders > 0 && (
                <span className="text-muted-foreground">
                  ⊘ {activeJob.skipped_orders}
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={handleViewCurrentDetails}>
              <Eye className="h-3 w-3" />
              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
            </Button>
            <Button variant="ghost" size="sm" className="gap-1" onClick={handleShowHistory}>
              <History className="h-3 w-3" />
              {language === 'ar' ? 'السجل' : 'History'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {language === 'ar' ? 'سجل المزامنة في الخلفية' : 'Background Sync History'}
            </DialogTitle>
          </DialogHeader>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : allJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا يوجد سجل' : 'No history found'}
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {allJobs.map((job) => (
                  <Card 
                    key={job.id} 
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleSelectHistoryJob(job)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {job.from_date} → {job.to_date}
                          </span>
                        </div>
                        <Badge 
                          variant={
                            job.status === 'completed' ? 'secondary' :
                            job.status === 'running' || job.status === 'pending' ? 'default' :
                            job.status === 'failed' ? 'destructive' : 'outline'
                          }
                          className="text-xs"
                        >
                          {job.status === 'completed' 
                            ? (language === 'ar' ? 'مكتمل' : 'Completed')
                            : job.status === 'running' || job.status === 'pending'
                              ? (language === 'ar' ? 'جاري' : 'Running')
                              : job.status === 'failed'
                                ? (language === 'ar' ? 'فشل' : 'Failed')
                                : job.status === 'paused'
                                  ? (language === 'ar' ? 'متوقف' : 'Paused')
                                  : job.status === 'cancelled'
                                    ? (language === 'ar' ? 'ملغي' : 'Cancelled')
                                    : job.status
                          }
                        </Badge>
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span className="text-green-600">✓ {job.successful_orders || 0}</span>
                        <span className="text-destructive">✗ {job.failed_orders || 0}</span>
                        <span>⊘ {job.skipped_orders || 0}</span>
                        <span className="ml-auto">
                          {new Date(job.created_at).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) setSelectedHistoryJob(null);
      }}>
        <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {language === 'ar' ? 'تفاصيل المزامنة في الخلفية' : 'Background Sync Details'}
              {(selectedHistoryJob || activeJob) && (
                <Badge variant="outline" className="ml-2">
                  {(selectedHistoryJob || activeJob)?.from_date} → {(selectedHistoryJob || activeJob)?.to_date}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Summary Cards - Calculate from syncDetails */}
          {(() => {
            const currentJob = selectedHistoryJob || activeJob;
            const successCount = syncDetails.filter(d => d.sync_status === 'success').length;
            const failedCount = syncDetails.filter(d => d.sync_status === 'failed').length;
            const skippedCount = syncDetails.filter(d => d.sync_status === 'skipped').length;
            const totalCount = syncDetails.length || currentJob?.total_orders || 0;
            
            return (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold">{totalCount}</div>
                    <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الإجمالي' : 'Total'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-green-500">{successCount}</div>
                    <div className="text-xs text-muted-foreground">{language === 'ar' ? 'نجح' : 'Success'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-destructive">{failedCount}</div>
                    <div className="text-xs text-muted-foreground">{language === 'ar' ? 'فشل' : 'Failed'}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-xl font-bold text-muted-foreground">{skippedCount}</div>
                    <div className="text-xs text-muted-foreground">{language === 'ar' ? 'تخطي' : 'Skipped'}</div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Details Table */}
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : syncDetails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isRunning 
                ? (language === 'ar' ? 'جاري المعالجة... سيتم تحديث التفاصيل تلقائياً' : 'Processing... Details will update automatically')
                : (language === 'ar' ? 'لا توجد تفاصيل متاحة' : 'No details available')
              }
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الهاتف' : 'Phone'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المنتجات' : 'Products'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'العميل' : 'Cust'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'علامة' : 'Brand'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'منتج' : 'Prod'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'طلب' : 'Order'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'شراء' : 'Purch'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الخطأ' : 'Error'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncDetails.map((detail) => (
                    <TableRow 
                      key={detail.id}
                      className={
                        detail.sync_status === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                        detail.sync_status === 'failed' ? 'bg-red-50 dark:bg-red-950/20' : ''
                      }
                    >
                      <TableCell className="font-mono text-xs">{detail.order_number}</TableCell>
                      <TableCell className="text-xs">{detail.order_date || '-'}</TableCell>
                      <TableCell className="text-xs">{detail.customer_phone || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[100px] truncate" title={detail.product_names || ''}>
                        {detail.product_names?.split(', ').slice(0, 2).join(', ') || '-'}
                      </TableCell>
                      <TableCell className="text-xs">{detail.total_amount?.toFixed(2) || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getStatusBadge(detail.sync_status)}
                          {detail.sync_status === 'failed' && detail.error_message ? (
                            <div className="text-xs text-destructive whitespace-normal break-words">
                              {detail.error_message}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getStepIcon(detail.step_customer)}</TableCell>
                      <TableCell className="text-center">{getStepIcon(detail.step_brand)}</TableCell>
                      <TableCell className="text-center">{getStepIcon(detail.step_product)}</TableCell>
                      <TableCell className="text-center">{getStepIcon(detail.step_order)}</TableCell>
                      <TableCell className="text-center">{getStepIcon(detail.step_purchase)}</TableCell>
                      <TableCell className="text-xs whitespace-normal break-words max-w-[260px]">
                        {detail.error_message || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {detail.sync_status === 'failed' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-primary hover:text-primary/80"
                            onClick={() => handleRetrySync(detail)}
                            disabled={retryingOrderId === detail.id}
                            title={language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                          >
                            {retryingOrderId === detail.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        ) : detail.sync_status === 'processing' ? (
                          <Loader2 className="h-3 w-3 animate-spin text-primary mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Refresh button for running jobs or history view */}
          {(isRunning || selectedHistoryJob) && (
            <div className="flex justify-center mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const targetJob = selectedHistoryJob || activeJob;
                  if (targetJob) fetchSyncDetails(targetJob.id);
                }}
                disabled={loadingDetails}
              >
                {loadingDetails ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                {language === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
