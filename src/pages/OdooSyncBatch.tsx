import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Play, CheckCircle2, XCircle, Clock, Loader2, SkipForward, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  order_number: string;
  created_at_date: string;
  created_at_date_int: number;
  customer_name: string;
  customer_phone: string;
  brand_name: string;
  brand_code?: string;
  product_name: string;
  product_id?: string;
  sku?: string;
  total: number;
  qty: number;
  unit_price: number;
  cost_price: number;
  cost_sold: number;
  coins_number: number;
  payment_method: string;
  payment_type: string;
  payment_brand: string;
  user_name: string;
  vendor_name: string;
  trans_type: string;
  order_status: string;
  profit: number;
  bank_fee: number;
  company: string;
  is_deleted: boolean;
}

interface OrderGroup {
  orderNumber: string;
  lines: Transaction[];
  date: string;
  customerPhone: string;
  productNames: string[];
  totalAmount: number;
  paymentMethod: string;
  paymentBrand: string;
  selected: boolean;
  skipSync: boolean;
  syncStatus: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  stepStatus: {
    customer: 'pending' | 'running' | 'found' | 'created' | 'failed';
    brand: 'pending' | 'running' | 'found' | 'created' | 'failed';
    product: 'pending' | 'running' | 'found' | 'created' | 'failed';
    order: 'pending' | 'running' | 'sent' | 'failed';
    purchase: 'pending' | 'running' | 'created' | 'skipped' | 'failed';
  };
  errorMessage?: string;
  hasNonStock: boolean;
}

// Helper function to translate Odoo error messages to Arabic
const translateOdooError = (error: string, language: string): string => {
  if (language !== 'ar') return error;
  
  // Common error patterns and their Arabic translations
  const errorPatterns: Array<{ pattern: RegExp; translate: (match: RegExpMatchArray) => string }> = [
    {
      pattern: /^Order:\s*Order\s+(\d+)\s+already\s+exists$/i,
      translate: (match) => `الطلب: الطلب ${match[1]} موجود مسبقاً`
    },
    {
      pattern: /^Customer:\s*(.+)$/i,
      translate: (match) => `العميل: ${translateErrorMessage(match[1], language)}`
    },
    {
      pattern: /^Brand:\s*(.+)$/i,
      translate: (match) => `العلامة التجارية: ${translateErrorMessage(match[1], language)}`
    },
    {
      pattern: /^Product:\s*(.+)$/i,
      translate: (match) => `المنتج: ${translateErrorMessage(match[1], language)}`
    },
    {
      pattern: /already\s+exists/i,
      translate: () => 'موجود مسبقاً'
    },
    {
      pattern: /not\s+found/i,
      translate: () => 'غير موجود'
    },
    {
      pattern: /failed/i,
      translate: () => 'فشل'
    },
    {
      pattern: /network\s+error/i,
      translate: () => 'خطأ في الشبكة'
    },
    {
      pattern: /timeout/i,
      translate: () => 'انتهت مهلة الاتصال'
    },
    {
      pattern: /unauthorized/i,
      translate: () => 'غير مصرح'
    },
    {
      pattern: /invalid/i,
      translate: () => 'غير صالح'
    },
  ];

  for (const { pattern, translate } of errorPatterns) {
    const match = error.match(pattern);
    if (match) {
      return translate(match);
    }
  }

  return error;
};

// Helper to translate common error parts
const translateErrorMessage = (message: string, language: string): string => {
  if (language !== 'ar') return message;
  
  const translations: Record<string, string> = {
    'already exists': 'موجود مسبقاً',
    'not found': 'غير موجود',
    'failed': 'فشل',
    'network error': 'خطأ في الشبكة',
    'timeout': 'انتهت المهلة',
    'unauthorized': 'غير مصرح',
    'invalid': 'غير صالح',
    'missing': 'مفقود',
    'required': 'مطلوب',
    'duplicate': 'مكرر',
  };
  
  let translated = message;
  for (const [eng, ar] of Object.entries(translations)) {
    translated = translated.replace(new RegExp(eng, 'gi'), ar);
  }
  
  return translated;
};

