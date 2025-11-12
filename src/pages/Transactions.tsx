import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, CalendarIcon, Settings2, ChevronsLeft, ChevronsRight, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
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
  product_name: string;
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
}

const Transactions = () => {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [orderNumberFilter, setOrderNumberFilter] = useState("");
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 1));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [brands, setBrands] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalCountAll, setTotalCountAll] = useState<number>(0);
  const [totalSalesAll, setTotalSalesAll] = useState<number>(0);
  const [totalProfitAll, setTotalProfitAll] = useState<number>(0);
  const [groupLevels, setGroupLevels] = useState<GroupLevel[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
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
          setColumnOrder(profile.transaction_column_order as string[]);
        }
        if (profile.transaction_column_visibility) {
          setVisibleColumns(profile.transaction_column_visibility as Record<string, boolean>);
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
      const startStr = format(start, "yyyy-MM-dd'T'00:00:00");
      const endStr = format(end, "yyyy-MM-dd'T'23:59:59");
      q = q.gte('created_at_date', startStr).lte('created_at_date', endStr);

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
      countQuery = countQuery.gte('created_at_date', startStr).lte('created_at_date', endStr);
      if (phone) countQuery = countQuery.ilike('customer_phone', `%${phone}%`);
      if (orderNo) countQuery = countQuery.ilike('order_number', `%${orderNo}%`);
      
      const { count } = await countQuery;
      setTotalCount(count || 0);

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
        const uniqueCustomers = [...new Set(rows.map(t => t.customer_name).filter(Boolean))];
        setBrands(uniqueBrands as string[]);
        setProducts(uniqueProducts as string[]);
        setPaymentMethods(uniquePaymentMethods as string[]);
        setCustomers(uniqueCustomers as string[]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotals = async () => {
    try {
      const start = startOfDay(fromDate || subDays(new Date(), 1));
      const end = endOfDay(toDate || new Date());
      const startStr = format(start, "yyyy-MM-dd'T'00:00:00");
      const endStr = format(end, "yyyy-MM-dd'T'23:59:59");

      const phone = phoneFilter.trim();
      const orderNo = orderNumberFilter.trim();

      const pageSize = 1000;
      let from = 0;
      let allData: any[] = [];
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('purpletransaction')
          .select('total, profit')
          .gte('created_at_date', startStr)
          .lte('created_at_date', endStr)
          .neq('payment_method', 'point')
          .order('created_at_date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (phone) query = query.ilike('customer_phone', `%${phone}%`);
        if (orderNo) query = query.ilike('order_number', `%${orderNo}%`);

        const { data, error } = await query;

        if (error) throw error;

        const batch = data || [];
        allData = allData.concat(batch);

        if (batch.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
        }
      }

      if (allData.length > 0) {
        const totalSales = allData.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
        const totalProfit = allData.reduce((sum, row) => sum + (Number(row.profit) || 0), 0);
        setTotalSalesAll(totalSales);
        setTotalProfitAll(totalProfit);
        setTotalCountAll(allData.length);
      } else {
        setTotalSalesAll(0);
        setTotalProfitAll(0);
        setTotalCountAll(0);
      }
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
      const matchesCustomer = filterCustomer === "all" || transaction.customer_name === filterCustomer;

      return matchesSearch && matchesPhone && matchesOrderNumber && matchesBrand && matchesProduct && matchesPaymentMethod && matchesCustomer;
    });
  }, [transactions, searchTerm, phoneFilter, orderNumberFilter, filterBrand, filterProduct, filterPaymentMethod, filterCustomer]);

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
      default:
        return value as string;
    }
  };

  const visibleColumnIds = useMemo(() => {
    return columnOrder.filter((id) => visibleColumns[id]);
  }, [columnOrder, visibleColumns]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("transactions.title")}</h1>
        <p className="text-muted-foreground">
          {t("transactions.subtitle")}
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("transactions.title")}</CardTitle>
            <div className="flex gap-2">
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
              <Button variant="outline" className="gap-2" onClick={exportToCSV}>
                <Download className="h-4 w-4" />
                {t("transactions.export")}
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
                        <TableRow key={transaction.id}>
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
