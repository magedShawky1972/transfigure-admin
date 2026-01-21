import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Database, FileText, Calendar, XCircle, CheckCircle } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

interface BackgroundJob {
  id: string;
  job_type: string;
  status: string;
  from_date_int: number | null;
  to_date_int: number | null;
  total_records: number;
  processed_records: number;
  updated_records: number;
  error_records: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

const UpdateBankLedger = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const { hasAccess, isLoading: accessLoading } = usePageAccess();
  
  const [updatingHyperpay, setUpdatingHyperpay] = useState(false);
  const [showPaymentRefDialog, setShowPaymentRefDialog] = useState(false);
  const [showHyperpayDialog, setShowHyperpayDialog] = useState(false);
  
  // Background job state
  const [activeJob, setActiveJob] = useState<BackgroundJob | null>(null);
  
  // Date filter
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [lastResult, setLastResult] = useState<{
    type: string;
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Fetch active job on mount
  useEffect(() => {
    fetchActiveJob();
  }, []);

  // Subscribe to realtime updates for job progress
  useEffect(() => {
    if (!activeJob) return;

    const channel = supabase
      .channel('bank_ledger_job_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bank_ledger_update_jobs',
          filter: `id=eq.${activeJob.id}`
        },
        (payload) => {
          const updatedJob = payload.new as BackgroundJob;
          setActiveJob(updatedJob);
          
          if (updatedJob.status === 'completed') {
            toast.success(isRTL ? 'تم إكمال التحديث بنجاح' : 'Update completed successfully');
            setLastResult({
              type: 'paymentRef',
              success: true,
              message: isRTL 
                ? `تم تحديث ${updatedJob.updated_records} سجل بنجاح${updatedJob.error_records > 0 ? ` (${updatedJob.error_records} أخطاء)` : ''}`
                : `Successfully updated ${updatedJob.updated_records} records${updatedJob.error_records > 0 ? ` (${updatedJob.error_records} errors)` : ''}`,
              details: {
                totalProcessed: updatedJob.processed_records,
                updated: updatedJob.updated_records,
                errors: updatedJob.error_records
              }
            });
          } else if (updatedJob.status === 'failed') {
            toast.error(updatedJob.error_message || (isRTL ? 'فشل التحديث' : 'Update failed'));
          } else if (updatedJob.status === 'cancelled') {
            toast.info(isRTL ? 'تم إلغاء المهمة' : 'Job cancelled');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeJob?.id, isRTL]);

  const fetchActiveJob = async () => {
    const { data, error } = await supabase
      .from('bank_ledger_update_jobs')
      .select('*')
      .eq('job_type', 'payment_reference')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setActiveJob(data as BackgroundJob);
    }
  };

  // Access control
  if (accessLoading || hasAccess === null) return <AccessDenied isLoading={true} />;
  if (hasAccess === false) return <AccessDenied />;

  // Convert date string to int format (YYYYMMDD)
  const dateToInt = (dateStr: string): number | null => {
    if (!dateStr) return null;
    return parseInt(dateStr.replace(/-/g, ''), 10);
  };

  const handleStartBackgroundJob = async () => {
    setShowPaymentRefDialog(false);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(isRTL ? 'يجب تسجيل الدخول' : 'Must be logged in');
        return;
      }

      const { data, error } = await supabase.functions.invoke('update-bank-ledger-background', {
        body: {
          action: 'start',
          fromDateInt: dateToInt(fromDate),
          toDateInt: dateToInt(toDate),
          userId: user.id
        }
      });

      if (error) throw error;

      if (data?.success && data?.jobId) {
        toast.success(isRTL ? 'تم بدء المهمة في الخلفية' : 'Background job started');
        // Fetch the new job
        const { data: job } = await supabase
          .from('bank_ledger_update_jobs')
          .select('*')
          .eq('id', data.jobId)
          .single();
        
        if (job) {
          setActiveJob(job as BackgroundJob);
        }
      } else {
        throw new Error(data?.error || 'Unknown error');
      }

    } catch (error) {
      console.error('Error starting background job:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء بدء المهمة' : 'Error starting job');
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;

    try {
      const { data, error } = await supabase.functions.invoke('update-bank-ledger-background', {
        body: {
          action: 'cancel',
          jobId: activeJob.id
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.info(isRTL ? 'جاري إلغاء المهمة...' : 'Cancelling job...');
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
      toast.error(isRTL ? 'حدث خطأ أثناء إلغاء المهمة' : 'Error cancelling job');
    }
  };

  const handleDismissJob = () => {
    setActiveJob(null);
  };

  const handleUpdateHyperpayFields = async () => {
    setUpdatingHyperpay(true);
    setShowHyperpayDialog(false);
    setLastResult(null);

    try {
      // Call the edge function for batch migration
      const { data, error } = await supabase.functions.invoke('migrate-bank-ledger-hyperpay', {
        body: { batchSize: 1000, maxBatches: 100 }
      });

      if (error) throw error;

      setLastResult({
        type: 'hyperpay',
        success: data?.success || false,
        message: data?.message || (isRTL ? 'تم التحديث' : 'Update completed'),
        details: data
      });

      if (data?.success) {
        toast.success(isRTL ? 'تم تحديث بيانات HyperPay بنجاح' : 'HyperPay data updated successfully');
      } else {
        toast.error(data?.error || (isRTL ? 'حدث خطأ' : 'An error occurred'));
      }

    } catch (error) {
      console.error('Error updating hyperpay fields:', error);
      setLastResult({
        type: 'hyperpay',
        success: false,
        message: isRTL ? 'حدث خطأ أثناء التحديث' : 'Error during update'
      });
      toast.error(isRTL ? 'حدث خطأ أثناء التحديث' : 'Error during update');
    } finally {
      setUpdatingHyperpay(false);
    }
  };

  const isJobRunning = activeJob && ['pending', 'running'].includes(activeJob.status);
  const progressPercentage = activeJob && activeJob.total_records > 0 
    ? (activeJob.processed_records / activeJob.total_records) * 100 
    : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{isRTL ? 'قيد الانتظار' : 'Pending'}</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">{isRTL ? 'قيد التشغيل' : 'Running'}</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">{isRTL ? 'مكتمل' : 'Completed'}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{isRTL ? 'فشل' : 'Failed'}</Badge>;
      case 'cancelled':
        return <Badge variant="outline">{isRTL ? 'ملغي' : 'Cancelled'}</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className={`container mx-auto p-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {isRTL ? 'تحديث سجل البنك' : 'Update Bank Ledger'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isRTL 
            ? 'تحديث بيانات سجل البنك من جداول الدفع والمعاملات'
            : 'Update bank ledger data from payment and transaction tables'}
        </p>
      </div>

      {/* Active Background Job Status Card */}
      {activeJob && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                {isJobRunning ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : activeJob.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                {isRTL ? 'مهمة تحديث مرجع الدفع' : 'Payment Reference Update Job'}
              </CardTitle>
              {getStatusBadge(activeJob.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            {activeJob.total_records > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'التقدم' : 'Progress'}</span>
                  <span className="font-medium">
                    {activeJob.processed_records.toLocaleString()} / {activeJob.total_records.toLocaleString()}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progressPercentage.toFixed(1)}%</span>
                  <span>
                    {isRTL ? 'محدث:' : 'Updated:'} {activeJob.updated_records.toLocaleString()}
                    {activeJob.error_records > 0 && (
                      <span className="text-red-500 ml-2">
                        {isRTL ? 'أخطاء:' : 'Errors:'} {activeJob.error_records}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Date Range Info */}
            {(activeJob.from_date_int || activeJob.to_date_int) && (
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'نطاق التاريخ:' : 'Date Range:'} {activeJob.from_date_int || 'Start'} - {activeJob.to_date_int || 'End'}
              </p>
            )}

            {/* Error Message */}
            {activeJob.error_message && (
              <p className="text-sm text-red-500">{activeJob.error_message}</p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isJobRunning && (
                <Button variant="destructive" size="sm" onClick={handleCancelJob}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Button>
              )}
              {!isJobRunning && (
                <Button variant="outline" size="sm" onClick={handleDismissJob}>
                  {isRTL ? 'إخفاء' : 'Dismiss'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Update Payment Reference Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {isRTL ? 'تحديث مرجع الدفع' : 'Update Payment Reference'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'تحديث حقل paymentrefrence في bank_ledger من جدول order_payment (يعمل في الخلفية)'
                : 'Update paymentrefrence field in bank_ledger from order_payment table (runs in background)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? 'يقوم هذا الإجراء بربط bank_ledger.reference_number مع order_payment.ordernumber وتحديث paymentrefrence. يستمر العمل حتى لو أغلقت الصفحة.'
                : 'This action links bank_ledger.reference_number with order_payment.ordernumber and updates paymentrefrence. Work continues even if you close the page.'}
            </p>
            
            {/* Date Filter */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromDate" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {isRTL ? 'من تاريخ' : 'From Date'}
                </Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={isJobRunning}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {isRTL ? 'إلى تاريخ' : 'To Date'}
                </Label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={isJobRunning}
                />
              </div>
            </div>

            <Button 
              onClick={() => setShowPaymentRefDialog(true)}
              disabled={isJobRunning || updatingHyperpay}
              className="w-full"
            >
              {isJobRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isRTL ? 'جاري التحديث...' : 'Updating...'}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isRTL ? 'تحديث مرجع الدفع (خلفية)' : 'Update Payment Reference (Background)'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Update HyperPay Fields Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              {isRTL ? 'تحديث بيانات HyperPay' : 'Update HyperPay Data'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'تحديث الحقول من hyberpaystatement إلى bank_ledger'
                : 'Update fields from hyberpaystatement to bank_ledger'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {isRTL 
                ? 'يقوم هذا الإجراء بتحديث: transactionid, transaction_receipt, result, customercountry, riskfrauddescription, clearinginstitutename'
                : 'This action updates: transactionid, transaction_receipt, result, customercountry, riskfrauddescription, clearinginstitutename'}
            </p>
            <Button 
              onClick={() => setShowHyperpayDialog(true)}
              disabled={isJobRunning || updatingHyperpay}
              className="w-full"
              variant="secondary"
            >
              {updatingHyperpay ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isRTL ? 'جاري التحديث...' : 'Updating...'}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isRTL ? 'تحديث بيانات HyperPay' : 'Update HyperPay Data'}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Last Result Display */}
      {lastResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className={lastResult.success ? 'text-green-600' : 'text-red-600'}>
              {lastResult.success 
                ? (isRTL ? 'نتيجة العملية - نجاح' : 'Operation Result - Success')
                : (isRTL ? 'نتيجة العملية - فشل' : 'Operation Result - Failed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2">{lastResult.message}</p>
            {lastResult.details && (
              <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-48" dir="ltr">
                {JSON.stringify(lastResult.details, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialogs */}
      <AlertDialog open={showPaymentRefDialog} onOpenChange={setShowPaymentRefDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'تأكيد تحديث مرجع الدفع (خلفية)' : 'Confirm Payment Reference Update (Background)'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? `سيتم تشغيل هذه المهمة في الخلفية ويمكنك إغلاق الصفحة. ${fromDate || toDate ? `(التاريخ: ${fromDate || 'البداية'} - ${toDate || 'النهاية'})` : '(جميع السجلات)'}`
                : `This job will run in the background and you can close the page. ${fromDate || toDate ? `(Date: ${fromDate || 'Start'} - ${toDate || 'End'})` : '(All records)'}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartBackgroundJob}>
              {isRTL ? 'بدء المهمة' : 'Start Job'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showHyperpayDialog} onOpenChange={setShowHyperpayDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? 'تأكيد تحديث بيانات HyperPay' : 'Confirm HyperPay Data Update'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? 'هل أنت متأكد من تحديث جميع سجلات bank_ledger ببيانات من hyberpaystatement؟'
                : 'Are you sure you want to update all bank_ledger records with data from hyberpaystatement?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateHyperpayFields}>
              {isRTL ? 'تأكيد' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UpdateBankLedger;
