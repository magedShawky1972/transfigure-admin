import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, Eye, Users, Clock, TrendingUp, Activity, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

interface PasswordAccessLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  created_at: string;
  record_id: string | null;
}

interface AlertHistory {
  id: string;
  alert_type: string;
  details: Record<string, unknown>;
  sent_at: string;
  user_id: string;
}

interface AccessPattern {
  date: string;
  count: number;
}

interface UserAccessSummary {
  user_email: string;
  access_count: number;
  last_access: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

const SecurityDashboard = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");
  const [accessLogs, setAccessLogs] = useState<PasswordAccessLog[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([]);
  const [dailyPatterns, setDailyPatterns] = useState<AccessPattern[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserAccessSummary[]>([]);
  const [stats, setStats] = useState({
    totalAccesses: 0,
    uniqueUsers: 0,
    alertsSent: 0,
    avgAccessesPerDay: 0,
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    const days = parseInt(dateRange);
    const fromDate = startOfDay(subDays(new Date(), days));
    const toDate = endOfDay(new Date());

    await Promise.all([
      fetchAccessLogs(fromDate, toDate),
      fetchAlertHistory(fromDate, toDate),
      fetchDailyPatterns(fromDate, toDate),
      fetchUserSummaries(fromDate, toDate),
    ]);

    setLoading(false);
  };

  const fetchAccessLogs = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'stored_passwords')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const logs: PasswordAccessLog[] = (data || []).map(log => ({
        id: log.id,
        user_id: log.user_id || '',
        user_email: log.user_email || 'Unknown',
        action: log.action,
        created_at: log.created_at,
        record_id: log.record_id,
      }));

      setAccessLogs(logs);

      // Calculate stats
      const uniqueUsers = new Set(logs.map(l => l.user_id)).size;
      const totalAccesses = logs.length;
      const days = parseInt(dateRange);
      const avgAccessesPerDay = totalAccesses / days;

      setStats(prev => ({
        ...prev,
        totalAccesses,
        uniqueUsers,
        avgAccessesPerDay: Math.round(avgAccessesPerDay * 10) / 10,
      }));
    } catch (error) {
      console.error('Error fetching access logs:', error);
    }
  };

  const fetchAlertHistory = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('security_alerts_sent')
        .select('*')
        .gte('sent_at', fromDate.toISOString())
        .lte('sent_at', toDate.toISOString())
        .order('sent_at', { ascending: false });

      if (error) throw error;

      const alerts: AlertHistory[] = (data || []).map(alert => ({
        id: alert.id,
        alert_type: alert.alert_type,
        details: typeof alert.details === 'object' && alert.details !== null ? alert.details as Record<string, unknown> : {},
        sent_at: alert.sent_at,
        user_id: alert.user_id,
      }));

