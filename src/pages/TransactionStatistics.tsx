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
      // Calculate date 3 months ago as integer (YYYYMMDD format)
      const today = new Date();
      const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const startDateInt = parseInt(
        `${threeMonthsAgo.getFullYear()}${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}${String(threeMonthsAgo.getDate()).padStart(2, '0')}`
      );

      // Get brands with ABC class "A"
      const { data: classABrands, error: brandsError } = await supabase
        .from("brands")
        .select("brand_code")
        .eq("abc_analysis", "A");

      if (brandsError) throw brandsError;

      const classABrandCodes = classABrands?.map(b => b.brand_code).filter(Boolean) || [];

      // Get total count using created_at_date_int for faster filtering
      const { count: totalCount, error: countError } = await supabase
        .from("purpletransaction")
        .select("*", { count: "exact", head: true })
        .neq("payment_method", "point")
        .eq("is_deleted", false)
        .gte("created_at_date_int", startDateInt);

      if (countError) throw countError;

      if (!totalCount || totalCount === 0) {
        setStats({
          averageOrderSize: 0,
          averageDailyTransactions: 0,
          averageMonthlyAmount: 0,
        });
        return;
      }

      // Fetch aggregated data in batches using created_at_date_int for faster filtering
      let allTransactions: { total: number | null; created_at_date_int: number | null; brand_code: string | null }[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error: batchError } = await supabase
          .from("purpletransaction")
          .select("total, created_at_date_int, brand_code")
          .neq("payment_method", "point")
          .eq("is_deleted", false)
          .gte("created_at_date_int", startDateInt)
          .range(offset, offset + batchSize - 1);

        if (batchError) throw batchError;

        if (batch && batch.length > 0) {
          allTransactions = [...allTransactions, ...batch];
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Filter transactions for Class A brands (for average order size only)
      const classATransactions = allTransactions.filter(t => 
        t.brand_code && classABrandCodes.includes(t.brand_code)
      );

      // Calculate average order size (Class A brands only)
      const classATotalAmount = classATransactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      const averageOrderSize = classATransactions.length > 0 
        ? classATotalAmount / classATransactions.length 
        : 0;

      // Calculate average daily transactions (all transactions)
      // created_at_date_int is in YYYYMMDD format
      const uniqueDates = new Set(
        allTransactions
          .filter(t => t.created_at_date_int)
          .map(t => t.created_at_date_int)
      );
      const numberOfDays = uniqueDates.size || 1;
      const averageDailyTransactions = allTransactions.length / numberOfDays;

      // Calculate average monthly amount (all transactions)
      const totalAmount = allTransactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
      const monthlyTotals: { [key: string]: number } = {};
      allTransactions.forEach(t => {
        if (t.created_at_date_int) {
          // Extract YYYYMM from YYYYMMDD
          const monthKey = String(t.created_at_date_int).substring(0, 6);
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
          a, a::after {
            display: none !important;
          }
          a[href]::after {
            content: none !important;
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
                ? "إحصائيات آخر 4 أشهر (الشهر الحالي + 3 أشهر سابقة)"
                : "Statistics for the last 4 months (current + previous 3 months)"}
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
                {language === "ar" ? "متوسط حجم الطلب (فئة A)" : "Average Order Size (Class A)"}
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.averageOrderSize)}</div>
              <p className="text-xs text-muted-foreground">
                {language === "ar" ? "متوسط قيمة الطلب للعلامات التجارية فئة A" : "Average order value for Class A brands"}
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
