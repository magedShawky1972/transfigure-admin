import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Download, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon, Settings2, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [totalCount, setTotalCount] = useState<number>(0); // For pagination only
  const [totalCountAll, setTotalCountAll] = useState<number>(0); // For cards
  const [totalSalesAll, setTotalSalesAll] = useState<number>(0);
  const [totalProfitAll, setTotalProfitAll] = useState<number>(0);
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

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    allColumns.reduce((acc, col) => ({ ...acc, [col.id]: col.enabled }), {})
  );

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

  // Fetch totals with all filters applied
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

      // Date range
      const start = startOfDay(fromDate || subDays(new Date(), 1));
      const end = endOfDay(toDate || new Date());
      const startStr = format(start, "yyyy-MM-dd'T'00:00:00");
      const endStr = format(end, "yyyy-MM-dd'T'23:59:59");
      q = q.gte('created_at_date', startStr).lte('created_at_date', endStr);

      // Server-side filters
      const phone = phoneFilter.trim();
      if (phone) q = q.ilike('customer_phone', `%${phone}%`);
      const orderNo = orderNumberFilter.trim();
      if (orderNo) q = q.ilike('order_number', `%${orderNo}%`);

      // Server-side sorting
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

      // Get total count with same filters
      let countQuery = (supabase as any).from(table).select('*', { count: 'exact', head: true });
      countQuery = countQuery.gte('created_at_date', startStr).lte('created_at_date', endStr);
      if (phone) countQuery = countQuery.ilike('customer_phone', `%${phone}%`);
      if (orderNo) countQuery = countQuery.ilike('order_number', `%${orderNo}%`);
      
      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Pagination
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

      // Apply server-side filters
      const phone = phoneFilter.trim();
      const orderNo = orderNumberFilter.trim();

      // Fetch ALL data with pagination to avoid Supabase limits
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

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 inline-block ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 inline-block ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 inline-block ml-1" />
    );
  };

  const filteredTransactions = transactions.filter(transaction => {
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

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any = a[sortColumn as keyof Transaction];
    let bValue: any = b[sortColumn as keyof Transaction];

    // Handle date sorting
    if (sortColumn === "created_at_date") {
      aValue = new Date(aValue || 0).getTime();
      bValue = new Date(bValue || 0).getTime();
    }
    // Handle numeric sorting - values are already numeric
    else if (["total", "profit", "cost_price", "unit_price", "cost_sold", "qty", "coins_number"].includes(sortColumn)) {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }
    // Handle string sorting
    else {
      aValue = (aValue || "").toString().toLowerCase();
      bValue = (bValue || "").toString().toLowerCase();
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const exportToCSV = () => {
    const headers = [
      t("dashboard.date"),
      t("dashboard.customer"),
      t("transactions.customerPhone"),
      t("dashboard.brand"),
      t("dashboard.product"),
      t("transactions.orderNumber"),
      t("transactions.userName"),
      t("dashboard.amount"),
      t("dashboard.profit"),
      t("transactions.paymentMethod"),
      t("transactions.paymentType"),
      t("dashboard.paymentBrands"),
      t("transactions.qty"),
      t("transactions.costPrice"),
      t("transactions.unitPrice"),
      t("transactions.costSold"),
      t("transactions.coinsNumber")
    ];

    const csvContent = [
      headers.join(','),
      ...sortedTransactions.map(t => [
        t.created_at_date ? format(new Date(t.created_at_date), 'yyyy-MM-dd') : '',
        t.customer_name || '',
        t.customer_phone || '',
        t.brand_name || '',
        t.product_name || '',
        t.order_number || '',
        t.user_name || '',
        t.total || '',
        t.profit || '',
        t.payment_method || '',
        t.payment_type || '',
        t.payment_brand || '',
        t.qty || '',
        t.cost_price || '',
        t.unit_price || '',
        t.cost_sold || '',
        t.coins_number || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

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
          <div className="flex flex-wrap items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? format(fromDate, "PPP") : <span>{language === 'ar' ? 'من تاريخ' : 'From Date'}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={fromDate} 
                  onSelect={(date) => date && setFromDate(date)} 
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={2020}
                  toYear={2030}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? format(toDate, "PPP") : <span>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                  mode="single" 
                  selected={toDate} 
                  onSelect={(date) => date && setToDate(date)} 
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={2020}
                  toYear={2030}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t("transactions.search")}
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="relative min-w-[200px]">
              <Input 
                placeholder={t("transactions.customerPhone")}
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
              />
            </div>
            
            <div className="relative min-w-[200px]">
              <Input 
                placeholder={t("transactions.orderNumber")}
                value={orderNumberFilter}
                onChange={(e) => setOrderNumberFilter(e.target.value)}
              />
            </div>
            
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
                    {visibleColumns.created_at_date && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("created_at_date")}>
                        {t("dashboard.date")}
                        <SortIcon column="created_at_date" />
                      </TableHead>
                    )}
                    {visibleColumns.customer_name && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("customer_name")}>
                        {t("dashboard.customer")}
                        <SortIcon column="customer_name" />
                      </TableHead>
                    )}
                    {visibleColumns.customer_phone && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("customer_phone")}>
                        {t("transactions.customerPhone")}
                        <SortIcon column="customer_phone" />
                      </TableHead>
                    )}
                    {visibleColumns.brand_name && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("brand_name")}>
                        {t("dashboard.brand")}
                        <SortIcon column="brand_name" />
                      </TableHead>
                    )}
                    {visibleColumns.product_name && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("product_name")}>
                        {t("dashboard.product")}
                        <SortIcon column="product_name" />
                      </TableHead>
                    )}
                    {visibleColumns.order_number && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("order_number")}>
                        {t("transactions.orderNumber")}
                        <SortIcon column="order_number" />
                      </TableHead>
                    )}
                    {visibleColumns.user_name && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("user_name")}>
                        {t("transactions.userName")}
                        <SortIcon column="user_name" />
                      </TableHead>
                    )}
                    {visibleColumns.vendor_name && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("vendor_name")}>
                        {t("transactions.vendorName")}
                        <SortIcon column="vendor_name" />
                      </TableHead>
                    )}
                    {visibleColumns.order_status && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("order_status")}>
                        {t("transactions.orderStatus")}
                        <SortIcon column="order_status" />
                      </TableHead>
                    )}
                    {visibleColumns.total && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("total")}>
                        {t("dashboard.amount")}
                        <SortIcon column="total" />
                      </TableHead>
                    )}
                    {visibleColumns.profit && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("profit")}>
                        {t("dashboard.profit")}
                        <SortIcon column="profit" />
                      </TableHead>
                    )}
                    {visibleColumns.payment_method && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("payment_method")}>
                        {t("transactions.paymentMethod")}
                        <SortIcon column="payment_method" />
                      </TableHead>
                    )}
                    {visibleColumns.payment_type && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("payment_type")}>
                        {t("transactions.paymentType")}
                        <SortIcon column="payment_type" />
                      </TableHead>
                    )}
                    {visibleColumns.payment_brand && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort("payment_brand")}>
                        {t("dashboard.paymentBrands")}
                        <SortIcon column="payment_brand" />
                      </TableHead>
                    )}
                    {visibleColumns.qty && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("qty")}>
                        {t("transactions.qty")}
                        <SortIcon column="qty" />
                      </TableHead>
                    )}
                    {visibleColumns.cost_price && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cost_price")}>
                        {t("transactions.costPrice")}
                        <SortIcon column="cost_price" />
                      </TableHead>
                    )}
                    {visibleColumns.unit_price && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("unit_price")}>
                        {t("transactions.unitPrice")}
                        <SortIcon column="unit_price" />
                      </TableHead>
                    )}
                    {visibleColumns.cost_sold && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("cost_sold")}>
                        {t("transactions.costSold")}
                        <SortIcon column="cost_sold" />
                      </TableHead>
                    )}
                    {visibleColumns.coins_number && (
                      <TableHead className="text-right cursor-pointer" onClick={() => handleSort("coins_number")}>
                        {t("transactions.coinsNumber")}
                        <SortIcon column="coins_number" />
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      {visibleColumns.created_at_date && (
                        <TableCell>
                          {transaction.created_at_date ? format(new Date(transaction.created_at_date), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                      )}
                      {visibleColumns.customer_name && <TableCell>{transaction.customer_name || 'N/A'}</TableCell>}
                      {visibleColumns.customer_phone && <TableCell>{transaction.customer_phone || 'N/A'}</TableCell>}
                      {visibleColumns.brand_name && (
                        <TableCell className="max-w-[120px] truncate" title={transaction.brand_name || 'N/A'}>
                          {transaction.brand_name || 'N/A'}
                        </TableCell>
                      )}
                      {visibleColumns.product_name && <TableCell>{transaction.product_name || 'N/A'}</TableCell>}
                      {visibleColumns.order_number && <TableCell>{transaction.order_number || 'N/A'}</TableCell>}
                      {visibleColumns.user_name && <TableCell>{transaction.user_name || 'N/A'}</TableCell>}
                      {visibleColumns.vendor_name && <TableCell>{transaction.vendor_name || 'N/A'}</TableCell>}
                      {visibleColumns.order_status && <TableCell>{transaction.order_status || 'N/A'}</TableCell>}
                      {visibleColumns.total && <TableCell className="text-right">{formatNumber(transaction.total)}</TableCell>}
                      {visibleColumns.profit && <TableCell className="text-right text-green-600">{formatNumber(transaction.profit)}</TableCell>}
                      {visibleColumns.payment_method && <TableCell>{transaction.payment_method || 'N/A'}</TableCell>}
                      {visibleColumns.payment_type && <TableCell>{transaction.payment_type || 'N/A'}</TableCell>}
                      {visibleColumns.payment_brand && <TableCell>{transaction.payment_brand || 'N/A'}</TableCell>}
                      {visibleColumns.qty && <TableCell className="text-right">{formatNumber(transaction.qty)}</TableCell>}
                      {visibleColumns.cost_price && <TableCell className="text-right">{formatNumber(transaction.cost_price)}</TableCell>}
                      {visibleColumns.unit_price && <TableCell className="text-right">{formatNumber(transaction.unit_price)}</TableCell>}
                      {visibleColumns.cost_sold && <TableCell className="text-right">{formatNumber(transaction.cost_sold)}</TableCell>}
                      {visibleColumns.coins_number && <TableCell className="text-right">{formatNumber(transaction.coins_number)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
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
