import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Package, Truck, FileText, Code, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  vendor_name: string | null;
  supplier_found: boolean;
  supplier_code?: string | null;
  original_order_number?: string | null;
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
  const [originalOrders, setOriginalOrders] = useState<string[]>([]);
  const [isOriginalOrdersOpen, setIsOriginalOrdersOpen] = useState(false);
  const [apiBody, setApiBody] = useState<any>(null);
  const [apiBodyLoading, setApiBodyLoading] = useState(false);
  const [isApiBodyOpen, setIsApiBodyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchApiBody = async () => {
    if (apiBody) {
      setIsApiBodyOpen(!isApiBodyOpen);
      return;
    }
    setApiBodyLoading(true);
    setIsApiBodyOpen(true);
    try {
      // Fetch Odoo config
      const { data: odooConfig } = await supabase
        .from('odoo_api_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      const isProduction = odooConfig?.is_production_mode !== false;
      const salesOrderApiUrl = isProduction ? odooConfig?.sales_order_api_url : odooConfig?.sales_order_api_url_test;

      let orderLines: any[] = [];

      // Use already-loaded transactionLines if available
      if (transactionLines.length > 0) {
        orderLines = transactionLines.map((line, index) => ({
          line_number: index + 1,
          product_sku: line.product_sku || line.product_id || '',
          product_name: line.product_name,
          quantity: parseFloat(String(line.qty)) || 1,
          uom: 'Unit',
          unit_price: parseFloat(String(line.unit_price)) || 0,
          total: parseFloat(String(line.total)) || 0,
        }));
      } else if (productNames) {
        // Fallback: use productNames from sync data
        const items = productNames.split(',').map(s => s.trim()).filter(Boolean);
        orderLines = items.map((item, index) => ({
          line_number: index + 1,
          product_name: item,
          note: 'from sync data (no transaction lines found)',
        }));
      }

      // Build body matching the actual Odoo sync format
      const body = {
        _note: 'Reconstructed API body (actual body may differ slightly)',
        api_url: salesOrderApiUrl || 'N/A',
        environment: isProduction ? 'Production' : 'Test',
        method: 'POST',
        body: {
          order_number: orderNumber,
          customer_phone: customerPhone,
          order_date: orderDate,
          payment_method: paymentMethod,
          payment_brand: paymentBrand || '',
          sales_person: '',
          online_payment: 'true',
          company: 'Purple',
          lines: orderLines,
        },
      };

      setApiBody(body);
    } catch (err) {
      console.error('Error building API body:', err);
      toast.error('Failed to build API body');
    } finally {
      setApiBodyLoading(false);
    }
  };

  const copyApiBody = () => {
    navigator.clipboard.writeText(JSON.stringify(apiBody, null, 2));
    setCopied(true);
    toast.success(language === 'ar' ? 'تم النسخ' : 'Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (open && orderNumber) {
      fetchTransactionLines();
      fetchOriginalOrders();
    }
  }, [open, orderNumber]);

  // Check if order number is aggregated format (YYYYMMDDXXXX - 12 digits)
  const isAggregatedOrder = orderNumber && /^\d{12}$/.test(orderNumber);

  const fetchOriginalOrders = async () => {
    if (!isAggregatedOrder) {
      setOriginalOrders([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('aggregated_order_mapping')
        .select('original_order_number')
        .eq('aggregated_order_number', orderNumber);
      
      if (!error && data) {
        setOriginalOrders(data.map(d => d.original_order_number));
      }
    } catch (error) {
      console.error('Error fetching original orders:', error);
    }
  };

  const fetchTransactionLines = async () => {
    setLoading(true);
    try {
      // For aggregated orders, we need to fetch from original order numbers
      let orderNumbersToFetch = [orderNumber];
      
      if (isAggregatedOrder) {
        const { data: mappingData } = await supabase
          .from('aggregated_order_mapping')
          .select('original_order_number')
          .eq('aggregated_order_number', orderNumber);
        
        if (mappingData && mappingData.length > 0) {
          orderNumbersToFetch = mappingData.map(m => m.original_order_number);
        }
      }

      // Fetch from purpletransaction - this is the main table with product lines
      const { data: purpleData, error: purpleError } = await supabase
        .from('purpletransaction')
        .select('id, product_name, brand_name, product_id, qty, unit_price, total, vendor_name, order_number')
        .in('order_number', orderNumbersToFetch);

      if (!purpleError && purpleData && purpleData.length > 0) {
        // Get all product SKUs to check which have SKU
        const productNames = purpleData
          .map(p => p.product_name)
          .filter((name): name is string => Boolean(name));
        
        // Get all vendor names to check supplier matches
        const vendorNames = purpleData
          .map(p => p.vendor_name)
          .filter((name): name is string => Boolean(name));
        
        let skuMap = new Map<string, string>();
        let supplierMap = new Map<string, string>(); // vendor_name -> supplier_code
        
        // Fetch SKUs
        if (productNames.length > 0) {
          const { data: productsData } = await supabase
            .from('products')
            .select('product_name, sku')
            .in('product_name', productNames);

          productsData?.forEach(p => {
            if (p.sku && p.product_name) skuMap.set(p.product_name, p.sku);
          });
        }

        // Fetch suppliers - check both supplier_name and supplier_code
        if (vendorNames.length > 0) {
          const { data: suppliersData } = await supabase
            .from('suppliers')
            .select('supplier_name, supplier_code')
            .or(`supplier_name.in.(${vendorNames.map(v => `"${v}"`).join(',')}),supplier_code.in.(${vendorNames.map(v => `"${v}"`).join(',')})`);

          suppliersData?.forEach(s => {
            if (s.supplier_name) supplierMap.set(s.supplier_name, s.supplier_code || s.supplier_name);
            if (s.supplier_code) supplierMap.set(s.supplier_code, s.supplier_code);
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
          vendor_name: t.vendor_name,
          supplier_found: t.vendor_name ? supplierMap.has(t.vendor_name) : false,
          supplier_code: t.vendor_name ? supplierMap.get(t.vendor_name) || null : null,
          original_order_number: isAggregatedOrder ? t.order_number : null,
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
  
  // Supplier stats
  const supplierFoundCount = transactionLines.filter(t => t.supplier_found).length;
  const missingVendorCount = transactionLines.filter(t => !t.vendor_name).length;
  const unmatchedVendorCount = transactionLines.filter(t => t.vendor_name && !t.supplier_found).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'}: {orderNumber}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 ml-2"
              onClick={fetchApiBody}
              title={language === 'ar' ? 'عرض بيانات API' : 'Show API Body'}
            >
              {apiBodyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code className="h-4 w-4" />}
            </Button>
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

        {/* API Body Section */}
        {isApiBodyOpen && apiBody && (
          <div className="mb-4 border border-border rounded overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-muted/50">
              <span className="text-sm font-medium flex items-center gap-2">
                <Code className="h-4 w-4" />
                {language === 'ar' ? 'بيانات API المرسلة' : 'API Body Sent'}
              </span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyApiBody}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <pre className="p-3 text-xs overflow-auto max-h-[200px] bg-muted/20 font-mono whitespace-pre-wrap">
              {JSON.stringify(apiBody, null, 2)}
            </pre>
          </div>
        )}

        {/* Original Orders Section (for aggregated orders) */}
        {isAggregatedOrder && originalOrders.length > 0 && (
          <Collapsible open={isOriginalOrdersOpen} onOpenChange={setIsOriginalOrdersOpen} className="mb-4">
            <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-muted/50 rounded hover:bg-muted transition-colors">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">
                {language === 'ar' ? `الطلبات الأصلية (${originalOrders.length})` : `Original Orders (${originalOrders.length})`}
              </span>
              <Badge variant="outline" className="ml-auto">
                {isOriginalOrdersOpen ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'عرض' : 'Show')}
              </Badge>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded">
                {originalOrders.map((order, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono text-xs">
                    {order}
                  </Badge>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* SKU Summary */}
        {transactionLines.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-2 text-sm">
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

        {/* Supplier Summary */}
        {transactionLines.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-4 text-sm p-2 bg-muted/30 rounded">
            <div className="flex items-center gap-1">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{language === 'ar' ? 'الموردين:' : 'Suppliers:'}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{language === 'ar' ? `${supplierFoundCount} مطابق` : `${supplierFoundCount} matched`}</span>
            </div>
            {missingVendorCount > 0 && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>{language === 'ar' ? `${missingVendorCount} بدون مورد` : `${missingVendorCount} no vendor`}</span>
              </div>
            )}
            {unmatchedVendorCount > 0 && (
              <div className="flex items-center gap-1 text-destructive">
                <XCircle className="h-4 w-4" />
                <span>{language === 'ar' ? `${unmatchedVendorCount} غير مطابق` : `${unmatchedVendorCount} unmatched`}</span>
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
                  <TableHead className="w-8">#</TableHead>
                  {isAggregatedOrder && (
                    <TableHead className="text-xs">{language === 'ar' ? 'الطلب' : 'Order'}</TableHead>
                  )}
                  <TableHead>{language === 'ar' ? 'المنتج' : 'Product'}</TableHead>
                  <TableHead>{language === 'ar' ? 'العلامة' : 'Brand'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المورد' : 'Vendor'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'مورد' : 'Supplier'}</TableHead>
                  <TableHead>{language === 'ar' ? 'SKU' : 'SKU'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'الكمية' : 'Qty'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'المجموع' : 'Total'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionLines.map((line, index) => {
                  const hasSupplierIssue = !line.vendor_name || !line.supplier_found;
                  const rowClass = hasSupplierIssue 
                    ? 'bg-orange-50 dark:bg-orange-950/20' 
                    : !line.has_sku 
                      ? 'bg-yellow-50 dark:bg-yellow-950/20' 
                      : '';
                  
                  return (
                    <TableRow key={line.id} className={rowClass}>
                      <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                      {isAggregatedOrder && (
                        <TableCell className="font-mono text-xs">
                          {line.original_order_number || '-'}
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-sm max-w-[150px] truncate" title={line.product_name || ''}>
                        {line.product_name || '-'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[80px] truncate">{line.brand_name || '-'}</TableCell>
                      <TableCell className="text-sm max-w-[100px] truncate" title={line.vendor_name || ''}>
                        {line.vendor_name || (
                          <span className="text-orange-600 text-xs">
                            {language === 'ar' ? 'فارغ' : 'Empty'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {!line.vendor_name ? (
                          <span title={language === 'ar' ? 'المورد فارغ' : 'Vendor empty'}>
                            <AlertTriangle className="h-4 w-4 text-orange-500 mx-auto" />
                          </span>
                        ) : line.supplier_found ? (
                          <span title={line.supplier_code || ''}>
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          </span>
                        ) : (
                          <span title={language === 'ar' ? 'غير موجود في الموردين' : 'Not in suppliers table'}>
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {line.product_sku || line.product_id || (
                          <span className="text-orange-600">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{line.qty ?? '-'}</TableCell>
                      <TableCell className="text-right text-sm">{line.total?.toFixed(2) ?? '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
