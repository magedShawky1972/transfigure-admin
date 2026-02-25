import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, TicketCheck, Key, Calendar, BookOpen, BarChart3, Receipt, Database, Coins, Landmark, Shield, ShoppingCart, Link2, DollarSign, ClipboardList, FileSpreadsheet, AlertTriangle, Scale, FolderKanban } from "lucide-react";
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
        setAllowedReports(['revenue-by-brand-type', 'cost-by-brand-type', 'tickets', 'software-licenses', 'shift-report', 'shift-plan', 'brand-balance', 'api-documentation', 'transaction-statistics', 'order-payment', 'data-loading-status', 'coins-ledger', 'bank-statement', 'bank-statement-as-of', 'security-dashboard', 'sold-product', 'odoo-sync-status', 'aggregated-orders', 'expense-pending', 'expense-paid', 'bank-balance-by-date', 'bank-statement-by-bank', 'daily-sales', 'cost-center-report', 'manual-shift-transactions', 'sales-order-detail', 'data-comparison', 'coins-comparison', 'projects-tasks']);
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
      name: language === "ar" ? "كشف حساب بنك الرياض" : "RIYAD BANK Statement",
      description: language === "ar" 
        ? "عرض كشف حساب البنك مع الفلترة حسب تاريخ المعاملة وتاريخ الترحيل" 
        : "View bank statement with filters by transaction date and posting date",
      icon: Landmark,
      route: "/reports/bank-statement",
    },
    {
      id: "bank-statement-as-of",
      name: language === "ar" ? "كشف حساب البنك حتى تاريخ" : "Bank Statement As Of",
      description: language === "ar" 
        ? "عرض كشف حساب البنك حتى تاريخ محدد مع الرصيد الافتتاحي والختامي" 
        : "View bank statement as of a specific date with opening and closing balances",
      icon: Landmark,
      route: "/reports/bank-statement-as-of",
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
    {
      id: "sold-product",
      name: language === "ar" ? "تقرير المنتجات المباعة" : "Sold Product Report",
      description: language === "ar" 
        ? "عرض المبيعات والكميات لكل علامة تجارية ومنتج مع إمكانية التصدير والطباعة" 
        : "View sales value and quantity per brand and product with export and print",
      icon: ShoppingCart,
      route: "/reports/sold-product",
    },
    {
      id: "odoo-sync-status",
      name: language === "ar" ? "حالة مزامنة Odoo" : "Odoo Sync Status Report",
      description: language === "ar" 
        ? "عرض البيانات المرسلة والغير مرسلة إلى Odoo مع رسائل الخطأ" 
        : "View data sent and not sent to Odoo with error messages",
      icon: Database,
      route: "/reports/odoo-sync-status",
    },
    {
      id: "aggregated-orders",
      name: language === "ar" ? "مطابقة الطلبات المجمعة" : "Aggregated Order Mapping",
      description: language === "ar" 
        ? "عرض ربط الطلبات المجمعة بالطلبات الأصلية للمطابقة بين Odoo و Edara" 
        : "View aggregated order to original order mapping for Odoo-Edara reconciliation",
      icon: Link2,
      route: "/reports/aggregated-orders",
    },
    {
      id: "expense-pending",
      name: language === "ar" ? "المصروفات المعلقة" : "Pending Expenses",
      description: language === "ar" 
        ? "عرض جميع المصروفات في الانتظار والمصنفة والمعتمدة مع الإجماليات" 
        : "View all pending, classified, and approved expenses with totals",
      icon: DollarSign,
      route: "/expense-reports?tab=pending",
    },
    {
      id: "expense-paid",
      name: language === "ar" ? "المصروفات المدفوعة" : "Paid Expenses",
      description: language === "ar" 
        ? "تقرير المصروفات المدفوعة خلال فترة محددة مع التصدير" 
        : "Paid expenses report for a selected period with export",
      icon: DollarSign,
      route: "/expense-reports?tab=paid",
    },
    {
      id: "bank-balance-by-date",
      name: language === "ar" ? "تقرير رصيد البنك بالتاريخ" : "Bank Balance by Date",
      description: language === "ar" 
        ? "عرض جميع المعاملات البنكية حسب النوع مع الرسوم والإجماليات" 
        : "View all bank transactions by type with charges and totals",
      icon: Landmark,
      route: "/reports/bank-balance-by-date",
    },
    {
      id: "bank-statement-by-bank",
      name: language === "ar" ? "كشف حساب البنك" : "Bank Statement",
      description: language === "ar" 
        ? "عرض كشف حساب البنك مع فلتر اسم البنك ونطاق التاريخ" 
        : "View bank statement with bank name filter and date range",
      icon: Landmark,
      route: "/reports/bank-statement-by-bank",
    },
    {
      id: "daily-sales",
      name: language === "ar" ? "تقرير المبيعات اليومية" : "Daily Sales Report",
      description: language === "ar" 
        ? "عرض إجمالي المبيعات ومبيعات النقاط وعدد المعاملات لكل يوم" 
        : "View total sales, point sales, and transaction count per day",
      icon: Calendar,
      route: "/reports/daily-sales",
    },
    {
      id: "cost-center-report",
      name: language === "ar" ? "تقرير تكاليف مراكز التكلفة" : "Cost Center Total Cost",
      description: language === "ar" 
        ? "عرض إجمالي التكاليف لكل مركز تكلفة من التراخيص والمصروفات" 
        : "View total costs per cost center from licenses and expenses",
      icon: TrendingUp,
      route: "/reports/cost-center",
    },
    {
      id: "manual-shift-transactions",
      name: language === "ar" ? "تقرير معاملات المناوبة اليدوية" : "Manual Shift Transaction Report",
      description: language === "ar" 
        ? "عرض معاملات المناوبة اليدوية مع مجموعات فرعية حسب العلامة التجارية والمستخدم" 
        : "View manual shift transactions with subtotals by brand and user",
      icon: ClipboardList,
      route: "/reports/manual-shift-transactions",
    },
    {
      id: "sales-order-detail",
      name: language === "ar" ? "تقرير تفاصيل أوامر البيع" : "Sales Order Detail Report",
      description: language === "ar"
        ? "عرض تفاصيل الطلبات مع الأسطر والمدفوعات"
        : "View order details with lines and payment transactions",
      icon: FileSpreadsheet,
      route: "/reports/sales-order-detail",
    },
    {
      id: "data-comparison",
      name: language === "ar" ? "مقارنة البيانات - API مقابل Excel" : "Data Comparison - API vs Excel",
      description: language === "ar"
        ? "مقارنة البيانات المرسلة عبر API مع البيانات المحملة من Excel لإيجاد الفروقات"
        : "Compare API-sent data with Excel-uploaded data to find discrepancies",
      icon: AlertTriangle,
      route: "/reports/data-comparison",
    },
    {
      id: "coins-comparison",
      name: language === "ar" ? "مقارنة الكوينز" : "Coins Comparison",
      description: language === "ar"
        ? "مقارنة كوينز المعاملات الفعلية مع كوينز المنتج المتوقعة لكشف الفروقات"
        : "Compare actual transaction coins vs expected product coins to find discrepancies",
      icon: Scale,
      route: "/reports/coins-comparison",
    },
    {
      id: "projects-tasks",
      name: language === "ar" ? "تقرير المشاريع والمهام" : "Projects & Tasks Report",
      description: language === "ar"
        ? "تقرير شامل للمشاريع والمهام مع نسبة الإنجاز وفلاتر متعددة للمشاريع والأقسام والمستخدمين"
        : "Comprehensive projects & tasks report with achievement percentage and multi-filters",
      icon: FolderKanban,
      route: "/reports/projects-tasks",
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