      setAlertHistory(alerts);
      setStats(prev => ({ ...prev, alertsSent: alerts.length }));
    } catch (error) {
      console.error('Error fetching alert history:', error);
    }
  };

  const fetchDailyPatterns = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('table_name', 'stored_passwords')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (error) throw error;

      // Group by date
      const dateMap = new Map<string, number>();
      (data || []).forEach(log => {
        const date = format(new Date(log.created_at), 'yyyy-MM-dd');
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });

      // Fill in missing dates
      const patterns: AccessPattern[] = [];
      const days = parseInt(dateRange);
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        patterns.push({
          date: format(subDays(new Date(), i), 'MMM dd'),
          count: dateMap.get(date) || 0,
        });
      }

      setDailyPatterns(patterns);
    } catch (error) {
      console.error('Error fetching daily patterns:', error);
    }
  };

  const fetchUserSummaries = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('user_email, created_at')
        .eq('table_name', 'stored_passwords')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (error) throw error;

      // Group by user
      const userMap = new Map<string, { count: number; lastAccess: string }>();
      (data || []).forEach(log => {
        const email = log.user_email || 'Unknown';
        const existing = userMap.get(email);
        if (existing) {
          existing.count++;
          if (new Date(log.created_at) > new Date(existing.lastAccess)) {
            existing.lastAccess = log.created_at;
          }
        } else {
          userMap.set(email, { count: 1, lastAccess: log.created_at });
        }
      });

      const summaries: UserAccessSummary[] = Array.from(userMap.entries())
        .map(([email, data]) => ({
          user_email: email,
          access_count: data.count,
          last_access: data.lastAccess,
        }))
        .sort((a, b) => b.access_count - a.access_count)
        .slice(0, 10);

      setUserSummaries(summaries);
    } catch (error) {
      console.error('Error fetching user summaries:', error);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'SELECT':
        return <Badge variant="secondary">{language === 'ar' ? 'عرض' : 'View'}</Badge>;
      case 'INSERT':
        return <Badge className="bg-green-500">{language === 'ar' ? 'إنشاء' : 'Create'}</Badge>;
      case 'UPDATE':
        return <Badge className="bg-amber-500">{language === 'ar' ? 'تعديل' : 'Update'}</Badge>;
      case 'DELETE':
        return <Badge variant="destructive">{language === 'ar' ? 'حذف' : 'Delete'}</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const getAlertTypeBadge = (type: string) => {
    switch (type) {
      case 'bulk_access':
        return <Badge variant="destructive">{language === 'ar' ? 'وصول مجمع' : 'Bulk Access'}</Badge>;
      case 'new_user_access':
        return <Badge className="bg-amber-500">{language === 'ar' ? 'مستخدم جديد' : 'New User'}</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const chartConfig = {
    count: {
      label: language === 'ar' ? 'عدد الوصول' : 'Access Count',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            {language === 'ar' ? 'لوحة الأمان' : 'Security Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'مراقبة أنماط الوصول لكلمات المرور وسجل التنبيهات في الوقت الفعلي'
              : 'Monitor password access patterns and alert history in real-time'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{language === 'ar' ? 'آخر 7 أيام' : 'Last 7 days'}</SelectItem>
              <SelectItem value="14">{language === 'ar' ? 'آخر 14 يوم' : 'Last 14 days'}</SelectItem>
              <SelectItem value="30">{language === 'ar' ? 'آخر 30 يوم' : 'Last 30 days'}</SelectItem>
              <SelectItem value="90">{language === 'ar' ? 'آخر 90 يوم' : 'Last 90 days'}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'إجمالي الوصول' : 'Total Accesses'}
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAccesses}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' ? `في آخر ${dateRange} أيام` : `In last ${dateRange} days`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'المستخدمين النشطين' : 'Active Users'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' ? 'مستخدمين فريدين' : 'Unique users'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'التنبيهات المرسلة' : 'Alerts Sent'}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.alertsSent}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' ? 'تنبيهات أمنية' : 'Security alerts'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'متوسط الوصول اليومي' : 'Avg. Daily Access'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgAccessesPerDay}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' ? 'وصول في اليوم' : 'Accesses per day'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {language === 'ar' ? 'نمط الوصول اليومي' : 'Daily Access Pattern'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'عدد مرات الوصول لكلمات المرور يومياً' : 'Password access count per day'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyPatterns}>
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {language === 'ar' ? 'أكثر المستخدمين وصولاً' : 'Top Users by Access'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'المستخدمين الأكثر وصولاً لكلمات المرور' : 'Users with most password accesses'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userSummaries.slice(0, 5).map((user, index) => (
                <div key={user.user_email} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.user_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'آخر وصول:' : 'Last access:'} {format(new Date(user.last_access), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{user.access_count}</Badge>
                </div>
              ))}
              {userSummaries.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  {language === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed data */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList>
          <TabsTrigger value="logs">
            <Eye className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'سجل الوصول' : 'Access Logs'}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'سجل التنبيهات' : 'Alert History'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'سجل الوصول الأخير لكلمات المرور' : 'Recent Password Access Logs'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'آخر 100 سجل وصول' : 'Last 100 access records'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الإجراء' : 'Action'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الوقت' : 'Time'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.user_email}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {accessLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {language === 'ar' ? 'لا توجد سجلات' : 'No logs found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'سجل التنبيهات الأمنية' : 'Security Alert History'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'التنبيهات الأمنية المرسلة' : 'Security alerts that have been sent'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'نوع التنبيه' : 'Alert Type'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{language === 'ar' ? 'وقت الإرسال' : 'Sent At'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التفاصيل' : 'Details'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertHistory.map(alert => (
                    <TableRow key={alert.id}>
                      <TableCell>{getAlertTypeBadge(alert.alert_type)}</TableCell>
                      <TableCell className="text-sm">{alert.user_id}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(alert.sent_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(alert.details)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {alertHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {language === 'ar' ? 'لم يتم إرسال تنبيهات بعد' : 'No alerts have been sent yet'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;
