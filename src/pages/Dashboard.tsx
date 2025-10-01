import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, Cloud, Database, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const cards = [
    {
      title: "Excel Sheets",
      description: "Upload and configure Excel sheets with column mappings",
      icon: FileSpreadsheet,
      link: "/excel-sheets",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: "API Configuration",
      description: "Define external APIs and map results to database",
      icon: Cloud,
      link: "/api-config",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: "Table Generator",
      description: "Define and generate database tables dynamically",
      icon: Database,
      link: "/table-generator",
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: "Reports",
      description: "Create custom reports with SQL scripts",
      icon: BarChart3,
      link: "/reports",
      gradient: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your data integrations, APIs, and reports from one central location
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
          <CardTitle>Quick Start Guide</CardTitle>
          <CardDescription>Get started with your data integration workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">1</div>
            <div>
              <p className="font-medium">Define Your Tables</p>
              <p className="text-sm text-muted-foreground">Use the Table Generator to create your transaction data structure</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">2</div>
            <div>
              <p className="font-medium">Configure Data Sources</p>
              <p className="text-sm text-muted-foreground">Set up Excel sheets or API endpoints with field mappings</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">3</div>
            <div>
              <p className="font-medium">Create Reports</p>
              <p className="text-sm text-muted-foreground">Build custom SQL-based reports to analyze your data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
