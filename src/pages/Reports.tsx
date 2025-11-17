import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Reports = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

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
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("reports.title")}</h1>
        <p className="text-muted-foreground">
          {t("reports.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => {
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
