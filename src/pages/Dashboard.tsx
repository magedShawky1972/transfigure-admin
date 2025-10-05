import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Cloud, Database, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Dashboard = () => {
  const { t } = useLanguage();
  
  const cards = [
    {
      title: t("dashboard.excelSheets"),
      description: t("dashboard.excelSheets.desc"),
      icon: FileSpreadsheet,
      link: "/excel-sheets",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: t("dashboard.apiConfig"),
      description: t("dashboard.apiConfig.desc"),
      icon: Cloud,
      link: "/api-config",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: t("dashboard.tableGen"),
      description: t("dashboard.tableGen.desc"),
      icon: Database,
      link: "/table-generator",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: t("dashboard.reports"),
      description: t("dashboard.reports.desc"),
      icon: BarChart3,
      link: "/reports",
      gradient: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t("dashboard.welcome")} {t("app.name")}</h1>
        <p className="text-muted-foreground">
          {t("dashboard.subtitle")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.title} to={card.link}>
            <Card className="hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 h-full group">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-xl">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader>
          <CardTitle>{t("dashboard.quickStart")}</CardTitle>
          <CardDescription>{t("dashboard.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">1</div>
            <div>
              <p className="text-sm text-muted-foreground">{t("dashboard.quickStart.1")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">2</div>
            <div>
              <p className="text-sm text-muted-foreground">{t("dashboard.quickStart.2")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">3</div>
            <div>
              <p className="text-sm text-muted-foreground">{t("dashboard.quickStart.3")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">4</div>
            <div>
              <p className="text-sm text-muted-foreground">{t("dashboard.quickStart.4")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">5</div>
            <div>
              <p className="text-sm text-muted-foreground">{t("dashboard.quickStart.5")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
