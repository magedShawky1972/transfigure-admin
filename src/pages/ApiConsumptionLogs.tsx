import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
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
 import { RefreshCw, Search, Eye, Activity, Clock, CheckCircle, XCircle, Trash2, Send, Loader2, RotateCcw, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  totalValue: number;
}

// Helper function to extract Order Number from request_body - defined outside component to avoid initialization issues
const getOrderNumber = (log: ApiLog): string => {
  if (!log.request_body) return "";
  const body = log.request_body as any;
  // Check for Order_Number (salesheader) or order_number
  return String(body.Order_Number || body.order_number || "");
};

const ApiConsumptionLogs = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ApiStats>({ total: 0, success: 0, failed: 0, avgTime: 0, totalValue: 0 });
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);
  const [retryProgress, setRetryProgress] = useState({ current: 0, total: 0 });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Column filters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    orderNumber: "",
    endpoint: "",
    method: "",
    status: "",
    executionTime: "",
    apiKey: "",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);

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

  useEffect(() => {
    if (hasAccess) {
      fetchLogs();
    }
  }, [endpointFilter, statusFilter, dateFilter, customDate, hasAccess, currentPage, pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [endpointFilter, statusFilter, dateFilter, customDate, searchTerm]);

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    
    switch (dateFilter) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(start);
        yesterdayEnd.setHours(23, 59, 59, 999);
        return { start: start.toISOString(), end: yesterdayEnd.toISOString() };
      case "week":
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start.setMonth(now.getMonth() - 1);
        break;
      case "custom":
        if (customDate) {
          const customStart = new Date(customDate);
          customStart.setHours(0, 0, 0, 0);
          const customEnd = new Date(customDate);
          customEnd.setHours(23, 59, 59, 999);
          return { start: customStart.toISOString(), end: customEnd.toISOString() };
        }
        start.setHours(0, 0, 0, 0);
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
      
      // Calculate pagination offset
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Fetch logs with pagination
      let logsQuery = supabase
        .from("api_consumption_logs")
        .select("*", { count: "exact" })
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (endpointFilter !== "all") {
        logsQuery = logsQuery.eq("endpoint", endpointFilter);
      }

      if (statusFilter === "success") {
        logsQuery = logsQuery.eq("success", true);
      } else if (statusFilter === "failed") {
        logsQuery = logsQuery.eq("success", false);
      }

      // Fetch count queries for accurate stats (no limit)
      let totalCountQuery = supabase
        .from("api_consumption_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end);

      let successCountQuery = supabase
        .from("api_consumption_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("success", true);

      let failedCountQuery = supabase
        .from("api_consumption_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end)
        .eq("success", false);

      // Query for api-salesline logs to calculate total value
      let saleslineQuery = supabase
        .from("api_consumption_logs")
        .select("request_body")
        .eq("endpoint", "api-salesline")
        .eq("success", true)
        .gte("created_at", start)
        .lte("created_at", end);

      // Apply endpoint filter to count queries if selected
      if (endpointFilter !== "all") {
        totalCountQuery = totalCountQuery.eq("endpoint", endpointFilter);
        successCountQuery = successCountQuery.eq("endpoint", endpointFilter);
        failedCountQuery = failedCountQuery.eq("endpoint", endpointFilter);
      }

      // Execute all queries in parallel
      const [logsResult, totalResult, successResult, failedResult, saleslineResult] = await Promise.all([
        logsQuery,
        totalCountQuery,
        successCountQuery,
        failedCountQuery,
        saleslineQuery,
      ]);

      if (logsResult.error) throw logsResult.error;

      const data = logsResult.data || [];
      setLogs(data);
      setTotalRecords(logsResult.count || 0);
      
      // Calculate avg time from fetched data
      const avgTime = data.length > 0 
        ? Math.round(data.reduce((acc, l) => acc + (l.execution_time_ms || 0), 0) / data.length)
        : 0;

      // Calculate total value from api-salesline logs
      let totalValue = 0;
      if (saleslineResult.data) {
        totalValue = saleslineResult.data.reduce((acc, log) => {
          const requestBody = log.request_body as any;
          const total = parseFloat(requestBody?.Total) || 0;
          return acc + total;
        }, 0);
      }

      setStats({
        total: totalResult.count || 0,
        success: successResult.count || 0,
        failed: failedResult.count || 0,
        avgTime,
        totalValue,
      });
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
      const matchesSearch = (
        log.endpoint.toLowerCase().includes(search) ||
        log.response_message?.toLowerCase().includes(search) ||
        log.api_key_description?.toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Apply column filters
    const orderNumber = getOrderNumber(log);
    
    if (columnFilters.orderNumber && orderNumber) {
      if (!orderNumber.toLowerCase().includes(columnFilters.orderNumber.toLowerCase())) {
        return false;
      }
    }
    
    if (columnFilters.endpoint && !log.endpoint.toLowerCase().includes(columnFilters.endpoint.toLowerCase())) {
      return false;
    }
    
    if (columnFilters.method && !log.method.toLowerCase().includes(columnFilters.method.toLowerCase())) {
      return false;
    }
    
    if (columnFilters.apiKey && log.api_key_description && !log.api_key_description.toLowerCase().includes(columnFilters.apiKey.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Sorted logs
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case "created_at":
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case "orderNumber":
        aValue = parseInt(getOrderNumber(a)) || 0;
        bValue = parseInt(getOrderNumber(b)) || 0;
        break;
      case "endpoint":
        aValue = a.endpoint.toLowerCase();
        bValue = b.endpoint.toLowerCase();
        break;
      case "method":
        aValue = a.method.toLowerCase();
        bValue = b.method.toLowerCase();
        break;
      case "status":
        aValue = a.success ? 1 : 0;
        bValue = b.success ? 1 : 0;
        break;
      case "executionTime":
        aValue = a.execution_time_ms || 0;
        bValue = b.execution_time_ms || 0;
        break;
      case "apiKey":
        aValue = (a.api_key_description || "").toLowerCase();
        bValue = (b.api_key_description || "").toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <div
      className="flex items-center gap-1 cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(column)}
    >
      {children}
      {sortColumn === column ? (
        sortDirection === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </div>
  );

  const ColumnFilterInput = ({ column, placeholder }: { column: string; placeholder: string }) => (
    <Input
      placeholder={placeholder}
      value={columnFilters[column] || ""}
      onChange={(e) => setColumnFilters(prev => ({ ...prev, [column]: e.target.value }))}
      className="h-7 text-xs mt-1"
    />
  );

  const viewLogDetails = (log: ApiLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const resendRequest = async (log: ApiLog) => {
    if (!log.request_body) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "لا يوجد بيانات للإرسال" : "No request body to send",
        variant: "destructive",
      });
      return;
    }

    if (!log.api_key_id) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "لا يوجد مفتاح API للإرسال" : "No API key associated with this request",
        variant: "destructive",
      });
      return;
    }

    setResending(log.id);
    try {
      // Fetch the API key from the database
      const { data: apiKeyData, error: apiKeyError } = await supabase
        .from("api_keys")
        .select("api_key")
        .eq("id", log.api_key_id)
        .single();

      if (apiKeyError || !apiKeyData) {
        throw new Error(language === "ar" ? "تعذر جلب مفتاح API" : "Failed to fetch API key");
      }

      // Make direct fetch request with the original API key
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${log.endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": apiKeyData.api_key,
          },
          body: JSON.stringify(log.request_body),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      toast({
        title: language === "ar" ? "تم الإرسال" : "Sent",
        description: language === "ar" ? "تم إرسال الطلب بنجاح" : "Request sent successfully",
      });

      // Refresh logs to see the new entry
      fetchLogs();
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResending(null);
    }
  };

  const retryAllFailed = async () => {
    // Get all failed logs that have request_body and api_key_id
    const failedLogs = filteredLogs.filter(
      log => !log.success && log.request_body && log.api_key_id
    );

    if (failedLogs.length === 0) {
      toast({
        title: language === "ar" ? "لا توجد طلبات" : "No Requests",
        description: language === "ar" ? "لا توجد طلبات فاشلة لإعادة المحاولة" : "No failed requests to retry",
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = language === "ar" 
      ? `هل أنت متأكد من إعادة إرسال ${failedLogs.length} طلب فاشل؟`
      : `Are you sure you want to retry ${failedLogs.length} failed request(s)?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setRetryingAll(true);
    setRetryProgress({ current: 0, total: failedLogs.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < failedLogs.length; i++) {
      const log = failedLogs[i];
      setRetryProgress({ current: i + 1, total: failedLogs.length });

      try {
        // Fetch the API key from the database
        const { data: apiKeyData, error: apiKeyError } = await supabase
          .from("api_keys")
          .select("api_key")
          .eq("id", log.api_key_id)
          .single();

        if (apiKeyError || !apiKeyData) {
          failCount++;
          continue;
        }

        // Make direct fetch request with the original API key
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${log.endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": apiKeyData.api_key,
            },
            body: JSON.stringify(log.request_body),
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        failCount++;
      }
    }

    setRetryingAll(false);
    setRetryProgress({ current: 0, total: 0 });

    toast({
      title: language === "ar" ? "اكتملت إعادة المحاولة" : "Retry Complete",
      description: language === "ar" 
        ? `ناجحة: ${successCount}, فاشلة: ${failCount}`
        : `Success: ${successCount}, Failed: ${failCount}`,
    });

    // Refresh logs to see the new entries
    fetchLogs();
  };

  const resendAllFiltered = async () => {
    // Get all filtered logs that have request_body and api_key_id
    const logsToResend = filteredLogs.filter(
      log => log.request_body && log.api_key_id
    );

    if (logsToResend.length === 0) {
      toast({
        title: language === "ar" ? "لا توجد طلبات" : "No Requests",
        description: language === "ar" ? "لا توجد طلبات لإعادة الإرسال" : "No requests to resend",
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = language === "ar" 
      ? `هل أنت متأكد من إعادة إرسال ${logsToResend.length} طلب؟`
      : `Are you sure you want to resend ${logsToResend.length} request(s)?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setResendingAll(true);
    setRetryProgress({ current: 0, total: logsToResend.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < logsToResend.length; i++) {
      const log = logsToResend[i];
      setRetryProgress({ current: i + 1, total: logsToResend.length });

      try {
        // Fetch the API key from the database
        const { data: apiKeyData, error: apiKeyError } = await supabase
          .from("api_keys")
          .select("api_key")
          .eq("id", log.api_key_id)
          .single();

        if (apiKeyError || !apiKeyData) {
          failCount++;
          continue;
        }

        // Make direct fetch request with the original API key
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${log.endpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": apiKeyData.api_key,
            },
            body: JSON.stringify(log.request_body),
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        failCount++;
      }
    }

    setResendingAll(false);
    setRetryProgress({ current: 0, total: 0 });

    toast({
      title: language === "ar" ? "اكتمل إعادة الإرسال" : "Resend Complete",
      description: language === "ar" 
        ? `ناجحة: ${successCount}, فاشلة: ${failCount}`
        : `Success: ${successCount}, Failed: ${failCount}`,
    });

    // Refresh logs to see the new entries
    fetchLogs();
  };

  // Show loading or access denied
  if (accessLoading || hasAccess === null) {
    return <AccessDenied isLoading={true} />;
  }

  if (hasAccess === false) {
    return <AccessDenied />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "سجلات استهلاك API" : "API Consumption Logs"}
        </h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={resendAllFiltered} 
            disabled={resendingAll || retryingAll || loading}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {resendingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {`${retryProgress.current}/${retryProgress.total}`}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {language === "ar" ? "إعادة إرسال الكل" : "Resend All"}
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={retryAllFailed} 
            disabled={retryingAll || resendingAll || loading}
            className="text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            {retryingAll ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {`${retryProgress.current}/${retryProgress.total}`}
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                {language === "ar" ? "إعادة الفاشلة" : "Retry Failed"}
              </>
            )}
          </Button>
          <Button variant="outline" onClick={fetchLogs} disabled={loading || retryingAll || resendingAll}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="destructive" onClick={handleClearLogs} disabled={retryingAll || resendingAll}>
            <Trash2 className="h-4 w-4 mr-2" />
            {language === "ar" ? "مسح السجلات" : "Clear Logs"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "إجمالي القيمة" : "Total Value"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-500">SAR</span>
              <span className="text-2xl font-bold text-emerald-600">
                {stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
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

            <Select value={dateFilter} onValueChange={(value) => {
              setDateFilter(value);
              if (value === "custom") {
                setDatePickerOpen(true);
              }
            }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={language === "ar" ? "الفترة" : "Period"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">{language === "ar" ? "اليوم" : "Today"}</SelectItem>
                <SelectItem value="yesterday">{language === "ar" ? "أمس" : "Yesterday"}</SelectItem>
                <SelectItem value="week">{language === "ar" ? "آخر أسبوع" : "Last Week"}</SelectItem>
                <SelectItem value="month">{language === "ar" ? "آخر شهر" : "Last Month"}</SelectItem>
                <SelectItem value="custom">{language === "ar" ? "تحديد تاريخ" : "Select Date"}</SelectItem>
              </SelectContent>
            </Select>

            {dateFilter === "custom" && (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !customDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate ? format(customDate, "yyyy-MM-dd") : (language === "ar" ? "اختر تاريخ" : "Pick a date")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={(date) => {
                      setCustomDate(date);
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
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
                  <TableHead className="min-w-[160px]">
                    <SortableHeader column="created_at">
                      {language === "ar" ? "الوقت" : "Time"}
                    </SortableHeader>
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortableHeader column="orderNumber">
                      {language === "ar" ? "رقم الطلب" : "Order #"}
                    </SortableHeader>
                    <ColumnFilterInput column="orderNumber" placeholder={language === "ar" ? "فلتر..." : "Filter..."} />
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <SortableHeader column="endpoint">
                      {language === "ar" ? "نقطة النهاية" : "Endpoint"}
                    </SortableHeader>
                    <ColumnFilterInput column="endpoint" placeholder={language === "ar" ? "فلتر..." : "Filter..."} />
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <SortableHeader column="method">
                      {language === "ar" ? "الطريقة" : "Method"}
                    </SortableHeader>
                    <ColumnFilterInput column="method" placeholder={language === "ar" ? "فلتر..." : "Filter..."} />
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <SortableHeader column="status">
                      {language === "ar" ? "الحالة" : "Status"}
                    </SortableHeader>
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <SortableHeader column="executionTime">
                      {language === "ar" ? "الوقت (ms)" : "Time (ms)"}
                    </SortableHeader>
                  </TableHead>
                  <TableHead className="min-w-[150px]">
                    <SortableHeader column="apiKey">
                      {language === "ar" ? "مفتاح API" : "API Key"}
                    </SortableHeader>
                    <ColumnFilterInput column="apiKey" placeholder={language === "ar" ? "فلتر..." : "Filter..."} />
                  </TableHead>
                  <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد سجلات" : "No logs found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {getOrderNumber(log) || "-"}
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => viewLogDetails(log)}
                            title={language === "ar" ? "عرض التفاصيل" : "View Details"}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {log.request_body && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => resendRequest(log)}
                              disabled={resending === log.id}
                              title={language === "ar" ? "إعادة الإرسال" : "Resend"}
                            >
                              {resending === log.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {language === "ar" ? "عرض" : "Showing"}{" "}
                {Math.min((currentPage - 1) * pageSize + 1, totalRecords)} -{" "}
                {Math.min(currentPage * pageSize, totalRecords)}{" "}
                {language === "ar" ? "من" : "of"} {totalRecords}{" "}
                {language === "ar" ? "سجل" : "records"}
              </span>
              <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <span>{language === "ar" ? "لكل صفحة" : "per page"}</span>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || loading}
                title={language === "ar" ? "الصفحة الأولى" : "First page"}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                title={language === "ar" ? "الصفحة السابقة" : "Previous page"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <span className="px-3 py-1 text-sm font-medium">
                {language === "ar" ? "صفحة" : "Page"} {currentPage}{" "}
                {language === "ar" ? "من" : "of"} {Math.ceil(totalRecords / pageSize) || 1}
              </span>
              
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalRecords / pageSize) || loading}
                title={language === "ar" ? "الصفحة التالية" : "Next page"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(Math.ceil(totalRecords / pageSize))}
                disabled={currentPage >= Math.ceil(totalRecords / pageSize) || loading}
                title={language === "ar" ? "الصفحة الأخيرة" : "Last page"}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
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

              {selectedLog.request_body && (
                <div className="pt-4 border-t">
                  <Button
                    className="w-full"
                    onClick={() => {
                      resendRequest(selectedLog);
                      setDetailDialogOpen(false);
                    }}
                    disabled={resending === selectedLog.id}
                  >
                    {resending === selectedLog.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {language === "ar" ? "إعادة إرسال الطلب" : "Resend Request"}
                  </Button>
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
