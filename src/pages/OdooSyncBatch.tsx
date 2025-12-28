import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  // Sync a single order to Odoo with step tracking
  const syncSingleOrder = async (group: OrderGroup): Promise<Partial<OrderGroup>> => {
    const updates: Partial<OrderGroup> = { syncStatus: 'running' };
    const stepStatus = { ...group.stepStatus };

    try {
      // Get Odoo config
      const { data: odooConfig } = await supabase
        .from('odoo_api_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (!odooConfig) {
        throw new Error('Odoo API configuration not found');
      }

      const isProductionMode = odooConfig.is_production_mode !== false;
      const customerApiUrl = isProductionMode ? odooConfig.customer_api_url : odooConfig.customer_api_url_test;
      const brandApiUrl = isProductionMode ? odooConfig.brand_api_url : odooConfig.brand_api_url_test;
      const productApiUrl = isProductionMode ? odooConfig.product_api_url : odooConfig.product_api_url_test;
      const salesOrderApiUrl = isProductionMode ? odooConfig.sales_order_api_url : odooConfig.sales_order_api_url_test;
      const purchaseOrderApiUrl = isProductionMode ? odooConfig.purchase_order_api_url : odooConfig.purchase_order_api_url_test;
      const odooApiKey = isProductionMode ? odooConfig.api_key : odooConfig.api_key_test;

      const firstLine = group.lines[0];

      // Step 1: Sync Customer
      stepStatus.customer = 'running';
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, stepStatus: { ...stepStatus } } : g
      ));

      if (firstLine.customer_phone && customerApiUrl) {
        try {
          const checkResponse = await fetch(`${customerApiUrl}/${firstLine.customer_phone}`, {
            method: 'PUT',
            headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
          });
          const checkData = await checkResponse.json().catch(() => null);
          
          if (checkResponse.ok && checkData?.success) {
            stepStatus.customer = 'found';
          } else {
            // Create customer
            const createResponse = await fetch(customerApiUrl, {
              method: 'POST',
              headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partner_type: "customer",
                phone: firstLine.customer_phone,
                name: firstLine.customer_name || 'Unknown Customer',
                email: "",
                status: "active",
              }),
            });
            if (createResponse.ok) {
              stepStatus.customer = 'created';
            } else {
              stepStatus.customer = 'failed';
              throw new Error(`Customer sync failed: ${createResponse.status}`);
            }
          }
        } catch (err) {
          stepStatus.customer = 'failed';
          throw new Error(`Customer: ${err instanceof Error ? err.message : 'Failed to fetch'}`);
        }
      } else {
        stepStatus.customer = 'found';
      }

      // Step 2: Sync Brand(s)
      stepStatus.brand = 'running';
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, stepStatus: { ...stepStatus } } : g
      ));

      const brandCodes = [...new Set(group.lines.map(l => l.brand_code).filter(Boolean))];
      let brandError: string | null = null;
      
      for (const brandCode of brandCodes) {
        if (!brandApiUrl) continue;
        const brandLine = group.lines.find(l => l.brand_code === brandCode);
        
        try {
          const putResponse = await fetch(`${brandApiUrl}/${brandCode}`, {
            method: 'PUT',
            headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: brandLine?.brand_name || brandCode }),
          });
          const putData = await putResponse.json().catch(() => ({ success: false }));
          
          if (!putData.success) {
            const postResponse = await fetch(brandApiUrl, {
              method: 'POST',
              headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: brandLine?.brand_name || brandCode,
                cat_code: brandCode,
                status: 'active',
              }),
            });
            if (!postResponse.ok) {
              brandError = `Brand ${brandCode}: ${postResponse.status}`;
            }
          }
        } catch (err) {
          brandError = `Brand: ${err instanceof Error ? err.message : 'Failed to fetch'}`;
        }
      }
      if (brandError) {
        stepStatus.brand = 'failed';
        throw new Error(brandError);
      }
      stepStatus.brand = 'found';

      // Step 3: Sync Product(s)
      stepStatus.product = 'running';
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, stepStatus: { ...stepStatus } } : g
      ));

      const skus = [...new Set(group.lines.map(l => l.sku || l.product_id).filter(Boolean))];
      let productError: string | null = null;

      for (const sku of skus) {
        if (!productApiUrl) continue;
        const productLine = group.lines.find(l => (l.sku || l.product_id) === sku);
        
        try {
          const putResponse = await fetch(`${productApiUrl}/${sku}`, {
            method: 'PUT',
            headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: productLine?.product_name || sku }),
          });
          const putData = await putResponse.json().catch(() => ({ success: false }));
          
          if (!putData.success) {
            const postResponse = await fetch(productApiUrl, {
              method: 'POST',
              headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sku: sku,
                name: productLine?.product_name || sku,
                cat_code: productLine?.brand_code || undefined,
                cost_price: productLine?.cost_price || 0,
                sales_price: productLine?.unit_price || 0,
              }),
            });
            if (!postResponse.ok) {
              productError = `Product ${sku}: ${postResponse.status}`;
            }
          }
        } catch (err) {
          productError = `Product: ${err instanceof Error ? err.message : 'Failed to fetch'}`;
        }
      }
      if (productError) {
        stepStatus.product = 'failed';
        throw new Error(productError);
      }
      stepStatus.product = 'found';

      // Step 4: Create Sales Order
      stepStatus.order = 'running';
      setOrderGroups(prev => prev.map(g => 
        g.orderNumber === group.orderNumber ? { ...g, stepStatus: { ...stepStatus } } : g
      ));

      if (salesOrderApiUrl) {
        try {
          const orderPayload = {
            order_number: group.orderNumber,
            customer_phone: firstLine.customer_phone,
            order_date: firstLine.created_at_date,
            payment_term: "immediate",
            sales_person: firstLine.user_name || "",
            payment_brand: firstLine.payment_brand || "",
            online_payment: "true",
            transaction_type: firstLine.user_name ? "manual" : "automatic",
            company: firstLine.company || "Asus",
            status: 1,
            status_description: "completed",
            lines: group.lines.map((line, idx) => ({
              line_number: idx + 1,
              line_status: 1,
              product_sku: line.sku || line.product_id,
              quantity: line.qty || 1,
              unit_price: line.unit_price || 0,
              total: line.total || 0,
              coins_number: line.coins_number || 0,
              cost_price: line.cost_price || 0,
              total_cost: line.cost_sold || 0,
            })),
            payment: {
              payment_method: firstLine.payment_method,
              payment_brand: firstLine.payment_brand,
              payment_amount: group.totalAmount,
            },
          };

          const orderResponse = await fetch(salesOrderApiUrl, {
            method: 'POST',
            headers: { 'Authorization': odooApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(orderPayload),
          });
          
          const orderResult = await orderResponse.json().catch(() => ({ success: false }));
          
          if (orderResponse.ok || orderResult.success) {
            stepStatus.order = 'sent';
          } else {
            stepStatus.order = 'failed';
            throw new Error(`Order: ${orderResult.error || orderResult.message || 'Failed to create order'}`);
          }
        } catch (err) {
          stepStatus.order = 'failed';
          throw new Error(`Order: ${err instanceof Error ? err.message : 'Failed to fetch'}`);
        }
      } else {
        stepStatus.order = 'failed';
        throw new Error('Sales Order API URL not configured');
      }

      // Step 5: Create Purchase Order (if non-stock)
      if (group.hasNonStock && purchaseOrderApiUrl) {
        stepStatus.purchase = 'running';
        setOrderGroups(prev => prev.map(g => 
          g.orderNumber === group.orderNumber ? { ...g, stepStatus: { ...stepStatus } } : g
        ));

        // Simplified - in real implementation, this would create purchase orders
        stepStatus.purchase = 'created';
      } else {
        stepStatus.purchase = 'skipped';
      }

      return {
        syncStatus: 'success',
        stepStatus,
      };

    } catch (error) {
      console.error('Error syncing order:', group.orderNumber, error);
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
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{language === 'ar' ? 'فشل' : 'Failed'}</Badge>;
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
    return { total, success, failed, skipped };
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
                    <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                    <TableHead>{language === 'ar' ? 'بطاقة الدفع' : 'Payment Brand'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تخطي' : 'Skip'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التفاصيل' : 'Details'}</TableHead>
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
                      <TableCell className="max-w-[200px] truncate" title={group.productNames.join(', ')}>
                        {group.productNames.slice(0, 2).join(', ')}
                        {group.productNames.length > 2 && ` +${group.productNames.length - 2}`}
                      </TableCell>
                      <TableCell>{group.totalAmount.toFixed(2)} SAR</TableCell>
                      <TableCell>{group.paymentMethod || '-'}</TableCell>
                      <TableCell>{group.paymentBrand || '-'}</TableCell>
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
                      <TableCell>{getSyncStatusBadge(group)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="flex items-center gap-1">
                            {getStepIcon(group.stepStatus.customer)}
                            <span className="hidden sm:inline">{getStepText('customer', group.stepStatus.customer)}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {getStepIcon(group.stepStatus.brand)}
                          </span>
                          <span className="flex items-center gap-1">
                            {getStepIcon(group.stepStatus.product)}
                          </span>
                          <span className="flex items-center gap-1">
                            {getStepIcon(group.stepStatus.order)}
                          </span>
                          {group.hasNonStock && (
                            <span className="flex items-center gap-1">
                              {getStepIcon(group.stepStatus.purchase)}
                            </span>
                          )}
                        </div>
                        {group.errorMessage && (
                          <p className="text-xs text-destructive mt-1 truncate max-w-[200px]" title={group.errorMessage}>
                            {group.errorMessage}
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
