import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Play, CheckCircle2, XCircle, Clock, Loader2, SkipForward, RefreshCw, StopCircle, Eye, History, Cloud, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInSeconds } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface SyncRunHistory {
  id: string;
  run_date: string;
  from_date: string;
  to_date: string;
  start_time: string;
  end_time: string | null;
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  skipped_orders: number;
  status: string;
}

interface SyncRunDetail {
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
}

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
  syncStatus: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'stopped';
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

interface AggregatedInvoice {
  orderNumber: string;
  date: string;
  brandName: string;
  paymentMethod: string;
  paymentBrand: string;
  userName: string;
  productLines: {
    productSku: string;
    productName: string;
    unitPrice: number;
    totalQty: number;
    totalAmount: number;
  }[];
  grandTotal: number;
  originalOrderNumbers: string[];
  originalLines: Transaction[];
  selected: boolean;
  skipSync: boolean;
  syncStatus: 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'stopped';
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
  
  // New states for enhanced features
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [showFailedDialog, setShowFailedDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showRunDetailsDialog, setShowRunDetailsDialog] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncRunHistory[]>([]);
  const [selectedRunDetails, setSelectedRunDetails] = useState<SyncRunDetail[]>([]);
  const [selectedRunInfo, setSelectedRunInfo] = useState<SyncRunHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingRunDetails, setLoadingRunDetails] = useState(false);
  const stopRequestedRef = useRef(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [startingBackgroundSync, setStartingBackgroundSync] = useState(false);
  const [aggregateMode, setAggregateMode] = useState(false);
  const [aggregatedInvoices, setAggregatedInvoices] = useState<AggregatedInvoice[]>([]);

  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  // Calculate duration in formatted string
  const formatDuration = (start: Date, end: Date): string => {
    const totalSeconds = differenceInSeconds(end, start);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return language === 'ar' 
        ? `${minutes} دقيقة و ${seconds} ثانية`
        : `${minutes}m ${seconds}s`;
    }
    return language === 'ar' ? `${seconds} ثانية` : `${seconds}s`;
  };

  // Load sync history for current date range
  const loadSyncHistory = async () => {
    if (!fromDate || !toDate) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('odoo_sync_runs')
        .select('*')
        .eq('from_date', fromDate)
        .eq('to_date', toDate)
        .order('run_date', { ascending: false });

      if (error) throw error;
      setSyncHistory((data as SyncRunHistory[]) || []);
    } catch (error) {
      console.error('Error loading sync history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open history dialog
  const handleShowHistory = () => {
    loadSyncHistory();
    setShowHistoryDialog(true);
  };

  // Load run details
  const loadRunDetails = async (run: SyncRunHistory) => {
    setSelectedRunInfo(run);
    setLoadingRunDetails(true);
    setShowRunDetailsDialog(true);
    
    try {
      const { data, error } = await supabase
        .from('odoo_sync_run_details')
        .select('*')
        .eq('run_id', run.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSelectedRunDetails((data as SyncRunDetail[]) || []);
    } catch (error) {
      console.error('Error loading run details:', error);
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل تحميل التفاصيل' : 'Failed to load details',
      });
    } finally {
      setLoadingRunDetails(false);
    }
  };

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
        
        // Fetch transactions within date range, excluding already synced orders (sendodoo = true)
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('*')
          .gte('created_at_date_int', fromDateInt)
          .lte('created_at_date_int', toDateInt)
          .neq('payment_method', 'point')
          .eq('is_deleted', false)
          .or('sendodoo.is.null,sendodoo.eq.false')
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

  // Build aggregated invoices when aggregate mode is on
  useEffect(() => {
    if (!aggregateMode || orderGroups.length === 0) {
      setAggregatedInvoices([]);
      return;
    }
    
    // First, group by invoice criteria: date, brand, payment_method, payment_brand, user_name
    const invoiceMap = new Map<string, {
      date: string;
      brandName: string;
      paymentMethod: string;
      paymentBrand: string;
      userName: string;
      lines: Transaction[];
      originalOrderNumbers: string[];
    }>();

    orderGroups.forEach(group => {
      group.lines.forEach(line => {
        const dateOnly = line.created_at_date?.substring(0, 10) || '';
        const invoiceKey = `${dateOnly}|${line.brand_name || ''}|${line.payment_method}|${line.payment_brand}|${line.user_name || ''}`;

        const existing = invoiceMap.get(invoiceKey);
        if (existing) {
          existing.lines.push(line);
          if (!existing.originalOrderNumbers.includes(group.orderNumber)) {
            existing.originalOrderNumbers.push(group.orderNumber);
          }
        } else {
          invoiceMap.set(invoiceKey, {
            date: dateOnly,
            brandName: line.brand_name || '',
            paymentMethod: line.payment_method || '',
            paymentBrand: line.payment_brand || '',
            userName: line.user_name || '',
            lines: [line],
            originalOrderNumbers: [group.orderNumber],
          });
        }
      });
    });

    // Build result with sync status
    const result: AggregatedInvoice[] = [];
    const sortedKeys = Array.from(invoiceMap.keys()).sort();
    const dateSequenceMap = new Map<string, number>();
    
    sortedKeys.forEach(invoiceKey => {
      const invoice = invoiceMap.get(invoiceKey)!;
      const dateStr = invoice.date?.replace(/-/g, '') || format(new Date(), 'yyyyMMdd');
      
      const currentSeq = dateSequenceMap.get(dateStr) || 0;
      const nextSeq = currentSeq + 1;
      dateSequenceMap.set(dateStr, nextSeq);
      
      const orderNumber = `${dateStr}${String(nextSeq).padStart(4, '0')}`;
      
      // Aggregate product lines by SKU and unit_price
      const productMap = new Map<string, {
        productSku: string;
        productName: string;
        unitPrice: number;
        totalQty: number;
        totalAmount: number;
      }>();
      
      invoice.lines.forEach(line => {
        const productKey = `${line.sku || line.product_id || ''}|${line.unit_price}`;
        const existing = productMap.get(productKey);
        if (existing) {
          existing.totalQty += line.qty || 0;
          existing.totalAmount += line.total || 0;
        } else {
          productMap.set(productKey, {
            productSku: line.sku || line.product_id || '',
            productName: line.product_name || '',
            unitPrice: line.unit_price || 0,
            totalQty: line.qty || 0,
            totalAmount: line.total || 0,
          });
        }
      });
      
      const productLines = Array.from(productMap.values()).sort((a, b) => 
        a.productSku.localeCompare(b.productSku)
      );

      // Check if any product is non-stock
      const hasNonStock = invoice.lines.some(line => {
        const sku = line.sku || line.product_id || '';
        return nonStockSkuSet.has(sku);
      });
      
      result.push({
        orderNumber,
        date: invoice.date,
        brandName: invoice.brandName,
        paymentMethod: invoice.paymentMethod,
        paymentBrand: invoice.paymentBrand,
        userName: invoice.userName,
        productLines,
        grandTotal: productLines.reduce((sum, p) => sum + p.totalAmount, 0),
        originalOrderNumbers: invoice.originalOrderNumbers,
        originalLines: invoice.lines,
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
    });

    // Sort
    result.sort((a, b) => {
      const brandCompare = (a.brandName || '').localeCompare(b.brandName || '');
      if (brandCompare !== 0) return brandCompare;
      const methodCompare = (a.paymentMethod || '').localeCompare(b.paymentMethod || '');
      if (methodCompare !== 0) return methodCompare;
      const brandPayCompare = (a.paymentBrand || '').localeCompare(b.paymentBrand || '');
      if (brandPayCompare !== 0) return brandPayCompare;
      const userCompare = (a.userName || '').localeCompare(b.userName || '');
      if (userCompare !== 0) return userCompare;
      return (a.date || '').localeCompare(b.date || '');
    });

    setAggregatedInvoices(prev => {
      const prevByOrderNumber = new Map(prev.map(i => [i.orderNumber, i] as const));
      return result.map(inv => {
        const prevInv = prevByOrderNumber.get(inv.orderNumber);
        if (!prevInv) return inv;
        return {
          ...inv,
          selected: prevInv.selected,
          skipSync: prevInv.skipSync,
          syncStatus: prevInv.syncStatus,
          stepStatus: prevInv.stepStatus,
          errorMessage: prevInv.errorMessage,
        };
      });
    });
  }, [orderGroups, aggregateMode, nonStockSkuSet]);

  // Aggregated invoice selection handlers
  const handleSelectAggregatedRow = (orderNumber: string, checked: boolean) => {
    setAggregatedInvoices(prev => prev.map(inv => 
      inv.orderNumber === orderNumber ? { ...inv, selected: checked } : inv
    ));
  };

  const handleSelectAllAggregated = (checked: boolean) => {
    setAggregatedInvoices(prev => prev.map(inv => ({ ...inv, selected: checked })));
  };

  const handleToggleSkipAggregated = (orderNumber: string) => {
    setAggregatedInvoices(prev => prev.map(inv => 
      inv.orderNumber === orderNumber ? { ...inv, skipSync: !inv.skipSync } : inv
    ));
  };

  const allAggregatedSelected = aggregatedInvoices.length > 0 && aggregatedInvoices.every(inv => inv.selected);
  const selectedAggregatedCount = aggregatedInvoices.filter(inv => inv.selected && !inv.skipSync).length;

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

  // Sync an aggregated invoice to Odoo - sends combined data as ONE order
  const syncAggregatedInvoice = async (invoice: AggregatedInvoice): Promise<Partial<AggregatedInvoice>> => {
    const stepStatus = { ...invoice.stepStatus };
    
    // Build synthetic transactions from aggregated data for the edge function
    // We take the first original line to get customer info, then build product lines from aggregated data
    const firstOriginalLine = invoice.originalLines[0];
    
    // Create synthetic transactions that represent the aggregated order
    // Use 'any' because we only need the fields the edge function uses
    const syntheticTransactions = invoice.productLines.map((pl) => ({
      order_number: invoice.orderNumber, // Use aggregated order number
      customer_name: firstOriginalLine?.customer_name || '',
      customer_phone: firstOriginalLine?.customer_phone || '',
      brand_code: firstOriginalLine?.brand_code || '',
      brand_name: invoice.brandName,
      product_id: pl.productSku,
      sku: pl.productSku,
      product_name: pl.productName,
      unit_price: pl.unitPrice,
      total: pl.totalAmount,
      qty: pl.totalQty,
      created_at_date: invoice.date,
      payment_method: invoice.paymentMethod,
      payment_brand: invoice.paymentBrand,
      user_name: invoice.userName,
      cost_price: firstOriginalLine?.cost_price || 0,
      cost_sold: firstOriginalLine?.cost_sold || 0,
      vendor_name: firstOriginalLine?.vendor_name || '',
      company: firstOriginalLine?.company || '',
    }));

    // Filter non-stock products
    const nonStockProducts = syntheticTransactions.filter(tx => {
      const sku = tx.sku || tx.product_id;
      return sku && nonStockSkuSet.has(sku);
    });

    const updateAggregatedStepStatus = (newStepStatus: typeof stepStatus) => {
      setAggregatedInvoices(prev => prev.map(inv => 
        inv.orderNumber === invoice.orderNumber ? { ...inv, stepStatus: { ...newStepStatus } } : inv
      ));
    };

    const executeStep = async (stepId: string): Promise<{ success: boolean; error?: string }> => {
      console.log(`[Aggregated Sync] Executing step: ${stepId} for invoice: ${invoice.orderNumber}`);
      try {
        const response = await supabase.functions.invoke("sync-order-to-odoo-step", {
          body: { step: stepId, transactions: syntheticTransactions, nonStockProducts },
        });

        console.log(`[Aggregated Sync] Step ${stepId} response:`, response);

        if (response.error) {
          console.error(`[Aggregated Sync] Step ${stepId} error:`, response.error);
          return { success: false, error: response.error.message };
        }

        const data = response.data;
        
        if (data.skipped) {
          console.log(`[Aggregated Sync] Step ${stepId} skipped`);
          return { success: true };
        }

        if (data.success) {
          console.log(`[Aggregated Sync] Step ${stepId} success:`, data.message);
          return { success: true };
        } else {
          const errorMessage = typeof data.error === 'object' && data.error?.error 
            ? data.error.error 
            : (data.error || data.message || 'Failed');
          console.error(`[Aggregated Sync] Step ${stepId} failed:`, errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (error: any) {
        console.error(`[Aggregated Sync] Step ${stepId} exception:`, error);
        return { success: false, error: error.message || 'Network error' };
      }
    };

    try {
      // Step 1: Sync Customer
      console.log(`[Aggregated Sync] Starting Customer step for invoice: ${invoice.orderNumber}`);
      stepStatus.customer = 'running';
      updateAggregatedStepStatus(stepStatus);

      const customerResult = await executeStep('customer');
      if (!customerResult.success) {
        stepStatus.customer = 'failed';
        updateAggregatedStepStatus(stepStatus);
        throw new Error(`Customer: ${customerResult.error}`);
      }
      stepStatus.customer = 'found';
      updateAggregatedStepStatus(stepStatus);

      // Step 2: Sync Brand
      console.log(`[Aggregated Sync] Starting Brand step for invoice: ${invoice.orderNumber}`);
      stepStatus.brand = 'running';
      updateAggregatedStepStatus(stepStatus);

      const brandResult = await executeStep('brand');
      if (!brandResult.success) {
        stepStatus.brand = 'failed';
        updateAggregatedStepStatus(stepStatus);
        throw new Error(`Brand: ${brandResult.error}`);
      }
      stepStatus.brand = 'found';
      updateAggregatedStepStatus(stepStatus);

      // Step 3: Sync Products
      console.log(`[Aggregated Sync] Starting Product step for invoice: ${invoice.orderNumber}`);
      stepStatus.product = 'running';
      updateAggregatedStepStatus(stepStatus);

      const productResult = await executeStep('product');
      if (!productResult.success) {
        stepStatus.product = 'failed';
        updateAggregatedStepStatus(stepStatus);
        throw new Error(`Product: ${productResult.error}`);
      }
      stepStatus.product = 'found';
      updateAggregatedStepStatus(stepStatus);

      // Step 4: Create Sales Order
      console.log(`[Aggregated Sync] Starting Order step for invoice: ${invoice.orderNumber}`);
      stepStatus.order = 'running';
      updateAggregatedStepStatus(stepStatus);

      const orderResult = await executeStep('order');
      if (!orderResult.success) {
        stepStatus.order = 'failed';
        updateAggregatedStepStatus(stepStatus);
        throw new Error(`Order: ${orderResult.error}`);
      }
      stepStatus.order = 'sent';
      updateAggregatedStepStatus(stepStatus);

      // Step 5: Create Purchase Order (if non-stock products exist)
      if (invoice.hasNonStock && nonStockProducts.length > 0) {
        console.log(`[Aggregated Sync] Starting Purchase step for invoice: ${invoice.orderNumber}`);
        stepStatus.purchase = 'running';
        updateAggregatedStepStatus(stepStatus);

        const purchaseResult = await executeStep('purchase');
        if (!purchaseResult.success) {
          stepStatus.purchase = 'failed';
          updateAggregatedStepStatus(stepStatus);
          throw new Error(`Purchase: ${purchaseResult.error}`);
        }
        stepStatus.purchase = 'created';
        updateAggregatedStepStatus(stepStatus);
      } else {
        stepStatus.purchase = 'skipped';
        updateAggregatedStepStatus(stepStatus);
      }

      console.log(`[Aggregated Sync] All steps completed for invoice: ${invoice.orderNumber}`);
      return {
        syncStatus: 'success',
        stepStatus,
      };

    } catch (error) {
      console.error('[Aggregated Sync] Error syncing invoice:', invoice.orderNumber, error);
      return {
        syncStatus: 'failed',
        stepStatus,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  // Create sync run record in database
  const createSyncRun = async (): Promise<string | null> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('odoo_sync_runs')
        .insert({
          from_date: fromDate,
          to_date: toDate,
          start_time: new Date().toISOString(),
          total_orders: selectedCount,
          status: 'running',
          created_by: user?.user?.id,
        })
        .select('id')
        .single();
      
      if (error) {
        console.error('Error creating sync run:', error);
        return null;
      }
      return data?.id || null;
    } catch (error) {
      console.error('Error creating sync run:', error);
      return null;
    }
  };

  // Update sync run with final results
  const updateSyncRun = async (runId: string, status: string, groups: OrderGroup[]) => {
    try {
      const success = groups.filter(g => g.syncStatus === 'success').length;
      const failed = groups.filter(g => g.syncStatus === 'failed').length;
      const skipped = groups.filter(g => g.syncStatus === 'skipped' || g.syncStatus === 'stopped').length;

      const { error: runUpdateError } = await supabase
        .from('odoo_sync_runs')
        .update({
          end_time: new Date().toISOString(),
          successful_orders: success,
          failed_orders: failed,
          skipped_orders: skipped,
          status,
        })
        .eq('id', runId);

      if (runUpdateError) {
        console.error('Error updating sync run header:', runUpdateError);
      }

      // Details are saved per-order during sync (so we don't rely on async state at the end)
      // Nothing else to do here.
    } catch (error) {
      console.error('Error updating sync run:', error);
    }
  };

  // Handle stop request
  const handleStopSync = () => {
    stopRequestedRef.current = true;
    setStopRequested(true);
    toast({
      title: language === 'ar' ? 'إيقاف المزامنة' : 'Stopping Sync',
      description: language === 'ar' ? 'سيتم إيقاف المزامنة بعد الطلب الحالي' : 'Sync will stop after the current order',
    });
  };

  // Start background sync process
  const handleStartBackgroundSync = async () => {
    const toSync = orderGroups.filter(g => g.selected && !g.skipSync);
    if (toSync.length === 0) {
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'لا توجد طلبات' : 'No Orders',
        description: language === 'ar' ? 'يرجى اختيار طلبات للمزامنة' : 'Please select orders to sync',
      });
      return;
    }

    if (!fromDate || !toDate) {
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يجب تحديد نطاق التاريخ' : 'Date range is required',
      });
      return;
    }

    setStartingBackgroundSync(true);

    try {
      // Get current user info
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        throw new Error('User not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_name, email')
        .eq('user_id', userData.user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Create background job record
      const { data: job, error: jobError } = await supabase
        .from('background_sync_jobs')
        .insert({
          user_id: userData.user.id,
          user_email: profile.email,
          user_name: profile.user_name,
          from_date: fromDate,
          to_date: toDate,
          total_orders: toSync.length,
          status: 'pending',
        })
        .select('id')
        .single();

      if (jobError || !job) {
        throw new Error(jobError?.message || 'Failed to create background job');
      }

      // Invoke the background sync edge function
      const { error: funcError } = await supabase.functions.invoke('sync-orders-background', {
        body: {
          jobId: job.id,
          fromDate,
          toDate,
          userId: userData.user.id,
          userEmail: profile.email,
          userName: profile.user_name,
        },
      });

      if (funcError) {
        throw new Error(funcError.message);
      }

      toast({
        title: language === 'ar' ? 'تم بدء المزامنة في الخلفية' : 'Background Sync Started',
        description: language === 'ar' 
          ? 'يمكنك إغلاق هذه الصفحة. سيتم إرسال إشعار بالبريد عند الانتهاء.'
          : 'You can close this page. An email notification will be sent when complete.',
      });

      // Navigate back to transactions
      navigate(`/transactions?from=${fromDate}&to=${toDate}`);

    } catch (error) {
      console.error('Error starting background sync:', error);
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to start background sync',
      });
    } finally {
      setStartingBackgroundSync(false);
    }
  };

  // Start sync process
  const handleStartSync = async () => {
    // When in aggregate mode, sync aggregated invoices directly (not individual orders)
    if (aggregateMode) {
      const selectedAggregated = aggregatedInvoices.filter(inv => inv.selected && !inv.skipSync);
      if (selectedAggregated.length === 0) {
        toast({
          variant: 'destructive',
          title: language === 'ar' ? 'لا توجد فواتير' : 'No Invoices',
          description: language === 'ar' ? 'يرجى اختيار فواتير للمزامنة' : 'Please select invoices to sync',
        });
        return;
      }
      
      // Sync aggregated invoices directly
      await executeAggregatedSync(selectedAggregated);
      return;
    }
    
    // Normal mode - use orderGroups selection directly
    const toSync = orderGroups.filter(g => g.selected && !g.skipSync);
    if (toSync.length === 0) {
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'لا توجد طلبات' : 'No Orders',
        description: language === 'ar' ? 'يرجى اختيار طلبات للمزامنة' : 'Please select orders to sync',
      });
      return;
    }
    
    await executeSync(toSync);
  };

  // Execute sync for aggregated invoices
  const executeAggregatedSync = async (toSync: AggregatedInvoice[]) => {
    // Reset stop flag
    stopRequestedRef.current = false;
    setStopRequested(false);

    // Set start time
    const syncStartTime = new Date();
    setStartTime(syncStartTime);
    setEndTime(null);

    // Create sync run record
    const runId = await createSyncRun();
    setCurrentRunId(runId);

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncComplete(false);

    let processedCount = 0;
    let stoppedEarly = false;

    for (let i = 0; i < toSync.length; i++) {
      // Check if stop was requested
      if (stopRequestedRef.current) {
        stoppedEarly = true;
        // Mark remaining invoices as stopped
        const remainingInvoices = toSync.slice(i);
        setAggregatedInvoices(prev => prev.map(inv => {
          const isRemaining = remainingInvoices.some(r => r.orderNumber === inv.orderNumber);
          if (isRemaining && inv.syncStatus === 'pending') {
            return { ...inv, syncStatus: 'stopped' };
          }
          return inv;
        }));
        break;
      }

      const invoice = toSync[i];

      // Mark as running
      setAggregatedInvoices(prev => prev.map(inv => 
        inv.orderNumber === invoice.orderNumber ? { ...inv, syncStatus: 'running' } : inv
      ));

      // Sync the aggregated invoice
      const result = await syncAggregatedInvoice(invoice);

      // Update with result
      setAggregatedInvoices(prev => prev.map(inv => 
        inv.orderNumber === invoice.orderNumber ? { ...inv, ...result } : inv
      ));

      // If success, mark all original orders as synced in database
      if (result.syncStatus === 'success') {
        for (const originalOrderNumber of invoice.originalOrderNumbers) {
          await supabase
            .from('purpletransaction')
            .update({ sendodoo: true })
            .eq('order_number', originalOrderNumber);
        }
      }

      processedCount++;
      setSyncProgress(Math.round((processedCount / toSync.length) * 100));
    }

    // Mark skipped invoices
    setAggregatedInvoices(prev => prev.map(inv => 
      inv.skipSync && inv.selected ? { ...inv, syncStatus: 'skipped' } : inv
    ));

    // Set end time
    const syncEndTime = new Date();
    setEndTime(syncEndTime);

    setIsSyncing(false);
    setSyncComplete(true);

    // Update sync run in database
    if (runId) {
      const success = toSync.filter(inv => {
        const current = aggregatedInvoices.find(a => a.orderNumber === inv.orderNumber);
        return current?.syncStatus === 'success';
      }).length;
      const failed = toSync.filter(inv => {
        const current = aggregatedInvoices.find(a => a.orderNumber === inv.orderNumber);
        return current?.syncStatus === 'failed';
      }).length;

      await supabase
        .from('odoo_sync_runs')
        .update({
          end_time: syncEndTime.toISOString(),
          successful_orders: success,
          failed_orders: failed,
          skipped_orders: stoppedEarly ? toSync.length - processedCount : 0,
          status: stoppedEarly ? 'stopped' : (failed > 0 ? 'completed_with_errors' : 'completed'),
        })
        .eq('id', runId);
    }

    // Show completion toast
    const successCount = toSync.filter(inv => {
      const current = aggregatedInvoices.find(a => a.orderNumber === inv.orderNumber);
      return current?.syncStatus === 'success';
    }).length;
    const failedCount = toSync.filter(inv => {
      const current = aggregatedInvoices.find(a => a.orderNumber === inv.orderNumber);
      return current?.syncStatus === 'failed';
    }).length;

    toast({
      title: language === 'ar' ? 'اكتملت المزامنة' : 'Sync Complete',
      description: language === 'ar' 
        ? `تم: ${successCount} | فشل: ${failedCount}`
        : `Success: ${successCount} | Failed: ${failedCount}`,
    });
  };

  // Execute sync for given orders
  const executeSync = async (toSync: OrderGroup[]) => {

    // Reset stop flag
    stopRequestedRef.current = false;
    setStopRequested(false);

    // Set start time
    const syncStartTime = new Date();
    setStartTime(syncStartTime);
    setEndTime(null);

    // Create sync run record
    const runId = await createSyncRun();
    setCurrentRunId(runId);

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncComplete(false);

    let processedCount = 0;
    let stoppedEarly = false;
    
    // Track results for database storage (since state updates are async)
    const syncResults: Map<string, Partial<OrderGroup>> = new Map();

    for (let i = 0; i < toSync.length; i++) {
      // Check if stop was requested
      if (stopRequestedRef.current) {
        stoppedEarly = true;
        // Mark remaining orders as stopped
        const remainingOrders = toSync.slice(i);
        remainingOrders.forEach(g => {
          syncResults.set(g.orderNumber, { syncStatus: 'stopped' });
        });
        setOrderGroups(prev => prev.map(g => {
          const isRemaining = remainingOrders.some(ts => ts.orderNumber === g.orderNumber);
          if (isRemaining && g.syncStatus === 'pending') {
            return { ...g, syncStatus: 'stopped' };
          }
          return g;
        }));
        break;
      }

      const group = toSync[i];
      setCurrentOrderIndex(orderGroups.findIndex(g => g.orderNumber === group.orderNumber));

      // Mark as running
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, syncStatus: 'running' } : g
      ));

      // Sync the order
      const result = await syncSingleOrder(group);
      
      // Store result for database
      syncResults.set(group.orderNumber, result);

      // Save this order detail immediately (avoid relying on async state)
      if (runId) {
        const mergedForDb: OrderGroup = { ...group, ...result } as OrderGroup;
        const { error: perOrderInsertError } = await supabase
          .from('odoo_sync_run_details')
          .insert({
            run_id: runId,
            order_number: mergedForDb.orderNumber,
            order_date: mergedForDb.date ? mergedForDb.date.slice(0, 10) : null,
            customer_phone: mergedForDb.customerPhone || null,
            product_names: mergedForDb.productNames.join(', ') || null,
            total_amount: mergedForDb.totalAmount,
            sync_status: mergedForDb.syncStatus,
            error_message: mergedForDb.errorMessage ? translateOdooError(mergedForDb.errorMessage, language) : null,
            step_customer: mergedForDb.stepStatus.customer,
            step_brand: mergedForDb.stepStatus.brand,
            step_product: mergedForDb.stepStatus.product,
            step_order: mergedForDb.stepStatus.order,
            step_purchase: mergedForDb.stepStatus.purchase,
          });

        if (perOrderInsertError) {
          console.error('Error saving per-order sync detail:', perOrderInsertError);
        }
      }

      // Update with result
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, ...result } : g
      ));

      processedCount++;
      // Update progress
      setSyncProgress(Math.round((processedCount / toSync.length) * 100));
    }

    // Mark skipped orders
    const skippedOrders = orderGroups.filter(g => g.skipSync && g.selected);
    skippedOrders.forEach(g => {
      syncResults.set(g.orderNumber, { syncStatus: 'skipped' });
    });
    setOrderGroups(prev => prev.map(g => 
      g.skipSync && g.selected ? { ...g, syncStatus: 'skipped' } : g
    ));

    // Set end time
    const syncEndTime = new Date();
    setEndTime(syncEndTime);

    setIsSyncing(false);
    setCurrentOrderIndex(-1);
    setSyncComplete(true);

    // Update sync run in database with tracked results
    if (runId) {
      // Build final groups with tracked results
      const finalGroups = orderGroups.map(g => {
        const result = syncResults.get(g.orderNumber);
        if (result) {
          return { ...g, ...result };
        }
        return g;
      });
      await updateSyncRun(runId, stoppedEarly ? 'stopped' : 'completed', finalGroups);
    }

    toast({
      title: stoppedEarly 
        ? (language === 'ar' ? 'تم إيقاف المزامنة' : 'Sync Stopped')
        : (language === 'ar' ? 'اكتملت المزامنة' : 'Sync Complete'),
      description: language === 'ar' 
        ? `تمت معالجة ${processedCount} من ${toSync.length} طلب(ات)`
        : `Processed ${processedCount} of ${toSync.length} order(s)`,
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
  const getSyncStatusBadge = (item: { syncStatus: string; errorMessage?: string }) => {
    switch (item.syncStatus) {
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
                <p>{item.errorMessage || (language === 'ar' ? 'خطأ غير معروف' : 'Unknown error')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'skipped':
        return <Badge variant="secondary" className="gap-1"><SkipForward className="h-3 w-3" />{language === 'ar' ? 'تخطي' : 'Skipped'}</Badge>;
      case 'stopped':
        return <Badge variant="outline" className="gap-1 border-orange-500 text-orange-500"><StopCircle className="h-3 w-3" />{language === 'ar' ? 'متوقف' : 'Stopped'}</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{language === 'ar' ? 'معلق' : 'Pending'}</Badge>;
    }
  };

  // Summary stats
  const summary = useMemo(() => {
    const total = orderGroups.length;
    const success = orderGroups.filter(g => g.syncStatus === 'success').length;
    const failed = orderGroups.filter(g => g.syncStatus === 'failed').length;
    const skipped = orderGroups.filter(g => g.syncStatus === 'skipped' || g.syncStatus === 'stopped').length;
    
    // Count created items (status === 'created')
    const customersCreated = orderGroups.filter(g => g.stepStatus.customer === 'created').length;
    const brandsCreated = orderGroups.filter(g => g.stepStatus.brand === 'created').length;
    const productsCreated = orderGroups.filter(g => g.stepStatus.product === 'created').length;
    const ordersCreated = orderGroups.filter(g => g.stepStatus.order === 'sent').length;
    const purchasesCreated = orderGroups.filter(g => g.stepStatus.purchase === 'created').length;
    
    return { total, success, failed, skipped, customersCreated, brandsCreated, productsCreated, ordersCreated, purchasesCreated };
  }, [orderGroups]);

  // Get failed orders for dialog
  const failedOrders = useMemo(() => 
    orderGroups.filter(g => g.syncStatus === 'failed'),
    [orderGroups]
  );

  // Get successful orders for dialog
  const successfulOrders = useMemo(() => 
    orderGroups.filter(g => g.syncStatus === 'success'),
    [orderGroups]
  );

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleShowHistory}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            {language === 'ar' ? 'السجل' : 'History'}
          </Button>
          {isSyncing && (
            <Button 
              variant="destructive"
              onClick={handleStopSync}
              disabled={stopRequested}
              className="gap-2"
            >
              <StopCircle className="h-4 w-4" />
              {stopRequested 
                ? (language === 'ar' ? 'جاري الإيقاف...' : 'Stopping...')
                : (language === 'ar' ? 'إيقاف' : 'Stop')}
            </Button>
          )}
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
          <Button 
            onClick={handleStartBackgroundSync} 
            disabled={isSyncing || selectedCount === 0 || startingBackgroundSync}
            variant="secondary"
            className="gap-2"
          >
            {startingBackgroundSync ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {language === 'ar' ? 'جاري البدء...' : 'Starting...'}
              </>
            ) : (
            <>
                <Cloud className="h-4 w-4" />
                {language === 'ar' ? 'تشغيل في الخلفية' : 'Run Process'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress bar with time info */}
      {(isSyncing || syncComplete) && startTime && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-4">
                  <span>{language === 'ar' ? 'التقدم' : 'Progress'}: {syncProgress}%</span>
                  {currentRunId && (
                    <span className="text-muted-foreground">
                      {language === 'ar' ? 'معرف التشغيل:' : 'Run ID:'} {currentRunId.slice(0, 8)}...
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {language === 'ar' ? 'وقت البدء:' : 'Start:'} {format(startTime, 'HH:mm:ss')}
                  {endTime && (
                    <>
                      {' - '}
                      {language === 'ar' ? 'الانتهاء:' : 'End:'} {format(endTime, 'HH:mm:ss')}
                      {' | '}
                      <span className="font-medium text-primary">
                        {language === 'ar' ? 'المدة:' : 'Duration:'} {formatDuration(startTime, endTime)}
                      </span>
                    </>
                  )}
                </span>
              </div>
              <Progress value={syncProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary (after sync) */}
      {syncComplete && (
        <div className="space-y-4">
          {/* Run Info */}
          {currentRunId && startTime && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{language === 'ar' ? 'معلومات التشغيل' : 'Run Information'}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'معرف التشغيل:' : 'Run ID:'} <span className="font-mono">{currentRunId}</span>
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm">
                      {language === 'ar' ? 'تاريخ التشغيل:' : 'Run Date:'} {format(startTime, 'yyyy-MM-dd')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(startTime, 'HH:mm:ss')} - {endTime ? format(endTime, 'HH:mm:ss') : '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
            <Card 
              className={cn(
                summary.failed > 0 && "cursor-pointer hover:border-destructive/50 transition-colors"
              )}
              onClick={() => summary.failed > 0 && setShowFailedDialog(true)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
                    <p className="text-muted-foreground text-sm">{language === 'ar' ? 'فشل' : 'Failed'}</p>
                  </div>
                  {summary.failed > 0 && (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
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
            <div className="flex items-center gap-4">
              <span>{language === 'ar' ? 'الطلبات' : 'Orders'}</span>
              <div className="flex items-center gap-2">
                <Switch
                  id="aggregate-mode"
                  checked={aggregateMode}
                  onCheckedChange={setAggregateMode}
                  disabled={isSyncing}
                />
                <Label htmlFor="aggregate-mode" className="text-sm font-normal flex items-center gap-1 cursor-pointer">
                  <Layers className="h-4 w-4" />
                  {language === 'ar' ? 'تجميع البيانات' : 'Aggregate Data'}
                </Label>
              </div>
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              {aggregateMode 
                ? (language === 'ar' 
                    ? `${selectedAggregatedCount} من ${aggregatedInvoices.length} فاتورة مجمعة`
                    : `${selectedAggregatedCount} of ${aggregatedInvoices.length} aggregated invoices`)
                : (language === 'ar' 
                    ? `${selectedCount} من ${orderGroups.length} محدد`
                    : `${selectedCount} of ${orderGroups.length} selected`)}
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
          ) : aggregateMode && aggregatedInvoices.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={allAggregatedSelected}
                        onCheckedChange={handleSelectAllAggregated}
                        disabled={isSyncing}
                      />
                    </TableHead>
                    <TableHead>{language === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'عدد الطلبات' : 'Lines'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</TableHead>
                    <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
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
                  {aggregatedInvoices.map((invoice, idx) => (
                    <TableRow 
                      key={invoice.orderNumber}
                      className={cn(
                        invoice.syncStatus === 'success' && 'bg-green-50 dark:bg-green-950/20',
                        invoice.syncStatus === 'failed' && 'bg-red-50 dark:bg-red-950/20',
                        invoice.syncStatus === 'running' && 'bg-muted/50'
                      )}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={invoice.selected}
                          onCheckedChange={(checked) => handleSelectAggregatedRow(invoice.orderNumber, checked as boolean)}
                          disabled={isSyncing}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{invoice.orderNumber}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {invoice.originalOrderNumbers.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {invoice.date ? format(parseISO(invoice.date), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs" title={invoice.brandName}>
                        {invoice.brandName || '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {invoice.paymentMethod}/{invoice.paymentBrand}
                      </TableCell>
                      <TableCell className="text-xs text-primary">{invoice.userName || '-'}</TableCell>
                      <TableCell className="text-xs font-bold">{invoice.grandTotal.toFixed(2)} SAR</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleSkipAggregated(invoice.orderNumber)}
                          disabled={isSyncing || invoice.syncStatus !== 'pending'}
                          className={invoice.skipSync ? 'text-destructive' : ''}
                        >
                          {invoice.skipSync ? (
                            <SkipForward className="h-4 w-4" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getSyncStatusBadge(invoice)}
                          {invoice.syncStatus === 'failed' && invoice.errorMessage && (
                            <span className="text-xs text-destructive max-w-[150px] break-words">
                              {translateOdooError(invoice.errorMessage, language)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStepIcon(invoice.stepStatus.customer)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStepIcon(invoice.stepStatus.brand)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStepIcon(invoice.stepStatus.product)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStepIcon(invoice.stepStatus.order)}
                      </TableCell>
                      <TableCell className="text-center">
                        {invoice.hasNonStock ? getStepIcon(invoice.stepStatus.purchase) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        {invoice.errorMessage && (
                          <p className="text-xs text-destructive truncate max-w-[120px]" title={translateOdooError(invoice.errorMessage, language)}>
                            {translateOdooError(invoice.errorMessage, language)}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
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
                        group.syncStatus === 'failed' && 'bg-red-50 dark:bg-red-950/20',
                        group.syncStatus === 'stopped' && 'bg-orange-50 dark:bg-orange-950/20'
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

      {/* Failed Orders Dialog */}
      <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              {language === 'ar' ? 'الطلبات الفاشلة' : 'Failed Orders'} ({failedOrders.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order Number'}</TableHead>
                  <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{language === 'ar' ? 'هاتف العميل' : 'Customer Phone'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المنتجات' : 'Products'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead>{language === 'ar' ? 'سبب الفشل' : 'Error Description'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedOrders.map((group) => (
                  <TableRow key={group.orderNumber}>
                    <TableCell className="font-mono">{group.orderNumber}</TableCell>
                    <TableCell>
                      {group.date ? format(parseISO(group.date), 'yyyy-MM-dd') : '-'}
                    </TableCell>
                    <TableCell>{group.customerPhone || '-'}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm" title={group.productNames.join(', ')}>
                        {group.productNames.slice(0, 2).join(', ')}
                        {group.productNames.length > 2 && ` +${group.productNames.length - 2}`}
                      </span>
                    </TableCell>
                    <TableCell>{group.totalAmount.toFixed(2)} SAR</TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm text-destructive break-words">
                        {translateOdooError(group.errorMessage || (language === 'ar' ? 'خطأ غير معروف' : 'Unknown error'), language)}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {language === 'ar' ? 'سجل المزامنة' : 'Sync History'}
              <span className="text-muted-foreground text-sm font-normal">
                ({fromDate} → {toDate})
              </span>
            </DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : syncHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا يوجد سجل سابق' : 'No previous sync history'}
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'معرف التشغيل' : 'Run ID'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ التشغيل' : 'Run Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الوقت' : 'Time'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المدة' : 'Duration'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                    <TableHead>{language === 'ar' ? 'نجح' : 'Success'}</TableHead>
                    <TableHead>{language === 'ar' ? 'فشل' : 'Failed'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التفاصيل' : 'Details'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((run) => {
                    const runStartTime = parseISO(run.start_time);
                    const runEndTime = run.end_time ? parseISO(run.end_time) : null;
                    return (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-xs">{run.id.slice(0, 8)}...</TableCell>
                        <TableCell>{format(runStartTime, 'yyyy-MM-dd')}</TableCell>
                        <TableCell>
                          {format(runStartTime, 'HH:mm:ss')}
                          {runEndTime && ` - ${format(runEndTime, 'HH:mm:ss')}`}
                        </TableCell>
                        <TableCell>
                          {runEndTime ? formatDuration(runStartTime, runEndTime) : '-'}
                        </TableCell>
                        <TableCell>{run.total_orders}</TableCell>
                        <TableCell className="text-green-500">{run.successful_orders}</TableCell>
                        <TableCell className="text-destructive">{run.failed_orders}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={run.status === 'completed' ? 'default' : run.status === 'stopped' ? 'secondary' : 'destructive'}
                            className={run.status === 'completed' ? 'bg-green-500' : ''}
                          >
                            {run.status === 'completed' 
                              ? (language === 'ar' ? 'مكتمل' : 'Completed')
                              : run.status === 'stopped'
                              ? (language === 'ar' ? 'متوقف' : 'Stopped')
                              : run.status === 'running'
                              ? (language === 'ar' ? 'جاري' : 'Running')
                              : run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadRunDetails(run)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Run Details Dialog */}
      <Dialog open={showRunDetailsDialog} onOpenChange={setShowRunDetailsDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {language === 'ar' ? 'تفاصيل التشغيل' : 'Run Details'}
              {selectedRunInfo && (
                <span className="text-muted-foreground text-sm font-normal">
                  {format(parseISO(selectedRunInfo.start_time), 'yyyy-MM-dd HH:mm:ss')}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {/* Run Summary */}
          {selectedRunInfo && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold">{selectedRunInfo.total_orders}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الإجمالي' : 'Total'}</div>
              </div>
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-500">{selectedRunInfo.successful_orders}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'نجح' : 'Success'}</div>
              </div>
              <div className="bg-destructive/10 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-destructive">{selectedRunInfo.failed_orders}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'فشل' : 'Failed'}</div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-muted-foreground">{selectedRunInfo.skipped_orders}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'تخطي' : 'Skipped'}</div>
              </div>
            </div>
          )}

          {loadingRunDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : selectedRunDetails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا توجد تفاصيل' : 'No details available'}
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order Number'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'هاتف العميل' : 'Customer Phone'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المنتجات' : 'Products'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الخطأ' : 'Error'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRunDetails.map((detail) => (
                    <TableRow 
                      key={detail.id}
                      className={cn(
                        detail.sync_status === 'success' && 'bg-green-50 dark:bg-green-950/20',
                        detail.sync_status === 'failed' && 'bg-red-50 dark:bg-red-950/20'
                      )}
                    >
                      <TableCell className="font-mono">{detail.order_number}</TableCell>
                      <TableCell>
                        {detail.order_date ? format(parseISO(detail.order_date), 'yyyy-MM-dd') : '-'}
                      </TableCell>
                      <TableCell>{detail.customer_phone || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={detail.product_names || ''}>
                        {detail.product_names || '-'}
                      </TableCell>
                      <TableCell>{detail.total_amount?.toFixed(2) || '-'} SAR</TableCell>
                      <TableCell>
                        <Badge 
                          variant={detail.sync_status === 'success' ? 'default' : detail.sync_status === 'failed' ? 'destructive' : 'secondary'}
                          className={detail.sync_status === 'success' ? 'bg-green-500' : ''}
                        >
                          {detail.sync_status === 'success' 
                            ? (language === 'ar' ? 'نجح' : 'Success')
                            : detail.sync_status === 'failed'
                            ? (language === 'ar' ? 'فشل' : 'Failed')
                            : detail.sync_status === 'skipped'
                            ? (language === 'ar' ? 'تخطي' : 'Skipped')
                            : detail.sync_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        {detail.error_message && (
                          <p className="text-xs text-destructive break-words">
                            {translateOdooError(detail.error_message, language)}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Helper for cn
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default OdooSyncBatch;
