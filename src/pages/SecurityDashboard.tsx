import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, Eye, Users, Clock, TrendingUp, Activity, RefreshCw, Smartphone, Monitor, LogIn } from "lucide-react";
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

interface DeviceActivation {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  device_name: string;
  device_info: Record<string, unknown>;
  activated_at: string;
  last_login_at: string;
  is_active: boolean;
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
  devices: number;
}

interface UserAccessSummary {
  user_email: string;
  user_name: string;
  access_count: number;
  device_count: number;
  last_access: string;
}

interface LoginHistoryRecord {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  login_at: string;
  logout_at: string | null;
  session_duration_minutes: number | null;
  device_name: string | null;
  device_info: Record<string, unknown>;
  is_active: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

const SecurityDashboard = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7");
  const [accessLogs, setAccessLogs] = useState<PasswordAccessLog[]>([]);
  const [deviceActivations, setDeviceActivations] = useState<DeviceActivation[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryRecord[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([]);
  const [dailyPatterns, setDailyPatterns] = useState<AccessPattern[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserAccessSummary[]>([]);
  const [stats, setStats] = useState({
    totalAccesses: 0,
    uniqueUsers: 0,
    deviceActivations: 0,
    loginSessions: 0,
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
      fetchDeviceActivations(fromDate, toDate),
      fetchLoginHistory(fromDate, toDate),
      fetchAlertHistory(fromDate, toDate),
      fetchDailyPatterns(fromDate, toDate),
      fetchUserSummaries(fromDate, toDate),
    ]);

    setLoading(false);
  };

  const fetchAccessLogs = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('password_access_logs')
        .select('*')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const logs: PasswordAccessLog[] = (data || []).map(log => ({
        id: log.id,
        user_id: log.user_id || '',
        user_email: log.user_email || 'Unknown',
        action: log.access_type || 'ACCESS',
        created_at: log.created_at,
        record_id: log.accessed_record_id,
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

  const fetchDeviceActivations = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('user_device_activations')
        .select(`
          id,
          user_id,
          device_name,
          device_info,
          activated_at,
          last_login_at,
          is_active,
          profiles!user_device_activations_user_id_fkey(user_name, email)
        `)
        .gte('activated_at', fromDate.toISOString())
        .lte('activated_at', toDate.toISOString())
        .order('activated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const activations: DeviceActivation[] = (data || []).map(d => ({
        id: d.id,
        user_id: d.user_id || '',
        user_email: (d.profiles as any)?.email || 'Unknown',
        user_name: (d.profiles as any)?.user_name || 'Unknown',
        device_name: d.device_name || 'Unknown Device',
        device_info: typeof d.device_info === 'object' && d.device_info !== null ? d.device_info as Record<string, unknown> : {},
        activated_at: d.activated_at,
        last_login_at: d.last_login_at,
        is_active: d.is_active,
      }));

      setDeviceActivations(activations);

      // Update stats with device activations count
      const uniqueDeviceUsers = new Set(activations.map(a => a.user_id)).size;
      setStats(prev => ({
        ...prev,
        deviceActivations: activations.length,
        uniqueUsers: Math.max(prev.uniqueUsers, uniqueDeviceUsers),
      }));
    } catch (error) {
      console.error('Error fetching device activations:', error);
    }
  };

  const fetchLoginHistory = async (fromDate: Date, toDate: Date) => {
    try {
      const { data, error } = await supabase
        .from('login_history')
        .select(`
          id,
          user_id,
          login_at,
          logout_at,
          session_duration_minutes,
          device_name,
          device_info,
          is_active
        `)
        .gte('login_at', fromDate.toISOString())
        .lte('login_at', toDate.toISOString())
        .order('login_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch user profiles for the login records
      const userIds = [...new Set((data || []).map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, user_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const history: LoginHistoryRecord[] = (data || []).map(d => {
        const profile = profileMap.get(d.user_id);
        return {
          id: d.id,
          user_id: d.user_id,
          user_name: profile?.user_name || 'Unknown',
          user_email: profile?.email || 'Unknown',
          login_at: d.login_at,
          logout_at: d.logout_at,
          session_duration_minutes: d.session_duration_minutes,
          device_name: d.device_name,
          device_info: typeof d.device_info === 'object' && d.device_info !== null ? d.device_info as Record<string, unknown> : {},
          is_active: d.is_active,
        };
      });

      setLoginHistory(history);
      setStats(prev => ({ ...prev, loginSessions: history.length }));
    } catch (error) {
      console.error('Error fetching login history:', error);
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
      // Fetch device activations for patterns
      const { data: deviceData, error: deviceError } = await supabase
        .from('user_device_activations')
        .select('activated_at, last_login_at')
        .gte('activated_at', fromDate.toISOString())
        .lte('activated_at', toDate.toISOString());

      // Fetch password access logs
      const { data: accessData, error: accessError } = await supabase
        .from('password_access_logs')
        .select('created_at')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (deviceError) throw deviceError;
      if (accessError) throw accessError;

      // Group by date
      const dateMap = new Map<string, { accesses: number; devices: number }>();
      
      (accessData || []).forEach(log => {
        const date = format(new Date(log.created_at), 'yyyy-MM-dd');
        const existing = dateMap.get(date) || { accesses: 0, devices: 0 };
        existing.accesses++;
        dateMap.set(date, existing);
      });

      (deviceData || []).forEach(d => {
        const date = format(new Date(d.activated_at), 'yyyy-MM-dd');
        const existing = dateMap.get(date) || { accesses: 0, devices: 0 };
        existing.devices++;
        dateMap.set(date, existing);
      });

      // Fill in missing dates
      const patterns: AccessPattern[] = [];
      const days = parseInt(dateRange);
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const data = dateMap.get(date) || { accesses: 0, devices: 0 };
        patterns.push({
          date: format(subDays(new Date(), i), 'MMM dd'),
          count: data.accesses + data.devices,
          devices: data.devices,
        });
      }

      setDailyPatterns(patterns);
    } catch (error) {
      console.error('Error fetching daily patterns:', error);
    }
  };

  const fetchUserSummaries = async (fromDate: Date, toDate: Date) => {
    try {
      // Fetch device activations with user info
      const { data: deviceData, error: deviceError } = await supabase
        .from('user_device_activations')
        .select(`
          user_id,
          activated_at,
          last_login_at,
          profiles!user_device_activations_user_id_fkey(user_name, email)
        `)
        .gte('activated_at', fromDate.toISOString())
        .lte('activated_at', toDate.toISOString());

      // Fetch password access logs
      const { data: accessData, error: accessError } = await supabase
        .from('password_access_logs')
        .select('user_id, user_email, created_at')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (deviceError) throw deviceError;
      if (accessError) throw accessError;

      // Group by user
      const userMap = new Map<string, { 
        user_name: string; 
        user_email: string;
        accessCount: number; 
        deviceCount: number;
        lastAccess: string 
      }>();
      
      (deviceData || []).forEach(d => {
        const email = (d.profiles as any)?.email || 'Unknown';
        const userName = (d.profiles as any)?.user_name || 'Unknown';
        const existing = userMap.get(email);
        const loginTime = d.last_login_at || d.activated_at;
        
        if (existing) {
          existing.deviceCount++;
          if (new Date(loginTime) > new Date(existing.lastAccess)) {
            existing.lastAccess = loginTime;
          }
        } else {
          userMap.set(email, { 
            user_name: userName,
            user_email: email,
            accessCount: 0, 
            deviceCount: 1, 
            lastAccess: loginTime 
          });
        }
      });

      (accessData || []).forEach(log => {
        const email = log.user_email || 'Unknown';
        const existing = userMap.get(email);
        if (existing) {
          existing.accessCount++;
          if (new Date(log.created_at) > new Date(existing.lastAccess)) {
            existing.lastAccess = log.created_at;
          }
        } else {
          userMap.set(email, { 
            user_name: email.split('@')[0],
            user_email: email,
            accessCount: 1, 
            deviceCount: 0, 
            lastAccess: log.created_at 
          });
        }
      });

      const summaries: UserAccessSummary[] = Array.from(userMap.values())
        .map(data => ({
          user_email: data.user_email,
          user_name: data.user_name,
          access_count: data.accessCount + data.deviceCount,
          device_count: data.deviceCount,
          last_access: data.lastAccess,
        }))
        .sort((a, b) => b.access_count - a.access_count)
        .slice(0, 10);

      setUserSummaries(summaries);
      
      // Update unique users stat
      setStats(prev => ({
        ...prev,
        uniqueUsers: userMap.size,
      }));
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
              ? 'مراقبة الأجهزة المفعلة ونشاط المستخدمين في الوقت الفعلي'
              : 'Monitor device activations and user activity in real-time'}
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
              {language === 'ar' ? 'الأجهزة المفعلة' : 'Device Activations'}
            </CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deviceActivations}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'ar' ? 'أجهزة جديدة' : 'New devices'}
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
              {language === 'ar' ? 'أكثر المستخدمين نشاطاً' : 'Top Active Users'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' ? 'المستخدمين الأكثر نشاطاً مع أجهزتهم' : 'Most active users with their devices'}
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
                      <p className="text-sm font-medium">{user.user_name}</p>
                      <p className="text-xs text-muted-foreground">{user.user_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' ? 'آخر نشاط:' : 'Last activity:'} {format(new Date(user.last_access), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Smartphone className="h-3 w-3" />
                      {user.device_count}
                    </Badge>
                    <Badge variant="secondary">{user.access_count}</Badge>
                  </div>
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
      <Tabs defaultValue="devices" className="w-full">
        <TabsList>
          <TabsTrigger value="devices">
            <Smartphone className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'الأجهزة المفعلة' : 'Device Activations'}
          </TabsTrigger>
          <TabsTrigger value="logins">
            <LogIn className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'سجل تسجيل الدخول' : 'Login History'}
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Eye className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'سجل كلمات المرور' : 'Password Logs'}
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'التنبيهات' : 'Alerts'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'الأجهزة المفعلة حديثاً' : 'Recent Device Activations'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'الأجهزة التي تم تفعيلها مؤخراً' : 'Devices that have been recently activated'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الجهاز' : 'Device'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المنصة' : 'Platform'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ التفعيل' : 'Activated'}</TableHead>
                    <TableHead>{language === 'ar' ? 'آخر دخول' : 'Last Login'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deviceActivations.map(device => (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{device.user_name}</p>
                          <p className="text-xs text-muted-foreground">{device.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {device.device_name.includes('iPhone') || device.device_name.includes('Android') ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <Monitor className="h-4 w-4" />
                          )}
                          {device.device_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(device.device_info as any)?.platform || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(device.activated_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(device.last_login_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell>
                        {device.is_active ? (
                          <Badge className="bg-green-500">{language === 'ar' ? 'نشط' : 'Active'}</Badge>
                        ) : (
                          <Badge variant="secondary">{language === 'ar' ? 'غير نشط' : 'Inactive'}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {deviceActivations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {language === 'ar' ? 'لا توجد أجهزة مفعلة' : 'No device activations found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'سجل تسجيل الدخول' : 'Login History'}</CardTitle>
              <CardDescription>
                {language === 'ar' ? 'سجل جلسات تسجيل الدخول ومدة البقاء' : 'Login sessions and session duration tracking'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'المستخدم' : 'User'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الجهاز' : 'Device'}</TableHead>
                    <TableHead>{language === 'ar' ? 'وقت الدخول' : 'Login Time'}</TableHead>
                    <TableHead>{language === 'ar' ? 'وقت الخروج' : 'Logout Time'}</TableHead>
                    <TableHead>{language === 'ar' ? 'مدة الجلسة' : 'Session Duration'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginHistory.map(login => (
                    <TableRow key={login.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{login.user_name}</p>
                          <p className="text-xs text-muted-foreground">{login.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {login.device_name?.includes('iPhone') || login.device_name?.includes('Android') ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <Monitor className="h-4 w-4" />
                          )}
                          <span className="text-sm">{login.device_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(login.login_at), 'yyyy-MM-dd HH:mm')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {login.logout_at ? format(new Date(login.logout_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        {login.session_duration_minutes !== null ? (
                          <span className="font-medium">
                            {login.session_duration_minutes >= 60 
                              ? `${Math.floor(login.session_duration_minutes / 60)}h ${login.session_duration_minutes % 60}m`
                              : `${login.session_duration_minutes}m`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {login.is_active ? (
                          <Badge className="bg-green-500">{language === 'ar' ? 'نشط' : 'Active'}</Badge>
                        ) : (
                          <Badge variant="secondary">{language === 'ar' ? 'منتهي' : 'Ended'}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {loginHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {language === 'ar' ? 'لا توجد سجلات تسجيل دخول' : 'No login history found'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'سجل الوصول لكلمات المرور' : 'Password Access Logs'}</CardTitle>
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
