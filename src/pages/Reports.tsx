import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, TicketCheck, Key, Calendar, BookOpen, BarChart3, Receipt, Database, Coins, Landmark, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const Reports = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [allowedReports, setAllowedReports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      // If admin, allow all reports
      if (roles) {
        setAllowedReports(['revenue-by-brand-type', 'cost-by-brand-type', 'tickets', 'software-licenses', 'shift-report', 'shift-plan', 'brand-balance', 'api-documentation', 'transaction-statistics', 'order-payment', 'data-loading-status', 'coins-ledger', 'bank-statement', 'security-dashboard']);
        setLoading(false);
        return;
      }

      // Otherwise, fetch specific permissions
      const { data: permissions } = await supabase
        .from('user_permissions')
        .select('menu_item')
        .eq('user_id', user.id)
        .eq('parent_menu', 'Reports')
        .eq('has_access', true);

      if (permissions && permissions.length > 0) {
        setAllowedReports(permissions.map(p => p.menu_item));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const reports = [
    {
      id: "revenue-by-brand-type",
      name: t("reports.revenueByBrandType.name"),
      description: t("reports.revenueByBrandType.description"),
      icon: TrendingUp,
      route: "/reports/revenue-by-brand-type",
    },
    {
      id: "cost-by-brand-type",
      name: t("reports.costByBrandType.name"),
      description: t("reports.costByBrandType.description"),
      icon: TrendingUp,
      route: "/reports/cost-by-brand-type",
    },
    {
      id: "tickets",
      name: language === "ar" ? "تقرير التذاكر" : "Tickets Report",
      description: language === "ar" 
        ? "تقرير مفصل للتذاكر مع فلاتر حسب الحالة والأولوية والقسم ونطاق التاريخ" 
        : "Detailed tickets report with filters for status, priority, department, and date range",
      icon: TicketCheck,
      route: "/reports/tickets",
    },
    {
      id: "software-licenses",
      name: language === "ar" ? "تقرير تراخيص البرمجيات" : "Software Licenses Report",
      description: language === "ar" 
        ? "تقرير شامل لتراخيص البرمجيات مع فلاتر حسب الحالة والفئة ودورة التجديد والتواريخ" 
        : "Comprehensive software licenses report with filters for status, category, renewal cycle, and dates",
      icon: Key,
      route: "/reports/software-licenses-report",
    },
    {
      id: "shift-report",
      name: language === "ar" ? "تقرير المناوبات" : "Shift Report",
      description: language === "ar" 
        ? "تقرير شامل للمناوبات مع فلاتر حسب الوظيفة والتاريخ" 
        : "Comprehensive shift report with filters by job position and date",
      icon: Calendar,
      route: "/reports/shift-report",
    },
    {
      id: "shift-plan",
      name: language === "ar" ? "تقرير خطة المناوبات" : "Shift Plan Report",
      description: language === "ar" 
        ? "تقرير خطة المناوبات مع فلاتر متعددة وتصدير إلى Excel" 
        : "Shift plan report with multi-filters and Excel export",
      icon: Calendar,
      route: "/reports/shift-plan",
    },
    {
      id: "brand-balance",
      name: language === "ar" ? "تقرير أرصدة البراندات" : "Brand Balance Report",
      description: language === "ar" 
        ? "تقرير أرصدة الإغلاق لمنتجات الفئة A المسجلة من مندوبي المبيعات" 
        : "Closing balances report for A-class products recorded by sales reps",
      icon: FileText,
      route: "/reports/brand-balance",
    },
    {
      id: "api-documentation",
      name: language === "ar" ? "توثيق API" : "API Documentation",
      description: language === "ar" 
        ? "دليل شامل لواجهات API للتكامل مع التجارة الإلكترونية" 
        : "Comprehensive API guide for E-Commerce integration",
      icon: BookOpen,
      route: "/api-documentation",
    },
    {
      id: "transaction-statistics",
      name: language === "ar" ? "إحصائيات المعاملات" : "Transaction Statistics",
      description: language === "ar" 
        ? "متوسط حجم الطلب ومتوسط المعاملات اليومية والمبلغ الشهري" 
        : "Average order size, daily transactions, and monthly amounts",
      icon: BarChart3,
      route: "/reports/transaction-statistics",
    },
    {
      id: "order-payment",
      name: language === "ar" ? "تقرير مدفوعات الطلبات" : "Order Payment Report",
      description: language === "ar" 
        ? "عرض وتصفية مدفوعات الطلبات مع تفاصيل البنود" 
        : "View and filter order payments with line item details",
      icon: Receipt,
      route: "/reports/order-payment",
    },
    {
      id: "data-loading-status",
      name: language === "ar" ? "حالة تحميل البيانات" : "Data Loading Status",
      description: language === "ar" 
        ? "التحقق من التواريخ المحملة في النظام لمعرفة الأيام المفقودة" 
        : "Check which dates have data loaded to identify missing days",
      icon: Database,
      route: "/reports/data-loading-status",
    },
    {
      id: "coins-ledger",
      name: language === "ar" ? "تقرير دفتر الكوينز" : "Coins Ledger Report",
      description: language === "ar" 
        ? "عرض حركة الكوينز لكل مناوبة مع الرصيد الافتتاحي والختامي والفرق" 
        : "View coins movement per shift with opening, closing balances and variance",
      icon: Coins,
      route: "/reports/coins-ledger",
    },
    {
      id: "bank-statement",
      name: language === "ar" ? "تقرير كشف حساب البنك" : "Bank Statement Report",
      description: language === "ar" 
        ? "عرض كشف حساب البنك مع الفلترة حسب تاريخ المعاملة وتاريخ الترحيل" 
        : "View bank statement with filters by transaction date and posting date",
      icon: Landmark,
      route: "/reports/bank-statement",
    },
    {
      id: "security-dashboard",
      name: language === "ar" ? "لوحة الأمان" : "Security Dashboard",
      description: language === "ar" 
        ? "مراقبة أنماط الوصول لكلمات المرور وسجل التنبيهات الأمنية في الوقت الفعلي" 
        : "Monitor password access patterns and security alert history in real-time",
      icon: Shield,
      route: "/reports/security-dashboard",
    },
  ];

  const filteredReports = reports.filter(report => allowedReports.includes(report.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">
          {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("reports.title")}</h1>
        <p className="text-muted-foreground">
          {t("reports.subtitle")}
        </p>
      </div>

      {filteredReports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'ليس لديك صلاحيات للوصول إلى أي تقارير. يرجى التواصل مع المسؤول.' 
              : 'You do not have permission to access any reports. Please contact an administrator.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(report.route)}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <CardDescription className="mt-2">
                      {report.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  {t("reports.viewReport")}
                </Button>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
};

export default Reports;
