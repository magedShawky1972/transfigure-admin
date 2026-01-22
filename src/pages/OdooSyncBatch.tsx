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
import { ArrowLeft, Play, CheckCircle2, XCircle, Clock, Loader2, SkipForward, RefreshCw, StopCircle, Eye, History, Cloud, Layers, Filter, X, Users, ShoppingCart, Package, AlertTriangle, DollarSign, Hash, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    vendorName?: string;
    costPrice?: number;
    costSold?: number;
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
  const [aggregateMode, setAggregateMode] = useState(true);
  const [separateByDay, setSeparateByDay] = useState(true);
  const [aggregatedInvoices, setAggregatedInvoices] = useState<AggregatedInvoice[]>([]);

  // Supplier check states
  const [checkingSuppliers, setCheckingSuppliers] = useState(false);
  const [supplierCheckResult, setSupplierCheckResult] = useState<{
    totalVendors: number;
    readyCount: number;
    issueCount: number;
    missingSupplierRecord: Array<{ vendor_name: string }>;
    missingOdooId: Array<{ vendor_name: string; supplier_code?: string }>;
    notInOdoo: Array<{ vendor_name: string; supplier_code?: string; partner_profile_id?: number | null; error?: string }>;
    inOdoo: Array<{ vendor_name: string; supplier_code?: string; partner_profile_id?: number | null }>;
  } | null>(null);
  const [showSuppliersDialog, setShowSuppliersDialog] = useState(false);
  const [supplierCheckDone, setSupplierCheckDone] = useState(false);
  
  // Invoice detail dialog state
  const [showInvoiceDetailDialog, setShowInvoiceDetailDialog] = useState(false);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<AggregatedInvoice | null>(null);

  // Filter states
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterProduct, setFilterProduct] = useState<string>('');
  const [filterOrderNumber, setFilterOrderNumber] = useState<string>('');
  const [filterHasPurchase, setFilterHasPurchase] = useState<string>('all');

  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  // Get unique brands and products from order groups for filter dropdowns
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    orderGroups.forEach(g => {
      g.lines.forEach(l => {
        if (l.brand_name) brands.add(l.brand_name);
      });
    });
    return Array.from(brands).sort();
  }, [orderGroups]);

  const uniqueProducts = useMemo(() => {
    const products = new Map<string, string>();
    orderGroups.forEach(g => {
      g.lines.forEach(l => {
        if (l.sku || l.product_id) {
          const key = l.sku || l.product_id || '';
          if (!products.has(key)) {
            products.set(key, l.product_name || key);
          }
        }
      });
    });
    // Filter by selected brand if applicable
    if (filterBrand && filterBrand !== 'all_brands') {
      const filteredProducts = new Map<string, string>();
      orderGroups.forEach(g => {
        g.lines.forEach(l => {
          if (l.brand_name === filterBrand && (l.sku || l.product_id)) {
            const key = l.sku || l.product_id || '';
            if (!filteredProducts.has(key)) {
              filteredProducts.set(key, l.product_name || key);
            }
          }
        });
      });
      return Array.from(filteredProducts.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }
    return Array.from(products.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [orderGroups, filterBrand]);

  // Filtered order groups based on filter criteria
  const filteredOrderGroups = useMemo(() => {
    return orderGroups.filter(g => {
      // Filter by brand (skip if 'all_brands' or empty)
      if (filterBrand && filterBrand !== 'all_brands') {
        const hasBrand = g.lines.some(l => l.brand_name === filterBrand);
        if (!hasBrand) return false;
      }
      // Filter by product (skip if 'all_products' or empty)
      if (filterProduct && filterProduct !== 'all_products') {
        const hasProduct = g.lines.some(l => (l.sku || l.product_id) === filterProduct);
        if (!hasProduct) return false;
      }
      // Filter by order number
      if (filterOrderNumber) {
        if (!g.orderNumber.toLowerCase().includes(filterOrderNumber.toLowerCase())) return false;
      }
      // Filter by has purchase to send
      if (filterHasPurchase === 'yes') {
        if (!g.hasNonStock) return false;
      } else if (filterHasPurchase === 'no') {
        if (g.hasNonStock) return false;
      }
      return true;
    });
  }, [orderGroups, filterBrand, filterProduct, filterOrderNumber, filterHasPurchase]);

  // Filtered aggregated invoices based on filter criteria
  const filteredAggregatedInvoices = useMemo(() => {
    return aggregatedInvoices.filter(inv => {
      // Filter by brand (skip if 'all_brands' or empty)
      if (filterBrand && filterBrand !== 'all_brands' && inv.brandName !== filterBrand) return false;
      // Filter by product (skip if 'all_products' or empty)
      if (filterProduct && filterProduct !== 'all_products') {
        const hasProduct = inv.productLines.some(pl => pl.productSku === filterProduct);
        if (!hasProduct) return false;
      }
      // Filter by order number (search in original order numbers and aggregated order number)
      if (filterOrderNumber) {
        const matchesAggregated = inv.orderNumber.toLowerCase().includes(filterOrderNumber.toLowerCase());
        const matchesOriginal = inv.originalOrderNumbers.some(o => o.toLowerCase().includes(filterOrderNumber.toLowerCase()));
        if (!matchesAggregated && !matchesOriginal) return false;
      }
      // Filter by has purchase to send
      if (filterHasPurchase === 'yes') {
        if (!inv.hasNonStock) return false;
      } else if (filterHasPurchase === 'no') {
        if (inv.hasNonStock) return false;
      }
      return true;
    });
  }, [aggregatedInvoices, filterBrand, filterProduct, filterOrderNumber, filterHasPurchase]);

  // Reset product filter when brand changes
  useEffect(() => {
    if (filterBrand && filterBrand !== 'all_brands' && filterProduct && filterProduct !== 'all_products') {
      // Check if the selected product belongs to the selected brand
      const productBelongsToBrand = orderGroups.some(g =>
        g.lines.some(l => l.brand_name === filterBrand && (l.sku || l.product_id) === filterProduct)
      );
      if (!productBelongsToBrand) {
        setFilterProduct('');
      }
    }
  }, [filterBrand, filterProduct, orderGroups]);

  // Clear all filters
  const clearFilters = () => {
    setFilterBrand('');
    setFilterProduct('');
    setFilterOrderNumber('');
    setFilterHasPurchase('all');
  };

  const hasActiveFilters = (filterBrand && filterBrand !== 'all_brands') || 
                           (filterProduct && filterProduct !== 'all_products') || 
                           filterOrderNumber || 
                           filterHasPurchase !== 'all';

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

  // Check suppliers in Odoo - now checks specifically vendors used in orders
  const checkSuppliersInOdoo = async () => {
    setCheckingSuppliers(true);
    setSupplierCheckResult(null);
    setSupplierCheckDone(false);
    
    try {
      // Extract unique vendor names from non-stock products in orders
      const vendorNames = [...new Set(
        (aggregateMode && aggregatedInvoices.length > 0 ? aggregatedInvoices : orderGroups)
          .filter(item => item.hasNonStock)
          .flatMap(item => {
            if ('productLines' in item) {
              // AggregatedInvoice
              return item.productLines.map(pl => pl.vendorName).filter(Boolean);
            } else {
              // OrderGroup
              return item.lines
                .filter(l => nonStockSkuSet.has(l.sku || l.product_id || ''))
                .map(l => l.vendor_name)
                .filter(Boolean);
            }
          })
      )].filter(Boolean) as string[];

      console.log('Checking vendors:', vendorNames);

      const { data, error } = await supabase.functions.invoke('check-suppliers-odoo', {
        body: { vendor_names: vendorNames }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        setSupplierCheckResult({
          totalVendors: data.total_vendors_in_orders || 0,
          readyCount: data.ready_count || 0,
          issueCount: data.issue_count || 0,
          missingSupplierRecord: data.missing_supplier_record || [],
          missingOdooId: data.missing_odoo_id || [],
          notInOdoo: data.not_in_odoo || [],
          inOdoo: data.in_odoo || [],
        });
        setSupplierCheckDone(true);
        
        const totalIssues = (data.missing_supplier_record?.length || 0) + 
                           (data.missing_odoo_id?.length || 0) + 
                           (data.not_in_odoo?.length || 0);
        
        if (totalIssues > 0) {
          toast({
            variant: 'destructive',
            title: language === 'ar' ? 'مشاكل في الموردين' : 'Supplier Issues Found',
            description: language === 'ar' 
              ? `${totalIssues} مورد يحتاج إلى إعداد`
              : `${totalIssues} supplier(s) need configuration`,
          });
        } else if (vendorNames.length === 0) {
          toast({
            title: language === 'ar' ? 'لا يوجد موردين' : 'No Suppliers',
            description: language === 'ar' 
              ? 'لا توجد منتجات غير مخزنية تتطلب موردين'
              : 'No non-stock products requiring suppliers',
          });
        } else {
          toast({
            title: language === 'ar' ? 'تم' : 'Success',
            description: language === 'ar' 
              ? `جميع الموردين (${data.ready_count}) جاهزون`
              : `All suppliers (${data.ready_count}) ready`,
          });
        }
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error checking suppliers:', error);
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل التحقق من الموردين' : 'Failed to check suppliers',
      });
    } finally {
      setCheckingSuppliers(false);
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
        
        // Fetch ALL transactions using batch fetching (Supabase has 1000 row limit per query)
        const BATCH_SIZE = 1000;
        let allData: any[] = [];
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const { data: batchData, error: batchError } = await supabase
            .from('purpletransaction')
            .select('*')
            .gte('created_at_date_int', fromDateInt)
            .lte('created_at_date_int', toDateInt)
            .neq('payment_method', 'point')
            .eq('is_deleted', false)
            .or('sendodoo.is.null,sendodoo.eq.false')
            .order('created_at_date_int', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);
          
          if (batchError) throw batchError;
          
          if (batchData && batchData.length > 0) {
            allData = [...allData, ...batchData];
            offset += BATCH_SIZE;
            hasMore = batchData.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }
        
        const data = allData;

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

  // Toggle select all (only for filtered items)
  const handleSelectAll = (checked: boolean) => {
    const filteredOrderNumbers = new Set(filteredOrderGroups.map(g => g.orderNumber));
    setOrderGroups(prev => prev.map(g => 
      filteredOrderNumbers.has(g.orderNumber) ? { ...g, selected: checked } : g
    ));
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

  // Count selected orders (from filtered)
  const selectedCount = useMemo(() => 
    filteredOrderGroups.filter(g => g.selected && !g.skipSync).length,
    [filteredOrderGroups]
  );

  // Build aggregated invoices when aggregate mode is on
  useEffect(() => {
    if (!aggregateMode || orderGroups.length === 0) {
      setAggregatedInvoices([]);
      return;
    }
    
    const buildAggregatedInvoices = async () => {
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
          // When separateByDay is false, use a fixed date part to consolidate all days
          const datePart = separateByDay ? dateOnly : 'ALL';
          const invoiceKey = `${datePart}|${line.brand_name || ''}|${line.payment_method}|${line.payment_brand}|${line.user_name || ''}`;

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
      
      // Get unique dates to fetch max sequence from database
      const uniqueDates = new Set<string>();
      sortedKeys.forEach(invoiceKey => {
        const invoice = invoiceMap.get(invoiceKey)!;
        const dateStr = invoice.date?.replace(/-/g, '') || format(new Date(), 'yyyyMMdd');
        uniqueDates.add(dateStr);
      });
      
      // Fetch ALL existing mappings to check which original orders have been synced before
      // Note: Orders in this list may need re-sync (sendodoo=false), so we don't filter them out
      // We just use the existing aggregated order number if available
      const allOriginalOrderNumbers: string[] = [];
      sortedKeys.forEach(invoiceKey => {
        const invoice = invoiceMap.get(invoiceKey)!;
        allOriginalOrderNumbers.push(...invoice.originalOrderNumbers);
      });
      
      const { data: existingMappingsData } = await supabase
        .from('aggregated_order_mapping')
        .select('original_order_number, aggregated_order_number')
        .in('original_order_number', allOriginalOrderNumbers);
      
      // Create a map of original order -> aggregated order number (for re-use if re-syncing)
      const existingMappingMap = new Map<string, string>();
      existingMappingsData?.forEach(m => {
        existingMappingMap.set(m.original_order_number, m.aggregated_order_number);
      });
      
      // Fetch max sequence for each date from aggregated_order_mapping table
      const dateSequenceMap = new Map<string, number>();
      for (const dateStr of uniqueDates) {
        const { data: existingMappings } = await supabase
          .from('aggregated_order_mapping')
          .select('aggregated_order_number')
          .eq('aggregation_date', `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`)
          .order('aggregated_order_number', { ascending: false })
          .limit(1);
        
        if (existingMappings && existingMappings.length > 0) {
          // Extract sequence from order number (last 4 digits)
          const lastOrderNumber = existingMappings[0].aggregated_order_number;
          const lastSeq = parseInt(lastOrderNumber.slice(-4), 10) || 0;
          dateSequenceMap.set(dateStr, lastSeq);
        } else {
          dateSequenceMap.set(dateStr, 0);
        }
      }
      
      sortedKeys.forEach(invoiceKey => {
        const invoice = invoiceMap.get(invoiceKey)!;
        const dateStr = invoice.date?.replace(/-/g, '') || format(new Date(), 'yyyyMMdd');
        
        // Check if any original order already has an aggregated order number (for re-sync scenario)
        // If so, reuse that aggregated order number instead of generating a new one
        let orderNumber: string;
        const existingAggregatedOrderNumber = invoice.originalOrderNumbers
          .map(orderNum => existingMappingMap.get(orderNum))
          .find(aggNum => aggNum !== undefined);
        
        if (existingAggregatedOrderNumber) {
          // Re-sync scenario: use existing aggregated order number
          orderNumber = existingAggregatedOrderNumber;
        } else {
          // New sync: generate a new aggregated order number sequence for this date
          const currentSeq = dateSequenceMap.get(dateStr) || 0;
          const nextSeq = currentSeq + 1;
          dateSequenceMap.set(dateStr, nextSeq);
          orderNumber = `${dateStr}${String(nextSeq).padStart(4, '0')}`;
        }
        
        // Aggregate product lines by SKU and unit_price
        const productMap = new Map<string, {
          productSku: string;
          productName: string;
          unitPrice: number;
          totalQty: number;
          totalAmount: number;
          vendorName: string;
          costPrice: number;
          costSold: number;
        }>();
        
        invoice.lines.forEach(line => {
          const productKey = `${line.sku || line.product_id || ''}|${line.unit_price}`;
          const existing = productMap.get(productKey);
          if (existing) {
            existing.totalQty += line.qty || 0;
            existing.totalAmount += line.total || 0;
            existing.costSold += line.cost_sold || 0;
          } else {
            productMap.set(productKey, {
              productSku: line.sku || line.product_id || '',
              productName: line.product_name || '',
              unitPrice: line.unit_price || 0,
              totalQty: line.qty || 0,
              totalAmount: line.total || 0,
              vendorName: line.vendor_name || '',
              costPrice: line.cost_price || 0,
              costSold: line.cost_sold || 0,
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
        
        // Whether this is a re-sync (has existing mapping)
        const isResync = !!existingAggregatedOrderNumber;
        
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
          selected: true, // Always select for syncing (these orders need sync based on sendodoo flag)
          skipSync: false,
          syncStatus: isResync ? 'pending' : 'pending', // Both new and re-sync start as pending
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

      // Sort - prioritize date first when separating by day
      result.sort((a, b) => {
        // When separating by day, sort by date first
        if (separateByDay) {
          const dateCompare = (a.date || '').localeCompare(b.date || '');
          if (dateCompare !== 0) return dateCompare;
        }
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

      // When separateByDay changes, we need to rebuild completely (new order numbers)
      // So we don't preserve previous state - just set the new result
      setAggregatedInvoices(result);
    };

    buildAggregatedInvoices();
  }, [orderGroups, aggregateMode, separateByDay, nonStockSkuSet]);

  // Aggregated invoice selection handlers (only for filtered items)
  const handleSelectAggregatedRow = (orderNumber: string, checked: boolean) => {
    setAggregatedInvoices(prev => prev.map(inv => 
      inv.orderNumber === orderNumber ? { ...inv, selected: checked } : inv
    ));
  };

  const handleSelectAllAggregated = (checked: boolean) => {
    const filteredOrderNumbers = new Set(filteredAggregatedInvoices.map(inv => inv.orderNumber));
    setAggregatedInvoices(prev => prev.map(inv => 
      filteredOrderNumbers.has(inv.orderNumber) ? { ...inv, selected: checked } : inv
    ));
  };

  const handleToggleSkipAggregated = (orderNumber: string) => {
    setAggregatedInvoices(prev => prev.map(inv => 
      inv.orderNumber === orderNumber ? { ...inv, skipSync: !inv.skipSync } : inv
    ));
  };

  const allAggregatedSelected = filteredAggregatedInvoices.length > 0 && filteredAggregatedInvoices.every(inv => inv.selected);
  const selectedAggregatedCount = filteredAggregatedInvoices.filter(inv => inv.selected && !inv.skipSync).length;

  const allSelected = filteredOrderGroups.length > 0 && filteredOrderGroups.every(g => g.selected);

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
    
    // For aggregated orders, use '0000' as cash customer phone (unified customer for aggregation)
    const aggregatedCustomerPhone = '0000';
    const aggregatedCustomerName = 'Cash Customer';
    
    // Create synthetic transactions that represent the aggregated order
    // Use 'any' because we only need the fields the edge function uses
    const syntheticTransactions = invoice.productLines.map((pl) => ({
      order_number: invoice.orderNumber, // Use aggregated order number
      customer_name: aggregatedCustomerName,
      customer_phone: aggregatedCustomerPhone,
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
      // Skip customer, brand, product checks for aggregated mode - go directly to order
      console.log(`[Aggregated Sync] Skipping customer/brand/product checks for aggregated invoice: ${invoice.orderNumber}`);
      stepStatus.customer = 'found';
      stepStatus.brand = 'found';
      stepStatus.product = 'found';
      updateAggregatedStepStatus(stepStatus);

      // Step 1: Create Sales Order
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
    // Check if in aggregate mode
    if (aggregateMode && aggregatedInvoices.length > 0) {
      const toSync = aggregatedInvoices.filter(inv => inv.selected && !inv.skipSync && inv.syncStatus !== 'success');
      if (toSync.length === 0) {
        toast({
          variant: 'destructive',
          title: language === 'ar' ? 'لا توجد فواتير' : 'No Invoices',
          description: language === 'ar' ? 'يرجى اختيار فواتير للمزامنة' : 'Please select invoices to sync',
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
            sync_type: 'aggregated',
          })
          .select('id')
          .single();

        if (jobError || !job) {
          throw new Error(jobError?.message || 'Failed to create background job');
        }

        // Send the pre-built aggregated invoices directly to avoid re-aggregation issues
        const selectedAggregatedInvoices = toSync.map(inv => ({
          orderNumber: inv.orderNumber,
          date: inv.date,
          brandName: inv.brandName,
          brandCode: inv.originalLines[0]?.brand_code || '',
          paymentMethod: inv.paymentMethod,
          paymentBrand: inv.paymentBrand,
          userName: inv.userName,
          company: inv.originalLines[0]?.company || 'Purple',
          productLines: inv.productLines,
          grandTotal: inv.grandTotal,
          originalOrderNumbers: inv.originalOrderNumbers,
          hasNonStock: inv.hasNonStock,
        }));

        const { error: funcError } = await supabase.functions.invoke('sync-aggregated-orders-background', {
          body: {
            jobId: job.id,
            fromDate,
            toDate,
            userId: userData.user.id,
            userEmail: profile.email,
            userName: profile.user_name,
            aggregatedInvoices: selectedAggregatedInvoices,
          },
        });

        if (funcError) {
          throw new Error(funcError.message);
        }

        toast({
          title: language === 'ar' ? 'تم بدء المزامنة المجمعة في الخلفية' : 'Aggregated Background Sync Started',
          description: language === 'ar'
            ? 'يمكنك إغلاق هذه الصفحة. سيتم إرسال إشعار بالبريد عند الانتهاء.'
            : 'You can close this page. An email notification will be sent when complete.',
        });

        navigate(`/transactions?from=${fromDate}&to=${toDate}`);
      } catch (error) {
        console.error('Error starting aggregated background sync:', error);
        toast({
          variant: 'destructive',
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: error instanceof Error ? error.message : 'Failed to start background sync',
        });
      } finally {
        setStartingBackgroundSync(false);
      }
      return;
    }

    // Normal (non-aggregate) background sync
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
          sync_type: 'orders',
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

      // If success, mark all original orders as synced and save mapping
      if (result.syncStatus === 'success' && invoice.originalOrderNumbers.length > 0) {
        // Mark original orders as synced
        await supabase
          .from('purpletransaction')
          .update({ sendodoo: true })
          .in('order_number', invoice.originalOrderNumbers);

        // Save aggregated order mapping with payment details
        const mappings = invoice.originalOrderNumbers.map(originalOrderNumber => ({
          aggregated_order_number: invoice.orderNumber,
          original_order_number: originalOrderNumber,
          aggregation_date: invoice.date,
          brand_name: invoice.brandName,
          payment_method: invoice.paymentMethod,
          payment_brand: invoice.paymentBrand,
          user_name: invoice.userName,
        }));
        
        await supabase
          .from('aggregated_order_mapping')
          .upsert(mappings, { onConflict: 'original_order_number' });
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
    // Use aggregatedInvoices when in aggregate mode, otherwise use orderGroups
    const sourceData = aggregateMode && aggregatedInvoices.length > 0 ? aggregatedInvoices : orderGroups;
    
    const total = sourceData.length;
    const success = sourceData.filter(g => g.syncStatus === 'success').length;
    const failed = sourceData.filter(g => g.syncStatus === 'failed').length;
    const skipped = sourceData.filter(g => g.syncStatus === 'skipped' || g.syncStatus === 'stopped').length;
    
    // Count created items (status === 'created')
    const customersCreated = sourceData.filter(g => g.stepStatus.customer === 'created').length;
    const brandsCreated = sourceData.filter(g => g.stepStatus.brand === 'created').length;
    const productsCreated = sourceData.filter(g => g.stepStatus.product === 'created').length;
    const ordersCreated = sourceData.filter(g => g.stepStatus.order === 'sent').length;
    const purchasesCreated = sourceData.filter(g => g.stepStatus.purchase === 'created').length;
    
    // Calculate total sales and purchase orders count
    let totalSales = 0;
    let totalPurchaseOrders = 0;
    
    if (aggregateMode && aggregatedInvoices.length > 0) {
      totalSales = aggregatedInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
      totalPurchaseOrders = aggregatedInvoices.filter(inv => inv.hasNonStock).length;
    } else {
      totalSales = orderGroups.reduce((sum, g) => sum + g.totalAmount, 0);
      totalPurchaseOrders = orderGroups.filter(g => g.hasNonStock).length;
    }
    
    return { 
      total, success, failed, skipped, 
      customersCreated, brandsCreated, productsCreated, ordersCreated, purchasesCreated,
      totalSales, totalPurchaseOrders
    };
  }, [orderGroups, aggregatedInvoices, aggregateMode]);

  // Get failed orders for dialog (keep as OrderGroup for display purposes)
  const failedOrders = useMemo(() => {
    if (aggregateMode && aggregatedInvoices.length > 0) {
      // Convert aggregated invoices to a compatible format for display
      return aggregatedInvoices.filter(g => g.syncStatus === 'failed').map(inv => ({
        orderNumber: inv.orderNumber,
        date: inv.date,
        customerPhone: '0000',
        productNames: inv.productLines.map(pl => pl.productName),
        totalAmount: inv.grandTotal,
        errorMessage: inv.errorMessage,
        syncStatus: inv.syncStatus,
      }));
    }
    return orderGroups.filter(g => g.syncStatus === 'failed');
  }, [orderGroups, aggregatedInvoices, aggregateMode]);

  // Get successful orders for dialog
  const successfulOrders = useMemo(() => {
    if (aggregateMode && aggregatedInvoices.length > 0) {
      return aggregatedInvoices.filter(g => g.syncStatus === 'success').map(inv => ({
        orderNumber: inv.orderNumber,
        date: inv.date,
        customerPhone: '0000',
        productNames: inv.productLines.map(pl => pl.productName),
        totalAmount: inv.grandTotal,
        syncStatus: inv.syncStatus,
      }));
    }
    return orderGroups.filter(g => g.syncStatus === 'success');
  }, [orderGroups, aggregatedInvoices, aggregateMode]);

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
                  {aggregateMode 
                    ? (language === 'ar' 
                        ? `${selectedAggregatedCount} من ${aggregatedInvoices.length} فاتورة مجمعة محددة`
                        : `${selectedAggregatedCount} of ${aggregatedInvoices.length} aggregated invoices selected`)
                    : (language === 'ar' 
                        ? `${selectedCount} من ${orderGroups.length} طلب محدد`
                        : `${selectedCount} of ${orderGroups.length} orders selected`)}
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

      {/* Summary Cards - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-500">
                  {summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/30 bg-indigo-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-indigo-500" />
              <div>
                <div className="text-2xl font-bold text-indigo-500">{summary.total}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'عدد الطلبات' : 'Total Count'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-500" />
              <div>
                <div className="text-2xl font-bold text-cyan-500">{summary.totalPurchaseOrders}</div>
                <p className="text-muted-foreground text-sm">{language === 'ar' ? 'أوامر الشراء' : 'Purchase Orders'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "border-amber-500/30 bg-amber-500/5 cursor-pointer hover:border-amber-500/50 transition-colors",
            supplierCheckResult && supplierCheckResult.issueCount > 0 && "border-destructive/50"
          )}
          onClick={() => {
            if (supplierCheckDone) {
              setShowSuppliersDialog(true);
            } else {
              checkSuppliersInOdoo();
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {checkingSuppliers ? (
                <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
              ) : supplierCheckResult && supplierCheckResult.issueCount > 0 ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : supplierCheckResult && supplierCheckResult.issueCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Users className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <div className={cn(
                  "text-2xl font-bold",
                  supplierCheckResult && supplierCheckResult.issueCount > 0 
                    ? "text-destructive" 
                    : supplierCheckResult && supplierCheckResult.issueCount === 0
                    ? "text-green-500"
                    : "text-amber-500"
                )}>
                  {checkingSuppliers 
                    ? (language === 'ar' ? '...' : '...') 
                    : supplierCheckDone && supplierCheckResult
                      ? `${supplierCheckResult.readyCount}/${supplierCheckResult.totalVendors}`
                      : (language === 'ar' ? 'تحقق' : 'Check')}
                </div>
                <p className="text-muted-foreground text-sm">
                  {supplierCheckDone && supplierCheckResult
                    ? supplierCheckResult.issueCount > 0
                      ? (language === 'ar' ? `${supplierCheckResult.issueCount} مشكلة` : `${supplierCheckResult.issueCount} Issue(s)`)
                      : (language === 'ar' ? 'الموردين جاهزون' : 'Suppliers Ready')
                    : (language === 'ar' ? 'تحقق من الموردين' : 'Check Suppliers')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
              {aggregateMode && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="separate-by-day"
                    checked={separateByDay}
                    onCheckedChange={setSeparateByDay}
                    disabled={isSyncing}
                  />
                  <Label htmlFor="separate-by-day" className="text-sm font-normal flex items-center gap-1 cursor-pointer">
                    {language === 'ar' ? 'فصل حسب اليوم' : 'Separate by Day'}
                  </Label>
                </div>
              )}
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              {aggregateMode 
                ? (language === 'ar' 
                    ? `${selectedAggregatedCount} من ${filteredAggregatedInvoices.length} فاتورة مجمعة`
                    : `${selectedAggregatedCount} of ${filteredAggregatedInvoices.length} aggregated invoices`)
                : (language === 'ar' 
                    ? `${selectedCount} من ${filteredOrderGroups.length} محدد`
                    : `${selectedCount} of ${filteredOrderGroups.length} selected`)}
            </span>
          </CardTitle>

          {/* Filter Section */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t mt-4">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{language === 'ar' ? 'تصفية' : 'Filters'}:</span>
            </div>
            
            {/* Order Number Filter */}
            <div className="flex items-center gap-2">
              <Input
                placeholder={language === 'ar' ? 'رقم الطلب...' : 'Order #...'}
                value={filterOrderNumber}
                onChange={(e) => setFilterOrderNumber(e.target.value)}
                className="h-9 w-[140px]"
                disabled={isSyncing}
              />
            </div>

            {/* Brand Filter */}
            <Select value={filterBrand} onValueChange={setFilterBrand} disabled={isSyncing}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder={language === 'ar' ? 'اختر العلامة التجارية' : 'Select Brand'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_brands">{language === 'ar' ? 'كل العلامات' : 'All Brands'}</SelectItem>
                {uniqueBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product Filter */}
            <Select value={filterProduct} onValueChange={setFilterProduct} disabled={isSyncing}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder={language === 'ar' ? 'اختر المنتج' : 'Select Product'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_products">{language === 'ar' ? 'كل المنتجات' : 'All Products'}</SelectItem>
                {uniqueProducts.map(([sku, name]) => (
                  <SelectItem key={sku} value={sku}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Has Purchase Filter */}
            <Select value={filterHasPurchase} onValueChange={setFilterHasPurchase} disabled={isSyncing}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder={language === 'ar' ? 'أمر شراء' : 'Purchase Order'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="yes">{language === 'ar' ? 'يوجد شراء' : 'Has Purchase'}</SelectItem>
                <SelectItem value="no">{language === 'ar' ? 'لا يوجد شراء' : 'No Purchase'}</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-9 gap-1 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                {language === 'ar' ? 'مسح' : 'Clear'}
              </Button>
            )}
          </div>
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
          ) : aggregateMode && filteredAggregatedInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد نتائج مطابقة للفلتر' : 'No results match the filter criteria'}
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="block mx-auto mt-2">
                  {language === 'ar' ? 'مسح الفلتر' : 'Clear filters'}
                </Button>
              )}
            </div>
          ) : aggregateMode && filteredAggregatedInvoices.length > 0 ? (
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
                    <TableHead className="w-12"></TableHead>
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
                  {filteredAggregatedInvoices.map((invoice, idx) => (
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
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setSelectedInvoiceDetail(invoice);
                                  setShowInvoiceDetailDialog(true);
                                }}
                              >
                                <FileText className="h-4 w-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                  {/* Grand Total Row */}
                  <TableRow className="bg-primary/10 font-bold border-t-2 border-primary/30">
                    <TableCell colSpan={8} className="text-right">
                      {language === 'ar' ? 'الإجمالي الكلي' : 'Grand Total'}
                      <span className="text-muted-foreground font-normal mx-2">
                        ({filteredAggregatedInvoices.length} {language === 'ar' ? 'فاتورة' : 'invoices'})
                      </span>
                    </TableCell>
                    <TableCell className="text-lg">
                      {filteredAggregatedInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR
                    </TableCell>
                    <TableCell colSpan={8}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          ) : !aggregateMode && filteredOrderGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {language === 'ar' ? 'لا توجد نتائج مطابقة للفلتر' : 'No results match the filter criteria'}
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="block mx-auto mt-2">
                  {language === 'ar' ? 'مسح الفلتر' : 'Clear filters'}
                </Button>
              )}
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
                  {filteredOrderGroups.map((group, idx) => (
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

      {/* Supplier Validation Dialog */}
      <Dialog open={showSuppliersDialog} onOpenChange={setShowSuppliersDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {supplierCheckResult && supplierCheckResult.issueCount > 0 ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {language === 'ar' ? 'حالة الموردين' : 'Supplier Status'}
              {supplierCheckResult && (
                <span className="text-muted-foreground text-sm font-normal">
                  ({supplierCheckResult.readyCount}/{supplierCheckResult.totalVendors} {language === 'ar' ? 'جاهز' : 'Ready'})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {!supplierCheckResult || supplierCheckResult.issueCount === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">
                {language === 'ar' ? 'جميع الموردين جاهزون!' : 'All Suppliers Ready!'}
              </p>
              <p className="text-sm mt-2">
                {supplierCheckResult 
                  ? (language === 'ar' 
                      ? `${supplierCheckResult.readyCount} مورد تم التحقق منه بنجاح`
                      : `${supplierCheckResult.readyCount} supplier(s) validated successfully`)
                  : (language === 'ar' 
                      ? 'لا توجد منتجات غير مخزنية تتطلب موردين'
                      : 'No non-stock products requiring suppliers')}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-6">
                {/* Missing Supplier Record Section */}
                {supplierCheckResult.missingSupplierRecord.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="px-3">
                        {language === 'ar' ? 'لا يوجد سجل مورد' : 'No Supplier Record'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({supplierCheckResult.missingSupplierRecord.length})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' 
                        ? 'هؤلاء البائعين موجودين في الطلبات لكن ليس لديهم سجل في إعداد الموردين'
                        : 'These vendors exist in orders but have no record in Supplier Setup'}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'اسم البائع' : 'Vendor Name'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الإجراء' : 'Action'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierCheckResult.missingSupplierRecord.map((item, idx) => (
                          <TableRow key={idx} className="bg-destructive/5">
                            <TableCell className="font-medium">{item.vendor_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-destructive border-destructive">
                                {language === 'ar' ? 'أضف إلى إعداد الموردين' : 'Add to Supplier Setup'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Missing Odoo ID Section */}
                {supplierCheckResult.missingOdooId.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="px-3 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        {language === 'ar' ? 'معرف Odoo مفقود' : 'Missing Odoo ID'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({supplierCheckResult.missingOdooId.length})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' 
                        ? 'هؤلاء الموردين موجودين لكن ليس لديهم معرف Odoo (partner_profile_id)'
                        : 'These suppliers exist but have no Odoo ID (partner_profile_id)'}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'اسم البائع' : 'Vendor Name'}</TableHead>
                          <TableHead>{language === 'ar' ? 'كود المورد' : 'Supplier Code'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الإجراء' : 'Action'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierCheckResult.missingOdooId.map((item, idx) => (
                          <TableRow key={idx} className="bg-amber-50 dark:bg-amber-950/20">
                            <TableCell className="font-medium">{item.vendor_name}</TableCell>
                            <TableCell className="font-mono">{item.supplier_code || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-amber-600 border-amber-500">
                                {language === 'ar' ? 'أضف معرف Odoo' : 'Add Odoo ID'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Not Found in Odoo Section */}
                {supplierCheckResult.notInOdoo.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="px-3 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                        {language === 'ar' ? 'غير موجود في Odoo' : 'Not Found in Odoo'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({supplierCheckResult.notInOdoo.length})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' 
                        ? 'هؤلاء الموردين لديهم معرف Odoo لكن لم يتم العثور عليهم في نظام Odoo'
                        : 'These suppliers have an Odoo ID but were not found in Odoo system'}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'اسم البائع' : 'Vendor Name'}</TableHead>
                          <TableHead>{language === 'ar' ? 'كود المورد' : 'Supplier Code'}</TableHead>
                          <TableHead>{language === 'ar' ? 'معرف Odoo' : 'Odoo ID'}</TableHead>
                          <TableHead>{language === 'ar' ? 'الخطأ' : 'Error'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierCheckResult.notInOdoo.map((item, idx) => (
                          <TableRow key={idx} className="bg-orange-50 dark:bg-orange-950/20">
                            <TableCell className="font-medium">{item.vendor_name}</TableCell>
                            <TableCell className="font-mono">{item.supplier_code || '-'}</TableCell>
                            <TableCell>{item.partner_profile_id || '-'}</TableCell>
                            <TableCell className="text-destructive text-sm">{item.error || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Ready Suppliers Section */}
                {supplierCheckResult.inOdoo.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="px-3 bg-green-500">
                        {language === 'ar' ? 'جاهز' : 'Ready'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        ({supplierCheckResult.inOdoo.length})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar' 
                        ? 'هؤلاء الموردين تم التحقق منهم بنجاح'
                        : 'These suppliers have been validated successfully'}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'اسم البائع' : 'Vendor Name'}</TableHead>
                          <TableHead>{language === 'ar' ? 'كود المورد' : 'Supplier Code'}</TableHead>
                          <TableHead>{language === 'ar' ? 'معرف Odoo' : 'Odoo ID'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierCheckResult.inOdoo.map((item, idx) => (
                          <TableRow key={idx} className="bg-green-50 dark:bg-green-950/20">
                            <TableCell className="font-medium">{item.vendor_name}</TableCell>
                            <TableCell className="font-mono">{item.supplier_code || '-'}</TableCell>
                            <TableCell className="text-green-600">{item.partner_profile_id || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={checkSuppliersInOdoo}
                disabled={checkingSuppliers}
              >
                {checkingSuppliers ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {language === 'ar' ? 'إعادة التحقق' : 'Re-check'}
              </Button>
              {supplierCheckResult && supplierCheckResult.issueCount > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => navigate('/supplier-setup')}
                >
                  {language === 'ar' ? 'إعداد الموردين' : 'Supplier Setup'}
                </Button>
              )}
            </div>
            <Button onClick={() => setShowSuppliersDialog(false)}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={showInvoiceDetailDialog} onOpenChange={setShowInvoiceDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {language === 'ar' ? 'تفاصيل الفاتورة المجمعة' : 'Aggregated Invoice Details'}
              {selectedInvoiceDetail && (
                <Badge variant="outline" className="font-mono ml-2">
                  {selectedInvoiceDetail.orderNumber}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoiceDetail && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6">
                {/* Invoice Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'التاريخ' : 'Date'}</p>
                    <p className="font-medium">{selectedInvoiceDetail.date ? format(parseISO(selectedInvoiceDetail.date), 'yyyy-MM-dd') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</p>
                    <p className="font-medium">{selectedInvoiceDetail.brandName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</p>
                    <p className="font-medium">{selectedInvoiceDetail.paymentMethod}/{selectedInvoiceDetail.paymentBrand}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{language === 'ar' ? 'المستخدم' : 'User'}</p>
                    <p className="font-medium text-primary">{selectedInvoiceDetail.userName || '-'}</p>
                  </div>
                </div>

                {/* Product Lines Section */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {language === 'ar' ? 'المنتجات المجمعة' : 'Aggregated Products'}
                    <Badge variant="secondary">{selectedInvoiceDetail.productLines.length}</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'ar' ? 'SKU' : 'SKU'}</TableHead>
                        <TableHead>{language === 'ar' ? 'اسم المنتج' : 'Product Name'}</TableHead>
                        <TableHead className="text-right">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</TableHead>
                        <TableHead className="text-right">{language === 'ar' ? 'الكمية' : 'Qty'}</TableHead>
                        <TableHead className="text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoiceDetail.productLines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{line.productSku}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={line.productName}>{line.productName}</TableCell>
                          <TableCell className="text-right">{line.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{line.totalQty}</TableCell>
                          <TableCell className="text-right font-medium">{line.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-primary/5 font-bold">
                        <TableCell colSpan={4} className="text-right">
                          {language === 'ar' ? 'الإجمالي' : 'Total'}
                        </TableCell>
                        <TableCell className="text-right">
                          {selectedInvoiceDetail.grandTotal.toFixed(2)} SAR
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Original Orders Section */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    {language === 'ar' ? 'الطلبات الأصلية' : 'Original Orders'}
                    <Badge variant="secondary">{selectedInvoiceDetail.originalOrderNumbers.length}</Badge>
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInvoiceDetail.originalOrderNumbers.map((orderNum, idx) => (
                      <Badge key={idx} variant="outline" className="font-mono text-xs">
                        {orderNum}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Original Lines Details */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    {language === 'ar' ? 'تفاصيل المعاملات الأصلية' : 'Original Transaction Details'}
                    <Badge variant="secondary">{selectedInvoiceDetail.originalLines.length}</Badge>
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order #'}</TableHead>
                        <TableHead>{language === 'ar' ? 'المنتج' : 'Product'}</TableHead>
                        <TableHead>{language === 'ar' ? 'البائع' : 'Vendor'}</TableHead>
                        <TableHead className="text-right">{language === 'ar' ? 'الكمية' : 'Qty'}</TableHead>
                        <TableHead className="text-right">{language === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</TableHead>
                        <TableHead className="text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoiceDetail.originalLines.map((line, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-xs">{line.order_number}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs" title={line.product_name}>
                            {line.product_name}
                          </TableCell>
                          <TableCell className="text-xs">{line.vendor_name || '-'}</TableCell>
                          <TableCell className="text-right">{line.qty}</TableCell>
                          <TableCell className="text-right">{line.unit_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">{line.total.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ScrollArea>
          )}
          
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowInvoiceDetailDialog(false)}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
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
