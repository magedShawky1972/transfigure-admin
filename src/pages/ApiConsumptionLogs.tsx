import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Eye, Activity, Clock, CheckCircle, XCircle, Trash2, ShieldX } from "lucide-react";
import { format } from "date-fns";

interface ApiLog {
  id: string;
  endpoint: string;
  method: string;
  request_body: any;
  response_status: number | null;
  response_message: string | null;
  success: boolean;
  execution_time_ms: number | null;
  source_ip: string | null;
  api_key_id: string | null;
  api_key_description: string | null;
  created_at: string;
}

interface ApiStats {
  total: number;
  success: number;
  failed: number;
  avgTime: number;
}

const ApiConsumptionLogs = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [stats, setStats] = useState<ApiStats>({ total: 0, success: 0, failed: 0, avgTime: 0 });
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");

  const endpoints = [
    "api-salesheader",
    "api-salesline",
    "api-payment",
    "api-customer",
    "api-supplier",
    "api-supplierproduct",
    "api-brand",
    "api-product",
    "api-zk-attendance",
  ];

  // Check user access permission
  useEffect(() => {
    const checkAccess = async () => {
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

        if (roles) {
          setHasAccess(true);
          return;
        }

        // Check specific permission - use same logic as AppSidebar (parent_menu is null)
        const { data: permissions, error: permError } = await supabase
          .from('user_permissions')
          .select('has_access, created_at')
          .eq('user_id', user.id)
          .eq('menu_item', 'apiConsumptionLogs')
          .is('parent_menu', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (permError) {
          console.error('Error checking permission:', permError);
          setHasAccess(false);
          return;
        }

        if (permissions && permissions.length > 0 && permissions[0].has_access) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      }
    };

    checkAccess();
  }, [navigate]);

  useEffect(() => {
    if (hasAccess) {
      fetchLogs();
    }
  }, [endpointFilter, statusFilter, dateFilter, hasAccess]);

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    switch (dateFilter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "week":
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start.setMonth(now.getMonth() - 1);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }
    
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      let query = supabase
        .from("api_consumption_logs")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);

      if (endpointFilter !== "all") {
        query = query.eq("endpoint", endpointFilter);
      }

      if (statusFilter === "success") {
        query = query.eq("success", true);
      } else if (statusFilter === "failed") {
        query = query.eq("success", false);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      calculateStats(data || []);
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

  const calculateStats = (data: ApiLog[]) => {
    const total = data.length;
    const success = data.filter(l => l.success).length;
    const failed = total - success;
    const avgTime = data.length > 0 
      ? Math.round(data.reduce((acc, l) => acc + (l.execution_time_ms || 0), 0) / data.length)
      : 0;

    setStats({ total, success, failed, avgTime });
  };

  const handleClearLogs = async () => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف جميع السجلات؟" : "Are you sure you want to delete all logs?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("api_consumption_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم الحذف" : "Cleared",
        description: language === "ar" ? "تم حذف جميع السجلات" : "All logs have been cleared",
      });

      fetchLogs();
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        log.endpoint.toLowerCase().includes(search) ||
        log.response_message?.toLowerCase().includes(search) ||
        log.api_key_description?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const viewLogDetails = (log: ApiLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  // Show loading state while checking access
  if (hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show Access Denied page
  if (hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldX className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-destructive">
          {language === "ar" ? "الوصول مرفوض" : "Access Denied"}
        </h1>
        <p className="text-muted-foreground text-center max-w-md">
          {language === "ar" 
            ? "ليس لديك صلاحية للوصول إلى هذه الصفحة. يرجى التواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ."
            : "You don't have permission to access this page. Please contact your system administrator if you believe this is an error."}
        </p>
        <Button onClick={() => navigate("/")} variant="outline">
          {language === "ar" ? "العودة للرئيسية" : "Go to Home"}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "سجلات استهلاك API" : "API Consumption Logs"}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="destructive" onClick={handleClearLogs}>
            <Trash2 className="h-4 w-4 mr-2" />
            {language === "ar" ? "مسح السجلات" : "Clear Logs"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "إجمالي الطلبات" : "Total Requests"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "ناجحة" : "Successful"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-green-600">{stats.success}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "فاشلة" : "Failed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold text-red-600">{stats.failed}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "متوسط الوقت" : "Avg. Time"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{stats.avgTime} ms</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث..." : "Search..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={endpointFilter} onValueChange={setEndpointFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === "ar" ? "نقطة النهاية" : "Endpoint"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "الكل" : "All Endpoints"}</SelectItem>
                {endpoints.map(ep => (
                  <SelectItem key={ep} value={ep}>{ep}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === "ar" ? "الحالة" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                <SelectItem value="success">{language === "ar" ? "ناجحة" : "Success"}</SelectItem>
                <SelectItem value="failed">{language === "ar" ? "فاشلة" : "Failed"}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === "ar" ? "الفترة" : "Period"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{language === "ar" ? "اليوم" : "Today"}</SelectItem>
                <SelectItem value="week">{language === "ar" ? "آخر أسبوع" : "Last Week"}</SelectItem>
                <SelectItem value="month">{language === "ar" ? "آخر شهر" : "Last Month"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="pt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                  <TableHead>{language === "ar" ? "نقطة النهاية" : "Endpoint"}</TableHead>
                  <TableHead>{language === "ar" ? "الطريقة" : "Method"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الوقت (ms)" : "Time (ms)"}</TableHead>
                  <TableHead>{language === "ar" ? "مفتاح API" : "API Key"}</TableHead>
                  <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد سجلات" : "No logs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.endpoint}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.method}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {log.response_status || 200}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            {log.response_status || "Error"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{log.execution_time_ms || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {log.api_key_description || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewLogDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تفاصيل الطلب" : "Request Details"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "نقطة النهاية" : "Endpoint"}
                  </label>
                  <p className="font-mono">{selectedLog.endpoint}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "الطريقة" : "Method"}
                  </label>
                  <p>{selectedLog.method}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "الوقت" : "Time"}
                  </label>
                  <p>{format(new Date(selectedLog.created_at), "yyyy-MM-dd HH:mm:ss")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "وقت التنفيذ" : "Execution Time"}
                  </label>
                  <p>{selectedLog.execution_time_ms || 0} ms</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "الحالة" : "Status"}
                  </label>
                  <p>
                    {selectedLog.success ? (
                      <Badge className="bg-green-100 text-green-800">Success</Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "كود الاستجابة" : "Response Code"}
                  </label>
                  <p>{selectedLog.response_status || "-"}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {language === "ar" ? "رسالة الاستجابة" : "Response Message"}
                </label>
                <p className="p-2 bg-muted rounded-md text-sm">
                  {selectedLog.response_message || "-"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  {language === "ar" ? "جسم الطلب" : "Request Body"}
                </label>
                <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-[300px]">
                  {selectedLog.request_body 
                    ? JSON.stringify(selectedLog.request_body, null, 2) 
                    : "-"}
                </pre>
              </div>

              {selectedLog.api_key_description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "مفتاح API" : "API Key"}
                  </label>
                  <p>{selectedLog.api_key_description}</p>
                </div>
              )}

              {selectedLog.source_ip && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === "ar" ? "عنوان IP" : "Source IP"}
                  </label>
                  <p className="font-mono">{selectedLog.source_ip}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiConsumptionLogs;
