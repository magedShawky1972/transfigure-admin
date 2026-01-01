import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { 
  Shield, 
  Search, 
  RefreshCw, 
  Eye,
  FileText,
  UserPlus,
  Pencil,
  Trash2,
  Filter,
  Key,
  Lock,
  Bell,
  Settings,
  Plus,
  X,
  Save
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  user_id: string | null;
  user_email: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
}

interface PasswordAccessLog {
  id: string;
  user_id: string;
  user_email: string | null;
  accessed_table: string;
  accessed_record_id: string | null;
  access_type: string;
  created_at: string;
}

interface SecurityAlertConfig {
  id: string;
  alert_type: string;
  threshold: number;
  time_window_minutes: number;
  is_enabled: boolean;
  alert_recipients: string[];
}

const AuditLogs = () => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("audit");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [passwordLogs, setPasswordLogs] = useState<PasswordAccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filters
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(100);
  
  // Password logs filters
  const [passwordTableFilter, setPasswordTableFilter] = useState<string>("all");
  const [passwordSearchTerm, setPasswordSearchTerm] = useState("");
  const [passwordLimit, setPasswordLimit] = useState(100);
  
  // Alert settings
  const [alertConfigs, setAlertConfigs] = useState<SecurityAlertConfig[]>([]);
  const [alertLoading, setAlertLoading] = useState(true);
  const [savingAlert, setSavingAlert] = useState<string | null>(null);
  const [newRecipient, setNewRecipient] = useState<{ [key: string]: string }>({});

  const tables = [
    "user_email_configs",
    "profiles",
    "user_roles",
    "customers",
    "employees",
    "api_keys"
  ];

  const passwordTables = ["profiles", "user_email_configs", "user_emails"];

  const actions = ["INSERT", "UPDATE", "DELETE"];

  useEffect(() => {
    fetchLogs();
  }, [tableFilter, actionFilter, limit]);

  useEffect(() => {
    fetchPasswordLogs();
  }, [passwordTableFilter, passwordLimit]);

  useEffect(() => {
    fetchAlertConfigs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc("get_audit_logs", {
        p_table_name: tableFilter === "all" ? null : tableFilter,
        p_action: actionFilter === "all" ? null : actionFilter,
        p_limit: limit
      });

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPasswordLogs = async () => {
    try {
      setPasswordLoading(true);
      
      const { data, error } = await supabase.rpc("get_password_access_logs", {
        p_table_name: passwordTableFilter === "all" ? null : passwordTableFilter,
        p_limit: passwordLimit
      });

      if (error) throw error;
      setPasswordLogs((data as PasswordAccessLog[]) || []);
    } catch (error) {
      console.error("Error fetching password access logs:", error);
    } finally {
      setPasswordLoading(false);
    }
  };

  const fetchAlertConfigs = async () => {
    try {
      setAlertLoading(true);
      const { data, error } = await supabase
        .from("security_alert_config")
        .select("*")
        .order("alert_type");

      if (error) throw error;
      setAlertConfigs((data as SecurityAlertConfig[]) || []);
    } catch (error) {
      console.error("Error fetching alert configs:", error);
    } finally {
      setAlertLoading(false);
    }
  };

  const updateAlertConfig = async (config: SecurityAlertConfig) => {
    try {
      setSavingAlert(config.id);
      const { error } = await supabase
        .from("security_alert_config")
        .update({
          threshold: config.threshold,
          time_window_minutes: config.time_window_minutes,
          is_enabled: config.is_enabled,
          alert_recipients: config.alert_recipients
        })
        .eq("id", config.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم حفظ الإعدادات" : "Settings saved");
    } catch (error) {
      console.error("Error updating alert config:", error);
      toast.error(language === "ar" ? "فشل في حفظ الإعدادات" : "Failed to save settings");
    } finally {
      setSavingAlert(null);
    }
  };

  const addRecipient = (configId: string) => {
    const email = newRecipient[configId]?.trim();
    if (!email) return;
    
    setAlertConfigs(prev => prev.map(c => {
      if (c.id === configId && !c.alert_recipients.includes(email)) {
        return { ...c, alert_recipients: [...c.alert_recipients, email] };
      }
      return c;
    }));
    setNewRecipient(prev => ({ ...prev, [configId]: "" }));
  };

  const removeRecipient = (configId: string, email: string) => {
    setAlertConfigs(prev => prev.map(c => {
      if (c.id === configId) {
        return { ...c, alert_recipients: c.alert_recipients.filter(r => r !== email) };
      }
      return c;
    }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === "audit") {
      await fetchLogs();
    } else if (activeTab === "password") {
      await fetchPasswordLogs();
    } else {
      await fetchAlertConfigs();
    }
    setRefreshing(false);
  };

  const getAlertTypeName = (alertType: string) => {
    switch (alertType) {
      case "bulk_access":
        return language === "ar" ? "الوصول المكثف" : "Bulk Access";
      case "new_user_access":
        return language === "ar" ? "وصول مستخدم جديد" : "New User Access";
      case "after_hours_access":
        return language === "ar" ? "وصول خارج الدوام" : "After Hours Access";
      default:
        return alertType;
    }
  };

  const getAlertTypeDescription = (alertType: string) => {
    switch (alertType) {
      case "bulk_access":
        return language === "ar" 
          ? "تنبيه عندما يصل مستخدم لعدد كبير من كلمات المرور" 
          : "Alert when a user accesses many passwords";
      case "new_user_access":
        return language === "ar" 
          ? "تنبيه عندما يصل مستخدم جديد لكلمات المرور" 
          : "Alert when a new user accesses passwords";
      case "after_hours_access":
        return language === "ar" 
          ? "تنبيه للوصول خارج ساعات العمل" 
          : "Alert for access outside work hours";
      default:
        return "";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "INSERT":
        return <UserPlus className="h-4 w-4" />;
      case "UPDATE":
        return <Pencil className="h-4 w-4" />;
      case "DELETE":
        return <Trash2 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "INSERT":
        return "default";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const viewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(term) ||
      log.user_email?.toLowerCase().includes(term) ||
      log.record_id?.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term)
    );
  });

  const filteredPasswordLogs = passwordLogs.filter(log => {
    if (!passwordSearchTerm) return true;
    const term = passwordSearchTerm.toLowerCase();
    return (
      log.accessed_table.toLowerCase().includes(term) ||
      log.user_email?.toLowerCase().includes(term) ||
      log.accessed_record_id?.toLowerCase().includes(term)
    );
  });

  const renderJsonDiff = (oldData: unknown, newData: unknown) => {
    const oldObj = oldData as Record<string, unknown> | null;
    const newObj = newData as Record<string, unknown> | null;
    
    if (!oldObj && !newObj) return null;

    const allKeys = new Set([
      ...Object.keys(oldObj || {}),
      ...Object.keys(newObj || {})
    ]);

    return (
      <div className="space-y-2">
        {Array.from(allKeys).map(key => {
          const oldVal = oldObj?.[key];
          const newVal = newObj?.[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);

          return (
            <div key={key} className={`p-2 rounded text-sm ${changed ? "bg-muted" : ""}`}>
              <span className="font-medium text-muted-foreground">{key}:</span>
              {oldObj && newObj && changed ? (
                <div className="mt-1 space-y-1">
                  <div className="text-destructive line-through">
                    {JSON.stringify(oldVal, null, 2)}
                  </div>
                  <div className="text-primary">
                    {JSON.stringify(newVal, null, 2)}
                  </div>
                </div>
              ) : (
                <span className="ml-2">
                  {JSON.stringify(newVal ?? oldVal, null, 2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const getTableDisplayName = (tableName: string) => {
    switch (tableName) {
      case "profiles":
        return language === "ar" ? "الملفات الشخصية" : "Profiles";
      case "user_email_configs":
        return language === "ar" ? "إعدادات البريد" : "Email Configs";
      case "user_emails":
        return language === "ar" ? "بريد المستخدم" : "User Emails";
      default:
        return tableName;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {language === "ar" ? "سجلات التدقيق" : "Audit Logs"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" 
                ? "تتبع جميع التغييرات على البيانات الحساسة" 
                : "Track all changes to sensitive data"}
            </p>
          </div>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          <span className="ml-2">{language === "ar" ? "تحديث" : "Refresh"}</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {language === "ar" ? "سجلات التدقيق" : "Audit Logs"}
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            {language === "ar" ? "الوصول للكلمات السرية" : "Password Access"}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {language === "ar" ? "إعدادات التنبيه" : "Alert Settings"}
          </TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {language === "ar" ? "الفلاتر" : "Filters"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "بحث" : "Search"}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={language === "ar" ? "بحث..." : "Search..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "الجدول" : "Table"}</Label>
                  <Select value={tableFilter} onValueChange={setTableFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {language === "ar" ? "الكل" : "All Tables"}
                      </SelectItem>
                      {tables.map(table => (
                        <SelectItem key={table} value={table}>
                          {table}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "العملية" : "Action"}</Label>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {language === "ar" ? "الكل" : "All Actions"}
                      </SelectItem>
                      {actions.map(action => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "عدد السجلات" : "Limit"}</Label>
                  <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="250">250</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "التاريخ" : "Timestamp"}</TableHead>
                      <TableHead>{language === "ar" ? "الجدول" : "Table"}</TableHead>
                      <TableHead>{language === "ar" ? "العملية" : "Action"}</TableHead>
                      <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                      <TableHead>{language === "ar" ? "معرف السجل" : "Record ID"}</TableHead>
                      <TableHead className="text-center">{language === "ar" ? "تفاصيل" : "Details"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {language === "ar" ? "لا توجد سجلات" : "No audit logs found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.table_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={getActionBadgeVariant(log.action) as "default" | "secondary" | "destructive" | "outline"}
                              className="flex items-center gap-1 w-fit"
                            >
                              {getActionIcon(log.action)}
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.user_email || (
                              <span className="text-muted-foreground italic">
                                {language === "ar" ? "غير معروف" : "Unknown"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.record_id?.substring(0, 8)}...
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => viewDetails(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Password Access Logs Tab */}
        <TabsContent value="password" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {language === "ar" ? "الفلاتر" : "Filters"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "بحث" : "Search"}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={language === "ar" ? "بحث بالبريد..." : "Search by email..."}
                      value={passwordSearchTerm}
                      onChange={(e) => setPasswordSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "المصدر" : "Source Table"}</Label>
                  <Select value={passwordTableFilter} onValueChange={setPasswordTableFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {language === "ar" ? "الكل" : "All Sources"}
                      </SelectItem>
                      {passwordTables.map(table => (
                        <SelectItem key={table} value={table}>
                          {getTableDisplayName(table)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ar" ? "عدد السجلات" : "Limit"}</Label>
                  <Select value={passwordLimit.toString()} onValueChange={(v) => setPasswordLimit(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="250">250</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Access Logs Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-orange-500" />
                {language === "ar" ? "سجل الوصول لكلمات المرور" : "Password Access Log"}
                <Badge variant="secondary" className="ml-2">
                  {filteredPasswordLogs.length} {language === "ar" ? "سجل" : "records"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[550px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "التاريخ" : "Timestamp"}</TableHead>
                      <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                      <TableHead>{language === "ar" ? "المصدر" : "Source"}</TableHead>
                      <TableHead>{language === "ar" ? "معرف السجل" : "Record ID"}</TableHead>
                      <TableHead>{language === "ar" ? "نوع الوصول" : "Access Type"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {passwordLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredPasswordLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {language === "ar" ? "لا توجد سجلات وصول" : "No password access logs found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPasswordLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.user_email || (
                              <span className="text-muted-foreground italic">
                                {language === "ar" ? "غير معروف" : "Unknown"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              <Key className="h-3 w-3" />
                              {getTableDisplayName(log.accessed_table)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.accessed_record_id?.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                              <Lock className="h-3 w-3" />
                              {log.access_type}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Settings Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-orange-500" />
                {language === "ar" ? "إعدادات تنبيهات الأمان" : "Security Alert Settings"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {alertLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : alertConfigs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {language === "ar" ? "لا توجد إعدادات" : "No alert configurations found"}
                </p>
              ) : (
                alertConfigs.map(config => (
                  <Card key={config.id} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={config.is_enabled}
                            onCheckedChange={(checked) => {
                              setAlertConfigs(prev => prev.map(c => 
                                c.id === config.id ? { ...c, is_enabled: checked } : c
                              ));
                            }}
                          />
                          <div>
                            <CardTitle className="text-base">
                              {getAlertTypeName(config.alert_type)}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {getAlertTypeDescription(config.alert_type)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => updateAlertConfig(config)}
                          disabled={savingAlert === config.id}
                        >
                          {savingAlert === config.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          <span className="ml-2">{language === "ar" ? "حفظ" : "Save"}</span>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "الحد الأدنى" : "Threshold"}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={config.threshold}
                            onChange={(e) => {
                              setAlertConfigs(prev => prev.map(c => 
                                c.id === config.id ? { ...c, threshold: parseInt(e.target.value) || 1 } : c
                              ));
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "النافذة الزمنية (دقائق)" : "Time Window (minutes)"}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={config.time_window_minutes}
                            onChange={(e) => {
                              setAlertConfigs(prev => prev.map(c => 
                                c.id === config.id ? { ...c, time_window_minutes: parseInt(e.target.value) || 60 } : c
                              ));
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "مستلمو التنبيه" : "Alert Recipients"}</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {config.alert_recipients.map(email => (
                            <Badge key={email} variant="secondary" className="flex items-center gap-1">
                              {email}
                              <button
                                onClick={() => removeRecipient(config.id, email)}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                          {config.alert_recipients.length === 0 && (
                            <span className="text-sm text-muted-foreground italic">
                              {language === "ar" ? "لا يوجد مستلمون" : "No recipients configured"}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            placeholder={language === "ar" ? "أدخل البريد الإلكتروني" : "Enter email address"}
                            value={newRecipient[config.id] || ""}
                            onChange={(e) => setNewRecipient(prev => ({ ...prev, [config.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addRecipient(config.id);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => addRecipient(config.id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {language === "ar" ? "معلومات النظام" : "System Information"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  {language === "ar" 
                    ? "• يتم فحص الأنماط غير الطبيعية كل ساعة"
                    : "• Anomaly detection runs every hour"}
                </p>
                <p>
                  {language === "ar"
                    ? "• يتم إرسال التنبيهات عبر البريد الإلكتروني فقط"
                    : "• Alerts are sent via email only"}
                </p>
                <p>
                  {language === "ar"
                    ? "• لن يتم إرسال تنبيهات متكررة لنفس الحدث خلال ساعة"
                    : "• Duplicate alerts for the same event are suppressed for 1 hour"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {language === "ar" ? "تفاصيل سجل التدقيق" : "Audit Log Details"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "ar" ? "التاريخ" : "Timestamp"}
                    </Label>
                    <p className="font-mono">
                      {format(new Date(selectedLog.created_at), "yyyy-MM-dd HH:mm:ss")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "ar" ? "العملية" : "Action"}
                    </Label>
                    <Badge 
                      variant={getActionBadgeVariant(selectedLog.action) as "default" | "secondary" | "destructive" | "outline"}
                      className="flex items-center gap-1 w-fit mt-1"
                    >
                      {getActionIcon(selectedLog.action)}
                      {selectedLog.action}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "ar" ? "الجدول" : "Table"}
                    </Label>
                    <p>{selectedLog.table_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {language === "ar" ? "معرف السجل" : "Record ID"}
                    </Label>
                    <p className="font-mono text-sm">{selectedLog.record_id}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">
                      {language === "ar" ? "المستخدم" : "User"}
                    </Label>
                    <p>{selectedLog.user_email || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {selectedLog.user_id}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="text-muted-foreground mb-2 block">
                    {language === "ar" ? "التغييرات" : "Changes"}
                  </Label>
                  {renderJsonDiff(selectedLog.old_data, selectedLog.new_data)}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogs;