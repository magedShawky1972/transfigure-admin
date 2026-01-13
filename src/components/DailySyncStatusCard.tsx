import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Eye, X, Pause, Play, StopCircle, Trash2, Calendar, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface DayStatus {
  date: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  skipped_orders: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

interface DailyJob {
  id: string;
  from_date: string;
  to_date: string;
  status: string;
  total_days: number;
  completed_days: number;
  failed_days: number;
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  skipped_orders: number;
  current_day: string | null;
  day_statuses: Record<string, DayStatus>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  user_email: string;
  user_name: string;
  user_id: string;
  error_message?: string | null;
}

export const DailySyncStatusCard = () => {
  const { language } = useLanguage();
  const [activeJob, setActiveJob] = useState<DailyJob | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCompletedJob, setShowCompletedJob] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Fetch active/recent job
    const fetchActiveJob = async () => {
      if (isDeleted) return;
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data, error } = await supabase
        .from('daily_sync_jobs')
        .select('*')
        .eq('user_id', user.user.id)
        .in('status', ['pending', 'running', 'paused', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setActiveJob(data as unknown as DailyJob);
      }
    };

    fetchActiveJob();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('daily_sync_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_sync_jobs',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setActiveJob(null);
            setIsDeleted(true);
            return;
          }
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setIsDeleted(false);
            const job = payload.new as unknown as DailyJob;
            if (job.status === 'pending' || job.status === 'running') {
              setActiveJob(job);
              setShowCompletedJob(false);
            } else if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
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

  const handleDismiss = () => {
    setActiveJob(null);
    setShowCompletedJob(false);
  };

  const handleDeleteJob = async () => {
    if (!activeJob || actionLoading) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('daily_sync_jobs')
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
        .from('daily_sync_jobs')
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
      const { error: updateError } = await supabase
        .from('daily_sync_jobs')
        .update({ status: 'running' })
        .eq('id', activeJob.id);

      if (updateError) throw updateError;

      const { error: fnError } = await supabase.functions.invoke('sync-orders-daily-background', {
        body: {
          jobId: activeJob.id,
          fromDate: activeJob.from_date,
          toDate: activeJob.to_date,
          userId: activeJob.user_id,
          userEmail: activeJob.user_email,
          userName: activeJob.user_name,
          resumeFromDay: activeJob.current_day,
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

  const handleStopSync = async () => {
    if (!activeJob || actionLoading) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('daily_sync_jobs')
        .update({ status: 'cancelled' })
        .eq('id', activeJob.id);

      if (error) throw error;
      
      toast.success(language === 'ar' ? 'تم إيقاف المزامنة' : 'Sync stopped');
      setActiveJob({ ...activeJob, status: 'cancelled' });
    } catch (error) {
      console.error('Error stopping sync:', error);
      toast.error(language === 'ar' ? 'فشل إيقاف المزامنة' : 'Failed to stop sync');
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeJob) return null;

  const progress = activeJob.total_days > 0 
    ? Math.round((activeJob.completed_days / activeJob.total_days) * 100) 
    : 0;

  const isRunning = activeJob.status === 'running' || activeJob.status === 'pending';
  const isPaused = activeJob.status === 'paused';
  const isCancelled = activeJob.status === 'cancelled';
  const isCompleted = activeJob.status === 'completed';
  const isFailed = activeJob.status === 'failed';

  const dayStatuses = activeJob.day_statuses ? Object.values(activeJob.day_statuses) : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 gap-1"><CheckCircle2 className="h-3 w-3" />{language === 'ar' ? 'مكتمل' : 'Completed'}</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{language === 'ar' ? 'فشل' : 'Failed'}</Badge>;
      case 'running':
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />{language === 'ar' ? 'جاري' : 'Running'}</Badge>;
      case 'pending':
        return <Badge variant="outline">{language === 'ar' ? 'في الانتظار' : 'Pending'}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {isPaused && <Pause className="h-4 w-4 text-orange-500" />}
              {isCancelled && <StopCircle className="h-4 w-4 text-orange-500" />}
              {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
              <CalendarDays className="h-4 w-4 text-blue-500" />
              <span className="font-medium">
                {language === 'ar' ? 'مزامنة يومية لـ Odoo' : 'Daily Odoo Sync'}
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
                    onClick={handleStopSync}
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
            {activeJob.from_date} → {activeJob.to_date} ({activeJob.total_days} {language === 'ar' ? 'يوم' : 'days'})
          </div>

          {(isRunning || isPaused) && (
            <>
              <Progress value={progress} className="h-2 mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {language === 'ar' 
                    ? `${activeJob.completed_days} من ${activeJob.total_days} يوم`
                    : `${activeJob.completed_days} of ${activeJob.total_days} days`
                  }
                </span>
                <span>{progress}%</span>
              </div>
              {activeJob.current_day && isRunning && (
                <div className="text-xs text-muted-foreground mt-1">
                  {language === 'ar' ? 'اليوم الحالي: ' : 'Current day: '}
                  {activeJob.current_day}
                </div>
              )}
            </>
          )}

          {(isCompleted || isFailed || isCancelled) && (
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">
                ✓ {activeJob.successful_orders || 0}
              </span>
              {(activeJob.failed_orders || 0) > 0 && (
                <span className="text-destructive">
                  ✗ {activeJob.failed_orders}
                </span>
              )}
              {(activeJob.skipped_orders || 0) > 0 && (
                <span className="text-muted-foreground">
                  ⊘ {activeJob.skipped_orders}
                </span>
              )}
            </div>
          )}

          <div className="mt-3">
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowDetailsDialog(true)}>
              <Eye className="h-3 w-3" />
              {language === 'ar' ? 'عرض تقرير الأيام' : 'View Daily Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Report Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-500" />
              {language === 'ar' ? 'تقرير المزامنة اليومية' : 'Daily Sync Report'}
              <Badge variant="outline" className="ml-2">
                {activeJob.from_date} → {activeJob.to_date}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">{language === 'ar' ? 'إجمالي الأيام' : 'Total Days'}</div>
              <div className="text-2xl font-bold">{activeJob.total_days}</div>
            </Card>
            <Card className="p-3 border-green-500/50">
              <div className="text-xs text-muted-foreground">{language === 'ar' ? 'أيام مكتملة' : 'Completed Days'}</div>
              <div className="text-2xl font-bold text-green-600">{activeJob.completed_days}</div>
            </Card>
            <Card className="p-3 border-destructive/50">
              <div className="text-xs text-muted-foreground">{language === 'ar' ? 'أيام فاشلة' : 'Failed Days'}</div>
              <div className="text-2xl font-bold text-destructive">{activeJob.failed_days}</div>
            </Card>
            <Card className="p-3">
              <div className="text-xs text-muted-foreground">{language === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}</div>
              <div className="text-2xl font-bold">{activeJob.total_orders || 0}</div>
            </Card>
          </div>

          {/* Orders Summary */}
          <div className="flex gap-4 mb-4 text-sm">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {language === 'ar' ? 'نجاح: ' : 'Success: '}{activeJob.successful_orders || 0}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-destructive" />
              {language === 'ar' ? 'فشل: ' : 'Failed: '}{activeJob.failed_orders || 0}
            </span>
            <span className="text-muted-foreground">
              {language === 'ar' ? 'تخطي: ' : 'Skipped: '}{activeJob.skipped_orders || 0}
            </span>
          </div>

          {/* Daily Breakdown Table */}
          <ScrollArea className="h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'نجح' : 'Success'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'فشل' : 'Failed'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'تخطي' : 'Skipped'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayStatuses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                    </TableCell>
                  </TableRow>
                ) : (
                  dayStatuses.sort((a, b) => a.date.localeCompare(b.date)).map((day) => (
                    <TableRow key={day.date} className={day.status === 'running' ? 'bg-blue-50 dark:bg-blue-950/20' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {day.date}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(day.status)}</TableCell>
                      <TableCell className="text-center">{day.total_orders}</TableCell>
                      <TableCell className="text-center text-green-600">{day.successful_orders}</TableCell>
                      <TableCell className="text-center text-destructive">{day.failed_orders}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{day.skipped_orders}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
