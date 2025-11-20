import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Ticket, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ShoppingCart,
  Users
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

type TicketStats = {
  total: number;
  open: number;
  inProgress: number;
  closed: number;
  urgent: number;
  high: number;
  medium: number;
  low: number;
  purchase: number;
};

type DepartmentStats = {
  department_name: string;
  ticket_count: number;
};

const TicketDashboard = () => {
  const { language } = useLanguage();
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    closed: 0,
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
    purchase: 0,
  });
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if user is admin
      const { data: adminDepts } = await supabase
        .from("department_admins")
        .select("department_id")
        .eq("user_id", user.id);

      const isAdmin = adminDepts && adminDepts.length > 0;

      // Fetch tickets based on role (exclude deleted tickets)
      let query = supabase
        .from("tickets")
        .select("*, departments(department_name)")
        .eq("is_deleted", false);

      if (isAdmin) {
        const departmentIds = adminDepts?.map(d => d.department_id) || [];
        query = query.in("department_id", departmentIds);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data: tickets, error } = await query;

      if (error) throw error;

      if (tickets) {
        const newStats: TicketStats = {
          total: tickets.length,
          open: tickets.filter(t => t.status === "Open").length,
          inProgress: tickets.filter(t => t.status === "In Progress").length,
          closed: tickets.filter(t => t.status === "Closed").length,
          urgent: tickets.filter(t => t.priority === "Urgent").length,
          high: tickets.filter(t => t.priority === "High").length,
          medium: tickets.filter(t => t.priority === "Medium").length,
          low: tickets.filter(t => t.priority === "Low").length,
          purchase: tickets.filter(t => t.is_purchase_ticket).length,
        };
        setStats(newStats);

        // Calculate department stats
        const deptMap = new Map<string, number>();
        tickets.forEach(ticket => {
          const deptName = ticket.departments?.department_name || "Unknown";
          deptMap.set(deptName, (deptMap.get(deptName) || 0) + 1);
        });

        const deptStats = Array.from(deptMap.entries())
          .map(([department_name, ticket_count]) => ({ department_name, ticket_count }))
          .sort((a, b) => b.ticket_count - a.ticket_count);

        setDepartmentStats(deptStats);
      }
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statusData = [
    { name: language === 'ar' ? 'مفتوح' : 'Open', value: stats.open, color: '#3b82f6' },
    { name: language === 'ar' ? 'قيد المعالجة' : 'In Progress', value: stats.inProgress, color: '#f59e0b' },
    { name: language === 'ar' ? 'مغلق' : 'Closed', value: stats.closed, color: '#10b981' },
  ];

  const priorityData = [
    { name: language === 'ar' ? 'عاجل' : 'Urgent', value: stats.urgent },
    { name: language === 'ar' ? 'عالي' : 'High', value: stats.high },
    { name: language === 'ar' ? 'متوسط' : 'Medium', value: stats.medium },
    { name: language === 'ar' ? 'منخفض' : 'Low', value: stats.low },
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'لوحة تحكم التذاكر' : 'Ticket Dashboard'}
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'إجمالي التذاكر' : 'Total Tickets'}
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'مفتوح' : 'Open'}
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <Badge variant="default" className="mt-2">
              {language === 'ar' ? 'تتطلب انتباه' : 'Needs Attention'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'قيد المعالجة' : 'In Progress'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'مغلق' : 'Closed'}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Priority & Purchase Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {language === 'ar' ? 'التذاكر حسب الأولوية' : 'Tickets by Priority'}
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'عاجل' : 'Urgent'}
                </span>
                <Badge variant="destructive">{stats.urgent}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'عالي' : 'High'}
                </span>
                <Badge variant="destructive">{stats.high}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'متوسط' : 'Medium'}
                </span>
                <Badge variant="default">{stats.medium}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {language === 'ar' ? 'منخفض' : 'Low'}
                </span>
                <Badge variant="secondary">{stats.low}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {language === 'ar' ? 'تذاكر المشتريات' : 'Purchase Tickets'}
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.purchase}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {language === 'ar' 
                ? `${((stats.purchase / stats.total) * 100 || 0).toFixed(1)}% من إجمالي التذاكر`
                : `${((stats.purchase / stats.total) * 100 || 0).toFixed(1)}% of total tickets`
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {language === 'ar' ? 'توزيع حالة التذاكر' : 'Ticket Status Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {language === 'ar' ? 'التذاكر حسب الأولوية' : 'Tickets by Priority'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Department Stats */}
      {departmentStats.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {language === 'ar' ? 'التذاكر حسب القسم' : 'Tickets by Department'}
            </CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={departmentStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department_name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="ticket_count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TicketDashboard;
