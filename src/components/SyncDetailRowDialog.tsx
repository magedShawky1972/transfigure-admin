import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Package } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface SyncDetailRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  orderDate: string | null;
  customerPhone: string | null;
  productNames: string | null;
  totalAmount: number | null;
  syncStatus: string;
  errorMessage: string | null;
  stepCustomer: string | null;
  stepBrand: string | null;
  stepProduct: string | null;
  stepOrder: string | null;
  stepPurchase: string | null;
  paymentMethod: string | null;
  paymentBrand: string | null;
}

interface TransactionLine {
  id: string;
  product_name: string | null;
  brand_name: string | null;
  product_id: string | null;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  product_sku?: string | null;
  has_sku: boolean;
}

export const SyncDetailRowDialog = ({
  open,
  onOpenChange,
  orderNumber,
  orderDate,
  customerPhone,
  productNames,
  totalAmount,
  syncStatus,
  errorMessage,
  stepCustomer,
  stepBrand,
  stepProduct,
  stepOrder,
  stepPurchase,
  paymentMethod,
  paymentBrand,
}: SyncDetailRowDialogProps) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [transactionLines, setTransactionLines] = useState<TransactionLine[]>([]);

  useEffect(() => {
    if (open && orderNumber) {
      fetchTransactionLines();
    }
  }, [open, orderNumber]);

  const fetchTransactionLines = async () => {
    setLoading(true);
    try {
      // Fetch from purpletransaction - this is the main table with product lines
      const { data: purpleData, error: purpleError } = await supabase
        .from('purpletransaction')
        .select('id, product_name, brand_name, product_id, qty, unit_price, total')
        .eq('order_number', orderNumber);

      if (!purpleError && purpleData && purpleData.length > 0) {
        // Get all product SKUs to check which have SKU
        const productNames = purpleData
          .map(p => p.product_name)
          .filter((name): name is string => Boolean(name));
        
        let skuMap = new Map<string, string>();
        
        if (productNames.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('product_name, sku')
            .in('product_name', productNames);

          productsData?.forEach(p => {
            if (p.sku && p.product_name) skuMap.set(p.product_name, p.sku);
          });
        }

        setTransactionLines(purpleData.map(t => ({
          id: t.id,
          product_name: t.product_name,
          brand_name: t.brand_name,
          product_id: t.product_id,
          qty: t.qty,
          unit_price: t.unit_price,
          total: t.total,
          product_sku: t.product_name ? skuMap.get(t.product_name) || null : null,
          has_sku: t.product_name ? skuMap.has(t.product_name) : false,
        })));
      } else {
        setTransactionLines([]);
      }
    } catch (error) {
      console.error('Error fetching transaction lines:', error);
      setTransactionLines([]);
    } finally {
      setLoading(false);
    }
  };

  const getStepBadge = (step: string | null, label: string) => {
    if (!step) return null;
    
    const isSuccess = step === 'found' || step === 'created' || step === 'sent';
    const isFailed = step === 'failed';
    const isSkipped = step === 'skipped';

    return (
      <div className="flex items-center gap-1">
        {isSuccess && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        {isFailed && <XCircle className="h-3 w-3 text-destructive" />}
        {isSkipped && <span className="text-muted-foreground">-</span>}
        <span className="text-xs">{label}: {step}</span>
      </div>
    );
  };

  const missingSkuCount = transactionLines.filter(t => !t.has_sku).length;
  const hasSkuCount = transactionLines.filter(t => t.has_sku).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'}: {orderNumber}
          </DialogTitle>
        </DialogHeader>

        {/* Order Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-muted/50 p-2 rounded">
            <div className="text-xs text-muted-foreground">{language === 'ar' ? 'التاريخ' : 'Date'}</div>
            <div className="font-medium text-sm">{orderDate || '-'}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الهاتف' : 'Phone'}</div>
            <div className="font-medium text-sm">{customerPhone || '-'}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <div className="text-xs text-muted-foreground">{language === 'ar' ? 'المبلغ' : 'Amount'}</div>
            <div className="font-medium text-sm">{totalAmount?.toFixed(2) || '-'}</div>
          </div>
          <div className="bg-muted/50 p-2 rounded">
            <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</div>
            <Badge 
              variant={syncStatus === 'success' ? 'default' : syncStatus === 'failed' ? 'destructive' : 'secondary'}
              className={syncStatus === 'success' ? 'bg-green-500' : ''}
            >
              {syncStatus === 'success' 
                ? (language === 'ar' ? 'نجح' : 'Success')
                : syncStatus === 'failed'
                  ? (language === 'ar' ? 'فشل' : 'Failed')
                  : syncStatus === 'skipped'
                    ? (language === 'ar' ? 'تخطي' : 'Skipped')
                    : syncStatus
              }
            </Badge>
          </div>
        </div>

        {/* Payment Info */}
        {(paymentMethod || paymentBrand) && (
          <div className="flex gap-4 mb-4 text-sm">
            {paymentMethod && (
              <div>
                <span className="text-muted-foreground">{language === 'ar' ? 'طريقة الدفع:' : 'Payment:'}</span>{' '}
                <Badge variant="outline">{paymentMethod}</Badge>
              </div>
            )}
            {paymentBrand && (
              <div>
                <span className="text-muted-foreground">{language === 'ar' ? 'علامة الدفع:' : 'Payment Brand:'}</span>{' '}
                <Badge variant="outline">{paymentBrand}</Badge>
              </div>
            )}
          </div>
        )}

        {/* Sync Steps */}
        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted/30 rounded">
          {getStepBadge(stepCustomer, language === 'ar' ? 'العميل' : 'Customer')}
          {getStepBadge(stepBrand, language === 'ar' ? 'العلامة' : 'Brand')}
          {getStepBadge(stepProduct, language === 'ar' ? 'المنتج' : 'Product')}
          {getStepBadge(stepOrder, language === 'ar' ? 'الطلب' : 'Order')}
          {getStepBadge(stepPurchase, language === 'ar' ? 'الشراء' : 'Purchase')}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded mb-4">
            <div className="flex items-center gap-2 text-destructive font-medium mb-1">
              <XCircle className="h-4 w-4" />
              {language === 'ar' ? 'رسالة الخطأ' : 'Error Message'}
            </div>
            <div className="text-sm text-destructive/80 whitespace-pre-wrap">{errorMessage}</div>
          </div>
        )}

        {/* SKU Summary */}
        {transactionLines.length > 0 && (
          <div className="flex gap-4 mb-2 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{language === 'ar' ? `${hasSkuCount} لديه SKU` : `${hasSkuCount} with SKU`}</span>
            </div>
            {missingSkuCount > 0 && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{language === 'ar' ? `${missingSkuCount} بدون SKU` : `${missingSkuCount} without SKU`}</span>
              </div>
            )}
          </div>
        )}

        {/* Transaction Lines Table */}
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : transactionLines.length === 0 ? (
            productNames ? (
              <div className="space-y-3 p-4">
                <div className="text-sm text-muted-foreground mb-2">
                  {language === 'ar' ? 'المنتجات (من بيانات المزامنة):' : 'Products (from sync data):'}
                </div>
                {productNames.split(',').map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{name.trim()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {language === 'ar' ? 'لا توجد تفاصيل متاحة' : 'No details available'}
              </div>
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{language === 'ar' ? 'المنتج' : 'Product'}</TableHead>
                  <TableHead>{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</TableHead>
                  <TableHead>{language === 'ar' ? 'SKU' : 'SKU'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'السعر' : 'Price'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'المجموع' : 'Total'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionLines.map((line, index) => (
                  <TableRow 
                    key={line.id}
                    className={!line.has_sku ? 'bg-orange-50 dark:bg-orange-950/20' : ''}
                  >
                    <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate" title={line.product_name || ''}>
                      {line.product_name || '-'}
                    </TableCell>
                    <TableCell className="text-sm">{line.brand_name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {line.product_sku || line.product_id || (
                        <span className="text-orange-600">
                          {language === 'ar' ? 'مفقود' : 'Missing'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">{line.qty ?? '-'}</TableCell>
                    <TableCell className="text-right text-sm">{line.unit_price?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className="text-right text-sm">{line.total?.toFixed(2) ?? '-'}</TableCell>
                    <TableCell className="text-center">
                      {line.has_sku ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-500 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
