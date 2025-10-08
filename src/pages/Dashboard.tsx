import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, TrendingUp, ShoppingCart, CreditCard, CalendarIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";

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
}

interface DashboardMetrics {
  totalSales: number;
  totalProfit: number;
  transactionCount: number;
  avgOrderValue: number;
  couponSales: number;
  costOfSales: number;
  ePaymentCharges: number;
}

const Dashboard = () => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
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
  });
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [topBrands, setTopBrands] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [paymentBrands, setPaymentBrands] = useState<any[]>([]);
  const [monthComparison, setMonthComparison] = useState<any[]>([]);
  const [productSummary, setProductSummary] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [customerPurchases, setCustomerPurchases] = useState<any[]>([]);
  
  // Product Summary Filters
  const [productFilter, setProductFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilterProduct, setBrandFilterProduct] = useState<string>("all");
  
  // Customer Purchases Filters
  const [customerFilterPurchases, setCustomerFilterPurchases] = useState<string>("all");
  const [productFilterCustomer, setProductFilterCustomer] = useState<string>("all");
  const [categoryFilterCustomer, setCategoryFilterCustomer] = useState<string>("all");
  
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [allBrands, setAllBrands] = useState<string[]>([]);
  const [allCustomers, setAllCustomers] = useState<string[]>([]);

  const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'];

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

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "yesterday":
        const yesterday = subDays(now, 1);
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleApplyFilter = () => {
    fetchDashboardData();
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setProgress(10);

      const dateRange = getDateRange();
      if (!dateRange) return;

      const pageSize = 1000;
      let from = 0;
      let transactions: Transaction[] = [];
      
      setProgress(20);
      
      while (true) {
        let query = (supabase as any)
          .from('purpletransaction')
          .select('*')
          .order('created_at_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (dateRange) {
          const startStr = format(startOfDay(dateRange.start), "yyyy-MM-dd'T'00:00:00");
          const endNextStr = format(addDays(startOfDay(dateRange.end), 1), "yyyy-MM-dd'T'00:00:00");
          query = query
            .gte('created_at_date', startStr)
            .lt('created_at_date', endNextStr);
        }

        const { data, error } = await query;

        if (error) throw error;

        const batch = (data as Transaction[]) || [];
        transactions = transactions.concat(batch);
        
        const estimatedProgress = Math.min(20 + (transactions.length / 100), 60);
        setProgress(estimatedProgress);
        
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      
      setProgress(65);

      if (transactions && transactions.length > 0) {
        setProgress(70);
        
        // Calculate metrics
        const totalSales = transactions.reduce((sum, t) => sum + parseNumber(t.total), 0);
        const totalProfit = transactions.reduce((sum, t) => sum + parseNumber(t.profit), 0);
        const transactionCount = transactions.length;
        const avgOrderValue = totalSales / transactionCount;
        const costOfSales = transactions.reduce((sum, t) => sum + parseNumber(t.cost_sold), 0);
        const couponSales = 0; // Placeholder - add logic if you have coupon data
        const ePaymentCharges = totalSales * 0.025; // Example: 2.5% payment processing fee

        setMetrics({
          totalSales,
          totalProfit,
          transactionCount,
          avgOrderValue,
          couponSales,
          costOfSales,
          ePaymentCharges,
        });
        
        setProgress(75);

        // Sales trend by date - fetch last 10 days from the reference date
        // If custom date range, use fromDate as reference; otherwise use today
        const referenceDate = (dateFilter === "dateRange" && fromDate) ? fromDate : new Date();
        const trendEndDate = endOfDay(referenceDate);
        const trendStartDate = startOfDay(subDays(referenceDate, 9));

        const { data: trendData, error: trendError } = await (supabase as any)
          .rpc('sales_trend', {
            date_from: format(trendStartDate, 'yyyy-MM-dd'),
            date_to: format(trendEndDate, 'yyyy-MM-dd')
          });

        if (!trendError && trendData) {
          // trendData is already grouped and summed by the database
          const byDate: Record<string, number> = {};
          trendData.forEach((row: any) => {
            byDate[row.created_at_date] = Number(row.total_sum);
          });

          const points: any[] = [];
          for (let d = startOfDay(trendStartDate); d <= startOfDay(trendEndDate); d = addDays(d, 1)) {
            const key = format(d, 'yyyy-MM-dd');
            const sales = byDate[key] ?? 0;
            points.push({ date: format(d, 'MMM dd'), sales });
          }
          setSalesTrend(points);
        }
        
        setProgress(78);

        // Top brands
        const brandSales = transactions.reduce((acc: any, t) => {
          const brand = t.brand_name || 'Unknown';
          if (!acc[brand]) {
            acc[brand] = { name: brand, value: 0 };
          }
          acc[brand].value += parseNumber(t.total);
          return acc;
        }, {});
        setTopBrands(Object.values(brandSales).sort((a: any, b: any) => b.value - a.value).slice(0, 5));

        setProgress(80);

        // Top 5 categories (using brand as category for now - adjust if you have a category field)
        setTopCategories(Object.values(brandSales).sort((a: any, b: any) => b.value - a.value).slice(0, 5));

        // Top 5 products
        const productSales = transactions.reduce((acc: any, t) => {
          const product = t.product_name || 'Unknown';
          if (!acc[product]) {
            acc[product] = { name: product, value: 0, qty: 0 };
          }
          acc[product].value += parseNumber(t.total);
          acc[product].qty += parseNumber(t.qty);
          return acc;
        }, {});
        setTopProducts(Object.values(productSales).sort((a: any, b: any) => b.value - a.value).slice(0, 5));
        setProductSummary(Object.values(productSales).sort((a: any, b: any) => b.value - a.value));
        
        // Extract unique values for filters
        const uniqueProducts = [...new Set(transactions.map(t => t.product_name).filter(Boolean))];
        const uniqueCategories = [...new Set(transactions.map(t => t.brand_name).filter(Boolean))]; // Using brand as category
        const uniqueBrands = [...new Set(transactions.map(t => t.brand_name).filter(Boolean))];
        const uniqueCustomers = [...new Set(transactions.map(t => t.customer_name).filter(Boolean))];
        
        setAllProducts(uniqueProducts as string[]);
        setAllCategories(uniqueCategories as string[]);
        setAllBrands(uniqueBrands as string[]);
        setAllCustomers(uniqueCustomers as string[]);
        
        // Customer Purchases Summary
        const customerData = transactions.reduce((acc: any, t) => {
          const customer = t.customer_name || 'Unknown';
          const category = t.brand_name || 'Unknown';
          const product = t.product_name || 'Unknown';
          
          const key = `${customer}-${category}-${product}`;
          if (!acc[key]) {
            acc[key] = {
              customerName: customer,
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

        setProgress(83);

        // Payment methods (doughnut chart)
        const paymentData = transactions.reduce((acc: any, t) => {
          const method = t.payment_method || 'Unknown';
          if (!acc[method]) {
            acc[method] = { name: method, value: 0 };
          }
          acc[method].value += parseNumber(t.total);
          return acc;
        }, {});
        setPaymentMethods(Object.values(paymentData));

        setProgress(86);

        // Payment brands (doughnut chart)
        const paymentBrandData = transactions.reduce((acc: any, t) => {
          const brand = t.payment_brand || 'Unknown';
          if (!acc[brand]) {
            acc[brand] = { name: brand, value: 0 };
          }
          acc[brand].value += parseNumber(t.total);
          return acc;
        }, {});
        setPaymentBrands(Object.values(paymentBrandData));

        setProgress(90);

        // Month comparison - fetch data for this month and last 2 months
        await fetchMonthComparison();

        // Recent transactions
        setRecentTransactions(transactions.slice(0, 5));
        
        setProgress(95);
      }

      setProgress(100);
      setTimeout(() => setLoading(false), 300);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const fetchMonthComparison = async () => {
    try {
      const now = new Date();
      const months = [];
      
      for (let i = 0; i < 3; i++) {
        const monthDate = subMonths(now, i);
        const start = startOfMonth(monthDate);
        const end = endOfMonth(monthDate);
        
        // Fetch all records in batches
        const pageSize = 1000;
        let from = 0;
        let allData: any[] = [];
        
        while (true) {
          const { data, error } = await (supabase as any)
            .from('purpletransaction')
            .select('total, profit')
            .gte('created_at_date', format(startOfDay(start), "yyyy-MM-dd'T'00:00:00"))
            .lt('created_at_date', format(addDays(startOfDay(end), 1), "yyyy-MM-dd'T'00:00:00"))
            .range(from, from + pageSize - 1);

          if (error) throw error;

          const batch = data || [];
          allData = allData.concat(batch);
          
          if (batch.length < pageSize) break;
          from += pageSize;
        }

        const totalSales = allData.reduce((sum: number, t: any) => sum + parseNumber(t.total), 0);
        const totalProfit = allData.reduce((sum: number, t: any) => sum + parseNumber(t.profit), 0);

        months.push({
          month: format(monthDate, 'MMM yyyy'),
          sales: totalSales,
          profit: totalProfit,
        });
      }

      setMonthComparison(months.reverse());
    } catch (error) {
      console.error('Error fetching month comparison:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("dashboard.loading")}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-2">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[300px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      title: t("dashboard.totalSales"),
      value: formatCurrency(metrics.totalSales),
      icon: DollarSign,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: t("dashboard.totalProfit"),
      value: formatCurrency(metrics.totalProfit),
      icon: TrendingUp,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: t("dashboard.transactions"),
      value: metrics.transactionCount.toLocaleString(),
      icon: ShoppingCart,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: t("dashboard.avgOrderValue"),
      value: formatCurrency(metrics.avgOrderValue),
      icon: CreditCard,
      gradient: "from-orange-500 to-red-500",
    },
  ];

  // Income Statement Data
  const incomeStatementData = [
    { label: t("dashboard.totalSalesWithDiscount"), value: metrics.totalSales, percentage: 100 },
    { label: t("dashboard.discountCoupons"), value: metrics.couponSales, percentage: (metrics.couponSales / metrics.totalSales) * 100 },
    { label: t("dashboard.salesPlusCoupon"), value: metrics.totalSales + metrics.couponSales, percentage: ((metrics.totalSales + metrics.couponSales) / metrics.totalSales) * 100 },
    { label: t("dashboard.costOfSales"), value: metrics.costOfSales, percentage: (metrics.costOfSales / metrics.totalSales) * 100 },
    { label: t("dashboard.shipping"), value: 0, percentage: 0 },
    { label: t("dashboard.taxes"), value: 0, percentage: 0 },
    { label: t("dashboard.ePaymentCharges"), value: metrics.ePaymentCharges, percentage: (metrics.ePaymentCharges / metrics.totalSales) * 100 },
    { label: t("dashboard.netSales"), value: metrics.totalSales - metrics.costOfSales - metrics.ePaymentCharges, percentage: ((metrics.totalSales - metrics.costOfSales - metrics.ePaymentCharges) / metrics.totalSales) * 100 },
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
                      <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus />
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
                      <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </>
            )}

            <Button onClick={handleApplyFilter}>{t("dashboard.apply")}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title} className="border-2 hover:shadow-lg transition-all duration-300">
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
      <Card className="border-2">
        <CardHeader>
          <CardTitle>{t("dashboard.incomeStatement")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {incomeStatementData.map((item, index) => (
              <div key={index} className={`flex justify-between items-center py-2 ${index === incomeStatementData.length - 1 ? 'border-t-2 pt-4 font-bold' : 'border-b'}`}>
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

      {/* Charts Row 1 - Sales Trend & Top 5 Categories */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.salesTrend")}</CardTitle>
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

        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.topCategories")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topCategories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {topCategories.map((entry, index) => (
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
                    if (value.length <= 9) return value;
                    const truncated = value.substring(0, 9);
                    const lastSpace = truncated.lastIndexOf(' ');
                    return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Top 10 Products & Month Comparison */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2">
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

        <Card className="border-2">
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
      </div>

      {/* Charts Row 3 - Payment Methods & Payment Brands (Doughnuts) */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.paymentMethods")}</CardTitle>
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
                  wrapperStyle={{ color: '#ffffff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-2">
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
      </div>

      {/* Product Summary Grid with Filters */}
      <Card className="border-2">
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

      {/* Customer Purchases Summary */}
      <Card className="border-2">
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
                    (productFilterCustomer === "all" || customer.product === productFilterCustomer) &&
                    (categoryFilterCustomer === "all" || customer.category === categoryFilterCustomer)
                  )
                  .slice(0, 20)
                  .map((customer: any, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4">{customer.customerName}</td>
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

      {/* Recent Transactions */}
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
    </div>
  );
};

export default Dashboard;