const OdooSyncBatch = () => {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(-1);
  const [syncComplete, setSyncComplete] = useState(false);
  const [nonStockSkuSet, setNonStockSkuSet] = useState<Set<string>>(new Set());

  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  // Load transactions based on date filter
  useEffect(() => {
    const loadTransactions = async () => {
      if (!fromDate || !toDate) {
        toast({
          variant: 'destructive',
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يجب تحديد تاريخ البداية والنهاية' : 'Start and end dates are required',
        });
        navigate(`/transactions?from=${fromDate || ''}&to=${toDate || ''}`);
        return;
      }

      setLoading(true);
      try {
        // Convert date strings to integer format YYYYMMDD for filtering
        const fromDateInt = parseInt(fromDate.replace(/-/g, ''), 10);
        const toDateInt = parseInt(toDate.replace(/-/g, ''), 10);
        
        // Fetch transactions within date range using created_at_date_int, excluding payment_method = 'point'
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('*')
          .gte('created_at_date_int', fromDateInt)
          .lte('created_at_date_int', toDateInt)
          .neq('payment_method', 'point')
          .eq('is_deleted', false)
          .order('created_at_date_int', { ascending: false });

        if (error) throw error;

        // Get non-stock products
        const { data: nonStockProducts } = await supabase
          .from('products')
          .select('sku, product_id')
          .eq('non_stock', true);

        const nonStockSet = new Set<string>();
        nonStockProducts?.forEach(p => {
          if (p.sku) nonStockSet.add(p.sku);
          if (p.product_id) nonStockSet.add(p.product_id);
        });
        setNonStockSkuSet(nonStockSet);

        // Group by order_number
        const groupMap = new Map<string, Transaction[]>();
        (data || []).forEach((tx: any) => {
          if (!tx.order_number) return;
          const existing = groupMap.get(tx.order_number) || [];
          existing.push(tx as Transaction);
          groupMap.set(tx.order_number, existing);
        });

        // Convert to OrderGroup array
        const groups: OrderGroup[] = [];
        for (const [orderNumber, lines] of groupMap) {
          const firstLine = lines[0];
          const productNames = [...new Set(lines.map(l => l.product_name))].filter(Boolean);
          const totalAmount = lines.reduce((sum, l) => sum + (l.total || 0), 0);
          
          // Check if any product is non-stock
          const hasNonStock = lines.some(l => {
            const sku = l.sku || l.product_id;
            return sku && nonStockSet.has(sku);
          });

          groups.push({
            orderNumber,
            lines,
            date: firstLine.created_at_date,
            customerPhone: firstLine.customer_phone || '',
            productNames,
            totalAmount,
            paymentMethod: firstLine.payment_method || '',
            paymentBrand: firstLine.payment_brand || '',
            selected: true,
            skipSync: false,
            syncStatus: 'pending',
            stepStatus: {
              customer: 'pending',
              brand: 'pending',
              product: 'pending',
              order: 'pending',
              purchase: 'pending',
            },
            hasNonStock,
          });
        }

        setOrderGroups(groups);
      } catch (error) {
        console.error('Error loading transactions:', error);
        toast({
          variant: 'destructive',
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'فشل تحميل المعاملات' : 'Failed to load transactions',
        });
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [fromDate, toDate, language, navigate]);

  // Toggle select all
  const handleSelectAll = (checked: boolean) => {
    setOrderGroups(prev => prev.map(g => ({ ...g, selected: checked })));
  };

  // Toggle single row selection
  const handleSelectRow = (orderNumber: string, checked: boolean) => {
    setOrderGroups(prev => prev.map(g => 
      g.orderNumber === orderNumber ? { ...g, selected: checked } : g
    ));
  };

  // Toggle skip sync for a row
  const handleToggleSkip = (orderNumber: string) => {
    setOrderGroups(prev => prev.map(g => 
      g.orderNumber === orderNumber ? { ...g, skipSync: !g.skipSync } : g
    ));
  };

  // Count selected orders
  const selectedCount = useMemo(() => 
    orderGroups.filter(g => g.selected && !g.skipSync).length,
    [orderGroups]
  );

  const allSelected = orderGroups.length > 0 && orderGroups.every(g => g.selected);

  // Sync a single order to Odoo with step tracking using edge function
  const syncSingleOrder = async (group: OrderGroup): Promise<Partial<OrderGroup>> => {
    const stepStatus = { ...group.stepStatus };
    const transactions = group.lines;

    // Filter non-stock products from this order's lines
    const orderNonStockProducts = transactions.filter(line => {
      const sku = line.sku || line.product_id;
      return sku && nonStockSkuSet.has(sku);
    });

    const updateStepStatus = (newStepStatus: typeof stepStatus) => {
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, stepStatus: { ...newStepStatus } } : g
      ));
    };

    const executeStep = async (stepId: string): Promise<{ success: boolean; error?: string }> => {
      console.log(`[Batch Sync] Executing step: ${stepId} for order: ${group.orderNumber}`);
      try {
        // Always pass nonStockProducts to all steps (same as step-by-step dialog)
        const response = await supabase.functions.invoke("sync-order-to-odoo-step", {
          body: { step: stepId, transactions, nonStockProducts: orderNonStockProducts },
        });

        console.log(`[Batch Sync] Step ${stepId} response:`, response);

        if (response.error) {
          console.error(`[Batch Sync] Step ${stepId} error:`, response.error);
          return { success: false, error: response.error.message };
        }

        const data = response.data;
        
        if (data.skipped) {
          console.log(`[Batch Sync] Step ${stepId} skipped`);
          return { success: true };
        }

        if (data.success) {
          console.log(`[Batch Sync] Step ${stepId} success:`, data.message);
          return { success: true };
        } else {
          // Handle nested error structure from Odoo: {error: {error: "message"}} or {error: "message"}
          const errorMessage = typeof data.error === 'object' && data.error?.error 
            ? data.error.error 
            : (data.error || data.message || 'Failed');
          console.error(`[Batch Sync] Step ${stepId} failed:`, errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (error: any) {
        console.error(`[Batch Sync] Step ${stepId} exception:`, error);
        return { success: false, error: error.message || 'Network error' };
      }
    };

    try {
      // Step 1: Sync Customer
      console.log(`[Batch Sync] Starting Customer step for order: ${group.orderNumber}`);
      stepStatus.customer = 'running';
      updateStepStatus(stepStatus);

      const customerResult = await executeStep('customer');
      if (!customerResult.success) {
        stepStatus.customer = 'failed';
        updateStepStatus(stepStatus);
        throw new Error(`Customer: ${customerResult.error}`);
      }
      stepStatus.customer = 'found';
      updateStepStatus(stepStatus);
      console.log(`[Batch Sync] Customer step completed for order: ${group.orderNumber}`);

      // Step 2: Sync Brand(s)
      console.log(`[Batch Sync] Starting Brand step for order: ${group.orderNumber}`);
      stepStatus.brand = 'running';
      updateStepStatus(stepStatus);

      const brandResult = await executeStep('brand');
      if (!brandResult.success) {
        stepStatus.brand = 'failed';
        updateStepStatus(stepStatus);
        throw new Error(`Brand: ${brandResult.error}`);
      }
      stepStatus.brand = 'found';
      updateStepStatus(stepStatus);
      console.log(`[Batch Sync] Brand step completed for order: ${group.orderNumber}`);

      // Step 3: Sync Product(s)
      console.log(`[Batch Sync] Starting Product step for order: ${group.orderNumber}`);
      stepStatus.product = 'running';
      updateStepStatus(stepStatus);

      const productResult = await executeStep('product');
      if (!productResult.success) {
        stepStatus.product = 'failed';
        updateStepStatus(stepStatus);
        throw new Error(`Product: ${productResult.error}`);
      }
      stepStatus.product = 'found';
      updateStepStatus(stepStatus);
      console.log(`[Batch Sync] Product step completed for order: ${group.orderNumber}`);

      // Step 4: Create Sales Order
      console.log(`[Batch Sync] Starting Order step for order: ${group.orderNumber}`);
      stepStatus.order = 'running';
      updateStepStatus(stepStatus);

      const orderResult = await executeStep('order');
      if (!orderResult.success) {
        stepStatus.order = 'failed';
        updateStepStatus(stepStatus);
        throw new Error(`Order: ${orderResult.error}`);
      }
      stepStatus.order = 'sent';
      updateStepStatus(stepStatus);
      console.log(`[Batch Sync] Order step completed for order: ${group.orderNumber}`);

      // Step 5: Create Purchase Order (if non-stock products exist)
      if (group.hasNonStock && orderNonStockProducts.length > 0) {
        console.log(`[Batch Sync] Starting Purchase step for order: ${group.orderNumber}, non-stock products: ${orderNonStockProducts.length}`);
        stepStatus.purchase = 'running';
        updateStepStatus(stepStatus);

        const purchaseResult = await executeStep('purchase');
        if (!purchaseResult.success) {
          stepStatus.purchase = 'failed';
          updateStepStatus(stepStatus);
          throw new Error(`Purchase: ${purchaseResult.error}`);
        }
        stepStatus.purchase = 'created';
        updateStepStatus(stepStatus);
        console.log(`[Batch Sync] Purchase step completed for order: ${group.orderNumber}`);
      } else {
        stepStatus.purchase = 'skipped';
        updateStepStatus(stepStatus);
      }

      console.log(`[Batch Sync] All steps completed for order: ${group.orderNumber}`);
      return {
        syncStatus: 'success',
        stepStatus,
      };

    } catch (error) {
      console.error('[Batch Sync] Error syncing order:', group.orderNumber, error);
      return {
        syncStatus: 'failed',
        stepStatus,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  // Start sync process
  const handleStartSync = async () => {
    const toSync = orderGroups.filter(g => g.selected && !g.skipSync);
    if (toSync.length === 0) {
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'لا توجد طلبات' : 'No Orders',
        description: language === 'ar' ? 'يرجى اختيار طلبات للمزامنة' : 'Please select orders to sync',
      });
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncComplete(false);

    for (let i = 0; i < toSync.length; i++) {
      const group = toSync[i];
      setCurrentOrderIndex(orderGroups.findIndex(g => g.orderNumber === group.orderNumber));

      // Mark as running
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, syncStatus: 'running' } : g
      ));

      // Sync the order
      const result = await syncSingleOrder(group);

      // Update with result
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, ...result } : g
      ));

      // Update progress
      setSyncProgress(Math.round(((i + 1) / toSync.length) * 100));
    }

    // Mark skipped orders
    setOrderGroups(prev => prev.map(g => 
      g.skipSync && g.selected ? { ...g, syncStatus: 'skipped' } : g
    ));

    setIsSyncing(false);
    setCurrentOrderIndex(-1);
    setSyncComplete(true);

    toast({
      title: language === 'ar' ? 'اكتملت المزامنة' : 'Sync Complete',
      description: language === 'ar' 
        ? `تمت مزامنة ${toSync.length} طلب(ات)`
        : `${toSync.length} order(s) synced`,
    });
  };

  // Get step status icon
  const getStepIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'found':
      case 'created':
      case 'sent':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-destructive" />;
      case 'skipped':
        return <SkipForward className="h-3 w-3 text-muted-foreground" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  // Get step status text
  const getStepText = (step: string, status: string) => {
    const texts: Record<string, Record<string, string>> = {
      customer: {
        pending: language === 'ar' ? 'العميل' : 'Customer',
        running: language === 'ar' ? 'جاري البحث...' : 'Checking...',
        found: language === 'ar' ? 'العميل موجود' : 'Found',
        created: language === 'ar' ? 'تم إنشاء العميل' : 'Created',
        failed: language === 'ar' ? 'فشل' : 'Failed',
      },
      brand: {
        pending: language === 'ar' ? 'العلامة التجارية' : 'Brand',
        running: language === 'ar' ? 'جاري البحث...' : 'Checking...',
        found: language === 'ar' ? 'موجودة' : 'Found',
        created: language === 'ar' ? 'تم الإنشاء' : 'Created',
        failed: language === 'ar' ? 'فشل' : 'Failed',
      },
      product: {
        pending: language === 'ar' ? 'المنتج' : 'Product',
        running: language === 'ar' ? 'جاري البحث...' : 'Checking...',
        found: language === 'ar' ? 'موجود' : 'Found',
        created: language === 'ar' ? 'تم الإنشاء' : 'Created',
        failed: language === 'ar' ? 'فشل' : 'Failed',
      },
      order: {
        pending: language === 'ar' ? 'الطلب' : 'Order',
        running: language === 'ar' ? 'جاري الإرسال...' : 'Sending...',
        sent: language === 'ar' ? 'تم الإرسال' : 'Sent',
        failed: language === 'ar' ? 'فشل' : 'Failed',
      },
      purchase: {
        pending: language === 'ar' ? 'المشتريات' : 'Purchase',
        running: language === 'ar' ? 'جاري الإنشاء...' : 'Creating...',
        created: language === 'ar' ? 'تم الإنشاء' : 'Created',
        skipped: language === 'ar' ? 'تخطي' : 'Skipped',
        failed: language === 'ar' ? 'فشل' : 'Failed',
      },
    };
    return texts[step]?.[status] || status;
  };

  // Get sync status badge
  const getSyncStatusBadge = (group: OrderGroup) => {
    switch (group.syncStatus) {
      case 'running':
        return <Badge variant="outline" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />{language === 'ar' ? 'جاري' : 'Running'}</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500 gap-1"><CheckCircle2 className="h-3 w-3" />{language === 'ar' ? 'نجح' : 'Success'}</Badge>;
      case 'failed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1 cursor-help">
                  <XCircle className="h-3 w-3" />{language === 'ar' ? 'فشل' : 'Failed'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px] text-sm">
                <p>{group.errorMessage || (language === 'ar' ? 'خطأ غير معروف' : 'Unknown error')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'skipped':
        return <Badge variant="secondary" className="gap-1"><SkipForward className="h-3 w-3" />{language === 'ar' ? 'تخطي' : 'Skipped'}</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{language === 'ar' ? 'معلق' : 'Pending'}</Badge>;
    }
  };

  // Summary stats
  const summary = useMemo(() => {
    const total = orderGroups.length;
    const success = orderGroups.filter(g => g.syncStatus === 'success').length;
    const failed = orderGroups.filter(g => g.syncStatus === 'failed').length;
    const skipped = orderGroups.filter(g => g.syncStatus === 'skipped').length;
    
    // Count created items (status === 'created')
    const customersCreated = orderGroups.filter(g => g.stepStatus.customer === 'created').length;
    const brandsCreated = orderGroups.filter(g => g.stepStatus.brand === 'created').length;
    const productsCreated = orderGroups.filter(g => g.stepStatus.product === 'created').length;
    const ordersCreated = orderGroups.filter(g => g.stepStatus.order === 'sent').length;
    const purchasesCreated = orderGroups.filter(g => g.stepStatus.purchase === 'created').length;
    
    return { total, success, failed, skipped, customersCreated, brandsCreated, productsCreated, ordersCreated, purchasesCreated };
  }, [orderGroups]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/transactions?from=${fromDate}&to=${toDate}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'مزامنة الطلبات مع Odoo' : 'Sync Orders to Odoo'}
            </h1>
            <p className="text-muted-foreground">
              {fromDate && toDate && (
                <>
                  {format(parseISO(fromDate), 'yyyy-MM-dd')} → {format(parseISO(toDate), 'yyyy-MM-dd')}
                  {' | '}
                  {language === 'ar' ? `${orderGroups.length} طلب` : `${orderGroups.length} orders`}
                </>
              )}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleStartSync} 
          disabled={isSyncing || selectedCount === 0}
          className="gap-2"
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === 'ar' ? 'جاري المزامنة...' : 'Syncing...'}
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {language === 'ar' ? 'ابدأ الآن' : 'Start Now'}
            </>
          )}
        </Button>
      </div>

      {/* Progress bar */}
      {isSyncing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{language === 'ar' ? 'التقدم' : 'Progress'}</span>
                <span>{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary (after sync) */}
      {syncComplete && (
        <div className="space-y-4">
          {/* Sync Results */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{summary.total}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'إجمالي الطلبات' : 'Total Orders'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">{summary.success}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'نجح' : 'Success'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'فشل' : 'Failed'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-muted-foreground">{summary.skipped}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'تخطي' : 'Skipped'}</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Created in Odoo */}
          <div className="grid grid-cols-5 gap-4">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">{summary.customersCreated}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'عملاء تم إنشاؤهم' : 'Customers Created'}</p>
              </CardContent>
            </Card>
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-purple-500">{summary.brandsCreated}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'علامات تجارية' : 'Brands Created'}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-500">{summary.productsCreated}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'منتجات تم إنشاؤها' : 'Products Created'}</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">{summary.ordersCreated}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'طلبات تم إرسالها' : 'Orders Sent'}</p>
              </CardContent>
            </Card>
            <Card className="border-cyan-500/30 bg-cyan-500/5">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-cyan-500">{summary.purchasesCreated}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'أوامر شراء' : 'Purchases Created'}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Orders table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{language === 'ar' ? 'الطلبات' : 'Orders'}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {language === 'ar' 
                ? `${selectedCount} من ${orderGroups.length} محدد`
                : `${selectedCount} of ${orderGroups.length} selected`}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orderGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد معاملات' : 'No transactions found'}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={allSelected}
                        onCheckedChange={handleSelectAll}
                        disabled={isSyncing}
                      />
                    </TableHead>
                    <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order Number'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'هاتف العميل' : 'Customer Phone'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المنتجات' : 'Products'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تخطي' : 'Skip'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'العميل' : 'Customer'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'العلامة' : 'Brand'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'المنتج' : 'Product'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'الطلب' : 'Order'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'الشراء' : 'Purchase'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الخطأ' : 'Error'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderGroups.map((group, idx) => (
                    <TableRow 
                      key={group.orderNumber}
                      className={cn(
                        currentOrderIndex === idx && 'bg-muted/50',
                        group.syncStatus === 'success' && 'bg-green-50 dark:bg-green-950/20',
                        group.syncStatus === 'failed' && 'bg-red-50 dark:bg-red-950/20'
                      )}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={group.selected}
                          onCheckedChange={(checked) => handleSelectRow(group.orderNumber, checked as boolean)}
                          disabled={isSyncing}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{group.orderNumber}</TableCell>
                      <TableCell>
                        {group.date ? format(parseISO(group.date), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell>{group.customerPhone || '-'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={group.productNames.join(', ')}>
                        {group.productNames.slice(0, 2).join(', ')}
                        {group.productNames.length > 2 && ` +${group.productNames.length - 2}`}
                      </TableCell>
                      <TableCell>{group.totalAmount.toFixed(2)} SAR</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSkip(group.orderNumber)}
                          disabled={isSyncing || group.syncStatus !== 'pending'}
                          className={group.skipSync ? 'text-destructive' : ''}
                        >
                          {group.skipSync ? (
                            <SkipForward className="h-4 w-4" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getSyncStatusBadge(group)}
                          {group.syncStatus === 'failed' && group.errorMessage && (
                            <span className="text-xs text-destructive max-w-[200px] break-words">
                              {translateOdooError(group.errorMessage, language)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStepIcon(group.stepStatus.customer)}
                          <span className="text-xs hidden lg:inline">
                            {group.stepStatus.customer === 'created' ? (language === 'ar' ? 'جديد' : 'New') : 
                             group.stepStatus.customer === 'found' ? (language === 'ar' ? 'موجود' : 'Found') : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStepIcon(group.stepStatus.brand)}
                          <span className="text-xs hidden lg:inline">
                            {group.stepStatus.brand === 'created' ? (language === 'ar' ? 'جديد' : 'New') : 
                             group.stepStatus.brand === 'found' ? (language === 'ar' ? 'موجود' : 'Found') : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStepIcon(group.stepStatus.product)}
                          <span className="text-xs hidden lg:inline">
                            {group.stepStatus.product === 'created' ? (language === 'ar' ? 'جديد' : 'New') : 
                             group.stepStatus.product === 'found' ? (language === 'ar' ? 'موجود' : 'Found') : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStepIcon(group.stepStatus.order)}
                          <span className="text-xs hidden lg:inline">
                            {group.stepStatus.order === 'sent' ? (language === 'ar' ? 'تم' : 'Sent') : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {group.hasNonStock ? getStepIcon(group.stepStatus.purchase) : <span className="text-muted-foreground">-</span>}
                          <span className="text-xs hidden lg:inline">
                            {group.stepStatus.purchase === 'created' ? (language === 'ar' ? 'تم' : 'Created') : 
                             group.stepStatus.purchase === 'skipped' ? (language === 'ar' ? 'تخطي' : 'Skip') : ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {group.errorMessage && (
                          <p className="text-xs text-destructive truncate max-w-[150px]" title={translateOdooError(group.errorMessage, language)}>
                            {translateOdooError(group.errorMessage, language)}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Helper for cn
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default OdooSyncBatch;
