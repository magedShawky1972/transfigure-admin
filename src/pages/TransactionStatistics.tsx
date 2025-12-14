import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Printer, ShoppingCart, Calendar, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Statistics {
  averageOrderSize: number;
  averageDailyTransactions: number;
  averageMonthlyAmount: number;
}

const TransactionStatistics = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Statistics>({
    averageOrderSize: 0,
    averageDailyTransactions: 0,
    averageMonthlyAmount: 0,
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      // Fetch all transactions (excluding point transactions)
      const { data: transactions, error } = await supabase
        .from("purpletransaction")
        .select("total, created_at_date")
        .neq("payment_method", "point")
        .eq("is_deleted", false);

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        setStats({
          averageOrderSize: 0,
          averageDailyTransactions: 0,
          averageMonthlyAmount: 0,
        });
        return;
      }

      // Calculate average order size
      const totalAmount = transactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      const averageOrderSize = totalAmount / transactions.length;

      // Calculate average daily transactions
      const uniqueDates = new Set(
        transactions
          .filter(t => t.created_at_date)
          .map(t => new Date(t.created_at_date!).toDateString())
      );
      const numberOfDays = uniqueDates.size || 1;
      const averageDailyTransactions = transactions.length / numberOfDays;

      // Calculate average monthly amount
      const monthlyTotals: { [key: string]: number } = {};
      transactions.forEach(t => {
        if (t.created_at_date) {
          const date = new Date(t.created_at_date);
          const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (Number(t.total) || 0);
        }
      });
      const numberOfMonths = Object.keys(monthlyTotals).length || 1;
      const averageMonthlyAmount = totalAmount / numberOfMonths;

      setStats({
        averageOrderSize,
        averageDailyTransactions,
        averageMonthlyAmount,
      });
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-area h1, .print-area h2, .print-area h3, .print-area p, .print-area span, .print-area div {
            color: #000000 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {language === "ar" ? "إحصائيات المعاملات" : "Transaction Statistics"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar"
                ? "متوسط حجم الطلب ومعاملات اليومية والشهرية"
                : "Average order size, daily transactions, and monthly amounts"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStatistics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="print-area">
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold text-center">
            {language === "ar" ? "إحصائيات المعاملات" : "Transaction Statistics"}
          </h1>
          <p className="text-center text-muted-foreground">
            {new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Average Order Size */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "متوسط حجم الطلب" : "Average Order Size"}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.averageOrderSize)}</div>
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "متوسط قيمة كل طلب" : "Average value per order"}
              </p>
            </CardContent>
          </Card>

          {/* Average Daily Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "متوسط المعاملات اليومية" : "Avg Daily Transactions"}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.averageDailyTransactions)}</div>
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "عدد المعاملات يومياً" : "Transactions per day"}
              </p>
            </CardContent>
          </Card>

          {/* Average Monthly Amount */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {language === "ar" ? "متوسط المبلغ الشهري" : "Avg Monthly Amount"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.averageMonthlyAmount)}</div>
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "إجمالي المبيعات شهرياً" : "Total sales per month"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TransactionStatistics;
