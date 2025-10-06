import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, ShoppingCart, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface Transaction {
  id: string;
  created_at_date: string;
  customer_name: string;
  brand_name: string;
  product_name: string;
  total: string;
  profit: string;
  payment_method: string;
}

interface DashboardMetrics {
  totalSales: number;
  totalProfit: number;
  transactionCount: number;
  avgOrderValue: number;
}

const Dashboard = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalSales: 0,
    totalProfit: 0,
    transactionCount: 0,
    avgOrderValue: 0,
  });
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [topBrands, setTopBrands] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);

  const COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444'];

  // Safely parse numbers coming as formatted strings like "3,087,089.63"
  const parseNumber = (value?: string | null) => {
    if (value == null) return 0;
    const cleaned = value.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Format numbers as Saudi Riyal currency
  const formatCurrency = (amount: number) => {
    if (!isFinite(amount)) amount = 0;
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all transactions in batches to bypass API page limits
      const pageSize = 1000; // Align with API max-rows to avoid skipping
      let from = 0;
      let transactions: Transaction[] = [];
      while (true) {
        const { data, error } = await (supabase as any)
          .from('purpletransaction')
          .select('*')
          .order('created_at_date', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const batch = (data as Transaction[]) || [];
        transactions = transactions.concat(batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }

      if (transactions && transactions.length > 0) {
        // Calculate metrics
        const totalSales = transactions.reduce((sum, t) => sum + parseNumber(t.total), 0);
        const totalProfit = transactions.reduce((sum, t) => sum + parseNumber(t.profit), 0);
        const transactionCount = transactions.length;
        const avgOrderValue = totalSales / transactionCount;

        setMetrics({
          totalSales,
          totalProfit,
          transactionCount,
          avgOrderValue,
        });

        // Sales trend by date
        const salesByDate = transactions.reduce((acc: any, t) => {
          const date = t.created_at_date ? format(new Date(t.created_at_date), 'MMM dd') : 'Unknown';
          if (!acc[date]) {
            acc[date] = { date, sales: 0, profit: 0 };
          }
           acc[date].sales += parseNumber(t.total);
           acc[date].profit += parseNumber(t.profit);
          return acc;
        }, {});
        setSalesTrend(Object.values(salesByDate).slice(0, 15));

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

        // Payment methods
        const paymentData = transactions.reduce((acc: any, t) => {
          const method = t.payment_method || 'Unknown';
          if (!acc[method]) {
            acc[method] = { name: method, value: 0 };
          }
          acc[method].value += 1;
          return acc;
        }, {});
        setPaymentMethods(Object.values(paymentData));

        // Recent transactions
        setRecentTransactions(transactions.slice(0, 5));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">{t("dashboard.loading")}</p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("dashboard.title")}</h1>
        <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
      </div>

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

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales Trend */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.salesTrend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="sales" stroke="#8B5CF6" strokeWidth={2} name={t("dashboard.totalSales")} />
                <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} name={t("dashboard.profit")} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Brands */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.topBrands")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topBrands}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="value" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods & Recent Transactions */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Payment Methods */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>{t("dashboard.paymentMethods")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={paymentMethods}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-2 md:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.recentTransactions")}</CardTitle>
            <CardDescription>
              <Link to="/transactions" className="text-primary hover:underline">
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
    </div>
  );
};

export default Dashboard;
