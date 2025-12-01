import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp, TicketCheck, Key, Calendar, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

const Reports = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [allowedReports, setAllowedReports] = useState<string[]>([]);

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      // If admin, allow all reports
      if (roles) {
        setAllowedReports(['revenue-by-brand-type', 'cost-by-brand-type', 'tickets', 'software-licenses', 'shift-report', 'shift-plan', 'brand-balance', 'api-documentation']);
        return;
      }

      // Otherwise, fetch specific permissions
      const { data: permissions } = await supabase
        .from('user_permissions')
        .select('menu_item')
        .eq('user_id', user.id)
        .eq('parent_menu', 'Reports')
        .eq('has_access', true);

      if (permissions) {
        setAllowedReports(permissions.map(p => p.menu_item));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
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
      name: "Tickets Report",
      description: "Detailed tickets report with filters for status, priority, department, and date range",
      icon: TicketCheck,
      route: "/reports/tickets",
    },
    {
      id: "software-licenses",
      name: "Software Licenses Report",
      description: "Comprehensive software licenses report with filters for status, category, renewal cycle, and dates",
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
  ];

  const filteredReports = reports.filter(report => allowedReports.includes(report.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("reports.title")}</h1>
        <p className="text-muted-foreground">
          {t("reports.subtitle")}
        </p>
      </div>

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
    </div>
  );
};

export default Reports;
