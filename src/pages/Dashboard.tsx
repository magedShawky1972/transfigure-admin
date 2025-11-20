import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, ShoppingCart, CreditCard, CalendarIcon, Loader2, Search, Edit, Coins, ArrowUpDown, ArrowUp, ArrowDown, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { TransactionTypeChart } from "@/components/TransactionTypeChart";
import { UserTransactionCountChart } from "@/components/UserTransactionCountChart";
import { UserTransactionValueChart } from "@/components/UserTransactionValueChart";

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  brand_name: string;
  product_name: string;
  total: string;
  profit: string;
  payment_method: string;
  payment_brand: string;
  cost_sold: string;
  qty: string;
  bank_fee: string;
  user_name?: string;
  trans_type?: string;
}

interface DashboardMetrics {
  totalSales: number;
  totalProfit: number;
  transactionCount: number;
  avgOrderValue: number;
  couponSales: number;
  costOfSales: number;
  ePaymentCharges: number;
  totalPoints: number;
  pointsCostSold: number;
}

const Dashboard = () => {
  const { t, language } = useLanguage();
  const [dashboardPermissions, setDashboardPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("yesterday");
  const [fromDate, setFromDate] = useState<Date>();
  const [toDate, setToDate] = useState<Date>();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    totalProfit: 0,
    transactionCount: 0,
    avgOrderValue: 0,
    couponSales: 0,
    costOfSales: 0,
    ePaymentCharges: 0,
    totalPoints: 0,
    pointsCostSold: 0,
  });
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [topBrands, setTopBrands] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentBrands, setPaymentBrands] = useState<any[]>([]);
  const [unusedPaymentBrands, setUnusedPaymentBrands] = useState<any[]>([]);
  const [monthComparison, setMonthComparison] = useState<any[]>([]);
  const [productSummary, setProductSummary] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [paymentBrandsByMethod, setPaymentBrandsByMethod] = useState<any[]>([]);
  const [inactiveCustomers, setInactiveCustomers] = useState<any[]>([]);
  const [loadingInactiveCustomers, setLoadingInactiveCustomers] = useState(false);
  const [showDateInfo, setShowDateInfo] = useState(false);
  const [inactivePeriod, setInactivePeriod] = useState<string>("10");
  const [trendDays, setTrendDays] = useState<string>("10");
  const [trendBrandFilter, setTrendBrandFilter] = useState<string>("all");
  const [inactiveCustomersPage, setInactiveCustomersPage] = useState(1);
  const inactiveCustomersPerPage = 20;
  const [inactivePhoneFilter, setInactivePhoneFilter] = useState<string>("");
  const [inactiveBrandFilter, setInactiveBrandFilter] = useState<string>("all");
  const [allInactiveBrands, setAllInactiveBrands] = useState<string[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [transactionTypeData, setTransactionTypeData] = useState<any[]>([]);
  const [userTransactionCountData, setUserTransactionCountData] = useState<any[]>([]);
  const [userTransactionValueData, setUserTransactionValueData] = useState<any[]>([]);
  const [crmDialogOpen, setCrmDialogOpen] = useState(false);
  const [crmNotes, setCrmNotes] = useState("");
  const [crmReminderDate, setCrmReminderDate] = useState<Date>();
  const [crmNextAction, setCrmNextAction] = useState("");
  const [savingCrmData, setSavingCrmData] = useState(false);
  
  // Brand Products Dialog
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [brandProductsDialogOpen, setBrandProductsDialogOpen] = useState(false);
  const [brandProducts, setBrandProducts] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [brandProductsSortColumn, setBrandProductsSortColumn] = useState<'name' | 'qty' | 'value'>('value');
  const [brandProductsSortDirection, setBrandProductsSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Brand Sales Grid
  const [brandSalesGrid, setBrandSalesGrid] = useState<any[]>([]);
  const [brandSalesSortColumn, setBrandSalesSortColumn] = useState<'brandName' | 'transactionCount' | 'totalSales'>('totalSales');
  const [brandSalesSortDirection, setBrandSalesSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Payment Charges Dialog
  const [paymentChargesDialogOpen, setPaymentChargesDialogOpen] = useState(false);
  const [paymentChargesBreakdown, setPaymentChargesBreakdown] = useState<any[]>([]);
  const [loadingPaymentCharges, setLoadingPaymentCharges] = useState(false);
  const [paymentChargesSortColumn, setPaymentChargesSortColumn] = useState<'payment_brand' | 'payment_method' | 'transaction_count' | 'total' | 'bank_fee' | 'percentage'>('bank_fee');
  const [paymentChargesSortDirection, setPaymentChargesSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Payment Charges Transaction Details Dialog
  const [paymentDetailsDialogOpen, setPaymentDetailsDialogOpen] = useState(false);
  const [paymentDetailsList, setPaymentDetailsList] = useState<any[]>([]);
  const [loadingPaymentDetails, setLoadingPaymentDetails] = useState(false);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<{payment_method: string, payment_brand: string} | null>(null);
  const [paymentDetailsSortColumn, setPaymentDetailsSortColumn] = useState<'order_number' | 'customer_name' | 'customer_phone' | 'brand_name' | 'product_name' | 'qty' | 'total'>('total');
  const [paymentDetailsSortDirection, setPaymentDetailsSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // New Customers Dialog
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [newCustomersDialogOpen, setNewCustomersDialogOpen] = useState(false);
  const [newCustomersList, setNewCustomersList] = useState<any[]>([]);
  const [newCustomersSortColumn, setNewCustomersSortColumn] = useState<'name' | 'phone' | 'creation_date'>('creation_date');
  const [newCustomersSortDirection, setNewCustomersSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Point Transactions Dialog
  const [pointTransactionsDialogOpen, setPointTransactionsDialogOpen] = useState(false);
  const [pointTransactionsList, setPointTransactionsList] = useState<any[]>([]);
  const [loadingPointTransactions, setLoadingPointTransactions] = useState(false);
  const [pointTransactionsSortColumn, setPointTransactionsSortColumn] = useState<'customer_name' | 'customer_phone' | 'created_at_date' | 'sales_amount' | 'cost_amount'>('created_at_date');
  const [pointTransactionsSortDirection, setPointTransactionsSortDirection] = useState<'asc' | 'desc'>('desc');
  // Applied date range snapshot to keep popup in sync with cards
  const [appliedStartStr, setAppliedStartStr] = useState<string | null>(null);
  const [appliedEndNextStr, setAppliedEndNextStr] = useState<string | null>(null);
  
  // Coins by Brand
  const [coinsByBrand, setCoinsByBrand] = useState<any[]>([]);
  const [coinsSortColumn, setCoinsSortColumn] = useState<'brand_name' | 'total_coins' | 'usd_cost'>('total_coins');
  const [coinsSortDirection, setCoinsSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Product Summary Filters
  const [productFilter, setProductFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilterProduct, setBrandFilterProduct] = useState<string>("all");
  
  // Customer Purchases Filters
  const [customerFilterPurchases, setCustomerFilterPurchases] = useState<string>("all");
  const [productFilterCustomer, setProductFilterCustomer] = useState<string>("all");
  const [categoryFilterCustomer, setCategoryFilterCustomer] = useState<string>("all");
  const [phoneFilterCustomer, setPhoneFilterCustomer] = useState<string>("");
  
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allCustomers, setAllCustomers] = useState<string[]>([]);
  const [allPhones, setAllPhones] = useState<string[]>([]);

  const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];

  const parseNumber = (value?: string | number | null) => {
    if (value == null) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (amount: number) => {
    if (!isFinite(amount)) amount = 0;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ر.س`;
  };

  const handlePaymentMethodClick = (data: any, transactions: Transaction[]) => {
    const methodName = data.name;
    setSelectedPaymentMethod(methodName);
    
    // Filter transactions for this payment method and group by payment brand
    const filteredTransactions = transactions.filter((t: any) => 
      (t.payment_method || 'Unknown') === methodName
    );
    
    const brandData = filteredTransactions.reduce((acc: any, t: any) => {
      const brand = t.payment_brand || 'Unknown';
      if (!acc[brand]) {
        acc[brand] = { name: brand, value: 0 };
      }
      acc[brand].value += parseNumber(t.total);
      return acc;
    }, {});
    
    setPaymentBrandsByMethod(Object.values(brandData).sort((a: any, b: any) => b.value - a.value));
  };

  const getDateRange = () => {
    const now = new Date();
    const yesterday = subDays(now, 1);
    
    switch (dateFilter) {
      case "yesterday":
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "thisMonth":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "dateRange":
        if (fromDate && toDate) {
          return { start: startOfDay(fromDate), end: endOfDay(toDate) };
        }
        return null;
      default:
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
  };

  const handleApplyFilter = () => {
    fetchMetrics();
    fetchCharts();
    fetchTables();
    fetchInactiveCustomers();
  };

  // Load dashboard permissions
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setPermissionsLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_permissions?user_id=eq.${session.user.id}&parent_menu=eq.dashboard&select=menu_item,has_access`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${session.access_token}`,
            }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch permissions');

        const permsData = await response.json();
        const permsMap: Record<string, boolean> = {};
        permsData?.forEach((p: any) => {
          permsMap[p.menu_item] = p.has_access;
        });

        setDashboardPermissions(permsMap);
      } catch (error) {
        console.error("Error loading dashboard permissions:", error);
      } finally {
        setPermissionsLoading(false);
      }
    };

    loadPermissions();
  }, []);

  // Removed auto-fetch - user must click Apply button to load data

  // Helper function to check if user has access to a component
  const hasAccess = (componentKey: string) => {
    if (permissionsLoading) return false;
    return dashboardPermissions[componentKey] ?? true; // Default to true if not set
  };

  // Check if user has no access to any dashboard components
  const hasAnyAccess = () => {
    if (permissionsLoading) return true; // Show loading state
    // If no permissions are set, deny access by default
    if (Object.keys(dashboardPermissions).length === 0) return false;
    return Object.values(dashboardPermissions).some(access => access === true);
  };

  const fetchMetrics = async () => {
    try {
      setLoadingStats(true);
      
      // Reset metrics before fetching
      setMetrics({
        totalSales: 0,
        totalProfit: 0,
        transactionCount: 0,
        avgOrderValue: 0,
        couponSales: 0,
        costOfSales: 0,
        ePaymentCharges: 0,
        totalPoints: 0,
        pointsCostSold: 0,
      });
      setRecentTransactions([]);
      setNewCustomersCount(0);
      
      const dateRange = getDateRange();
      if (!dateRange) {
        setLoadingStats(false);
        return;
      }

      const startStr = format(dateRange.start, "yyyy-MM-dd 00:00:00");
      const endStr = format(dateRange.end, "yyyy-MM-dd 23:59:59");
      const startDate = format(dateRange.start, "yyyy-MM-dd");
      const endDate = format(dateRange.end, "yyyy-MM-dd");
      // Store for applied filter display
      setAppliedStartStr(startStr);
      setAppliedEndNextStr(endStr);

      // Fetch new customers count only
      const { count: newCustomersCount, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .gte('creation_date', startStr)
        .lte('creation_date', endStr);

      if (!customersError) {
        setNewCustomersCount(newCustomersCount || 0);
      }

      // Use RPC function for fast aggregated metrics
      const { data: summary, error: summaryError } = await supabase
        .rpc('transactions_summary', {
          date_from: startDate,
          date_to: endDate
        });

      if (summaryError) throw summaryError;

      if (summary && summary.length > 0) {
        const stats = summary[0];
        const totalSales = Number(stats.total_sales || 0);
        const totalProfit = Number(stats.total_profit || 0);
        const transactionCount = Number(stats.tx_count || 0);
        const avgOrderValue = transactionCount > 0 ? totalSales / transactionCount : 0;

        // Use optimized RPC functions for fast aggregation
        const [cogsResult, chargesResult, pointsResult] = await Promise.all([
          supabase.rpc('get_cost_of_sales', {
            date_from: startDate,
            date_to: endDate
          }),
          supabase.rpc('get_epayment_charges', {
            date_from: startDate,
            date_to: endDate
          }),
          supabase.rpc('get_points_summary', {
            date_from: startDate,
            date_to: endDate
          })
        ]);

        if (cogsResult.error) throw cogsResult.error;
        if (chargesResult.error) throw chargesResult.error;
        if (pointsResult.error) throw pointsResult.error;

        const costOfSales = Number(cogsResult.data || 0);
        const ePaymentCharges = Number(chargesResult.data || 0);
        const pointsData = pointsResult.data && pointsResult.data.length > 0 ? pointsResult.data[0] : { total_sales: 0, total_cost: 0 };
        const totalPointsSales = Number(pointsData.total_sales || 0);
        const totalPointsCost = Number(pointsData.total_cost || 0);

        setMetrics({
          totalSales,
          totalProfit,
          transactionCount,
          avgOrderValue,
          couponSales: 0,
          costOfSales,
          ePaymentCharges,
          totalPoints: totalPointsSales,
          pointsCostSold: totalPointsCost,
        });
      }

      // Fetch only recent 5 transactions for display
      const { data: recentTxns, error: recentError } = await supabase
        .from('purpletransaction')
        .select('*')
        .gte('created_at_date', startStr)
        .lte('created_at_date', endStr)
        .order('created_at_date', { ascending: false })
        .limit(5);

      if (!recentError && recentTxns) {
        setRecentTransactions(recentTxns as unknown as Transaction[]);
      }

      setLoadingStats(false);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      setLoadingStats(false);
    }
  };

  const fetchSalesTrend = async () => {
    try {
      const daysCount = parseInt(trendDays) - 1;
      // Use yesterday as the reference day unless a custom range is applied
      const referenceDate = (dateFilter === "dateRange" && toDate)
        ? toDate
        : subDays(new Date(), 1);
      const trendEndDate = endOfDay(referenceDate);
      const trendStartDate = startOfDay(subDays(referenceDate, daysCount));

      const startStr = format(trendStartDate, "yyyy-MM-dd 00:00:00");
      const endStr = format(trendEndDate, "yyyy-MM-dd 23:59:59");

      // Build base query with optional brand filter
      let base = supabase
        .from('purpletransaction')
        .select('created_at_date, total, payment_method')
        .gte('created_at_date', startStr)
        .lte('created_at_date', endStr)
        .order('created_at_date', { ascending: true });

      if (trendBrandFilter !== 'all') {
        base = base.eq('brand_name', trendBrandFilter);
      }

      // IMPORTANT: paginate to avoid the default 1000 row limit
      const pageSize = 1000;
      let from = 0;
      let trendRows: any[] = [];
      while (true) {
        const { data, error } = await (base as any).range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        trendRows = trendRows.concat(batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      const byDate: Record<string, number> = {};
      (trendRows || []).forEach((row: any) => {
        // Skip point transactions
        if ((row.payment_method || '').toLowerCase() === 'point') return;
        const dateKey = String(row.created_at_date).split('T')[0];
        const sales = parseNumber(row.total);
        byDate[dateKey] = (byDate[dateKey] || 0) + sales;
      });

      const points: any[] = [];
      for (let d = startOfDay(trendStartDate); d <= startOfDay(trendEndDate); d = addDays(d, 1)) {
        const key = format(d, 'yyyy-MM-dd');
        const sales = byDate[key] ?? 0;
        points.push({ date: format(d, 'MMM dd'), sales });
      }
      setSalesTrend(points);
    } catch (error) {
      console.error('Error fetching sales trend:', error);
    }
  };

  const fetchCharts = async () => {
    try {
      setLoadingCharts(true);
      
      // Reset charts before fetching
      setSalesTrend([]);
      setTopBrands([]);
      setTopCategories([]);
      setTopProducts([]);
      setPaymentMethods([]);
      setPaymentBrands([]);
      setMonthComparison([]);
      setTransactionTypeData([]);
      setUserTransactionCountData([]);
      setUserTransactionValueData([]);
      
      const dateRange = getDateRange();
      if (!dateRange) {
        setLoadingCharts(false);
        return;
      }

      const startDate = format(dateRange.start, 'yyyy-MM-dd');
      const endDate = format(dateRange.end, 'yyyy-MM-dd');
      const startStr = format(dateRange.start, "yyyy-MM-dd 00:00:00");
      const endStr = format(dateRange.end, "yyyy-MM-dd 23:59:59");
      
      // Use RPC function which properly handles date ranges
      const { data: summary, error: summaryError } = await supabase
        .rpc('transactions_summary', {
          date_from: startDate,
          date_to: endDate
        });

      // Fetch transactions for charts
      const pageSize = 1000;
      let from = 0;
      let transactions: Transaction[] = [];
      
      while (true) {
        const { data, error } = await (supabase as any)
          .from('purpletransaction')
          .select('*')
          .order('created_at_date', { ascending: false })
          .gte('created_at_date', startStr)
          .lte('created_at_date', endStr)
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = (data as Transaction[]) || [];
        transactions = transactions.concat(batch);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      // Sales trend - calculate last N days back from yesterday (or selected end date)
      const daysCount = parseInt(trendDays) - 1;
      const referenceDate = (dateFilter === "dateRange" && toDate)
        ? toDate
        : subDays(new Date(), 1);
      const trendEndDate = endOfDay(referenceDate);
      const trendStartDate = startOfDay(subDays(referenceDate, daysCount));

      const trendStartStr = format(trendStartDate, "yyyy-MM-dd 00:00:00");
      const trendEndStr = format(trendEndDate, "yyyy-MM-dd 23:59:59");

      // Build base query with optional brand filter
      let trendBase = supabase
        .from('purpletransaction')
        .select('created_at_date, total, payment_method')
        .gte('created_at_date', trendStartStr)
        .lte('created_at_date', trendEndStr)
        .order('created_at_date', { ascending: true });

      if (trendBrandFilter !== 'all') {
        trendBase = trendBase.eq('brand_name', trendBrandFilter);
      }

      // Paginate to avoid 1000 row limit
      const trendPageSize = 1000;
      let trendFrom = 0;
      let trendRows: any[] = [];
      while (true) {
        const { data, error } = await (trendBase as any).range(trendFrom, trendFrom + trendPageSize - 1);
        if (error) throw error;
        const batch = data || [];
        trendRows = trendRows.concat(batch);
        if (batch.length < trendPageSize) break;
        trendFrom += trendPageSize;
      }

      const trendByDate: Record<string, number> = {};
      (trendRows || []).forEach((row: any) => {
        // Skip point transactions
        if ((row.payment_method || '').toLowerCase() === 'point') return;
        const dateKey = String(row.created_at_date).split('T')[0];
        const sales = parseNumber(row.total);
        trendByDate[dateKey] = (trendByDate[dateKey] || 0) + sales;
      });

      const trendPoints: any[] = [];
      for (let d = startOfDay(trendStartDate); d <= startOfDay(trendEndDate); d = addDays(d, 1)) {
        const key = format(d, 'yyyy-MM-dd');
        const sales = trendByDate[key] ?? 0;
        trendPoints.push({ date: format(d, 'MMM dd'), sales });
      }
      setSalesTrend(trendPoints);

      // Month comparison - show base month and previous two months, matching total cards logic
      const now = new Date();
      const months: Array<{ month: string; sales: number; profit: number }> = [];
      
      // Determine base month based on date filter (same behavior as before)
      let baseMonth;
      if (dateFilter === "lastMonth") {
        baseMonth = subMonths(now, 1);
      } else if (dateFilter === "thisMonth") {
        baseMonth = now;
      } else if (dateFilter === "yesterday") {
        baseMonth = subDays(now, 1);
      } else if (dateFilter === "dateRange" && fromDate) {
        baseMonth = fromDate;
      } else {
        baseMonth = now;
      }
      
      // Build last 3 months (previous 2 + base)
      for (let i = 2; i >= 0; i--) {
        const monthDate = subMonths(baseMonth, i);
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        
        // Calculate monthly metrics matching Income Statement and Profit Card:
        // Sales = sum(total) for NON-POINT only
        // Profit = (nonPointSales - nonPointCost) - pointsCost - nonPointBankFees
        // pointsCost is grouped by order_number to avoid double counting
        // Fetch non-point data
        let fromNP = 0;
        let nonPointData: any[] = [];
        const startStr = format(start, "yyyy-MM-dd 00:00:00");
        const endStr = format(end, "yyyy-MM-dd 23:59:59");
        
        while (true) {
          const { data, error } = await (supabase as any)
            .from('purpletransaction')
            .select('total, cost_sold, bank_fee, payment_method')
            .gte('created_at_date', startStr)
            .lte('created_at_date', endStr)
            .range(fromNP, fromNP + pageSize - 1);
          if (error) throw error;
          const batch = data || [];
          // Filter out point transactions on client-side
          nonPointData = nonPointData.concat(batch.filter((row: any) => (row.payment_method || '').toLowerCase() !== 'point'));
          if (batch.length < pageSize) break;
          fromNP += pageSize;
        }

        // Fetch point transactions and group by order
        let fromP = 0;
        let pointData: any[] = [];
        while (true) {
          const { data, error } = await (supabase as any)
            .from('purpletransaction')
            .select('id, order_number, total')
            .ilike('payment_method', 'point')
            .gte('created_at_date', startStr)
            .lte('created_at_date', endStr)
            .range(fromP, fromP + pageSize - 1);
          if (error) throw error;
          const batch = data || [];
          pointData = pointData.concat(batch);
          if (batch.length < pageSize) break;
          fromP += pageSize;
        }

        let nonPointSales = 0;
        let nonPointCost = 0;
        let nonPointBankFees = 0;
        nonPointData.forEach((row) => {
          nonPointSales += parseNumber(row.total);
          nonPointCost += parseNumber(row.cost_sold);
          nonPointBankFees += parseNumber(row.bank_fee);
        });

        const orderGrouped = new Map<string, number>();
        pointData.forEach((item: any) => {
          const key = item.order_number || item.id;
          const total = parseNumber(item.total);
          orderGrouped.set(key, (orderGrouped.get(key) || 0) + total);
        });
        const pointsCost = Array.from(orderGrouped.values()).reduce((s, v) => s + v, 0);

        const monthSales = nonPointSales;
        const monthProfit = (nonPointSales - nonPointCost) - pointsCost - nonPointBankFees;

        months.push({
          month: format(monthDate, 'MMM yyyy'),
          sales: monthSales,
          profit: monthProfit,
        });
      }

      setMonthComparison(months);

      if (transactions && transactions.length > 0) {
        // Store transactions for brand filtering
        setAllTransactions(transactions);
        
        // Fetch brands for short names
        const { data: brandsData } = await supabase
          .from('brands')
          .select('brand_name, short_name');
        
        const brandsMap = brandsData?.reduce((acc: any, b: any) => {
          acc[b.brand_name] = b.short_name || b.brand_name;
          return acc;
        }, {}) || {};
        
        // Filter out point sales for brand and product calculations
        const nonPointTransactions = transactions.filter(t => t.payment_method !== 'point');
        
        // Top brands
        const brandSales = nonPointTransactions.reduce((acc: any, t) => {
          const brand = t.brand_name || 'Unknown';
          if (!acc[brand]) {
            acc[brand] = { name: brand, value: 0 };
          }
          acc[brand].value += parseNumber(t.total);
          return acc;
        }, {});
        
        const totalBrandRevenue = Object.values(brandSales).reduce((sum: number, val: any) => sum + val.value, 0) as number;
        
        const top5Brands = Object.values(brandSales)
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 5)
          .map((item: any) => {
            const percentage = totalBrandRevenue > 0 ? ((item.value / totalBrandRevenue) * 100).toFixed(1) : '0.0';
            return {
              name: `${brandsMap[item.name] || item.name} (${percentage}%)`,
              brandName: item.name, // Store original brand_name for drilldown
              value: item.value
            };
          });
        
        setTopBrands(top5Brands);
        setTopCategories(Object.values(brandSales).sort((a: any, b: any) => b.value - a.value).slice(0, 5));

        // Top products
        const productSales = nonPointTransactions.reduce((acc: any, t) => {
          const product = t.product_name || 'Unknown';
          if (!acc[product]) {
            acc[product] = { name: product, value: 0, qty: 0 };
          }
          acc[product].value += parseNumber(t.total);
          acc[product].qty += parseNumber(t.qty);
          return acc;
        }, {});
        
        const totalProductRevenue = Object.values(productSales).reduce((sum: number, val: any) => sum + val.value, 0) as number;
        
        const top5Products = Object.values(productSales)
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 5)
          .map((item: any) => {
            const percentage = totalProductRevenue > 0 ? ((item.value / totalProductRevenue) * 100).toFixed(1) : '0.0';
            return {
              name: `${item.name} (${percentage}%)`,
              value: item.value,
              qty: item.qty
            };
          });
        
        setTopProducts(top5Products);

        // Payment methods with click data (excluding point payments)
        const paymentData = transactions
          .filter(t => t.payment_method?.toLowerCase() !== 'point')
          .reduce((acc: any, t) => {
            const method = t.payment_method || 'Unknown';
            if (!acc[method]) {
              acc[method] = { name: method, value: 0, transactions: [] };
            }
            acc[method].value += parseNumber(t.total);
            acc[method].transactions.push(t);
            return acc;
          }, {});
        setPaymentMethods(Object.values(paymentData));

        // Payment brands (excluding point sales and unknown brands)
        const paymentBrandData = transactions
          .filter(t => t.payment_method?.toLowerCase() !== 'point' && t.payment_brand && t.payment_brand.toLowerCase() !== 'unknown')
          .reduce((acc: any, t) => {
            const brand = t.payment_brand;
            if (!acc[brand]) {
              acc[brand] = { name: brand, value: 0 };
            }
            acc[brand].value += parseNumber(t.total);
            return acc;
          }, {});
        setPaymentBrands(Object.values(paymentBrandData));

        // Fetch all payment brands from payment_methods table
        const { data: allPaymentBrands, error: paymentBrandsError } = await supabase
          .from('payment_methods')
          .select('payment_method, payment_type')
          .eq('is_active', true);

        if (!paymentBrandsError && allPaymentBrands) {
          // Get list of used payment brands from transactions
          const usedBrands = new Set(
            transactions
              .filter(t => t.payment_method?.toLowerCase() !== 'point' && t.payment_brand && t.payment_brand.toLowerCase() !== 'unknown')
              .map(t => t.payment_brand)
          );

          // Find payment brands that exist in payment_methods but not in transactions
          const unused = allPaymentBrands
            .filter(pm => !usedBrands.has(pm.payment_method))
            .map(pm => ({
              payment_method: pm.payment_method,
              payment_type: pm.payment_type || '-'
            }));

          setUnusedPaymentBrands(unused);
        }

        // Transaction Type Data (Manual vs Automatic)
        const transactionTypeCount = transactions.reduce((acc: any, t) => {
          const type = t.trans_type || 'automatic'; // Default to automatic if not set
          const typeName = type === 'manual' 
            ? (language === 'ar' ? 'يدوي' : 'Manual')
            : (language === 'ar' ? 'تلقائي' : 'Automatic');
          
          if (!acc[typeName]) {
            acc[typeName] = { name: typeName, value: 0 };
          }
          acc[typeName].value += 1;
          return acc;
        }, {});

        const transTypeArray = Object.values(transactionTypeCount) as Array<{ name: string; value: number }>;
        const totalTransType = transTypeArray.reduce((sum, item: any) => sum + item.value, 0);
        const transTypeWithPercentage = transTypeArray.map((item: any) => ({
          ...item,
          percentage: totalTransType > 0 ? (item.value / totalTransType) * 100 : 0
        }));
        setTransactionTypeData(transTypeWithPercentage);

        // User Transaction Count (exclude null/empty user_name)
        const userCountMap = transactions
          .filter((t: any) => t.user_name && String(t.user_name).trim() !== '')
          .reduce((acc: any, t: any) => {
            const name = String(t.user_name);
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        const userCountArray = Object.entries(userCountMap).map(([name, value]) => ({ name, value: value as number }));
        const userCountTotal = userCountArray.reduce((sum, item: any) => sum + item.value, 0);
        const userCountWithPct = userCountArray.map((item: any) => ({
          ...item,
          percentage: userCountTotal > 0 ? (item.value / userCountTotal) * 100 : 0,
        })).sort((a: any, b: any) => b.value - a.value);
        setUserTransactionCountData(userCountWithPct);

        // User Transaction Value (exclude point payments, exclude null/empty user_name)
        const userValueMap = transactions
          .filter((t: any) => t.payment_method?.toLowerCase() !== 'point')
          .filter((t: any) => t.user_name && String(t.user_name).trim() !== '')
          .reduce((acc: any, t: any) => {
            const name = String(t.user_name);
            acc[name] = (acc[name] || 0) + parseNumber(t.total);
            return acc;
          }, {} as Record<string, number>);
        const userValueArray = Object.entries(userValueMap).map(([name, value]) => ({ name, value: value as number }));
        const userValueTotal = userValueArray.reduce((sum, item: any) => sum + item.value, 0);
        const userValueWithPct = userValueArray.map((item: any) => ({
          ...item,
          percentage: userValueTotal > 0 ? (item.value / userValueTotal) * 100 : 0,
        })).sort((a: any, b: any) => b.value - a.value);
        setUserTransactionValueData(userValueWithPct);
      }

      setLoadingCharts(false);
    } catch (error) {
      console.error('Error fetching charts:', error);
      setLoadingCharts(false);
    }
  };

  const fetchTables = async () => {
    try {
      setLoadingTables(true);
      
      // Reset tables before fetching
      setProductSummary([]);
      setCustomerPurchases([]);
      setAllProducts([]);
      setAllCategories([]);
      setAllBrands([]);
      setAllCustomers([]);
      
      const dateRange = getDateRange();
      if (!dateRange) {
        setLoadingTables(false);
        return;
      }

      const startStr = format(dateRange.start, "yyyy-MM-dd");
      const endStr = format(dateRange.end, "yyyy-MM-dd");

      const pageSize = 1000;
      let from = 0;
      let transactions: Transaction[] = [];
      
      while (true) {
        const { data, error } = await (supabase as any)
          .from('purpletransaction')
          .select('*')
          .order('created_at_date', { ascending: false })
          .gte('created_at_date', startStr)
          .lte('created_at_date', endStr)
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = (data as Transaction[]) || [];
        transactions = transactions.concat(batch);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      if (transactions && transactions.length > 0) {
        // Product summary
        const productSales = transactions.reduce((acc: any, t) => {
          const product = t.product_name || 'Unknown';
          if (!acc[product]) {
            acc[product] = { name: product, value: 0, qty: 0 };
          }
          acc[product].value += parseNumber(t.total);
          acc[product].qty += parseNumber(t.qty);
          return acc;
        }, {});
        setProductSummary(Object.values(productSales).sort((a: any, b: any) => b.value - a.value));
        
        // Extract unique values for filters
        const uniqueProducts = [...new Set(transactions.map(t => t.product_name).filter(Boolean))];
        const uniqueCategories = [...new Set(transactions.map(t => t.brand_name).filter(Boolean))];
        const uniqueBrands = [...new Set(transactions.map(t => t.brand_name).filter(Boolean))];
        const uniqueCustomers = [...new Set(transactions.map(t => t.customer_name).filter(Boolean))];
        const uniquePhones = [...new Set(transactions.map((t: any) => t.customer_phone).filter(Boolean))];
        
        setAllProducts(uniqueProducts as string[]);
        setAllCategories(uniqueCategories as string[]);
        setAllBrands(uniqueBrands as string[]);
        setAllCustomers(uniqueCustomers as string[]);
        setAllPhones(uniquePhones as string[]);
        
        // Customer Purchases Summary
        const customerData = transactions.reduce((acc: any, t: any) => {
          const customer = t.customer_name || 'Unknown';
          const phone = t.customer_phone || 'N/A';
          const category = t.brand_name || 'Unknown';
          const product = t.product_name || 'Unknown';
          
          const key = `${customer}-${phone}-${category}-${product}`;
          if (!acc[key]) {
            acc[key] = {
              customerName: customer,
              customerPhone: phone,
              category: category,
              product: product,
              totalValue: 0,
              transactionCount: 0
            };
          }
          acc[key].totalValue += parseNumber(t.total);
          acc[key].transactionCount += 1;
          return acc;
        }, {});
        setCustomerPurchases(Object.values(customerData).sort((a: any, b: any) => b.totalValue - a.totalValue));
        
        // Coins by Brand - Fetch brands data for USD values
        const { data: brandsData } = await supabase
          .from('brands')
          .select('brand_name, usd_value_for_coins');
        
        const brandsMap = new Map(
          (brandsData || []).map(b => [b.brand_name, b.usd_value_for_coins || 0])
        );
        
        const coinsByBrandData = transactions.reduce((acc: any, t: any) => {
          const brand = t.brand_name || 'Unknown';
          const coins = parseNumber(t.coins_number);
          
          if (!acc[brand]) {
            acc[brand] = {
              brand_name: brand,
              total_coins: 0,
              usd_value: brandsMap.get(brand) || 0
            };
          }
          acc[brand].total_coins += coins;
          return acc;
        }, {});
        
        const sortedCoins = Object.values(coinsByBrandData)
          .filter((item: any) => item.total_coins > 0)
          .map((item: any) => ({
            ...item,
            usd_cost: item.usd_value > 0 ? item.total_coins * item.usd_value : 0
          }))
          .sort((a: any, b: any) => b.total_coins - a.total_coins);
        setCoinsByBrand(sortedCoins);
        
        // Brand Sales Grid - exclude point transactions from sales (matching Total Sales Card)
        const brandSalesData = transactions.reduce((acc: any, t) => {
          const brand = t.brand_name || 'Unknown';
          const isPoint = (t.payment_method || '').toLowerCase() === 'point';
          
          if (!acc[brand]) {
            acc[brand] = { 
              brandName: brand, 
              transactionCount: 0, 
              totalSales: 0 
            };
          }
          acc[brand].transactionCount += 1;
          // Only add to sales if not a point transaction
          if (!isPoint) {
            acc[brand].totalSales += parseNumber(t.total);
          }
          return acc;
        }, {});
        
        const sortedBrandSales = Object.values(brandSalesData)
          .sort((a: any, b: any) => b.totalSales - a.totalSales);
        setBrandSalesGrid(sortedBrandSales);
      }

      setLoadingTables(false);
    } catch (error) {
      console.error('Error fetching tables:', error);
      setLoadingTables(false);
    }
  };

  const fetchInactiveCustomers = async () => {
    try {
      setLoadingInactiveCustomers(true);
      setInactiveCustomers([]);
      setInactiveCustomersPage(1);

      // Calculate days based on selected period
      let daysAgo: number;
      if (inactivePeriod === "over30") {
        daysAgo = 31;
      } else {
        daysAgo = parseInt(inactivePeriod);
      }
      
      const targetDate = subDays(new Date(), daysAgo);
      const targetDateStr = format(startOfDay(targetDate), "yyyy-MM-dd'T'00:00:00");

      // Fetch all transactions
      const pageSize = 1000;
      let from = 0;
      let allTransactions: any[] = [];
      
      while (true) {
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('customer_phone, customer_name, total, created_at_date, brand_name, user_name, payment_method')
          .order('created_at_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        allTransactions = allTransactions.concat(batch);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      // Group by customer phone and calculate stats
      const customerMap = new Map<string, {
        customerName: string;
        customerPhone: string;
        totalSpend: number;
        transactionCount: number;
        lastTransaction: Date;
        topBrand: string;
        brandSpends: Map<string, number>;
      }>();

      allTransactions.forEach((t: any) => {
        const phone = t.customer_phone;
        if (!phone) return;

        const transDate = new Date(t.created_at_date);
        const totalValue = parseNumber(t.total);
        const brand = t.brand_name || 'Unknown';

        if (!customerMap.has(phone)) {
          customerMap.set(phone, {
            customerName: t.customer_name || 'Unknown',
            customerPhone: phone,
            totalSpend: 0,
            transactionCount: 0,
            lastTransaction: transDate,
            topBrand: brand,
            brandSpends: new Map(),
          });
        }

        const customer = customerMap.get(phone)!;
        customer.totalSpend += totalValue;
        customer.transactionCount += 1;
        
        // Track brand spending
        const currentBrandSpend = customer.brandSpends.get(brand) || 0;
        customer.brandSpends.set(brand, currentBrandSpend + totalValue);
        
        // Update last transaction if this one is more recent
        if (transDate > customer.lastTransaction) {
          customer.lastTransaction = transDate;
        }
      });

      // Filter for inactive customers and determine top brand
      const inactive = Array.from(customerMap.values())
        .filter(customer => {
          if (inactivePeriod === "over30") {
            return customer.lastTransaction < subDays(new Date(), 30);
          } else {
            return customer.lastTransaction < targetDate;
          }
        })
        .map(customer => {
          // Find the brand with highest spend
          let maxSpend = 0;
          let topBrand = 'Unknown';
          customer.brandSpends.forEach((spend, brand) => {
            if (spend > maxSpend) {
              maxSpend = spend;
              topBrand = brand;
            }
          });
          return {
            customerName: customer.customerName,
            customerPhone: customer.customerPhone,
            totalSpend: customer.totalSpend,
            transactionCount: customer.transactionCount,
            lastTransaction: customer.lastTransaction,
            topBrand,
          };
        })
        .sort((a, b) => b.totalSpend - a.totalSpend);

      setInactiveCustomers(inactive);
      
      // Extract unique brands for filter
      const uniqueBrands = [...new Set(inactive.map((c: any) => c.topBrand))];
      setAllInactiveBrands(uniqueBrands.filter(Boolean).sort());
      
      setLoadingInactiveCustomers(false);
    } catch (error) {
      console.error('Error fetching inactive customers:', error);
      setLoadingInactiveCustomers(false);
    }
  };

  const handleEditCustomer = async (customer: any) => {
    setEditingCustomer(customer);
    
    // Fetch existing CRM data for this customer
    const { data, error } = await supabase
      .from('crm_customer_followup')
      .select('*')
      .eq('customer_phone', customer.customerPhone)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setCrmNotes(data.notes || "");
      setCrmReminderDate(data.reminder_date ? new Date(data.reminder_date) : undefined);
      setCrmNextAction(data.next_action || "");
    } else {
      setCrmNotes("");
      setCrmReminderDate(undefined);
      setCrmNextAction("");
    }
    
    setCrmDialogOpen(true);
  };

  const handleSaveCrmData = async () => {
    if (!editingCustomer) return;
    
    try {
      setSavingCrmData(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: language === 'ar' ? 'خطأ' : 'Error',
          description: language === 'ar' ? 'يجب تسجيل الدخول' : 'You must be logged in',
          variant: "destructive",
        });
        return;
      }

      // Check if record exists
      const { data: existing } = await supabase
        .from('crm_customer_followup')
        .select('id')
        .eq('customer_phone', editingCustomer.customerPhone)
        .maybeSingle();

      const followupData = {
        customer_phone: editingCustomer.customerPhone,
        customer_name: editingCustomer.customerName,
        notes: crmNotes,
        reminder_date: crmReminderDate?.toISOString(),
        next_action: crmNextAction,
        updated_by: user.id,
      };

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('crm_customer_followup')
          .update(followupData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('crm_customer_followup')
          .insert({ ...followupData, created_by: user.id });

        if (error) throw error;
      }

      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم حفظ بيانات المتابعة بنجاح' : 'CRM follow-up data saved successfully',
      });

      setCrmDialogOpen(false);
      setEditingCustomer(null);
      setCrmNotes("");
      setCrmReminderDate(undefined);
      setCrmNextAction("");
    } catch (error) {
      console.error('Error saving CRM data:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل حفظ البيانات' : 'Failed to save data',
        variant: "destructive",
      });
    } finally {
      setSavingCrmData(false);
    }
  };

  const handleBrandClick = (data: any) => {
    if (!data || !data.brandName) return;
    
    const brandName = data.brandName; // Use the original brand_name stored in data
    setSelectedBrand(brandName);
    
    // Filter transactions by brand and aggregate products
    const brandTransactions = allTransactions.filter(t => t.brand_name === brandName);
    const productSales = brandTransactions.reduce((acc: any, t) => {
      const product = t.product_name || 'Unknown';
      if (!acc[product]) {
        acc[product] = { name: product, value: 0, qty: 0 };
      }
      acc[product].value += parseNumber(t.total);
      acc[product].qty += parseNumber(t.qty);
      return acc;
    }, {});
    
    setBrandProducts(Object.values(productSales).sort((a: any, b: any) => b.value - a.value));
    setBrandProductsSortColumn('value');
    setBrandProductsSortDirection('desc');
    setBrandProductsDialogOpen(true);
  };

  const handleBrandProductSort = (column: 'name' | 'qty' | 'value') => {
    const newDirection = brandProductsSortColumn === column && brandProductsSortDirection === 'asc' ? 'desc' : 'asc';
    setBrandProductsSortColumn(column);
    setBrandProductsSortDirection(newDirection);
    
    const sorted = [...brandProducts].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      if (column === 'name') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        return newDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    
    setBrandProducts(sorted);
  };
  
  const handleCoinsSort = (column: 'brand_name' | 'total_coins' | 'usd_cost') => {
    const newDirection = coinsSortColumn === column && coinsSortDirection === 'asc' ? 'desc' : 'asc';
    setCoinsSortColumn(column);
    setCoinsSortDirection(newDirection);
    
    const sorted = [...coinsByBrand].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      if (column === 'brand_name') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
        return newDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    
    setCoinsByBrand(sorted);
  };

  // Re-fetch only sales trend when trend days or brand selection changes
  useEffect(() => {
    if (dateFilter && (dateFilter !== 'dateRange' || (fromDate && toDate))) {
      fetchSalesTrend();
    }
  }, [trendDays, trendBrandFilter]);

  const handleNewCustomersClick = async () => {
    const dateRange = getDateRange();
    if (!dateRange) return;

    const startStr = format(dateRange.start, "yyyy-MM-dd 00:00:00");
    const endStr = format(dateRange.end, "yyyy-MM-dd 23:59:59");

    const { data: newCustomers, error } = await supabase
      .from('customers')
      .select('*')
      .gte('creation_date', startStr)
      .lte('creation_date', endStr)
      .order('creation_date', { ascending: false });

    if (!error && newCustomers) {
      setNewCustomersList(newCustomers);
      setNewCustomersSortColumn('creation_date');
      setNewCustomersSortDirection('desc');
      setNewCustomersDialogOpen(true);
    }
  };

  const handleNewCustomerSort = (column: 'name' | 'phone' | 'creation_date') => {
    const newDirection = newCustomersSortColumn === column && newCustomersSortDirection === 'asc' ? 'desc' : 'asc';
    setNewCustomersSortColumn(column);
    setNewCustomersSortDirection(newDirection);
    
    const sorted = [...newCustomersList].sort((a, b) => {
      let aVal = a[column === 'name' ? 'customer_name' : column === 'phone' ? 'customer_phone' : 'creation_date'];
      let bVal = b[column === 'name' ? 'customer_name' : column === 'phone' ? 'customer_phone' : 'creation_date'];
      
      if (column === 'name' || column === 'phone') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return newDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return newDirection === 'asc' ? new Date(aVal).getTime() - new Date(bVal).getTime() : new Date(bVal).getTime() - new Date(aVal).getTime();
      }
    });
    
    setNewCustomersList(sorted);
  };

  const handlePaymentChargesSort = (column: 'payment_brand' | 'payment_method' | 'transaction_count' | 'total' | 'bank_fee' | 'percentage') => {
    const newDirection = paymentChargesSortColumn === column && paymentChargesSortDirection === 'asc' ? 'desc' : 'asc';
    setPaymentChargesSortColumn(column);
    setPaymentChargesSortDirection(newDirection);
    
    const sorted = [...paymentChargesBreakdown].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      if (column === 'payment_brand' || column === 'payment_method') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return newDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return newDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    
    setPaymentChargesBreakdown(sorted);
  };

  const handlePointsClick = async () => {
    try {
      setLoadingPointTransactions(true);
      const dateRange = getDateRange();
      if (!dateRange) {
        setLoadingPointTransactions(false);
        return;
      }

      const startStr = appliedStartStr ?? format(dateRange.start, "yyyy-MM-dd 00:00:00");
      const endStr = appliedEndNextStr ?? format(dateRange.end, "yyyy-MM-dd 23:59:59");

      // Fetch ALL point transactions with pagination
      const pageSize = 1000;
      let from = 0;
      let allPointData: any[] = [];
      
      while (true) {
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('id, order_number, customer_name, customer_phone, created_at_date, total, cost_sold')
          .ilike('payment_method', 'point')
          .gte('created_at_date', startStr)
          .lte('created_at_date', endStr)
          .order('created_at_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        allPointData = allPointData.concat(batch);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      // Use exact same grouping logic as dashboard card calculation
      const orderGrouped = new Map<string, { total: number; cost: number; customer_name: string; customer_phone: string; created_at_date: string }>();
      allPointData.forEach((item: any) => {
        const key = item.order_number || item.id;
        const total = parseNumber(item.total);
        const cost = parseNumber(item.cost_sold);
        const existing = orderGrouped.get(key);
        if (!existing) {
          orderGrouped.set(key, { 
            total, 
            cost, 
            customer_name: item.customer_name || '',
            customer_phone: item.customer_phone || '',
            created_at_date: item.created_at_date
          });
        } else {
          existing.total += total;
          existing.cost += cost;
          // Keep the latest date for this order
          if (item.created_at_date && new Date(item.created_at_date).getTime() > new Date(existing.created_at_date).getTime()) {
            existing.created_at_date = item.created_at_date;
          }
        }
      });

      // Now group by customer for the summary display
      const customerGrouped = new Map<string, any>();
      Array.from(orderGrouped.values()).forEach((order) => {
        const customerKey = `${order.customer_name}-${order.customer_phone}`;
        const existing = customerGrouped.get(customerKey);
        if (!existing) {
          customerGrouped.set(customerKey, {
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            created_at_date: order.created_at_date,
            sales_amount: order.total,
            cost_amount: order.cost,
          });
        } else {
          existing.sales_amount += order.total;
          existing.cost_amount += order.cost;
          // Keep the latest transaction date for this customer
          if (order.created_at_date && new Date(order.created_at_date).getTime() > new Date(existing.created_at_date).getTime()) {
            existing.created_at_date = order.created_at_date;
          }
        }
      });

      // Calculate totals for the metrics card
      const totalPointsSales = Array.from(orderGrouped.values()).reduce((sum, v) => sum + v.total, 0);
      const totalPointsCost = Array.from(orderGrouped.values()).reduce((sum, v) => sum + v.cost, 0);

      // Update metrics with points data and recalculate profit
      setMetrics(prev => ({
        ...prev,
        totalPoints: totalPointsSales,
        pointsCostSold: totalPointsCost,
      }));

      const formattedData = Array.from(customerGrouped.values());

      setPointTransactionsList(formattedData);
      setPointTransactionsSortColumn('created_at_date');
      setPointTransactionsSortDirection('desc');
      setPointTransactionsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching point transactions:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل معاملات النقاط' : 'Failed to load point transactions',
        variant: "destructive",
      });
    } finally {
      setLoadingPointTransactions(false);
    }
  };

  const handlePointTransactionSort = (column: 'customer_name' | 'customer_phone' | 'created_at_date' | 'sales_amount' | 'cost_amount') => {
    const newDirection = pointTransactionsSortColumn === column && pointTransactionsSortDirection === 'asc' ? 'desc' : 'asc';
    setPointTransactionsSortColumn(column as any);
    setPointTransactionsSortDirection(newDirection);
    
    const sorted = [...pointTransactionsList].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      if (column === 'customer_name' || column === 'customer_phone') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return newDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else if (column === 'created_at_date') {
        return newDirection === 'asc' ? new Date(aVal).getTime() - new Date(bVal).getTime() : new Date(bVal).getTime() - new Date(aVal).getTime();
      } else {
        // Numeric columns: sales_amount, cost_amount
        return newDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
      }
    });
    
    setPointTransactionsList(sorted);
  };

  const handleBrandSalesSort = (column: 'brandName' | 'transactionCount' | 'totalSales') => {
    const newDirection = brandSalesSortColumn === column && brandSalesSortDirection === 'asc' ? 'desc' : 'asc';
    setBrandSalesSortColumn(column);
    setBrandSalesSortDirection(newDirection);
  };

  const handlePaymentChargesClick = async () => {
    try {
      setLoadingPaymentCharges(true);
      const dateRange = getDateRange();
      if (!dateRange) {
        setLoadingPaymentCharges(false);
        return;
      }

      const startStr = appliedStartStr ?? format(dateRange.start, "yyyy-MM-dd 00:00:00");
      const endStr = appliedEndNextStr ?? format(dateRange.end, "yyyy-MM-dd 23:59:59");

      // Fetch payment methods configuration
      const { data: paymentMethods, error: pmError } = await supabase
        .from('payment_methods')
        .select('payment_type, payment_method, gateway_fee, fixed_value, vat_fee, is_active')
        .eq('is_active', true);

      if (pmError) throw pmError;

      // Create a lookup map for payment methods (composite key)
      const paymentMethodMap = new Map();
      (paymentMethods || []).forEach((pm: any) => {
        const key = `${pm.payment_type?.toLowerCase()}||${pm.payment_method?.toLowerCase()}`;
        paymentMethodMap.set(key, pm);
      });

      // Fetch only non-point orders from ordertotals table with pagination
      const pageSize = 1000;
      let from = 0;
      let allData: any[] = [];
      
      while (true) {
        const { data, error } = await supabase
          .from('ordertotals')
          .select('payment_brand, payment_method, total')
          .gte('order_date', startStr)
          .lte('order_date', endStr)
          .order('order_date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        allData = allData.concat(batch);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      // Group by payment_method + payment_brand and calculate fees dynamically
      const grouped = allData.reduce((acc: any, item) => {
        // Skip point transactions
        if ((item.payment_method || '').toLowerCase() === 'point') return acc;
        
        const brand = item.payment_brand || 'Unknown';
        const method = item.payment_method || 'Unknown';
        const key = `${method}||${brand}`;
        
        // Get payment method config using composite key
        const pmKey = `${method.toLowerCase()}||${brand.toLowerCase()}`;
        const pmConfig = paymentMethodMap.get(pmKey);
        
        // Calculate bank fee dynamically: ((total * gateway_fee%) + fixed_value) * (1 + vat_fee%)
        const total = parseNumber(item.total);
        let bankFee = 0;
        if (pmConfig) {
          const gatewayFee = (total * (pmConfig.gateway_fee || 0)) / 100;
          bankFee = (gatewayFee + (pmConfig.fixed_value || 0)) * (1 + (pmConfig.vat_fee || 15) / 100);
        }
        
        if (!acc[key]) {
          acc[key] = {
            payment_brand: brand,
            payment_method: method,
            total: 0,
            bank_fee: 0,
            transaction_count: 0
          };
        }
        acc[key].total += total;
        acc[key].bank_fee += bankFee;
        acc[key].transaction_count += 1;
        return acc;
      }, {});

      // Add percentage to each item (bank_fee / sales * 100)
      const groupedArray = Object.values(grouped) as Array<{payment_brand: string, total: number, bank_fee: number, transaction_count: number}>;
      const breakdown = groupedArray.map((item) => ({
        ...item,
        percentage: item.total > 0 ? (item.bank_fee / item.total) * 100 : 0
      })).sort((a, b) => b.bank_fee - a.bank_fee);
      
      setPaymentChargesBreakdown(breakdown);
      setPaymentChargesSortColumn('bank_fee');
      setPaymentChargesSortDirection('desc');
      setPaymentChargesDialogOpen(true);
    } catch (error) {
      console.error('Error calculating payment charges:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل رسوم الدفع' : 'Failed to load payment charges',
        variant: "destructive",
      });
    } finally {
      setLoadingPaymentCharges(false);
    }
  };

  const handlePaymentDetailsClick = async (payment_method: string, payment_brand: string) => {
    try {
      setLoadingPaymentDetails(true);
      setSelectedPaymentForDetails({ payment_method, payment_brand });
      const dateRange = getDateRange();
      if (!dateRange) {
        setLoadingPaymentDetails(false);
        return;
      }

      const startStr = appliedStartStr ?? format(dateRange.start, "yyyy-MM-dd 00:00:00");
      const endStr = appliedEndNextStr ?? format(dateRange.end, "yyyy-MM-dd 23:59:59");

      // Fetch transactions for specific payment method and brand
      const pageSize = 1000;
      let from = 0;
      let allData: any[] = [];
      
      while (true) {
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('order_number, customer_name, customer_phone, brand_name, product_name, qty, total')
          .eq('payment_method', payment_method)
          .eq('payment_brand', payment_brand)
          .gte('created_at_date', startStr)
          .lte('created_at_date', endStr)
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = data || [];
        allData = allData.concat(batch);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      setPaymentDetailsList(allData);
      setPaymentDetailsSortColumn('total');
      setPaymentDetailsSortDirection('desc');
      setPaymentDetailsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحميل تفاصيل المعاملات' : 'Failed to load transaction details',
        variant: "destructive",
      });
    } finally {
      setLoadingPaymentDetails(false);
    }
  };

  const handlePaymentDetailsSort = (column: 'order_number' | 'customer_name' | 'customer_phone' | 'brand_name' | 'product_name' | 'qty' | 'total') => {
    const newDirection = paymentDetailsSortColumn === column && paymentDetailsSortDirection === 'asc' ? 'desc' : 'asc';
    setPaymentDetailsSortColumn(column);
    setPaymentDetailsSortDirection(newDirection);
    
    const sorted = [...paymentDetailsList].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      if (column === 'order_number' || column === 'customer_name' || column === 'customer_phone' || column === 'brand_name' || column === 'product_name') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return newDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        // Numeric columns: qty, total
        return newDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
      }
    });
    
    setPaymentDetailsList(sorted);
  };

  const metricCards = [
    {
      key: "sales_metrics",
      title: t("dashboard.totalSales"),
      value: formatCurrency(metrics.totalSales),
      icon: DollarSign,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      key: "total_profit",
      title: t("dashboard.totalProfit"),
      value: formatCurrency(metrics.totalSales - metrics.costOfSales - metrics.pointsCostSold - metrics.ePaymentCharges),
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      key: "points_sales",
      title: language === 'ar' ? 'مبيعات النقاط' : 'Points Sales',
      value: formatCurrency(metrics.totalPoints),
      icon: Coins,
      gradient: "from-yellow-500 to-amber-500",
      onClick: handlePointsClick,
    },
    {
      key: "transaction_count",
      title: t("dashboard.transactions"),
      value: metrics.transactionCount.toLocaleString(),
      icon: ShoppingCart,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      key: "avg_order_metrics",
      title: t("dashboard.avgOrderValue"),
      value: formatCurrency(metrics.avgOrderValue),
      icon: CreditCard,
      gradient: "from-orange-500 to-red-500",
    },
    {
      key: "new_customers",
      title: language === 'ar' ? 'عملاء جدد' : 'New Customers',
      value: newCustomersCount.toLocaleString(),
      icon: TrendingUp,
      gradient: "from-indigo-500 to-purple-500",
      onClick: handleNewCustomersClick,
    },
  ].filter(card => hasAccess(card.key));

  // Income Statement Data
  const incomeStatementData = [
    { label: t("dashboard.totalSalesWithDiscount"), value: metrics.totalSales, percentage: 100 },
    { label: t("dashboard.discountCoupons"), value: metrics.couponSales, percentage: (metrics.couponSales / metrics.totalSales) * 100 },
    { label: t("dashboard.salesPlusCoupon"), value: metrics.totalSales + metrics.couponSales, percentage: ((metrics.totalSales + metrics.couponSales) / metrics.totalSales) * 100 },
    { label: t("dashboard.costOfSales"), value: metrics.costOfSales, percentage: (metrics.costOfSales / metrics.totalSales) * 100 },
    { label: t("dashboard.pointsCost"), value: metrics.pointsCostSold, percentage: (metrics.pointsCostSold / metrics.totalSales) * 100 },
    { label: t("dashboard.shipping"), value: 0, percentage: 0 },
    { label: t("dashboard.taxes"), value: 0, percentage: 0 },
    { label: t("dashboard.ePaymentCharges"), value: metrics.ePaymentCharges, percentage: (metrics.ePaymentCharges / metrics.totalSales) * 100, onClick: handlePaymentChargesClick },
    { label: t("dashboard.netSales"), value: metrics.totalSales - metrics.costOfSales - metrics.pointsCostSold - metrics.ePaymentCharges, percentage: ((metrics.totalSales - metrics.costOfSales - metrics.pointsCostSold - metrics.ePaymentCharges) / metrics.totalSales) * 100 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">{t("dashboard.dateRange")}</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yesterday">{t("dashboard.yesterday")}</SelectItem>
                  <SelectItem value="thisMonth">{t("dashboard.thisMonth")}</SelectItem>
                  <SelectItem value="lastMonth">{t("dashboard.lastMonth")}</SelectItem>
                  <SelectItem value="dateRange">{t("dashboard.dateRange")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === "dateRange" && (
              <>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">{t("dashboard.from")}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, "PPP") : <span>{t("dashboard.from")}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar 
                        mode="single" 
                        selected={fromDate} 
                        onSelect={setFromDate} 
                        initialFocus 
                        captionLayout="dropdown"
                        fromYear={2020}
                        toYear={new Date().getFullYear() + 1}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">{t("dashboard.to")}</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? format(toDate, "PPP") : <span>{t("dashboard.to")}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar 
                        mode="single" 
                        selected={toDate} 
                        onSelect={setToDate} 
                        initialFocus 
                        captionLayout="dropdown"
                        fromYear={2020}
                        toYear={new Date().getFullYear() + 1}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDateInfo(true)}
                className="w-fit self-center"
              >
                <Info className="h-4 w-4" />
              </Button>
              <Button onClick={handleApplyFilter}>{t("dashboard.apply")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Info Dialog */}
      <Dialog open={showDateInfo} onOpenChange={setShowDateInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.selectedDateRange")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-4">
            {(() => {
              const dateRange = getDateRange();
              if (!dateRange) {
                return <p className="text-muted-foreground">Please select a date range</p>;
              }
              
              return (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">From Date (yyyymmdd):</span>
                    <span className="text-2xl font-bold">
                      {format(dateRange.start, "yyyyMMdd")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-muted-foreground">To Date (yyyymmdd):</span>
                    <span className="text-2xl font-bold">
                      {format(dateRange.end, "yyyyMMdd")}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 pt-4 border-t">
                    <span className="text-sm font-medium text-muted-foreground">Integer Format:</span>
                    <div className="flex gap-2 items-center">
                      <span className="text-lg font-mono bg-muted px-3 py-1 rounded">
                        {format(dateRange.start, "yyyyMMdd")}
                      </span>
                      <span className="text-muted-foreground">to</span>
                      <span className="text-lg font-mono bg-muted px-3 py-1 rounded">
                        {format(dateRange.end, "yyyyMMdd")}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Metrics Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((card) => (
          <Card 
            key={card.title} 
            className={cn(
              "border-2 hover:shadow-lg transition-all duration-300 relative",
              card.onClick && "cursor-pointer hover:border-primary"
            )}
            onClick={card.onClick}
          >
            {loadingStats && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Income Statement */}
      {hasAccess("income_statement") && (
        <Card className="border-2 relative">
        {loadingStats && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <CardTitle>{t("dashboard.incomeStatement")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {incomeStatementData.map((item, index) => (
              <div 
                key={index} 
                className={cn(
                  `flex justify-between items-center py-2 ${index === incomeStatementData.length - 1 ? 'border-t-2 pt-4 font-bold' : 'border-b'}`,
                  item.onClick && "cursor-pointer hover:bg-muted/50 transition-colors rounded px-2"
                )}
                onClick={item.onClick}
              >
                <span className={`${index === incomeStatementData.length - 1 ? 'text-lg' : ''}`}>{item.label}</span>
                <div className="flex gap-4 items-center">
                  <span className={`${item.percentage < 0 ? 'text-red-500' : item.percentage > 20 ? 'text-green-500' : ''} ${index === incomeStatementData.length - 1 ? 'text-lg' : 'text-sm'}`}>
                    {item.percentage > 0 && item.percentage !== 100 ? `${item.percentage.toFixed(2)}%` : ''}
                  </span>
                  <span className={`${index === incomeStatementData.length - 1 ? 'text-lg' : ''}`}>{formatCurrency(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Brand Sales Grid */}
      {hasAccess("brand_sales_grid") && (
      <Card className="border-2 relative">
        {loadingTables && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'مبيعات العلامات التجارية' : 'Brand Sales Overview'}</CardTitle>
          <CardDescription>
            {language === 'ar' ? 'جميع مبيعات العلامات التجارية للفترة المحددة' : 'All brand sales for the selected period'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Sorting Controls */}
          <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
            <Button
              variant={brandSalesSortColumn === 'brandName' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleBrandSalesSort('brandName')}
              className="gap-2"
            >
              {language === 'ar' ? 'اسم العلامة' : 'Brand Name'}
              {brandSalesSortColumn === 'brandName' && (
                brandSalesSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant={brandSalesSortColumn === 'totalSales' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleBrandSalesSort('totalSales')}
              className="gap-2"
            >
              {language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
              {brandSalesSortColumn === 'totalSales' && (
                brandSalesSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant={brandSalesSortColumn === 'transactionCount' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleBrandSalesSort('transactionCount')}
              className="gap-2"
            >
              {language === 'ar' ? 'عدد المعاملات' : 'Transaction Count'}
              {brandSalesSortColumn === 'transactionCount' && (
                brandSalesSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* List Display */}
          <div className="space-y-3">
            {brandSalesGrid.length > 0 ? (
              <>
                {[...brandSalesGrid]
                  .sort((a, b) => {
                    const aVal = a[brandSalesSortColumn];
                    const bVal = b[brandSalesSortColumn];
                    
                    if (typeof aVal === 'string' && typeof bVal === 'string') {
                      return brandSalesSortDirection === 'asc' 
                        ? aVal.localeCompare(bVal) 
                        : bVal.localeCompare(aVal);
                    }
                    
                    return brandSalesSortDirection === 'asc' 
                      ? aVal - bVal 
                      : bVal - aVal;
                  })
                  .map((brand, index) => (
                  <Card key={brand.brandName} className="border hover:border-primary transition-colors">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary shrink-0">
                            #{index + 1}
                          </span>
                          <h3 className="font-semibold text-base" title={brand.brandName}>
                            {brand.brandName.length > 30 ? brand.brandName.substring(0, 30) + '...' : brand.brandName}
                          </h3>
                        </div>
                        
                        <div className="flex items-center gap-6 shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
                            </div>
                            <div className="font-bold text-primary">
                              {formatCurrency(brand.totalSales)}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              {language === 'ar' ? 'عدد المعاملات' : 'Transactions'}
                            </div>
                            <div className="font-semibold">
                              {brand.transactionCount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* Total Row */}
                <Card className="border-2 border-primary bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <h3 className="font-bold text-lg">
                          {language === 'ar' ? 'المجموع الكلي' : 'Total'}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground font-semibold">
                            {language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
                          </div>
                          <div className="font-bold text-primary text-lg">
                            {formatCurrency(brandSalesGrid.reduce((sum, brand) => sum + brand.totalSales, 0))}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground font-semibold">
                            {language === 'ar' ? 'عدد المعاملات' : 'Transactions'}
                          </div>
                          <div className="font-bold text-lg">
                            {brandSalesGrid.reduce((sum, brand) => sum + brand.transactionCount, 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Coins by Brand Grid */}
      {hasAccess("coins_by_brand") && (
      <Card className="border-2 relative">
        {loadingTables && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            {t("dashboard.coinsByBrand")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleCoinsSort('brand_name')}
                  >
                    <div className="flex items-center gap-2">
                      {t("dashboard.brandName")}
                      {coinsSortColumn === 'brand_name' && (
                        coinsSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {coinsSortColumn !== 'brand_name' && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </th>
                  <th 
                    className="text-right py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleCoinsSort('total_coins')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {t("dashboard.totalCoins")}
                      {coinsSortColumn === 'total_coins' && (
                        coinsSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {coinsSortColumn !== 'total_coins' && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </th>
                  <th 
                    className="text-right py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleCoinsSort('usd_cost')}
                  >
                    <div className="flex items-center justify-end gap-2">
                      USD$
                      {coinsSortColumn === 'usd_cost' && (
                        coinsSortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
                      )}
                      {coinsSortColumn !== 'usd_cost' && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {coinsByBrand.length > 0 ? (
                  coinsByBrand.map((item: any, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4 font-medium">{item.brand_name}</td>
                      <td className="text-right py-3 px-4 font-semibold">
                        {new Intl.NumberFormat('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        }).format(item.total_coins)}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-primary">
                        {item.usd_value > 0 ? (
                          `$${new Intl.NumberFormat('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(item.usd_cost)}`
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-muted-foreground">
                      {t("dashboard.noCoinsData")}
                    </td>
                  </tr>
                )}
              </tbody>
              {coinsByBrand.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-bold bg-muted/30">
                    <td className="py-3 px-4">{language === 'ar' ? 'الإجمالي الكلي' : 'Total'}</td>
                    <td className="text-right py-3 px-4 text-lg">
                      {new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(coinsByBrand.reduce((sum, item) => sum + item.total_coins, 0))}
                    </td>
                    <td className="text-right py-3 px-4 text-lg text-primary">
                      ${new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(coinsByBrand.reduce((sum, item) => sum + (item.usd_cost || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Charts Row 1 - Sales Trend & Top 5 Categories */}
      <div className="grid gap-6 md:grid-cols-2">
        {hasAccess("sales_trend_chart") && (
          <Card className="border-2 relative">
            {loadingCharts && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>{t("dashboard.salesTrend")}</CardTitle>
                <div className="flex gap-2">
                  <Select value={trendBrandFilter} onValueChange={setTrendBrandFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t("dashboard.filterBrand")} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="all">{t("dashboard.allBrands")}</SelectItem>
                      {allBrands.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={trendDays} onValueChange={setTrendDays}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Select days" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="10">10 Days</SelectItem>
                      <SelectItem value="20">20 Days</SelectItem>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                      <SelectItem value="120">120 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area type="monotone" dataKey="sales" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} name={t("dashboard.sales")} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {hasAccess("top_brands_chart") && (
          <Card className="border-2 relative">
            {loadingCharts && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'أفضل 5 علامات تجارية' : 'Top 5 Brand'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topBrands}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, name }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      const match = name.match(/\(([\d.]+)%\)/);
                      const percentage = match ? `${match[1]}%` : '';
                      
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          style={{ fontSize: '14px', fontWeight: 'bold' }}
                        >
                          {percentage}
                        </text>
                      );
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={handleBrandClick}
                    cursor="pointer"
                  >
                    {topBrands.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend 
                    iconType="circle" 
                    align="left"
                    verticalAlign="middle" 
                    layout="vertical"
                    wrapperStyle={{ color: '#ffffff' }}
                    formatter={(value) => {
                      const shortName = value.replace(/\s*\([\d.]+%\)/, '');
                      if (shortName.length <= 9) return shortName;
                      const truncated = shortName.substring(0, 9);
                      const lastSpace = truncated.lastIndexOf(' ');
                      return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 2 - Top 10 Products & Month Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        {hasAccess("top_products_chart") && (
          <Card className="border-2 relative">
            {loadingCharts && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'أفضل 5 منتجات' : 'Top 5 Products'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, name }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      const match = name.match(/\(([\d.]+)%\)/);
                      const percentage = match ? `${match[1]}%` : '';
                      
                      return (
                        <text 
                          x={x} 
                          y={y} 
                          fill="white" 
                          textAnchor={x > cx ? 'start' : 'end'} 
                          dominantBaseline="central"
                          style={{ fontSize: '14px', fontWeight: 'bold' }}
                        >
                          {percentage}
                        </text>
                      );
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend 
                    iconType="circle" 
                    align="left"
                    verticalAlign="middle" 
                    layout="vertical"
                    wrapperStyle={{ color: '#ffffff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {hasAccess("month_comparison_chart") && (
          <Card className="border-2 relative">
            {loadingCharts && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>{t("dashboard.monthComparison")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="sales" fill="#8B5CF6" name={t("dashboard.sales")} />
                  <Bar dataKey="profit" fill="#10B981" name={t("dashboard.profit")} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row 3 - Payment Methods & Payment Brands (Doughnuts) */}
      <div className="grid gap-6 md:grid-cols-2">
        {hasAccess("payment_methods_chart") && (
          <Card className="border-2 relative">
            {loadingCharts && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>{t("dashboard.paymentMethods")}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                {language === 'ar' ? 'انقر على أي طريقة دفع لرؤية تفاصيل العلامات التجارية' : 'Click on any payment method to see brand details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(data) => handlePaymentMethodClick(data, data.transactions)}
                    className="cursor-pointer"
                  >
                    {paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend 
                    iconType="circle" 
                    align={language === 'ar' ? 'right' : 'left'}
                    verticalAlign="middle" 
                    layout="vertical"
                    wrapperStyle={{ color: '#ffffff', cursor: 'pointer' }}
                    onClick={(data) => {
                      const method = paymentMethods.find(m => m.name === data.value);
                      if (method) {
                        handlePaymentMethodClick(method, method.transactions);
                      }
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Payment Brand Details Dialog */}
        <Dialog open={selectedPaymentMethod !== null} onOpenChange={() => setSelectedPaymentMethod(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'العلامات التجارية للدفع - ' : 'Payment Brands - '}
                {selectedPaymentMethod}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {paymentBrandsByMethod.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentBrandsByMethod}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentBrandsByMethod.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">{language === 'ar' ? 'العلامة التجارية' : 'Brand'}</th>
                          <th className="text-right py-2 px-4">{language === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentBrandsByMethod.map((brand: any, index) => (
                          <tr key={index} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-4">{brand.name}</td>
                            <td className="text-right py-2 px-4 font-semibold">{formatCurrency(brand.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-bold bg-muted/30">
                          <td className="py-3 px-4">{language === 'ar' ? 'الإجمالي الكلي' : 'Grand Total'}</td>
                          <td className="text-right py-3 px-4 text-lg">
                            {formatCurrency(paymentBrandsByMethod.reduce((sum, brand) => sum + brand.value, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {hasAccess("payment_brands_chart") && (
          <Card className="border-2 relative">
            {loadingCharts && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <CardHeader>
              <CardTitle>{t("dashboard.paymentBrands")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentBrands}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentBrands.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend 
                    iconType="circle" 
                    align={language === 'ar' ? 'right' : 'left'}
                    verticalAlign="middle" 
                    layout="vertical"
                    wrapperStyle={{ color: '#ffffff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unused Payment Brands Grid */}
      {hasAccess("unused_payment_brands") && (
        <Card className="border-2 relative mt-6">
          {loadingCharts && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'وسائل دفع غير مستخدمة في الفترة المحددة' : 'Payment Brands Not Used in Selected Period'}</CardTitle>
            <CardDescription>
              {language === 'ar' 
                ? `${unusedPaymentBrands.length} وسيلة دفع لم تستخدم خلال الفترة المحددة`
                : `${unusedPaymentBrands.length} payment brand(s) not used during the selected period`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unusedPaymentBrands.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === 'ar' 
                  ? 'جميع وسائل الدفع المفعلة قيد الاستخدام' 
                  : 'All active payment brands are being used'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'وسيلة الدفع' : 'Payment Brand'}</TableHead>
                    <TableHead>{language === 'ar' ? 'نوع الدفع' : 'Payment Type'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unusedPaymentBrands.map((brand, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{brand.payment_method}</TableCell>
                      <TableCell>{brand.payment_type}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transaction Type Chart */}
      {hasAccess("transaction_type_chart") && (
        <TransactionTypeChart
          data={transactionTypeData}
          language={language}
          loading={loadingCharts}
        />
      )}

      {/* User Transaction Count Chart */}
      {hasAccess("user_transaction_count_chart") && (
        <UserTransactionCountChart
          data={userTransactionCountData}
          language={language}
          loading={loadingCharts}
        />
      )}

      {/* User Transaction Value Chart */}
      {hasAccess("user_transaction_value_chart") && (
        <UserTransactionValueChart
          data={userTransactionValueData}
          language={language}
          loading={loadingCharts}
        />
      )}

      {/* Product Summary Grid with Filters */}
      {hasAccess("product_summary_table") && (
      <Card className="border-2 relative">
        {loadingTables && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <CardTitle>{t("dashboard.productSummary")}</CardTitle>
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allProducts")}</SelectItem>
                {allProducts.map(product => (
                  <SelectItem key={product} value={product}>{product}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterCategory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allCategories")}</SelectItem>
                {allCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={brandFilterProduct} onValueChange={setBrandFilterProduct}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterBrand")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allBrands")}</SelectItem>
                {allBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">{t("dashboard.product")}</th>
                  <th className="text-right py-2 px-4">{t("dashboard.quantity")}</th>
                  <th className="text-right py-2 px-4">{t("dashboard.sales")}</th>
                </tr>
              </thead>
              <tbody>
                {productSummary
                  .filter(product => 
                    (productFilter === "all" || product.name === productFilter) &&
                    (categoryFilter === "all" || true) &&
                    (brandFilterProduct === "all" || true)
                  )
                  .slice(0, 20)
                  .map((product: any, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4">{product.name}</td>
                      <td className="text-right py-2 px-4">{product.qty}</td>
                      <td className="text-right py-2 px-4">{formatCurrency(product.value)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Customer Purchases Summary */}
      {hasAccess("customer_purchases_table") && (
      <Card className="border-2 relative">
        {loadingTables && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <CardTitle>{t("dashboard.customerPurchases")}</CardTitle>
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={customerFilterPurchases} onValueChange={setCustomerFilterPurchases}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterCustomer")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allCustomers")}</SelectItem>
                {allCustomers.map(customer => (
                  <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={language === 'ar' ? 'بحث برقم الهاتف' : 'Search by phone'}
                value={phoneFilterCustomer}
                onChange={(e) => setPhoneFilterCustomer(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={productFilterCustomer} onValueChange={setProductFilterCustomer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allProducts")}</SelectItem>
                {allProducts.map(product => (
                  <SelectItem key={product} value={product}>{product}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilterCustomer} onValueChange={setCategoryFilterCustomer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterCategory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allCategories")}</SelectItem>
                {allCategories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">{t("dashboard.customerName")}</th>
                  <th className="text-left py-2 px-4">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</th>
                  <th className="text-left py-2 px-4">{t("dashboard.category")}</th>
                  <th className="text-left py-2 px-4">{t("dashboard.product")}</th>
                  <th className="text-right py-2 px-4">{t("dashboard.totalValue")}</th>
                  <th className="text-right py-2 px-4">{t("dashboard.transactionCount")}</th>
                </tr>
              </thead>
              <tbody>
                {customerPurchases
                  .filter(customer => 
                    (customerFilterPurchases === "all" || customer.customerName === customerFilterPurchases) &&
                    (phoneFilterCustomer === "" || customer.customerPhone.includes(phoneFilterCustomer)) &&
                    (productFilterCustomer === "all" || customer.product === productFilterCustomer) &&
                    (categoryFilterCustomer === "all" || customer.category === categoryFilterCustomer)
                  )
                  .slice(0, 20)
                  .map((customer: any, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4">{customer.customerName}</td>
                      <td className="py-2 px-4 font-mono">{customer.customerPhone}</td>
                      <td className="py-2 px-4">{customer.category}</td>
                      <td className="py-2 px-4">{customer.product}</td>
                      <td className="text-right py-2 px-4">{formatCurrency(customer.totalValue)}</td>
                      <td className="text-right py-2 px-4">{customer.transactionCount}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Inactive Customers - CRM Follow-up */}
      {hasAccess("inactive_customers_section") && (
      <Card className="border-2 relative">
        {loadingInactiveCustomers && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{language === 'ar' ? 'عملاء بحاجة للمتابعة - CRM' : 'Inactive Customers - CRM Follow-up'}</CardTitle>
              <CardDescription>
                {language === 'ar' 
                  ? `العملاء الذين لم يشتروا منذ ${inactivePeriod === "over30" ? 'أكثر من 30' : inactivePeriod} ${inactivePeriod === "over30" ? 'يوماً' : 'أيام'}` 
                  : `Customers who haven't purchased in the last ${inactivePeriod === "over30" ? 'over 30' : inactivePeriod} days`}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{inactiveCustomers.length}</p>
              <p className="text-xs text-muted-foreground">{language === 'ar' ? 'إجمالي السجلات' : 'Total Records'}</p>
            </div>
          </div>
          <div className="mt-4">
            <Select value={inactivePeriod} onValueChange={(value) => {
              setInactivePeriod(value);
              setTimeout(() => fetchInactiveCustomers(), 100);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === 'ar' ? 'اختر الفترة' : 'Select Period'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">{language === 'ar' ? '10 أيام' : '10 Days'}</SelectItem>
                <SelectItem value="15">{language === 'ar' ? '15 يوم' : '15 Days'}</SelectItem>
                <SelectItem value="20">{language === 'ar' ? '20 يوم' : '20 Days'}</SelectItem>
                <SelectItem value="30">{language === 'ar' ? '30 يوم' : '30 Days'}</SelectItem>
                <SelectItem value="over30">{language === 'ar' ? 'أكثر من 30 يوم' : 'Over 30 Days'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="relative w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={language === 'ar' ? 'بحث برقم الهاتف' : 'Search by phone'}
                value={inactivePhoneFilter}
                onChange={(e) => {
                  setInactivePhoneFilter(e.target.value);
                  setInactiveCustomersPage(1);
                }}
                className="pl-10"
              />
            </div>

            <Select value={inactiveBrandFilter} onValueChange={(value) => {
              setInactiveBrandFilter(value);
              setInactiveCustomersPage(1);
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === 'ar' ? 'تصفية حسب العلامة' : 'Filter by Brand'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'جميع العلامات' : 'All Brands'}</SelectItem>
                {allInactiveBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {inactiveCustomers.filter(customer => 
            (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
            (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
          ).length > inactiveCustomersPerPage && (
            <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              {language === 'ar' 
                ? `عرض ${(inactiveCustomersPage - 1) * inactiveCustomersPerPage + 1} - ${Math.min(inactiveCustomersPage * inactiveCustomersPerPage, inactiveCustomers.filter(customer => 
                    (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                    (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                  ).length)} من ${inactiveCustomers.filter(customer => 
                    (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                    (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                  ).length} عميل` 
                : `Showing ${(inactiveCustomersPage - 1) * inactiveCustomersPerPage + 1} - ${Math.min(inactiveCustomersPage * inactiveCustomersPerPage, inactiveCustomers.filter(customer => 
                    (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                    (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                  ).length)} of ${inactiveCustomers.filter(customer => 
                    (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                    (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                  ).length} customers`}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</th>
                  <th className="text-left py-2 px-4">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</th>
                  <th className="text-left py-2 px-4">{language === 'ar' ? 'العلامة الرئيسية' : 'Top Brand'}</th>
                  <th className="text-right py-2 px-4">{language === 'ar' ? 'إجمالي الإنفاق' : 'Total Spend'}</th>
                  <th className="text-right py-2 px-4">{language === 'ar' ? 'عدد المعاملات' : 'Transaction Count'}</th>
                  <th className="text-right py-2 px-4">{language === 'ar' ? 'آخر معاملة' : 'Last Transaction'}</th>
                  <th className="text-center py-2 px-4">{language === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {inactiveCustomers.length > 0 ? (
                  inactiveCustomers
                    .filter(customer => 
                      (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                      (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                    )
                    .slice((inactiveCustomersPage - 1) * inactiveCustomersPerPage, inactiveCustomersPage * inactiveCustomersPerPage)
                    .map((customer: any, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{customer.customerName}</td>
                        <td className="py-2 px-4 font-mono">{customer.customerPhone}</td>
                        <td className="py-2 px-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {customer.topBrand}
                          </span>
                        </td>
                        <td className="text-right py-2 px-4 font-semibold">{formatCurrency(customer.totalSpend)}</td>
                        <td className="text-right py-2 px-4">{customer.transactionCount}</td>
                        <td className="text-right py-2 px-4">
                          {customer.lastTransaction ? format(new Date(customer.lastTransaction), 'MMM dd, yyyy') : 'N/A'}
                        </td>
                        <td className="text-center py-2 px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            {language === 'ar' ? 'تعديل' : 'Edit'}
                          </Button>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">
                      {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No inactive customers found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {inactiveCustomers.filter(customer => 
            (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
            (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
          ).length > inactiveCustomersPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInactiveCustomersPage(prev => Math.max(1, prev - 1))}
                disabled={inactiveCustomersPage === 1}
              >
                {language === 'ar' ? 'السابق' : 'Previous'}
              </Button>
              
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.ceil(inactiveCustomers.filter(customer => 
                  (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                  (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                ).length / inactiveCustomersPerPage) }, (_, i) => i + 1)
                  .filter(page => {
                    const totalPages = Math.ceil(inactiveCustomers.filter(customer => 
                      (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                      (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                    ).length / inactiveCustomersPerPage);
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (page >= inactiveCustomersPage - 1 && page <= inactiveCustomersPage + 1) return true;
                    return false;
                  })
                  .map((page, index, array) => {
                    const showEllipsis = index > 0 && page - array[index - 1] > 1;
                    return (
                      <>
                        {showEllipsis && <span className="px-2">...</span>}
                        <Button
                          key={page}
                          variant={inactiveCustomersPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setInactiveCustomersPage(page)}
                          className="w-10"
                        >
                          {page}
                        </Button>
                      </>
                    );
                  })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInactiveCustomersPage(prev => Math.min(Math.ceil(inactiveCustomers.filter(customer => 
                  (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                  (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                ).length / inactiveCustomersPerPage), prev + 1))}
                disabled={inactiveCustomersPage === Math.ceil(inactiveCustomers.filter(customer => 
                  (inactivePhoneFilter === "" || customer.customerPhone.includes(inactivePhoneFilter)) &&
                  (inactiveBrandFilter === "all" || customer.topBrand === inactiveBrandFilter)
                ).length / inactiveCustomersPerPage)}
              >
                {language === 'ar' ? 'التالي' : 'Next'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* CRM Follow-up Dialog */}
      <Dialog open={crmDialogOpen} onOpenChange={setCrmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'بيانات متابعة العميل - CRM' : 'Customer Follow-up - CRM'}
            </DialogTitle>
          </DialogHeader>
          
          {editingCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'اسم العميل' : 'Customer Name'}</p>
                  <p className="font-medium">{editingCustomer.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</p>
                  <p className="font-medium font-mono">{editingCustomer.customerPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'إجمالي الإنفاق' : 'Total Spend'}</p>
                  <p className="font-medium">{formatCurrency(editingCustomer.totalSpend)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{language === 'ar' ? 'آخر معاملة' : 'Last Transaction'}</p>
                  <p className="font-medium">
                    {editingCustomer.lastTransaction ? format(new Date(editingCustomer.lastTransaction), 'MMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  value={crmNotes}
                  onChange={(e) => setCrmNotes(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل ملاحظات حول العميل' : 'Enter notes about the customer'}
                  className="w-full min-h-[100px] p-3 border rounded-md resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'تاريخ التذكير' : 'Reminder Date'}
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !crmReminderDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {crmReminderDate ? format(crmReminderDate, "PPP") : <span>{language === 'ar' ? 'اختر تاريخ التذكير' : 'Pick a reminder date'}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar 
                      mode="single" 
                      selected={crmReminderDate} 
                      onSelect={setCrmReminderDate} 
                      initialFocus 
                      captionLayout="dropdown"
                      fromYear={new Date().getFullYear()}
                      toYear={new Date().getFullYear() + 5}
                      className="pointer-events-auto" 
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {language === 'ar' ? 'الإجراء التالي' : 'Next Action'}
                </label>
                <Input
                  value={crmNextAction}
                  onChange={(e) => setCrmNextAction(e.target.value)}
                  placeholder={language === 'ar' ? 'أدخل الإجراء التالي المطلوب' : 'Enter the next action to take'}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setCrmDialogOpen(false)}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button onClick={handleSaveCrmData} disabled={savingCrmData}>
                  {savingCrmData ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                    </>
                  ) : (
                    language === 'ar' ? 'حفظ' : 'Save'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Transactions */}
      {hasAccess('recent_transactions') && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.recentTransactions")}</CardTitle>
            <CardDescription>
              <Link 
                to={`/transactions?from=${getDateRange() ? format(getDateRange()!.start, 'yyyy-MM-dd') : ''}&to=${getDateRange() ? format(getDateRange()!.end, 'yyyy-MM-dd') : ''}`}
                className="text-primary hover:underline"
              >
                {t("dashboard.viewAll")}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between border-b pb-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{transaction.customer_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.brand_name} - {transaction.product_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.created_at_date ? format(new Date(transaction.created_at_date), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(parseNumber(transaction.total))}</p>
                    <p className="text-xs text-green-600">+{formatCurrency(parseNumber(transaction.profit))}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Brand Products Dialog */}
      <Dialog open={brandProductsDialogOpen} onOpenChange={setBrandProductsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? `منتجات ${selectedBrand}` : `${selectedBrand} Products`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {brandProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 font-semibold text-sm border-b pb-2">
                  <button 
                    onClick={() => handleBrandProductSort('name')}
                    className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                  >
                    {language === 'ar' ? 'المنتج' : 'Product'}
                    {brandProductsSortColumn === 'name' && (
                      brandProductsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleBrandProductSort('qty')}
                    className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                  >
                    {language === 'ar' ? 'الكمية' : 'Quantity'}
                    {brandProductsSortColumn === 'qty' && (
                      brandProductsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleBrandProductSort('value')}
                    className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                  >
                    {language === 'ar' ? 'القيمة' : 'Value'}
                    {brandProductsSortColumn === 'value' && (
                      brandProductsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
                {brandProducts.map((product, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4 py-2 border-b">
                    <div className="text-sm">{product.name}</div>
                    <div className="text-sm text-right">{product.qty.toLocaleString()}</div>
                    <div className="text-sm font-medium text-right">{formatCurrency(product.value)}</div>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-4 pt-4 font-bold">
                  <div>{language === 'ar' ? 'الإجمالي' : 'Total'}</div>
                  <div className="text-right">
                    {brandProducts.reduce((sum, p) => sum + p.qty, 0).toLocaleString()}
                  </div>
                  <div className="text-right">
                    {formatCurrency(brandProducts.reduce((sum, p) => sum + p.value, 0))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Point Transactions Dialog */}
      <Dialog open={pointTransactionsDialogOpen} onOpenChange={setPointTransactionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'ملخص معاملات النقاط حسب العميل' : 'Points Transactions Summary by Customer'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pointTransactionsList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === 'ar' ? 'لا توجد معاملات نقاط' : 'No point transactions found'}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-4 font-semibold text-sm border-b pb-2">
                  <button 
                    onClick={() => handlePointTransactionSort('customer_name')}
                    className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                  >
                    {language === 'ar' ? 'اسم العميل' : 'Customer Name'}
                    {pointTransactionsSortColumn === 'customer_name' && (
                      pointTransactionsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handlePointTransactionSort('customer_phone')}
                    className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                  >
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                    {pointTransactionsSortColumn === 'customer_phone' && (
                      pointTransactionsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handlePointTransactionSort('created_at_date')}
                    className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                  >
                    {language === 'ar' ? 'التاريخ' : 'Date'}
                    {pointTransactionsSortColumn === 'created_at_date' && (
                      pointTransactionsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handlePointTransactionSort('sales_amount')}
                    className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                  >
                    {language === 'ar' ? 'مبيعات النقاط' : 'Points Sales'}
                    {pointTransactionsSortColumn === 'sales_amount' && (
                      pointTransactionsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handlePointTransactionSort('cost_amount')}
                    className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                  >
                    {language === 'ar' ? 'تكلفة النقاط' : 'Points Cost'}
                    {pointTransactionsSortColumn === 'cost_amount' && (
                      pointTransactionsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
                {pointTransactionsList.map((transaction, index) => (
                  <div key={index} className="grid grid-cols-5 gap-4 py-2 border-b">
                    <div className="text-sm">{transaction.customer_name || 'N/A'}</div>
                    <div className="text-sm">{transaction.customer_phone || 'N/A'}</div>
                    <div className="text-sm text-right">
                      {transaction.created_at_date ? format(new Date(transaction.created_at_date), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                    <div className="text-sm font-medium text-right">{formatCurrency(transaction.sales_amount || 0)}</div>
                    <div className="text-sm font-medium text-right">{formatCurrency(transaction.cost_amount || 0)}</div>
                  </div>
                ))}
                <div className="grid grid-cols-5 gap-4 pt-4 font-bold">
                  <div className="col-span-3 text-right">{language === 'ar' ? 'الإجمالي' : 'Totals'}</div>
                  <div className="text-right">
                    {formatCurrency(pointTransactionsList.reduce((sum, t) => sum + (t.sales_amount || 0), 0))}
                  </div>
                  <div className="text-right">
                    {formatCurrency(pointTransactionsList.reduce((sum, t) => sum + (t.cost_amount || 0), 0))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Charges Dialog */}
      <Dialog open={paymentChargesDialogOpen} onOpenChange={setPaymentChargesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تفاصيل رسوم الدفع الإلكتروني' : 'E-Payment Charges Breakdown'}
            </DialogTitle>
          </DialogHeader>
          {loadingPaymentCharges ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {paymentChargesBreakdown.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'ar' ? 'لا توجد رسوم دفع' : 'No payment charges found'}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-6 gap-4 font-semibold text-sm border-b pb-2">
                    <button 
                      onClick={() => handlePaymentChargesSort('payment_method')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'نوع الدفع' : 'Payment Method'}
                      {paymentChargesSortColumn === 'payment_method' && (
                        paymentChargesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentChargesSort('payment_brand')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'وسيلة الدفع' : 'Payment Brand'}
                      {paymentChargesSortColumn === 'payment_brand' && (
                        paymentChargesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentChargesSort('transaction_count')}
                      className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                    >
                      {language === 'ar' ? 'عدد المعاملات' : 'Transactions'}
                      {paymentChargesSortColumn === 'transaction_count' && (
                        paymentChargesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentChargesSort('total')}
                      className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                    >
                      {language === 'ar' ? 'المبيعات' : 'Total Sales'}
                      {paymentChargesSortColumn === 'total' && (
                        paymentChargesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentChargesSort('bank_fee')}
                      className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                    >
                      {language === 'ar' ? 'رسوم البنك' : 'Bank Fee'}
                      {paymentChargesSortColumn === 'bank_fee' && (
                        paymentChargesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentChargesSort('percentage')}
                      className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                    >
                      {language === 'ar' ? 'النسبة' : 'Percentage'}
                      {paymentChargesSortColumn === 'percentage' && (
                        paymentChargesSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {paymentChargesBreakdown.map((item, index) => (
                    <div key={index} className="grid grid-cols-6 gap-4 py-2 border-b">
                      <div className="text-sm">{item.payment_method}</div>
                      <div className="text-sm">{item.payment_brand}</div>
                      <button 
                        onClick={() => handlePaymentDetailsClick(item.payment_method, item.payment_brand)}
                        className="text-sm text-right text-primary hover:underline cursor-pointer"
                      >
                        {item.transaction_count?.toLocaleString() || 0}
                      </button>
                      <div className="text-sm text-right">{formatCurrency(item.total)}</div>
                      <div className="text-sm font-medium text-right">{formatCurrency(item.bank_fee)}</div>
                      <div className="text-sm font-medium text-right text-primary">{item.percentage.toFixed(2)}%</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-6 gap-4 pt-4 font-bold border-t-2">
                    <div className="text-left">{language === 'ar' ? 'الإجمالي' : 'Total'}</div>
                    <div></div>
                    <div className="text-right">
                      {paymentChargesBreakdown.reduce((sum, item) => sum + (item.transaction_count || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-right">
                      {formatCurrency(paymentChargesBreakdown.reduce((sum, item) => sum + item.total, 0))}
                    </div>
                    <div className="text-right">
                      {formatCurrency(paymentChargesBreakdown.reduce((sum, item) => sum + item.bank_fee, 0))}
                    </div>
                    <div className="text-right">
                      {(() => {
                        const totalSales = paymentChargesBreakdown.reduce((sum, item) => sum + item.total, 0);
                        const totalFees = paymentChargesBreakdown.reduce((sum, item) => sum + item.bank_fee, 0);
                        return totalSales > 0 ? ((totalFees / totalSales) * 100).toFixed(2) + '%' : '0.00%';
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Customers Dialog */}
      <Dialog open={newCustomersDialogOpen} onOpenChange={setNewCustomersDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'العملاء الجدد' : 'New Customers'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {newCustomersList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {language === 'ar' ? 'لا يوجد عملاء جدد' : 'No new customers found'}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-4 font-semibold text-sm border-b pb-2">
                  <button 
                    onClick={() => handleNewCustomerSort('name')}
                    className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                  >
                    {language === 'ar' ? 'الاسم' : 'Name'}
                    {newCustomersSortColumn === 'name' && (
                      newCustomersSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleNewCustomerSort('phone')}
                    className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                  >
                    {language === 'ar' ? 'الهاتف' : 'Phone'}
                    {newCustomersSortColumn === 'phone' && (
                      newCustomersSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleNewCustomerSort('creation_date')}
                    className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                  >
                    {language === 'ar' ? 'تاريخ الإنشاء' : 'Creation Date'}
                    {newCustomersSortColumn === 'creation_date' && (
                      newCustomersSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                </div>
                {newCustomersList.map((customer, index) => (
                  <div key={index} className="grid grid-cols-3 gap-4 py-2 border-b">
                    <div className="text-sm">{customer.customer_name}</div>
                    <div className="text-sm">{customer.customer_phone}</div>
                    <div className="text-sm text-right">
                      {customer.creation_date ? format(new Date(customer.creation_date), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                  </div>
                ))}
                <div className="pt-4 font-bold">
                  {language === 'ar' ? 'الإجمالي' : 'Total'}: {newCustomersList.length.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsDialogOpen} onOpenChange={setPaymentDetailsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تفاصيل معاملات الدفع' : 'Payment Transaction Details'}
              {selectedPaymentForDetails && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({selectedPaymentForDetails.payment_method} - {selectedPaymentForDetails.payment_brand})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {loadingPaymentDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {paymentDetailsList.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'ar' ? 'لا توجد معاملات' : 'No transactions found'}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-4 font-semibold text-sm border-b pb-2">
                    <button 
                      onClick={() => handlePaymentDetailsSort('order_number')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'رقم الطلب' : 'Order #'}
                      {paymentDetailsSortColumn === 'order_number' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentDetailsSort('customer_name')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'العميل' : 'Customer'}
                      {paymentDetailsSortColumn === 'customer_name' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentDetailsSort('customer_phone')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'الهاتف' : 'Phone'}
                      {paymentDetailsSortColumn === 'customer_phone' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentDetailsSort('brand_name')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'البراند' : 'Brand'}
                      {paymentDetailsSortColumn === 'brand_name' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentDetailsSort('product_name')}
                      className="flex items-center gap-1 hover:text-primary transition-colors text-left"
                    >
                      {language === 'ar' ? 'المنتج' : 'Product'}
                      {paymentDetailsSortColumn === 'product_name' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentDetailsSort('qty')}
                      className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                    >
                      {language === 'ar' ? 'الكمية' : 'Qty'}
                      {paymentDetailsSortColumn === 'qty' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                    <button 
                      onClick={() => handlePaymentDetailsSort('total')}
                      className="flex items-center gap-1 hover:text-primary transition-colors justify-end"
                    >
                      {language === 'ar' ? 'المجموع' : 'Total'}
                      {paymentDetailsSortColumn === 'total' && (
                        paymentDetailsSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {paymentDetailsList.map((item, index) => (
                    <div key={index} className="grid grid-cols-7 gap-4 py-2 border-b text-sm">
                      <div>{item.order_number || '-'}</div>
                      <div>{item.customer_name || '-'}</div>
                      <div>{item.customer_phone || '-'}</div>
                      <div>{item.brand_name || '-'}</div>
                      <div>{item.product_name || '-'}</div>
                      <div className="text-right">{item.qty?.toLocaleString() || 0}</div>
                      <div className="text-right">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                  <div className="grid grid-cols-7 gap-4 pt-4 font-bold border-t-2">
                    <div className="col-span-5 text-left">{language === 'ar' ? 'الإجمالي' : 'Total'}</div>
                    <div className="text-right">
                      {paymentDetailsList.reduce((sum, item) => sum + (parseNumber(item.qty) || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-right">
                      {formatCurrency(paymentDetailsList.reduce((sum, item) => sum + parseNumber(item.total), 0))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Loading Overlays */}
      {loadingPaymentCharges && (
        <LoadingOverlay 
          progress={100} 
          message={language === 'ar' ? 'جاري تحميل رسوم الدفع الإلكتروني...' : 'Loading E-Payment Charges...'}
        />
      )}
      
      {loadingPaymentDetails && (
        <LoadingOverlay 
          progress={100} 
          message={language === 'ar' ? 'جاري تحميل تفاصيل المعاملات...' : 'Loading Transaction Details...'}
        />
      )}
      
      {loadingPointTransactions && (
        <LoadingOverlay 
          progress={100} 
          message={language === 'ar' ? 'جاري تحميل معاملات النقاط...' : 'Loading Point Transactions...'}
        />
      )}
    </div>
  );
};

export default Dashboard;
