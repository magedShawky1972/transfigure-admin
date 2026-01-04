import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, CalendarIcon, Settings2, ChevronsLeft, ChevronsRight, RotateCcw, Trash2, RotateCw, Upload, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DraggableColumnHeader } from "@/components/transactions/DraggableColumnHeader";
import { MultiLevelGroupByZone } from "@/components/transactions/MultiLevelGroupByZone";
import { MultiLevelGroupedTransactions } from "@/components/transactions/MultiLevelGroupedTransactions";
import { OdooSyncStepDialog } from "@/components/OdooSyncStepDialog";
import { BackgroundSyncStatusCard } from "@/components/BackgroundSyncStatusCard";

interface GroupLevel {
  columnId: string;
  label: string;
  sortDirection: 'asc' | 'desc';
}

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  customer_phone: string;
  brand_name: string;
  brand_code?: string;
  product_name: string;
  product_id?: string;
  sku?: string;
  total: number;
  profit: number;
  payment_method: string;
  payment_type: string;
  payment_brand: string;
  order_number: string;
  user_name: string;
  cost_price: number;
  unit_price: number;
  cost_sold: number;
  qty: number;
  coins_number: number;
  vendor_name: string;
  order_status: string;
  is_deleted: boolean;
  sendodoo?: boolean;
}

