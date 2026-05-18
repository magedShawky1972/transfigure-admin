import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Play, CheckCircle2, XCircle, Clock, Loader2, SkipForward, Search, Filter, X } from "lucide-react";
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
  brandNames: string[];
  skus: string[];
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

interface Brand {
  id: string;
  brand_name: string;
  brand_code: string | null;
}

const OdooSyncAll = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(-1);
  const [syncComplete, setSyncComplete] = useState(false);
  const [nonStockSkuSet, setNonStockSkuSet] = useState<Set<string>>(new Set());

  // Filter states
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [productNameFilter, setProductNameFilter] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Load brands for filter
  useEffect(() => {
    const loadBrands = async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, brand_name, brand_code')
        .eq('status', 'active')
        .order('brand_name');
      
      if (data) {
        setBrands(data);
      }
    };
    loadBrands();
  }, []);

  // Load non-stock products
  useEffect(() => {
    const loadNonStockProducts = async () => {
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
    };
    loadNonStockProducts();
  }, []);

  // Search transactions with filters
  const handleSearch = async () => {
    if (!selectedBrand && !productNameFilter && !skuFilter && !orderNumberFilter) {
      toast({
        variant: 'destructive',
        title: 'Filter Required',
        description: 'Please enter at least one filter to search',
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      let query = supabase
        .from('purpletransaction')
        .select('*')
        .neq('payment_method', 'point')
        .eq('is_deleted', false)
        .or('sendodoo.is.null,sendodoo.eq.false')
        .order('created_at_date_int', { ascending: false });

      // Apply filters
      if (selectedBrand && selectedBrand !== 'all') {
        const brand = brands.find(b => b.id === selectedBrand);
        if (brand) {
          query = query.eq('brand_name', brand.brand_name);
        }
      }

      if (productNameFilter.trim()) {
        query = query.ilike('product_name', `%${productNameFilter.trim()}%`);
      }

      if (skuFilter.trim()) {
        query = query.or(`sku.ilike.%${skuFilter.trim()}%,product_id.ilike.%${skuFilter.trim()}%`);
      }

      if (orderNumberFilter.trim()) {
        query = query.ilike('order_number', `%${orderNumberFilter.trim()}%`);
      }

      // Limit to prevent performance issues
      query = query.limit(5000);

      const { data, error } = await query;

      if (error) throw error;

      setAllTransactions(data || []);

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
        const brandNames = [...new Set(lines.map(l => l.brand_name))].filter(Boolean);
        const skus = [...new Set(lines.map(l => l.sku || l.product_id))].filter(Boolean) as string[];
        const totalAmount = lines.reduce((sum, l) => sum + (l.total || 0), 0);
        
        // Check if any product is non-stock
        const hasNonStock = lines.some(l => {
          const sku = l.sku || l.product_id;
          return sku && nonStockSkuSet.has(sku);
        });

        groups.push({
          orderNumber,
          lines,
          date: firstLine.created_at_date,
          customerPhone: firstLine.customer_phone || '',
          productNames,
          brandNames,
          skus,
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
        title: 'Error',
        description: 'Failed to load transactions',
      });
    } finally {
      setLoading(false);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setSelectedBrand("");
    setProductNameFilter("");
    setSkuFilter("");
    setOrderNumberFilter("");
    setOrderGroups([]);
    setHasSearched(false);
  };

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
      console.log(`[Sync All] Executing step: ${stepId} for order: ${group.orderNumber}`);
      try {
        const response = await supabase.functions.invoke("sync-order-to-odoo-step", {
          body: { step: stepId, transactions, nonStockProducts: orderNonStockProducts },
        });

        console.log(`[Sync All] Step ${stepId} response:`, response);

        if (response.error) {
          console.error(`[Sync All] Step ${stepId} error:`, response.error);
          return { success: false, error: response.error.message };
        }

        const data = response.data;
        
        if (data.skipped) {
          console.log(`[Sync All] Step ${stepId} skipped`);
          return { success: true };
        }

        if (data.success) {
          console.log(`[Sync All] Step ${stepId} success:`, data.message);
          return { success: true };
        } else {
          const errorMessage = typeof data.error === 'object' && data.error?.error 
            ? data.error.error 
            : (data.error || data.message || 'Failed');
          console.error(`[Sync All] Step ${stepId} failed:`, errorMessage);
          return { success: false, error: errorMessage };
        }
      } catch (error: any) {
        console.error(`[Sync All] Step ${stepId} exception:`, error);
        return { success: false, error: error.message || 'Network error' };
      }
    };

    try {
      // Step 1: Sync Customer
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

      // Step 2: Sync Brand(s)
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

      // Step 3: Sync Product(s)
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

      // Step 4: Create Sales Order
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

      // Step 5: Create Purchase Order (if non-stock products exist)
      if (group.hasNonStock && orderNonStockProducts.length > 0) {
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
      } else {
        stepStatus.purchase = 'skipped';
        updateStepStatus(stepStatus);
      }

      return {
        syncStatus: 'success',
        stepStatus,
      };

    } catch (error) {
      console.error('[Sync All] Error syncing order:', group.orderNumber, error);
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
        title: 'No Orders',
        description: 'Please select orders to sync',
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
      title: 'Sync Complete',
      description: `${toSync.length} order(s) synced`,
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
        pending: 'Customer',
        running: 'Checking...',
        found: 'Found',
        created: 'Created',
        failed: 'Failed',
      },
      brand: {
        pending: 'Brand',
        running: 'Checking...',
        found: 'Found',
        created: 'Created',
        failed: 'Failed',
      },
      product: {
        pending: 'Product',
        running: 'Checking...',
        found: 'Found',
        created: 'Created',
        failed: 'Failed',
      },
      order: {
        pending: 'Order',
        running: 'Sending...',
        sent: 'Sent',
        failed: 'Failed',
      },
      purchase: {
        pending: 'Purchase',
        running: 'Creating...',
        created: 'Created',
        skipped: 'Skipped',
        failed: 'Failed',
      },
    };
    return texts[step]?.[status] || status;
  };

  // Get sync status badge
  const getSyncStatusBadge = (status: string, errorMessage?: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'running':
        return <Badge variant="secondary" className="animate-pulse">Syncing...</Badge>;
      case 'success':
        return <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>;
      case 'failed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive">Failed</Badge>
              </TooltipTrigger>
              {errorMessage && (
                <TooltipContent>
                  <p className="max-w-xs">{errorMessage}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      case 'skipped':
        return <Badge variant="secondary">Skipped</Badge>;
      default:
        return null;
    }
  };

  // Sync summary
  const syncSummary = useMemo(() => {
    const success = orderGroups.filter(g => g.syncStatus === 'success').length;
    const failed = orderGroups.filter(g => g.syncStatus === 'failed').length;
    const skipped = orderGroups.filter(g => g.syncStatus === 'skipped').length;
    return { success, failed, skipped };
  }, [orderGroups]);

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Sync All to Odoo</h1>
          <p className="text-muted-foreground">
            Filter and sync transactions to Odoo
          </p>
        </div>
        {selectedCount > 0 && !isSyncing && (
          <Button onClick={handleStartSync} className="gap-2">
            <Play className="h-4 w-4" />
            Start Sync ({selectedCount} orders)
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Brand Filter */}
            <div className="space-y-2">
              <Label>Brand</Label>
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger>
                  <SelectValue placeholder="Select brand..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.brand_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product Name Filter */}
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input
                placeholder="Search product name..."
                value={productNameFilter}
                onChange={(e) => setProductNameFilter(e.target.value)}
              />
            </div>

            {/* SKU Filter */}
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                placeholder="Search SKU..."
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
              />
            </div>

            {/* Order Number Filter */}
            <div className="space-y-2">
              <Label>Order Number</Label>
              <Input
                placeholder="Search order number..."
                value={orderNumberFilter}
                onChange={(e) => setOrderNumberFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
            <Button variant="outline" onClick={handleClearFilters} className="gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Progress */}
      {isSyncing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Syncing orders...</span>
                <span>{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Summary */}
      {syncComplete && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{syncSummary.success}</div>
                <div className="text-sm text-muted-foreground">Success</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{syncSummary.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{syncSummary.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Orders ({orderGroups.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orderGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No orders found with the current filters
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
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
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Products</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Skip</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderGroups.map((group, idx) => (
                      <TableRow 
                        key={group.orderNumber}
                        className={currentOrderIndex === idx ? 'bg-primary/5' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={group.selected}
                            onCheckedChange={(checked) => handleSelectRow(group.orderNumber, !!checked)}
                            disabled={isSyncing}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{group.orderNumber}</TableCell>
                        <TableCell>
                          {group.date ? format(parseISO(group.date), 'yyyy-MM-dd') : '-'}
                        </TableCell>
                        <TableCell>{group.customerPhone}</TableCell>
                        <TableCell>
                          <div className="max-w-[150px] truncate" title={group.brandNames.join(', ')}>
                            {group.brandNames.join(', ')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate" title={group.productNames.join(', ')}>
                            {group.productNames.slice(0, 2).join(', ')}
                            {group.productNames.length > 2 && ` +${group.productNames.length - 2}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {group.totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>{getStepIcon(group.stepStatus.customer)}</TooltipTrigger>
                                <TooltipContent>{getStepText('customer', group.stepStatus.customer)}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>{getStepIcon(group.stepStatus.brand)}</TooltipTrigger>
                                <TooltipContent>{getStepText('brand', group.stepStatus.brand)}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>{getStepIcon(group.stepStatus.product)}</TooltipTrigger>
                                <TooltipContent>{getStepText('product', group.stepStatus.product)}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>{getStepIcon(group.stepStatus.order)}</TooltipTrigger>
                                <TooltipContent>{getStepText('order', group.stepStatus.order)}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {group.hasNonStock && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>{getStepIcon(group.stepStatus.purchase)}</TooltipTrigger>
                                  <TooltipContent>{getStepText('purchase', group.stepStatus.purchase)}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getSyncStatusBadge(group.syncStatus, group.errorMessage)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleSkip(group.orderNumber)}
                            disabled={isSyncing}
                            className={group.skipSync ? 'text-muted-foreground' : ''}
                          >
                            <SkipForward className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OdooSyncAll;
