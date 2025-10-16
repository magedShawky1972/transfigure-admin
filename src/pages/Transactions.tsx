import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Download, ArrowUpDown, ArrowUp, ArrowDown, CalendarIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  customer_phone: string;
  brand_name: string;
  product_name: string;
  total: string;
  profit: string;
  payment_method: string;
  payment_type: string;
  payment_brand: string;
  order_number: string;
  user_name: string;
  cost_price: string;
  unit_price: string;
  cost_sold: string;
  qty: string;
  coins_number: string;
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
  const [hasMore, setHasMore] = useState<boolean>(false);
  const pageSize = 500;

  const parseNumber = (value?: string | null) => {
    if (value == null) return 0;
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

  const formatNumber = (amount: number) => {
    if (!isFinite(amount)) amount = 0;
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
    setTransactions([]); // Clear when sort/filter changes
  }, [fromDate, toDate, orderNumberFilter, phoneFilter, sortColumn, sortDirection]);

  useEffect(() => {
    fetchTransactions();
  }, [fromDate, toDate, page, orderNumberFilter, phoneFilter, sortColumn, sortDirection]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      const numericSortColumns = new Set([
        'total', 'profit', 'cost_price', 'unit_price', 'cost_sold', 'qty'
      ]);

      const table = sortColumn && numericSortColumns.has(sortColumn)
        ? 'purpletransaction_enriched'
        : 'purpletransaction';

      let q = supabase
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

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await q.range(from, to);

      if (error) throw error;
      const rows = (data as any) as Transaction[];
      setHasMore(rows.length === pageSize);
      setTransactions(prev => {
        if (page === 1) return rows;
        const merged = [...prev, ...rows];
        const seen = new Set<string>();
        return merged.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
      });

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
    // Handle numeric sorting
    else if (["total", "profit", "cost_price", "unit_price", "cost_sold", "qty"].includes(sortColumn)) {
      aValue = parseNumber(aValue);
      bValue = parseNumber(bValue);
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("transactions.title")}</CardTitle>
            <Button variant="outline" className="gap-2" onClick={exportToCSV}>
              <Download className="h-4 w-4" />
              {t("transactions.export")}
            </Button>
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
                <Calendar mode="single" selected={fromDate} onSelect={(date) => date && setFromDate(date)} initialFocus />
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
                <Calendar mode="single" selected={toDate} onSelect={(date) => date && setToDate(date)} initialFocus />
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
                    <TableHead className="cursor-pointer" onClick={() => handleSort("created_at_date")}>
                      {t("dashboard.date")}
                      <SortIcon column="created_at_date" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("customer_name")}>
                      {t("dashboard.customer")}
                      <SortIcon column="customer_name" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("customer_phone")}>
                      {t("transactions.customerPhone")}
                      <SortIcon column="customer_phone" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("brand_name")}>
                      {t("dashboard.brand")}
                      <SortIcon column="brand_name" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("product_name")}>
                      {t("dashboard.product")}
                      <SortIcon column="product_name" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("order_number")}>
                      {t("transactions.orderNumber")}
                      <SortIcon column="order_number" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("user_name")}>
                      {t("transactions.userName")}
                      <SortIcon column="user_name" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("total")}>
                      {t("dashboard.amount")}
                      <SortIcon column="total" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("profit")}>
                      {t("dashboard.profit")}
                      <SortIcon column="profit" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("payment_method")}>
                      {t("transactions.paymentMethod")}
                      <SortIcon column="payment_method" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("payment_type")}>
                      {t("transactions.paymentType")}
                      <SortIcon column="payment_type" />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("payment_brand")}>
                      {t("dashboard.paymentBrands")}
                      <SortIcon column="payment_brand" />
                    </TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort("qty")}>
                      {t("transactions.qty")}
                      <SortIcon column="qty" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {transaction.created_at_date ? format(new Date(transaction.created_at_date), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>{transaction.customer_name || 'N/A'}</TableCell>
                      <TableCell>{transaction.customer_phone || 'N/A'}</TableCell>
                      <TableCell className="max-w-[120px] truncate" title={transaction.brand_name || 'N/A'}>
                        {transaction.brand_name || 'N/A'}
                      </TableCell>
                      <TableCell>{transaction.product_name || 'N/A'}</TableCell>
                      <TableCell>{transaction.order_number || 'N/A'}</TableCell>
                      <TableCell>{transaction.user_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{transaction.total || 'N/A'}</TableCell>
                      <TableCell className="text-right text-green-600">{transaction.profit || 'N/A'}</TableCell>
                      <TableCell>{transaction.payment_method || 'N/A'}</TableCell>
                      <TableCell>{transaction.payment_type || 'N/A'}</TableCell>
                      <TableCell>{transaction.payment_brand || 'N/A'}</TableCell>
                      <TableCell className="text-right">{transaction.qty || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {!loading && hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setPage(p => p + 1)}>
                {language === 'ar' ? 'تحميل المزيد' : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.transactions")}</CardTitle>
            <CardTitle className="text-3xl">{sortedTransactions.length}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalSales")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(sortedTransactions.reduce((sum, t) => sum + parseNumber(t.total), 0))}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.totalProfit")}</CardTitle>
            <CardTitle className="text-3xl">
              {formatCurrency(sortedTransactions.reduce((sum, t) => sum + parseNumber(t.profit), 0))}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Transactions;
