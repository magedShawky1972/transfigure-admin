import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Database, FileText, Calendar } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

const UpdateBankLedger = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const { hasAccess, isLoading: accessLoading } = usePageAccess();
  
  const [updatingPaymentRef, setUpdatingPaymentRef] = useState(false);
  const [updatingHyperpay, setUpdatingHyperpay] = useState(false);
  const [showPaymentRefDialog, setShowPaymentRefDialog] = useState(false);
  const [showHyperpayDialog, setShowHyperpayDialog] = useState(false);
  
  // Progress tracking
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  // Date filter
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [lastResult, setLastResult] = useState<{
    type: string;
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Access control
  if (accessLoading || hasAccess === null) return <AccessDenied isLoading={true} />;
  if (hasAccess === false) return <AccessDenied />;

  // Convert date string to int format (YYYYMMDD)
  const dateToInt = (dateStr: string): number | null => {
    if (!dateStr) return null;
    return parseInt(dateStr.replace(/-/g, ''), 10);
  };

  const handleUpdatePaymentReference = async () => {
    setUpdatingPaymentRef(true);
    setShowPaymentRefDialog(false);
    setLastResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      // Build query with optional date filter
      let query = supabase
        .from('order_payment')
        .select('ordernumber, paymentrefrence, created_at_int', { count: 'exact' })
        .not('paymentrefrence', 'is', null)
        .not('ordernumber', 'is', null);

      const fromInt = dateToInt(fromDate);
      const toInt = dateToInt(toDate);

      if (fromInt) {
        query = query.gte('created_at_int', fromInt);
      }
      if (toInt) {
        query = query.lte('created_at_int', toInt);
      }

      // First get total count
      const { count, error: countError } = await query;
      
      if (countError) throw countError;

      if (!count || count === 0) {
        setLastResult({
          type: 'paymentRef',
          success: true,
          message: isRTL ? 'لا توجد سجلات للتحديث' : 'No records to update'
        });
        setUpdatingPaymentRef(false);
        return;
      }

      setProgress({ current: 0, total: count });

      let updated = 0;
      let errors = 0;
      const batchSize = 1000;
      let offset = 0;

      // Process all records in batches
      while (offset < count) {
        // Fetch batch
        let batchQuery = supabase
          .from('order_payment')
          .select('ordernumber, paymentrefrence')
          .not('paymentrefrence', 'is', null)
          .not('ordernumber', 'is', null)
          .range(offset, offset + batchSize - 1);

        if (fromInt) {
          batchQuery = batchQuery.gte('created_at_int', fromInt);
        }
        if (toInt) {
          batchQuery = batchQuery.lte('created_at_int', toInt);
        }

        const { data: orderPayments, error: opError } = await batchQuery;

        if (opError) throw opError;

        if (!orderPayments || orderPayments.length === 0) break;

        // Process each record in the batch
        for (const op of orderPayments) {
          const { error: updateError } = await supabase
            .from('bank_ledger')
            .update({ paymentrefrence: op.paymentrefrence })
            .eq('reference_number', op.ordernumber);

          if (updateError) {
            console.error(`Error updating bank_ledger for order ${op.ordernumber}:`, updateError);
            errors++;
          } else {
            updated++;
          }

          // Update progress
          setProgress(prev => ({ ...prev, current: updated + errors }));
        }

        offset += batchSize;
      }

      setLastResult({
        type: 'paymentRef',
        success: true,
        message: isRTL 
          ? `تم تحديث ${updated} سجل بنجاح${errors > 0 ? ` (${errors} أخطاء)` : ''}`
          : `Successfully updated ${updated} records${errors > 0 ? ` (${errors} errors)` : ''}`,
        details: { totalProcessed: count, updated, errors }
      });

      toast.success(isRTL ? 'تم تحديث مرجع الدفع بنجاح' : 'Payment reference updated successfully');

    } catch (error) {
      console.error('Error updating payment reference:', error);
      setLastResult({
        type: 'paymentRef',
        success: false,
        message: isRTL ? 'حدث خطأ أثناء التحديث' : 'Error during update'
      });
      toast.error(isRTL ? 'حدث خطأ أثناء التحديث' : 'Error during update');
    } finally {
      setUpdatingPaymentRef(false);
    }
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

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

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
                ? 'تحديث حقل paymentrefrence في bank_ledger من جدول order_payment'
                : 'Update paymentrefrence field in bank_ledger from order_payment table'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? 'يقوم هذا الإجراء بربط bank_ledger.reference_number مع order_payment.ordernumber وتحديث paymentrefrence'
                : 'This action links bank_ledger.reference_number with order_payment.ordernumber and updates paymentrefrence'}
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
                  disabled={updatingPaymentRef}
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
                  disabled={updatingPaymentRef}
                />
              </div>
            </div>

            {/* Progress Bar */}
            {updatingPaymentRef && progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{isRTL ? 'التقدم' : 'Progress'}</span>
                  <span className="font-medium">
                    {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {progressPercentage.toFixed(1)}%
                </p>
              </div>
            )}

            <Button 
              onClick={() => setShowPaymentRefDialog(true)}
              disabled={updatingPaymentRef || updatingHyperpay}
              className="w-full"
            >
              {updatingPaymentRef ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isRTL ? 'جاري التحديث...' : 'Updating...'}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isRTL ? 'تحديث مرجع الدفع' : 'Update Payment Reference'}
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
              disabled={updatingPaymentRef || updatingHyperpay}
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
              {isRTL ? 'تأكيد تحديث مرجع الدفع' : 'Confirm Payment Reference Update'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL 
                ? `هل أنت متأكد من تحديث سجلات bank_ledger بمراجع الدفع من order_payment؟${fromDate || toDate ? ` (التاريخ: ${fromDate || 'البداية'} - ${toDate || 'النهاية'})` : ' (جميع السجلات)'}`
                : `Are you sure you want to update bank_ledger records with payment references from order_payment?${fromDate || toDate ? ` (Date: ${fromDate || 'Start'} - ${toDate || 'End'})` : ' (All records)'}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdatePaymentReference}>
              {isRTL ? 'تأكيد' : 'Confirm'}
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
