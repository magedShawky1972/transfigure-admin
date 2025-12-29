import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Eye, X, StopCircle } from "lucide-react";
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
}

interface SyncDetail {
  id: string;
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
}

export const BackgroundSyncStatusCard = () => {
  const { language } = useLanguage();
  const [activeJob, setActiveJob] = useState<BackgroundJob | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [syncDetails, setSyncDetails] = useState<SyncDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showCompletedJob, setShowCompletedJob] = useState(false);

  useEffect(() => {
    // Fetch active/recent job
    const fetchActiveJob = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data, error } = await supabase
        .from('background_sync_jobs')
        .select('*')
        .eq('user_id', user.user.id)
        .in('status', ['pending', 'running'])
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
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const job = payload.new as BackgroundJob;
            if (job.status === 'pending' || job.status === 'running') {
              setActiveJob(job);
              setShowCompletedJob(false);
            } else if (activeJob?.id === job.id) {
              // Job completed - show for a while then allow dismissing
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
  }, [activeJob?.id]);

  // Fetch sync details for the job
  const fetchSyncDetails = async (jobId: string) => {
    setLoadingDetails(true);
    try {
      // First, get the sync run that matches this job
      const { data: job } = await supabase
        .from('background_sync_jobs')
        .select('from_date, to_date, started_at')
        .eq('id', jobId)
        .single();

      if (!job) return;

      // Get the matching sync run
      const { data: run } = await supabase
        .from('odoo_sync_runs')
        .select('id')
        .eq('from_date', job.from_date)
        .eq('to_date', job.to_date)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (run?.id) {
        const { data: details } = await supabase
          .from('odoo_sync_run_details')
          .select('*')
          .eq('run_id', run.id)
          .order('created_at', { ascending: true });

        setSyncDetails((details as SyncDetail[]) || []);
      }
    } catch (error) {
      console.error('Error fetching sync details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleViewDetails = () => {
    if (activeJob) {
      fetchSyncDetails(activeJob.id);
      setShowDetailsDialog(true);
    }
  };

  const [stopping, setStopping] = useState(false);

  const handleDismiss = () => {
    setActiveJob(null);
    setShowCompletedJob(false);
  };

  const handleStopSync = async () => {
    if (!activeJob || stopping) return;
    
    setStopping(true);
    try {
      const { error } = await supabase
        .from('background_sync_jobs')
        .update({ status: 'cancelled' })
        .eq('id', activeJob.id);

      if (error) throw error;
      
      toast.success(language === 'ar' ? 'تم إيقاف المزامنة' : 'Sync stopped successfully');
      setActiveJob({ ...activeJob, status: 'cancelled' });
    } catch (error) {
      console.error('Error stopping sync:', error);
      toast.error(language === 'ar' ? 'فشل إيقاف المزامنة' : 'Failed to stop sync');
    } finally {
      setStopping(false);
    }
  };

  if (!activeJob) return null;

  const progress = activeJob.total_orders > 0 
    ? Math.round((activeJob.processed_orders / activeJob.total_orders) * 100) 
    : 0;

  const isRunning = activeJob.status === 'running' || activeJob.status === 'pending';
  const isCompleted = activeJob.status === 'completed';
  const isFailed = activeJob.status === 'failed';
  const isCancelled = activeJob.status === 'cancelled';

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
              {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
              {isCancelled && <StopCircle className="h-4 w-4 text-orange-500" />}
              <span className="font-medium">
                {language === 'ar' ? 'مزامنة Odoo في الخلفية' : 'Background Odoo Sync'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isRunning ? 'default' : isCompleted ? 'secondary' : isCancelled ? 'outline' : 'destructive'}>
                {isRunning 
                  ? (language === 'ar' ? 'جاري التشغيل' : 'Running')
                  : isCompleted 
                    ? (language === 'ar' ? 'مكتمل' : 'Completed')
                    : isCancelled
                      ? (language === 'ar' ? 'تم الإيقاف' : 'Stopped')
                      : (language === 'ar' ? 'فشل' : 'Failed')
                }
              </Badge>
              {isRunning && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-orange-500 hover:text-orange-600 hover:bg-orange-100" 
                  onClick={handleStopSync}
                  disabled={stopping}
                  title={language === 'ar' ? 'إيقاف المزامنة' : 'Stop Sync'}
                >
                  {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                </Button>
              )}
              {(showCompletedJob || isCancelled) && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-2">
            {activeJob.from_date} → {activeJob.to_date}
          </div>

          {isRunning && (
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
              {activeJob.current_order_number && (
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

          <div className="mt-3">
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={handleViewDetails}>
              <Eye className="h-3 w-3" />
              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تفاصيل المزامنة في الخلفية' : 'Background Sync Details'}
            </DialogTitle>
          </DialogHeader>

          {/* Summary Cards - Calculate from syncDetails */}
          {(() => {
            const successCount = syncDetails.filter(d => d.sync_status === 'success').length;
            const failedCount = syncDetails.filter(d => d.sync_status === 'failed').length;
            const skippedCount = syncDetails.filter(d => d.sync_status === 'skipped').length;
            const totalCount = syncDetails.length || activeJob.total_orders;
            
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Refresh button for running jobs */}
          {isRunning && (
            <div className="flex justify-center mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchSyncDetails(activeJob.id)}
                disabled={loadingDetails}
              >
                {loadingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {language === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
