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
  Filter
} from "lucide-react";

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

const AuditLogs = () => {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filters
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [limit, setLimit] = useState(100);

  const tables = [
    "user_email_configs",
    "profiles",
    "user_roles",
    "customers",
    "employees",
    "api_keys"
  ];

  const actions = ["INSERT", "UPDATE", "DELETE"];

  useEffect(() => {
    fetchLogs();
  }, [tableFilter, actionFilter, limit]);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
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