const Transactions = () => {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [fromDate, setFromDate] = useState<Date>(() => {
    const fromParam = searchParams.get('from');
    if (fromParam) {
      const parsed = new Date(fromParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return subDays(new Date(), 1);
  });
  const [toDate, setToDate] = useState<Date>(() => {
    const toParam = searchParams.get('to');
    if (toParam) {
      const parsed = new Date(toParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterPaymentBrand, setFilterPaymentBrand] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [paymentBrands, setPaymentBrands] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalCountAll, setTotalCountAll] = useState<number>(0);
  const [totalSalesAll, setTotalSalesAll] = useState<number>(0);
  const [totalProfitAll, setTotalProfitAll] = useState<number>(0);
  const [pointTransactionCount, setPointTransactionCount] = useState<number>(0);
  const [pointSales, setPointSales] = useState<number>(0);
  const [groupLevels, setGroupLevels] = useState<GroupLevel[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAllDataLoaded, setIsAllDataLoaded] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [transactionToRestore, setTransactionToRestore] = useState<Transaction | null>(null);
  const [odooSyncDialogOpen, setOdooSyncDialogOpen] = useState(false);
  const [odooOrderLines, setOdooOrderLines] = useState<Transaction[]>([]);
  const [selectedOdooLines, setSelectedOdooLines] = useState<string[]>([]);
  const [syncingToOdoo, setSyncingToOdoo] = useState(false);
  const [syncingAllToOdoo, setSyncingAllToOdoo] = useState(false);
  const [odooStepDialogOpen, setOdooStepDialogOpen] = useState(false);
  const [odooStepTransactions, setOdooStepTransactions] = useState<Transaction[]>([]);
  const [resetOdooDialogOpen, setResetOdooDialogOpen] = useState(false);
  const [resettingOdoo, setResettingOdoo] = useState(false);
  const pageSize = 500;

  const allColumns = [
    { id: "created_at_date", label: t("dashboard.date"), enabled: true },
    { id: "customer_name", label: t("dashboard.customer"), enabled: true },
    { id: "customer_phone", label: t("transactions.customerPhone"), enabled: true },
    { id: "brand_name", label: t("dashboard.brand"), enabled: true },
    { id: "product_name", label: t("dashboard.product"), enabled: true },
    { id: "order_number", label: t("transactions.orderNumber"), enabled: true },
    { id: "user_name", label: t("transactions.userName"), enabled: true },
    { id: "vendor_name", label: t("transactions.vendorName"), enabled: false },
    { id: "order_status", label: t("transactions.orderStatus"), enabled: false },
    { id: "total", label: t("dashboard.amount"), enabled: true },
    { id: "profit", label: t("dashboard.profit"), enabled: true },
    { id: "payment_method", label: t("transactions.paymentMethod"), enabled: true },
    { id: "payment_type", label: t("transactions.paymentType"), enabled: true },
    { id: "payment_brand", label: t("dashboard.paymentBrands"), enabled: true },
    { id: "qty", label: t("transactions.qty"), enabled: false },
    { id: "cost_price", label: t("transactions.costPrice"), enabled: false },
    { id: "unit_price", label: t("transactions.unitPrice"), enabled: false },
    { id: "cost_sold", label: t("transactions.costSold"), enabled: false },
    { id: "coins_number", label: t("transactions.coinsNumber"), enabled: false },
    { id: "is_deleted", label: language === 'ar' ? 'محذوف' : 'Deleted', enabled: true },
    { id: "sendodoo", label: language === 'ar' ? 'مرسل لـ Odoo' : 'Sent to Odoo', enabled: true },
    { id: "odoo_sync", label: language === 'ar' ? 'إرسال لـ Odoo' : 'Sync to Odoo', enabled: true },
  ];

  const [columnOrder, setColumnOrder] = useState<string[]>(
    allColumns.map((col) => col.id)
  );

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    allColumns.reduce((acc, col) => ({ ...acc, [col.id]: col.enabled }), {})
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const customCollisionDetection: CollisionDetection = (args) => {
    // Prioritize the Group By zone when pointer is over it
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const overId = pointerCollisions[0].id;
      if (overId === 'group-by-zone') {
        return pointerCollisions;
      }
    }

    // If rectangles intersect with the group zone, prioritize it
    const rectCollisions = rectIntersection(args);
    const groupHit = rectCollisions.find((c) => c.id === 'group-by-zone');
    if (groupHit) return [groupHit];

    // Fallbacks
    return pointerCollisions.length ? pointerCollisions : closestCenter(args);
  };

  // Load user preferences and ID
  useEffect(() => {
    const loadUserPreferences = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('transaction_column_order, transaction_column_visibility, transaction_group_by')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        if (profile.transaction_column_order) {
          const savedOrder = profile.transaction_column_order as string[];
          // Add any new columns that aren't in saved order
          const allColumnIds = allColumns.map(col => col.id);
          const newColumns = allColumnIds.filter(id => !savedOrder.includes(id));
          setColumnOrder([...savedOrder, ...newColumns]);
        }
        if (profile.transaction_column_visibility) {
          const savedVisibility = profile.transaction_column_visibility as Record<string, boolean>;
          // Add any new columns with their default visibility
          const mergedVisibility = { ...savedVisibility };
          allColumns.forEach(col => {
            if (!(col.id in mergedVisibility)) {
              mergedVisibility[col.id] = col.enabled;
            }
          });
          setVisibleColumns(mergedVisibility);
        }
        if (profile.transaction_group_by) {
          const saved = profile.transaction_group_by;
          if (Array.isArray(saved)) {
            setGroupLevels(saved as any as GroupLevel[]); // Type will update after migration
          } else if (typeof saved === 'string') {
            // Migrate old single-level grouping
            setGroupLevels([{ columnId: saved, label: getColumnLabel(saved), sortDirection: 'asc' }]);
          }
        }
      }
    };

    loadUserPreferences();
  }, []);

  // Save user preferences
  const saveUserPreferences = async () => {
    if (!userId) return;

    await supabase
      .from('profiles')
      .update({
        transaction_column_order: columnOrder,
        transaction_column_visibility: visibleColumns,
        transaction_group_by: groupLevels as any, // Type will update after migration
      })
      .eq('user_id', userId);
  };

  // Auto-save preferences when they change
  useEffect(() => {
    if (userId) {
      const timer = setTimeout(() => {
        saveUserPreferences();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [columnOrder, visibleColumns, groupLevels, userId]);

  // Clear grouping levels if columns are hidden
  useEffect(() => {
    const updatedLevels = groupLevels.filter(level => visibleColumns[level.columnId]);
    if (updatedLevels.length !== groupLevels.length) {
      setGroupLevels(updatedLevels);
      toast({
        title: language === 'ar' ? 'تم تحديث التجميع' : 'Grouping Updated',
        description: language === 'ar' 
          ? 'تم إزالة الأعمدة المخفية من التجميع'
          : 'Hidden columns removed from grouping',
      });
    }
  }, [visibleColumns, groupLevels, language]);

  const formatCurrency = (amount: number) => {
    if (!isFinite(amount)) amount = 0;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${formatted} ر.س`;
  };

  const formatNumber = (amount: number | null | undefined) => {
    if (amount == null || !isFinite(amount)) amount = 0;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  useEffect(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    if (fromParam) setFromDate(new Date(fromParam));
    if (toParam) setToDate(new Date(toParam));
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
    setIsAllDataLoaded(false);
    setTotalCountAll(0);
  }, [fromDate, toDate, orderNumberFilter, phoneFilter, sortColumn, sortDirection]);

  useEffect(() => {
    fetchTransactions();
  }, [fromDate, toDate, page, orderNumberFilter, phoneFilter, sortColumn, sortDirection]);

  useEffect(() => {
    fetchTotals();
  }, [fromDate, toDate, phoneFilter, orderNumberFilter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      const numericSortColumns = new Set([
        'total', 'profit', 'cost_price', 'unit_price', 'cost_sold', 'qty'
      ]);

      const table = sortColumn && numericSortColumns.has(sortColumn)
        ? 'purpletransaction_enriched'
        : 'purpletransaction';

      let q = (supabase as any)
        .from(table)
        .select('*');

      const start = startOfDay(fromDate || subDays(new Date(), 1));
      const end = endOfDay(toDate || new Date());
      // Use created_at_date_int (integer format: YYYYMMDD) for filtering
      const startInt = parseInt(format(start, 'yyyyMMdd'), 10);
      const endInt = parseInt(format(end, 'yyyyMMdd'), 10);
      q = q.gte('created_at_date_int', startInt).lte('created_at_date_int', endInt);

      const phone = phoneFilter.trim();
      if (phone) q = q.ilike('customer_phone', `%${phone}%`);
      const orderNo = orderNumberFilter.trim();
      if (orderNo) q = q.ilike('order_number', `%${orderNo}%`);

      if (sortColumn) {
        if (numericSortColumns.has(sortColumn)) {
          const map: Record<string, string> = {
            total: 'total_num',
            profit: 'profit_num',
            qty: 'qty_num',
            cost_price: 'cost_price_num',
            unit_price: 'unit_price_num',
            cost_sold: 'cost_sold_num',
          };
          q = q.order(map[sortColumn], { ascending: sortDirection === 'asc' });
        } else {
          q = q.order(sortColumn, { ascending: sortDirection === 'asc' });
        }
      } else {
        q = q.order('created_at_date', { ascending: false });
      }

      let countQuery = (supabase as any).from(table).select('*', { count: 'exact', head: true });
      countQuery = countQuery.gte('created_at_date_int', startInt).lte('created_at_date_int', endInt);
      if (phone) countQuery = countQuery.ilike('customer_phone', `%${phone}%`);
      if (orderNo) countQuery = countQuery.ilike('order_number', `%${orderNo}%`);
      
      const { count } = await countQuery;
      const totalRecords = count || 0;
      setTotalCount(totalRecords);
      setTotalCountAll(totalRecords);

      // Auto-load all data if count is less than 4000
      const AUTO_LOAD_THRESHOLD = 4000;
      if (totalRecords > 0 && totalRecords < AUTO_LOAD_THRESHOLD && !isAllDataLoaded && !loadingAll) {
        // Set totalCountAll first so display shows correct total
        setTotalCountAll(totalRecords);
        
        // Trigger auto-load
        setLoading(false);
        // Use setTimeout to avoid calling loadAllData during render
        setTimeout(() => loadAllData(), 0);
        return;
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await q.range(from, to);

      if (error) throw error;
      const rows = (data as any) as Transaction[];
      setTransactions(rows);

      if (page === 1) {
        const uniqueBrands = [...new Set(rows.map(t => t.brand_name).filter(Boolean))];
        const uniqueProducts = [...new Set(rows.map(t => t.product_name).filter(Boolean))];
        const uniquePaymentMethods = [...new Set(rows.map(t => t.payment_method).filter(Boolean))];
        const uniquePaymentBrands = [...new Set(rows.map(t => t.payment_brand).filter(Boolean))];
        const uniqueCustomers = [...new Set(rows.map(t => t.customer_name).filter(Boolean))];
        setBrands(uniqueBrands as string[]);
        setProducts(uniqueProducts as string[]);
        setPaymentMethods(uniquePaymentMethods as string[]);
        setPaymentBrands(uniquePaymentBrands as string[]);
        setCustomers(uniqueCustomers as string[]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    setLoadingAll(true);
    setLoadingProgress(0);

    const numericSortColumns = new Set([
      'total', 'profit', 'cost_price', 'unit_price', 'cost_sold', 'qty'
    ]);

    const table = sortColumn && numericSortColumns.has(sortColumn)
      ? 'purpletransaction_enriched'
      : 'purpletransaction';

    const start = startOfDay(fromDate || subDays(new Date(), 1));
    const end = endOfDay(toDate || new Date());
    // Use created_at_date_int (integer format: YYYYMMDD) for filtering
    const startInt = parseInt(format(start, 'yyyyMMdd'), 10);
    const endInt = parseInt(format(end, 'yyyyMMdd'), 10);

    const phone = phoneFilter.trim();
    const orderNo = orderNumberFilter.trim();

    const batchSize = 1000; // Larger batch size to reduce number of requests
    let from = 0;
    let allData: Transaction[] = [];
    let hasMore = true;
    const estimatedTotal = Math.max(totalCountAll, 1);
    let retryCount = 0;
    const maxRetries = 8;

    const getErrorStatus = (err: unknown): number | undefined => {
      const e = err as any;
      return (
        e?.status ??
        e?.cause?.status ??
        e?.error?.status ??
        e?.response?.status
      );
    };

    const getRetryDelayMs = (attempt: number, status?: number) => {
      // More conservative backoff for rate limits / transient backend errors
      if (status === 429) return 3000 * attempt * attempt;
      if (status && status >= 500) return 2000 * attempt * attempt;
      return 1000 * attempt;
    }; 

    try {
      while (hasMore) {
        try {
          let query = (supabase as any)
            .from(table)
            .select('*')
            .gte('created_at_date_int', startInt)
            .lte('created_at_date_int', endInt);

          if (phone) query = query.ilike('customer_phone', `%${phone}%`);
          if (orderNo) query = query.ilike('order_number', `%${orderNo}%`);

          if (sortColumn) {
            if (numericSortColumns.has(sortColumn)) {
              const map: Record<string, string> = {
                total: 'total_num',
                profit: 'profit_num',
                qty: 'qty_num',
                cost_price: 'cost_price_num',
                unit_price: 'unit_price_num',
                cost_sold: 'cost_sold_num',
              };
              query = query.order(map[sortColumn], { ascending: sortDirection === 'asc' });
            } else {
              query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
            }
          } else {
            query = query.order('created_at_date', { ascending: false });
          }

          query = query.range(from, from + batchSize - 1);

          const { data, error } = await query;
          if (error) throw error;

          const batch = (data as any) as Transaction[];
          allData = allData.concat(batch);
          retryCount = 0; // Reset retry count on success

          // Update progress
          const progress = Math.min(95, Math.round((allData.length / estimatedTotal) * 100));
          setLoadingProgress(progress);

          if (batch.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }

          // Small delay between batches to avoid rate limiting
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        } catch (batchError) {
          retryCount++;
          const status = getErrorStatus(batchError);
          console.warn(
            `Batch fetch failed (attempt ${retryCount}/${maxRetries}, status ${status ?? 'n/a'}):`,
            batchError
          );

          if (retryCount >= maxRetries) {
            throw new Error(
              language === 'ar'
                ? `فشل تحميل البيانات بعد عدة محاولات (تم تحميل ${allData.length.toLocaleString()})`
                : `Failed to load data after multiple attempts (loaded ${allData.length.toLocaleString()})`
            );
          }

          // Wait before retry with backoff (handles 429/5xx better)
          await new Promise(resolve =>
            setTimeout(resolve, getRetryDelayMs(retryCount, status))
          );
        }
      }

      setLoadingProgress(100);
      setTransactions(allData);
      setIsAllDataLoaded(true);
      // Update totalCountAll to match actual loaded count (don't change totalCount which is for pagination)
      setTotalCountAll(allData.length);

      toast({
        title: language === 'ar' ? 'تم تحميل جميع البيانات' : 'All Data Loaded',
        description:
          language === 'ar'
            ? `تم تحميل ${allData.length.toLocaleString()} معاملة`
            : `Loaded ${allData.length.toLocaleString()} transactions`,
      });

      // Update filters with all data
      const uniqueBrands = [...new Set(allData.map(t => t.brand_name).filter(Boolean))];
      const uniqueProducts = [...new Set(allData.map(t => t.product_name).filter(Boolean))];
      const uniquePaymentMethods = [...new Set(allData.map(t => t.payment_method).filter(Boolean))];
      const uniqueCustomers = [...new Set(allData.map(t => t.customer_name).filter(Boolean))];
      setBrands(uniqueBrands as string[]);
      setProducts(uniqueProducts as string[]);
      setPaymentMethods(uniquePaymentMethods as string[]);
      setCustomers(uniqueCustomers as string[]);
    } catch (error) {
      console.error('Error loading all data:', error);
      toast({
        variant: "destructive",
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : (language === 'ar' 
          ? 'فشل تحميل جميع البيانات'
          : 'Failed to load all data'),
      });
    } finally {
      setLoadingAll(false);
    }
  };

  const fetchTotals = async () => {
    try {
      const start = startOfDay(fromDate || subDays(new Date(), 1));
      const end = endOfDay(toDate || new Date());
      const startStr = format(start, "yyyy-MM-dd'T'00:00:00");
      const endNextStr = format(addDays(startOfDay(end), 1), "yyyy-MM-dd'T'00:00:00");

      // IMPORTANT: For parity with Dashboard, totals ignore phone/order filters
      // and follow the same backend aggregation + manual adjustments.

      // 1) Base totals from RPC (same as Dashboard)
      const { data: summary, error: summaryError } = await supabase
        .rpc('transactions_summary', {
          date_from: format(start, 'yyyy-MM-dd'),
          date_to: format(end, 'yyyy-MM-dd')
        });

      if (summaryError) throw summaryError;

      let totalSales = 0;
      let transactionCount = 0;
      if (summary && summary.length > 0) {
        const stats = summary[0];
        totalSales = Number(stats.total_sales || 0);
        transactionCount = Number(stats.tx_count || 0);
      }

      // 2) Cost of Sales (non-point) from purpletransaction
      const pageSize = 1000;
      let fromIdx = 0;
      let allCogsData: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('cost_sold')
          .gte('created_at_date', startStr)
          .lt('created_at_date', endNextStr)
          .neq('payment_method', 'point')
          .order('created_at_date', { ascending: true })
          .range(fromIdx, fromIdx + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        allCogsData = allCogsData.concat(batch);
        if (batch.length < pageSize) break;
        fromIdx += pageSize;
      }
      let costOfSales = 0;
      allCogsData.forEach((row) => {
        costOfSales += Number(row.cost_sold) || 0;
      });

      // 3) E-Payment Charges from ordertotals (non-point)
      let orderFrom = 0;
      let allOrderData: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('ordertotals')
          .select('bank_fee')
          .gte('order_date', startStr)
          .lt('order_date', endNextStr)
          .neq('payment_method', 'point')
          .order('order_date', { ascending: true })
          .range(orderFrom, orderFrom + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        allOrderData = allOrderData.concat(batch);
        if (batch.length < pageSize) break;
        orderFrom += pageSize;
      }
      let ePaymentCharges = 0;
      allOrderData.forEach((row) => {
        ePaymentCharges += Number(row.bank_fee) || 0;
      });

      // 4) Points sales and cost (grouped by order to avoid duplicates)
      let pointsFrom = 0;
      let allPointsData: any[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('purpletransaction')
          .select('id, order_number, total, cost_sold')
          .ilike('payment_method', 'point')
          .gte('created_at_date', startStr)
          .lt('created_at_date', endNextStr)
          .order('created_at_date', { ascending: true })
          .range(pointsFrom, pointsFrom + pageSize - 1);
        if (error) throw error;
        const batch = data || [];
        allPointsData = allPointsData.concat(batch);
        if (batch.length < pageSize) break;
        pointsFrom += pageSize;
      }
      const orderGrouped = new Map<string, { total: number; cost: number }>();
      allPointsData.forEach((item: any) => {
        const key = item.order_number || item.id;
        const total = Number(item.total) || 0;
        const cost = Number(item.cost_sold) || 0;
        const existing = orderGrouped.get(key);
        if (!existing) {
          orderGrouped.set(key, { total, cost });
        } else {
          existing.total += total;
          existing.cost += cost;
        }
      });
      const totalPointsSales = Array.from(orderGrouped.values()).reduce((sum, v) => sum + v.total, 0);
      const totalPointsCost = Array.from(orderGrouped.values()).reduce((sum, v) => sum + v.cost, 0);

      // 5) Final totals exactly like Dashboard card
      setTotalSalesAll(totalSales);
      setTotalProfitAll(totalSales - costOfSales - totalPointsCost - ePaymentCharges);
      setPointTransactionCount(orderGrouped.size);
      setPointSales(totalPointsSales);
    } catch (error) {
      console.error('Error fetching totals:', error);
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = searchTerm === "" || 
        transaction.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.product_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPhone = phoneFilter === "" || 
        transaction.customer_phone?.toLowerCase().includes(phoneFilter.toLowerCase());
      
      const matchesOrderNumber = orderNumberFilter === "" || 
        transaction.order_number?.toLowerCase().includes(orderNumberFilter.toLowerCase());
      
      const matchesBrand = filterBrand === "all" || transaction.brand_name === filterBrand;
      const matchesProduct = filterProduct === "all" || transaction.product_name === filterProduct;
      const matchesPaymentMethod = filterPaymentMethod === "all" || transaction.payment_method === filterPaymentMethod;
      const matchesPaymentBrand = filterPaymentBrand === "all" || transaction.payment_brand === filterPaymentBrand;
      const matchesCustomer = filterCustomer === "all" || transaction.customer_name === filterCustomer;

      return matchesSearch && matchesPhone && matchesOrderNumber && matchesBrand && matchesProduct && matchesPaymentMethod && matchesPaymentBrand && matchesCustomer;
    });
  }, [transactions, searchTerm, phoneFilter, orderNumberFilter, filterBrand, filterProduct, filterPaymentMethod, filterPaymentBrand, filterCustomer]);

  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (!sortColumn) return 0;

      let aValue: any = a[sortColumn as keyof Transaction];
      let bValue: any = b[sortColumn as keyof Transaction];

      if (sortColumn === "created_at_date") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      } else if (["total", "profit", "cost_price", "unit_price", "cost_sold", "qty", "coins_number"].includes(sortColumn)) {
        aValue = aValue || 0;
        bValue = bValue || 0;
      } else {
        aValue = (aValue || "").toString().toLowerCase();
        bValue = (bValue || "").toString().toLowerCase();
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, sortColumn, sortDirection]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const overId = (over as any).id;
    const overType = (over as any).data?.current?.type;

    // Check if dropped on group-by zone
    if (overId === "group-by-zone" || overType === 'group-zone') {
      const columnId = active.id as string;
      const label = getColumnLabel(columnId);
      
      // Check if already grouped by this column
      if (groupLevels.some(level => level.columnId === columnId)) {
        toast({
          title: language === 'ar' ? 'موجود بالفعل' : 'Already Grouped',
          description: language === 'ar' 
            ? `تم التجميع بالفعل حسب ${label}`
            : `Already grouped by ${label}`,
          variant: 'destructive'
        });
        return;
      }

      // Add new grouping level
      setGroupLevels(prev => [...prev, { columnId, label, sortDirection: 'asc' }]);
      toast({
        title: language === 'ar' ? 'تمت الإضافة للتجميع' : 'Added to Grouping',
        description: language === 'ar' 
          ? `المستوى ${groupLevels.length + 1}: ${label}`
          : `Level ${groupLevels.length + 1}: ${label}`,
      });
      return;
    }

    // Handle column reordering
    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const getColumnLabel = (columnId: string) => {
    return allColumns.find(col => col.id === columnId)?.label || columnId;
  };

  const resetLayout = async () => {
    const defaultOrder = allColumns.map((col) => col.id);
    const defaultVisibility = allColumns.reduce((acc, col) => ({ ...acc, [col.id]: col.enabled }), {});
    
    setColumnOrder(defaultOrder);
    setVisibleColumns(defaultVisibility);
    setGroupLevels([]);

    if (userId) {
      await supabase
        .from('profiles')
        .update({
          transaction_column_order: null,
          transaction_column_visibility: null,
          transaction_group_by: null,
        })
        .eq('user_id', userId);
    }

    toast({
      title: language === 'ar' ? 'تم إعادة التعيين' : 'Layout Reset',
      description: language === 'ar' 
        ? 'تم إعادة تعيين تخطيط الجدول إلى الإعدادات الافتراضية'
        : 'Table layout has been reset to default settings',
    });
  };

  const exportToCSV = () => {
    const headers = columnOrder
      .filter(id => visibleColumns[id])
      .map(id => getColumnLabel(id));

    const csvContent = [
      headers.join(','),
      ...sortedTransactions.map(t => 
        columnOrder
          .filter(id => visibleColumns[id])
          .map(id => {
            const value = t[id as keyof Transaction];
            if (id === 'created_at_date') {
              return value ? format(new Date(value as string), 'yyyy-MM-dd') : '';
            }
            return value || '';
          })
          .join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const handleDeleteClick = (transaction: Transaction) => {
    if (transaction.is_deleted) {
      // If already deleted, show restore confirmation
      setTransactionToRestore(transaction);
      setRestoreDialogOpen(true);
    } else {
      // If not deleted, show delete confirmation dialog
      setTransactionToDelete(transaction);
      setDeleteDialogOpen(true);
    }
  };

  const confirmToggleDeleted = async (transaction: Transaction, isRestore: boolean) => {
    try {
      const newValue = !transaction.is_deleted;
      const { error } = await supabase
        .from('purpletransaction')
        .update({ is_deleted: newValue })
        .eq('id', transaction.id);

      if (error) throw error;

      setTransactions(prev => 
        prev.map(t => t.id === transaction.id ? { ...t, is_deleted: newValue } : t)
      );

      toast({
        title: language === 'ar' 
          ? (isRestore ? 'تم استعادة المعاملة' : 'تم حذف المعاملة')
          : (isRestore ? 'Transaction restored' : 'Transaction deleted'),
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل تحديث المعاملة' : 'Failed to update transaction',
      });
    }
  };

  const handleConfirmDelete = () => {
    if (transactionToDelete) {
      confirmToggleDeleted(transactionToDelete, false);
      setTransactionToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleConfirmRestore = () => {
    if (transactionToRestore) {
      confirmToggleDeleted(transactionToRestore, true);
      setTransactionToRestore(null);
      setRestoreDialogOpen(false);
    }
  };

  // Handle Odoo sync for a single transaction
  const handleOdooSyncClick = async (transaction: Transaction) => {
    // Find all lines with the same order number
    const orderNumber = transaction.order_number;
    const orderLines = sortedTransactions.filter(t => t.order_number === orderNumber);
    
    if (orderLines.length > 1) {
      // Multi-line order - show dialog to select lines
      setOdooOrderLines(orderLines);
      setSelectedOdooLines(orderLines.map(l => l.id));
      setOdooSyncDialogOpen(true);
    } else {
      // Single line order - open step-by-step dialog
      setOdooStepTransactions([transaction]);
      setOdooStepDialogOpen(true);
    }
  };

  // Sync selected transactions to Odoo
  const syncTransactionsToOdoo = async (txs: Transaction[]) => {
    setSyncingToOdoo(true);
    try {
      const response = await supabase.functions.invoke('sync-order-to-odoo', {
        body: { transactions: txs },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      if (result.success) {
        toast({
          title: language === 'ar' ? 'تم الإرسال بنجاح' : 'Sync Successful',
          description: language === 'ar' 
            ? `تم إرسال ${result.synced} طلب(ات) إلى Odoo`
            : `${result.synced} order(s) synced to Odoo`,
        });
      } else {
        toast({
          title: language === 'ar' ? 'فشل الإرسال' : 'Sync Failed',
          description: result.errors?.[0]?.error || result.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error syncing to Odoo:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to sync to Odoo',
        variant: 'destructive',
      });
    } finally {
      setSyncingToOdoo(false);
      setOdooSyncDialogOpen(false);
      setOdooOrderLines([]);
      setSelectedOdooLines([]);
    }
  };

  // Confirm sync selected lines from dialog - open step dialog
  const handleConfirmOdooSync = () => {
    const selectedTxs = odooOrderLines.filter(t => selectedOdooLines.includes(t.id));
    if (selectedTxs.length > 0) {
      setOdooSyncDialogOpen(false);
      setOdooStepTransactions(selectedTxs);
      setOdooStepDialogOpen(true);
    }
  };

  // Sync all visible transactions to Odoo - navigate to batch sync page
  const handleSyncAllToOdoo = () => {
    if (sortedTransactions.length === 0) {
      toast({
        title: language === 'ar' ? 'لا توجد معاملات' : 'No Transactions',
        description: language === 'ar' ? 'لا توجد معاملات للإرسال' : 'No transactions to sync',
        variant: 'destructive',
      });
      return;
    }

    // Navigate to Odoo sync batch page with date filters
    const fromDateStr = format(fromDate, 'yyyy-MM-dd');
    const toDateStr = format(toDate, 'yyyy-MM-dd');
    navigate(`/odoo-sync-batch?from=${fromDateStr}&to=${toDateStr}`);
  };

  // Reset Odoo sync flag for all visible transactions
  const handleResetOdooSync = async () => {
    if (sortedTransactions.length === 0) {
      toast({
        title: language === 'ar' ? 'لا توجد معاملات' : 'No Transactions',
        description: language === 'ar' ? 'لا توجد معاملات لإعادة تعيينها' : 'No transactions to reset',
        variant: 'destructive',
      });
      return;
    }
    setResetOdooDialogOpen(true);
  };

  const confirmResetOdooSync = async () => {
    setResettingOdoo(true);
    try {
      // Get unique order numbers from visible transactions
      const orderNumbers = [...new Set(sortedTransactions.map(t => t.order_number))];
      
      // Batch update in chunks of 100 to avoid query size limits
      const batchSize = 100;
      let successCount = 0;
      
      for (let i = 0; i < orderNumbers.length; i += batchSize) {
        const batch = orderNumbers.slice(i, i + batchSize);
        const { error } = await supabase
          .from('purpletransaction')
          .update({ sendodoo: false })
          .in('order_number', batch);

        if (error) throw error;
        successCount += batch.length;
      }

      // Update local state
      const orderNumberSet = new Set(orderNumbers);
      setTransactions(prev => prev.map(t => 
        orderNumberSet.has(t.order_number) 
          ? { ...t, sendodoo: false } 
          : t
      ));

      toast({
        title: language === 'ar' ? 'تم إعادة التعيين' : 'Reset Complete',
        description: language === 'ar' 
          ? `تم إعادة تعيين ${successCount} طلب(ات)`
          : `${successCount} order(s) reset successfully`,
      });
    } catch (error) {
      console.error('Error resetting Odoo sync:', error);
      toast({
        variant: 'destructive',
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إعادة التعيين' : 'Failed to reset Odoo sync flag',
      });
    } finally {
      setResettingOdoo(false);
      setResetOdooDialogOpen(false);
    }
  };

  const renderCell = (transaction: Transaction, columnId: string) => {
    const value = transaction[columnId as keyof Transaction];

    switch (columnId) {
      case 'created_at_date':
        return value ? format(new Date(value as string), 'yyyy-MM-dd') : '';
      case 'total':
      case 'profit':
      case 'cost_price':
      case 'unit_price':
      case 'cost_sold':
        return formatCurrency(Number(value) || 0);
      case 'qty':
      case 'coins_number':
        return formatNumber(Number(value));
      case 'order_status':
        return (
          <Badge variant={value === 'completed' ? 'default' : 'secondary'}>
            {value as string}
          </Badge>
        );
      case 'payment_method':
        return (
          <Badge variant="outline" className="font-mono">
            {value as string}
          </Badge>
        );
      case 'is_deleted':
        return (
          <Button
            variant={transaction.is_deleted ? "outline" : "ghost"}
            size="sm"
            className={transaction.is_deleted ? "text-green-600 hover:text-green-700 border-green-600" : "text-destructive hover:text-destructive"}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(transaction);
            }}
            title={language === 'ar' 
              ? (transaction.is_deleted ? 'استعادة' : 'حذف')
              : (transaction.is_deleted ? 'Restore' : 'Delete')}
          >
            {transaction.is_deleted ? (
              <RotateCw className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        );
      case 'sendodoo':
        return (
          <Button
            variant={transaction.sendodoo ? "default" : "outline"}
            size="sm"
            className={transaction.sendodoo ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            onClick={async (e) => {
              e.stopPropagation();
              const newValue = !transaction.sendodoo;
              const { error } = await supabase
                .from('purpletransaction')
                .update({ sendodoo: newValue })
                .eq('order_number', transaction.order_number);
              
              if (error) {
                toast({
                  variant: 'destructive',
                  title: language === 'ar' ? 'خطأ' : 'Error',
                  description: error.message,
                });
              } else {
                // Update local state
                setTransactions(prev => prev.map(t => 
                  t.order_number === transaction.order_number 
                    ? { ...t, sendodoo: newValue } 
                    : t
                ));
                toast({
                  title: language === 'ar' ? 'تم التحديث' : 'Updated',
                  description: language === 'ar' 
                    ? `تم ${newValue ? 'تحديد' : 'إلغاء تحديد'} الطلب كمرسل`
                    : `Order ${newValue ? 'marked' : 'unmarked'} as sent to Odoo`,
                });
              }
            }}
            title={language === 'ar' 
              ? (transaction.sendodoo ? 'تم الإرسال - انقر للإلغاء' : 'لم يرسل - انقر للتحديد')
              : (transaction.sendodoo ? 'Sent - Click to unmark' : 'Not sent - Click to mark')}
          >
            {transaction.sendodoo ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
          </Button>
        );
      case 'odoo_sync':
        return (
          <Button
            variant="outline"
            size="sm"
            className="text-primary hover:text-primary/80"
            onClick={(e) => {
              e.stopPropagation();
              handleOdooSyncClick(transaction);
            }}
            disabled={syncingToOdoo || transaction.is_deleted}
            title={language === 'ar' ? 'إرسال إلى Odoo' : 'Sync to Odoo'}
          >
            {syncingToOdoo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        );
      default:
        return value as string;
    }
  };

  const visibleColumnIds = useMemo(() => {
    return columnOrder.filter((id) => visibleColumns[id]);
  }, [columnOrder, visibleColumns]);

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من حذف الطلب رقم ${transactionToDelete?.order_number || ''}؟`
                : `Are you sure you want to delete order number ${transactionToDelete?.order_number || ''}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'تأكيد الاستعادة' : 'Confirm Restore'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من استعادة الطلب رقم ${transactionToRestore?.order_number || ''}؟`
                : `Are you sure you want to restore order number ${transactionToRestore?.order_number || ''}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore} className="bg-green-600 text-white hover:bg-green-700">
              {language === 'ar' ? 'استعادة' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Odoo Multi-Line Order Selection Dialog */}
      <AlertDialog open={odooSyncDialogOpen} onOpenChange={setOdooSyncDialogOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'اختر سطور الطلب للإرسال' : 'Select Order Lines to Sync'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `الطلب رقم ${odooOrderLines[0]?.order_number || ''} يحتوي على ${odooOrderLines.length} سطور. اختر السطور المراد إرسالها.`
                : `Order ${odooOrderLines[0]?.order_number || ''} has ${odooOrderLines.length} lines. Select lines to sync.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selectedOdooLines.length === odooOrderLines.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOdooLines(odooOrderLines.map(l => l.id));
                        } else {
                          setSelectedOdooLines([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>{t("dashboard.product")}</TableCell>
                  <TableCell>{t("transactions.qty")}</TableCell>
                  <TableCell>{t("dashboard.amount")}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {odooOrderLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOdooLines.includes(line.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOdooLines(prev => [...prev, line.id]);
                          } else {
                            setSelectedOdooLines(prev => prev.filter(id => id !== line.id));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="truncate max-w-48">{line.product_name}</TableCell>
                    <TableCell>{line.qty}</TableCell>
                    <TableCell>{formatCurrency(line.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncingToOdoo}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmOdooSync} 
              disabled={selectedOdooLines.length === 0 || syncingToOdoo}
              className="gap-2"
            >
              {syncingToOdoo && <Loader2 className="h-4 w-4 animate-spin" />}
              {language === 'ar' ? `إرسال (${selectedOdooLines.length})` : `Sync (${selectedOdooLines.length})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Odoo Step-by-Step Sync Dialog */}
      <OdooSyncStepDialog
        open={odooStepDialogOpen}
        onOpenChange={setOdooStepDialogOpen}
        transactions={odooStepTransactions}
        onSyncComplete={() => {
          setOdooStepTransactions([]);
          setOdooOrderLines([]);
          setSelectedOdooLines([]);
        }}
      />

      {/* Reset Odoo Sync Confirmation Dialog */}
      <AlertDialog open={resetOdooDialogOpen} onOpenChange={setResetOdooDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'إعادة تعيين إرسال Odoo' : 'Reset Odoo Sync Flag'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من إعادة تعيين علامة الإرسال لـ ${[...new Set(sortedTransactions.map(t => t.order_number))].length} طلب(ات)؟ سيتيح لك هذا إعادة إرسال البيانات إلى Odoo.`
                : `Are you sure you want to reset the Odoo sync flag for ${[...new Set(sortedTransactions.map(t => t.order_number))].length} order(s)? This will allow you to resend data to Odoo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resettingOdoo}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmResetOdooSync} 
              disabled={resettingOdoo}
              className="bg-orange-600 text-white hover:bg-orange-700 gap-2"
            >
              {resettingOdoo && <Loader2 className="h-4 w-4 animate-spin" />}
              {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loadingAll && (
        <LoadingOverlay
          progress={loadingProgress}
          message={language === 'ar' ? 'جاري تحميل جميع البيانات...' : 'Loading all data...'}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("transactions.title")}</h1>
        <p className="text-muted-foreground">
          {t("transactions.subtitle")}
        </p>
      </div>

      {/* Background Sync Status Card */}
      <BackgroundSyncStatusCard />

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.transactions")}</CardTitle>
            <CardTitle className="text-3xl">{totalCountAll.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalSales")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(totalSalesAll)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalProfit")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(totalProfitAll)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{language === 'ar' ? 'معاملات النقاط' : 'Point Transactions'}</CardTitle>
            <CardTitle className="text-3xl">{pointTransactionCount.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{language === 'ar' ? 'مبيعات النقاط' : 'Point Sales'}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(pointSales)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("transactions.title")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {language === 'ar' 
                  ? `${transactions.length.toLocaleString()} سجل محمّل من ${totalCountAll.toLocaleString()}`
                  : `${transactions.length.toLocaleString()} of ${totalCountAll.toLocaleString()} records loaded`}
                {isAllDataLoaded && (
                  <Badge variant="secondary" className="mr-2 ml-2">
                    {language === 'ar' ? 'الكل محمّل' : 'All Loaded'}
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2" 
                onClick={() => {
                  setIsAllDataLoaded(false);
                  setPage(1);
                  fetchTransactions();
                  fetchTotals();
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {language === 'ar' ? 'تحميل' : 'Load'}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={resetLayout}>
                <RotateCcw className="h-4 w-4" />
                {language === 'ar' ? 'إعادة تعيين' : 'Reset Layout'}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    {language === 'ar' ? 'الأعمدة' : 'Columns'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 pointer-events-auto" align="end">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">{language === 'ar' ? 'إظهار الأعمدة' : 'Show Columns'}</h4>
                    {allColumns.map((column) => (
                      <div key={column.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={column.id}
                          checked={visibleColumns[column.id]}
                          onCheckedChange={(checked) =>
                            setVisibleColumns((prev) => ({ ...prev, [column.id]: !!checked }))
                          }
                        />
                        <label
                          htmlFor={column.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {column.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {/* Only show Load All button when count >= 4000 and not all loaded */}
              {!isAllDataLoaded && totalCountAll >= 4000 && (
                <Button 
                  variant="outline" 
                  className="gap-2" 
                  onClick={loadAllData}
                  disabled={loadingAll}
                >
                  <ChevronsRight className="h-4 w-4" />
                  {loadingAll 
                    ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...') 
                    : (language === 'ar' ? `تحميل الكل (${totalCountAll.toLocaleString()})` : `Load All (${totalCountAll.toLocaleString()})`)}
                </Button>
              )}
              <Button variant="outline" className="gap-2" onClick={exportToCSV}>
                <Download className="h-4 w-4" />
                {t("transactions.export")}
              </Button>
              <Button 
                variant="default" 
                className="gap-2" 
                onClick={handleSyncAllToOdoo}
                disabled={syncingAllToOdoo || sortedTransactions.length === 0}
              >
                {syncingAllToOdoo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {language === 'ar' ? 'إرسال الكل لـ Odoo' : 'Sync All to Odoo'}
              </Button>
              <Button 
                variant="outline" 
                className="gap-2 text-orange-600 border-orange-600 hover:bg-orange-50 hover:text-orange-700" 
                onClick={handleResetOdooSync}
                disabled={resettingOdoo || sortedTransactions.length === 0}
              >
                {resettingOdoo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                {language === 'ar' ? 'إعادة تعيين Odoo' : 'Reset Odoo Sync'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragEnd={handleDragEnd}
            id="transactions-dnd"
          >
            <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, "PPP") : <span>{t("dashboard.selectDate")}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">{language === 'ar' ? 'إلى' : 'to'}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, "PPP") : <span>{t("dashboard.selectDate")}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Input
              placeholder={t("transactions.searchCustomerProduct")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />

            <Input
              placeholder={t("transactions.filterByPhone")}
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value)}
              className="max-w-sm"
            />

            <Input
              placeholder={t("transactions.filterByOrderNumber")}
              value={orderNumberFilter}
              onChange={(e) => setOrderNumberFilter(e.target.value)}
              className="max-w-sm"
            />

            <Select value={filterBrand} onValueChange={setFilterBrand}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterBrand")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allBrands")}</SelectItem>
                {brands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allProducts")}</SelectItem>
                {products.map(product => (
                  <SelectItem key={product} value={product}>{product}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("transactions.paymentMethod")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'جميع طرق الدفع' : 'All Methods'}</SelectItem>
                {paymentMethods.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterPaymentBrand} onValueChange={setFilterPaymentBrand}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.paymentBrands")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'جميع علامات الدفع' : 'All Payment Brands'}</SelectItem>
                {paymentBrands.map(brand => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCustomer} onValueChange={setFilterCustomer}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("dashboard.filterCustomer")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("dashboard.allCustomers")}</SelectItem>
                {customers.map(customer => (
                  <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <MultiLevelGroupByZone
            groupLevels={groupLevels}
            onRemoveLevel={(index) => {
              setGroupLevels(prev => prev.filter((_, i) => i !== index));
            }}
            onToggleSort={(index) => {
              setGroupLevels(prev => prev.map((level, i) => 
                i === index 
                  ? { ...level, sortDirection: level.sortDirection === 'asc' ? 'desc' : 'asc' }
                  : level
              ));
            }}
            onClearAll={() => setGroupLevels([])}
            language={language}
          />

          <div className="border rounded-lg overflow-x-auto">
            {loading ? (
              <div className="text-center py-16 text-muted-foreground">
                {t("dashboard.loading")}
              </div>
            ) : sortedTransactions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {t("dashboard.noData")}
              </div>
            ) : (
              <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableContext
                        key={visibleColumnIds.join(',')}
                        items={visibleColumnIds}
                        strategy={horizontalListSortingStrategy}
                      >
                        {visibleColumnIds.map((columnId) => (
                          <DraggableColumnHeader
                            key={columnId}
                            id={columnId}
                            label={getColumnLabel(columnId)}
                            sortColumn={sortColumn}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                          />
                        ))}
                      </SortableContext>
                    </TableRow>
                  </TableHeader>
                  {groupLevels.length > 0 ? (
                    <MultiLevelGroupedTransactions
                      groupLevels={groupLevels}
                      transactions={sortedTransactions}
                      visibleColumns={visibleColumns}
                      columnOrder={columnOrder}
                      formatCurrency={formatCurrency}
                      renderCell={renderCell}
                    />
                  ) : (
                    <TableBody>
                      {sortedTransactions.map((transaction) => (
                        <TableRow 
                          key={transaction.id}
                          className={cn(
                            transaction.is_deleted && "bg-destructive/10 line-through opacity-60"
                          )}
                        >
                          {visibleColumnIds.map((columnId) => (
                            <TableCell key={columnId}>
                              {renderCell(transaction, columnId)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  )}
                </Table>
              )}
            </div>
            {!loading && sortedTransactions.length > 0 && (
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="gap-1 pl-2.5 cursor-pointer"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                      <span>{language === 'ar' ? 'الأولى' : 'First'}</span>
                    </Button>
                  </PaginationItem>
                  
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, Math.ceil(totalCount / pageSize)) }, (_, i) => {
                    const totalPages = Math.ceil(totalCount / pageSize);
                    let pageNum: number;
                    
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  {Math.ceil(totalCount / pageSize) > 5 && page < Math.ceil(totalCount / pageSize) - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                      className={page >= Math.ceil(totalCount / pageSize) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setPage(Math.ceil(totalCount / pageSize))}
                      disabled={page >= Math.ceil(totalCount / pageSize)}
                      className="gap-1 pr-2.5 cursor-pointer"
                    >
                      <span>{language === 'ar' ? 'الأخيرة' : 'Last'}</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
          </DndContext>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.transactions")}</CardTitle>
            <CardTitle className="text-3xl">{totalCountAll.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalSales")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(totalSalesAll)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalProfit")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(totalProfitAll)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
