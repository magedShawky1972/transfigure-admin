import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon, RefreshCw, Clock, User, Download, Trash2, CheckCircle, Pencil, List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AttendanceLog {
  id: string;
  employee_code: string;
  attendance_date: string;
  attendance_time: string;
  record_type: string;
  raw_data: any;
  created_at: string;
  is_processed: boolean;
  processed_at: string | null;
}

interface AttendanceType {
  id: string;
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  is_shift_based: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  zk_employee_code: string | null;
  employee_number: string;
  attendance_type_id: string | null;
  attendance_types: AttendanceType | null;
}

interface SummaryRecord {
  key: string;
  employee_code: string;
  attendance_date: string;
  in_time: string | null;
  out_time: string | null;
  is_processed: boolean;
  created_at: string;
  log_ids: string[];
  total_hours: number | null;
  expected_hours: number | null;
  difference_hours: number | null;
}

const ZKAttendanceLogs = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"detailed" | "summary">("detailed");
  const [selectedSummary, setSelectedSummary] = useState<SummaryRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    employee_code: "",
    attendance_date: "",
    attendance_time: "",
    record_type: "unknown",
  });
  const [summaryEditFormData, setSummaryEditFormData] = useState({
    employee_code: "",
    attendance_date: "",
    in_time: "",
    out_time: "",
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("zk_attendance_logs")
        .select("*", { count: "exact" })
        .order("attendance_date", { ascending: false })
        .order("attendance_time", { ascending: false })
        .range(from, to);

      if (searchCode) {
        query = query.ilike("employee_code", `%${searchCode}%`);
      }

      if (selectedDate) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        query = query.eq("attendance_date", dateStr);
      }

      if (recordTypeFilter !== "all") {
        query = query.eq("record_type", recordTypeFilter);
      }

      if (selectedEmployee !== "all") {
        query = query.eq("employee_code", selectedEmployee);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast.error(isArabic ? "خطأ في تحميل البيانات" : "Error loading data");
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, first_name_ar, last_name_ar, zk_employee_code, employee_number, attendance_type_id, attendance_types(id, fixed_start_time, fixed_end_time, is_shift_based)")
        .not("zk_employee_code", "is", null);

      if (error) throw error;
      setEmployees((data || []) as Employee[]);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
    }
  };

  // Helper to calculate hours between two time strings (HH:MM:SS)
  const calculateHoursDiff = (startTime: string | null, endTime: string | null): number | null => {
    if (!startTime || !endTime) return null;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return (endMinutes - startMinutes) / 60;
  };

  // Get expected hours for an employee based on their attendance type
  const getExpectedHours = (employeeCode: string): number | null => {
    const employee = employees.find((e) => e.zk_employee_code === employeeCode);
    if (!employee?.attendance_types) return null;
    const { fixed_start_time, fixed_end_time, is_shift_based } = employee.attendance_types;
    if (is_shift_based || !fixed_start_time || !fixed_end_time) return null;
    return calculateHoursDiff(fixed_start_time, fixed_end_time);
  };

  useEffect(() => {
    fetchLogs();
    fetchEmployees();
  }, [searchCode, selectedDate, recordTypeFilter, selectedEmployee, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchCode, selectedDate, recordTypeFilter, selectedEmployee]);

  const getEmployeeName = (code: string) => {
    const employee = employees.find((e) => e.zk_employee_code === code);
    if (!employee) return null;
    
    if (isArabic && employee.first_name_ar) {
      return `${employee.first_name_ar} ${employee.last_name_ar || ""}`.trim();
    }
    return `${employee.first_name} ${employee.last_name}`.trim();
  };

  const getRecordTypeBadge = (type: string) => {
    switch (type) {
      case "entry":
        return <Badge className="bg-green-500">{isArabic ? "دخول" : "Entry"}</Badge>;
      case "exit":
        return <Badge className="bg-red-500">{isArabic ? "خروج" : "Exit"}</Badge>;
      default:
        return <Badge variant="secondary">{isArabic ? "غير محدد" : "Unknown"}</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ["Employee Code", "Employee Name", "Date", "Time", "Type", "Received At"];
    const rows = logs.map((log) => [
      log.employee_code,
      getEmployeeName(log.employee_code) || "-",
      log.attendance_date,
      log.attendance_time,
      log.record_type,
      format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zk_attendance_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to check if time is after midnight (00:00 - 06:00 is treated as "out" from previous shift)
  const isAfterMidnightEarlyMorning = (time: string): boolean => {
    const [hours] = time.split(":").map(Number);
    return hours >= 0 && hours < 6; // 00:00 to 05:59 is considered "out" time
  };

  // Group logs by employee and date for summary view
  const getSummaryRecords = (): SummaryRecord[] => {
    const grouped: Record<string, { 
      logs: AttendanceLog[]; 
      inTimes: string[];
      outTimes: string[];
      is_processed: boolean;
      created_at: string;
    }> = {};
    
    logs.forEach((log) => {
      const key = `${log.employee_code}_${log.attendance_date}`;
      if (!grouped[key]) {
        grouped[key] = { 
          logs: [], 
          inTimes: [],
          outTimes: [],
          is_processed: log.is_processed,
          created_at: log.created_at 
        };
      }
      grouped[key].logs.push(log);
      
      // Classify time as In or Out based on time of day
      // Times after midnight (00:00-05:59) are treated as "Out" times
      if (isAfterMidnightEarlyMorning(log.attendance_time)) {
        grouped[key].outTimes.push(log.attendance_time);
      } else {
        // Regular times: earliest is In, latest is Out
        grouped[key].inTimes.push(log.attendance_time);
      }
      
      // If any log is processed, mark as processed
      if (log.is_processed) {
        grouped[key].is_processed = true;
      }
      
      // Use latest created_at
      if (log.created_at > grouped[key].created_at) {
        grouped[key].created_at = log.created_at;
      }
    });
    
    return Object.entries(grouped).map(([key, data]) => {
      const [employee_code, attendance_date] = key.split("_");
      
      // Sort times to find min/max
      const sortedInTimes = data.inTimes.sort();
      const sortedOutTimes = data.outTimes.sort();
      
      // In time: minimum of regular times (not early morning)
      // Out time: maximum of early morning times OR maximum of regular times (whichever is later in the shift)
      let in_time: string | null = sortedInTimes.length > 0 ? sortedInTimes[0] : null;
      let out_time: string | null = null;
      
      if (sortedOutTimes.length > 0) {
        // If there are early morning times, the latest one is the out time
        out_time = sortedOutTimes[sortedOutTimes.length - 1];
      } else if (sortedInTimes.length > 1) {
        // Otherwise, the latest regular time is the out time
        out_time = sortedInTimes[sortedInTimes.length - 1];
      }
      
      // Calculate total hours - handle overnight shifts
      let total_hours: number | null = null;
      if (in_time && out_time) {
        const [inH, inM] = in_time.split(":").map(Number);
        const [outH, outM] = out_time.split(":").map(Number);
        const inMinutes = inH * 60 + inM;
        let outMinutes = outH * 60 + outM;
        
        // If out time is early morning (after midnight), add 24 hours
        if (isAfterMidnightEarlyMorning(out_time)) {
          outMinutes += 24 * 60;
        }
        
        total_hours = (outMinutes - inMinutes) / 60;
      }
      
      const expected_hours = getExpectedHours(employee_code);
      const difference_hours = total_hours !== null && expected_hours !== null 
        ? total_hours - expected_hours 
        : null;
      
      return {
        key,
        employee_code,
        attendance_date,
        in_time,
        out_time,
        is_processed: data.is_processed,
        created_at: data.created_at,
        log_ids: data.logs.map(l => l.id),
        total_hours,
        expected_hours,
        difference_hours,
      };
    }).sort((a, b) => {
      // Sort by date desc, then by employee code
      if (a.attendance_date !== b.attendance_date) {
        return b.attendance_date.localeCompare(a.attendance_date);
      }
      return a.employee_code.localeCompare(b.employee_code);
    });
  };

  const summaryRecords = getSummaryRecords();

  const handleDeleteClick = (log: AttendanceLog) => {
    setSelectedLog(log);
    setDeleteDialogOpen(true);
  };

  const handleApproveClick = (log: AttendanceLog) => {
    setSelectedLog(log);
    setApproveDialogOpen(true);
  };

  const handleEditClick = (log: AttendanceLog) => {
    setSelectedLog(log);
    setEditFormData({
      employee_code: log.employee_code,
      attendance_date: log.attendance_date,
      attendance_time: log.attendance_time,
      record_type: log.record_type,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedLog) return;

    if (!editFormData.employee_code || !editFormData.attendance_date || !editFormData.attendance_time) {
      toast.error(isArabic ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    setActionLoading(true);
    try {
      // Ensure time has seconds format (HH:MM:SS)
      let timeValue = editFormData.attendance_time;
      if (timeValue && timeValue.split(":").length === 2) {
        timeValue = `${timeValue}:00`;
      }

      // IMPORTANT: ask the backend to return the updated row.
      // If RLS/filters prevent a match, data will be empty even if no error is thrown.
      const { data, error } = await supabase
        .from("zk_attendance_logs")
        .update({
          employee_code: editFormData.employee_code,
          attendance_date: editFormData.attendance_date,
          attendance_time: timeValue,
          record_type: editFormData.record_type,
        })
        .eq("id", selectedLog.id)
        .select("id, employee_code, attendance_date, attendance_time, record_type")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Update returned no row (no match or blocked)");
      }

      // Update UI immediately (and also refresh to stay consistent with filters/order)
      setLogs((prev) => prev.map((l) => (l.id === data.id ? { ...l, ...data } : l)));

      toast.success(isArabic ? "تم تحديث السجل بنجاح" : "Record updated successfully");
      await fetchLogs();
    } catch (error: any) {
      console.error("Error updating log:", error);
      toast.error(
        isArabic
          ? "خطأ في تحديث السجل"
          : `Error updating record${error?.message ? `: ${error.message}` : ""}`
      );
    } finally {
      setActionLoading(false);
      setEditDialogOpen(false);
      setSelectedLog(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLog) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("zk_attendance_logs")
        .delete()
        .eq("id", selectedLog.id);

      if (error) throw error;

      toast.success(isArabic ? "تم حذف السجل بنجاح" : "Record deleted successfully");
      fetchLogs();
    } catch (error: any) {
      console.error("Error deleting log:", error);
      toast.error(isArabic ? "خطأ في حذف السجل" : "Error deleting record");
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
      setSelectedLog(null);
    }
  };

  const handleApproveConfirm = async () => {
    if (!selectedLog) return;
    
    setActionLoading(true);
    try {
      // Find the employee by ZK code
      const employee = employees.find((e) => e.zk_employee_code === selectedLog.employee_code);
      
      if (!employee) {
        toast.error(isArabic ? "لم يتم العثور على الموظف" : "Employee not found");
        return;
      }

      // Mark as processed
      const { error: updateError } = await supabase
        .from("zk_attendance_logs")
        .update({ 
          is_processed: true, 
          processed_at: new Date().toISOString() 
        })
        .eq("id", selectedLog.id);

      if (updateError) throw updateError;

      toast.success(
        isArabic 
          ? "تمت الموافقة وإضافة السجل إلى دوام الموظف" 
          : "Record approved and added to employee timesheet"
      );
      fetchLogs();
    } catch (error: any) {
      console.error("Error approving log:", error);
      toast.error(isArabic ? "خطأ في الموافقة على السجل" : "Error approving record");
    } finally {
      setActionLoading(false);
      setApproveDialogOpen(false);
      setSelectedLog(null);
    }
  };

  const handleDeleteAllFiltered = async () => {
    setActionLoading(true);
    try {
      let query = supabase.from("zk_attendance_logs").delete();

      if (searchCode) {
        query = query.ilike("employee_code", `%${searchCode}%`);
      }

      if (selectedDate) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        query = query.eq("attendance_date", dateStr);
      }

      if (recordTypeFilter !== "all") {
        query = query.eq("record_type", recordTypeFilter);
      }

      // Use gte on created_at to ensure filter is always present (required for delete)
      // This ensures all records are matched when no other filters are set
      query = query.gte("created_at", "1970-01-01");

      const { error } = await query;
      
      if (error) throw error;

      toast.success(
        isArabic
          ? `تم حذف ${totalCount} سجل بنجاح`
          : `Successfully deleted ${totalCount} records`
      );
      fetchLogs();
    } catch (error: any) {
      console.error("Error deleting filtered logs:", error);
      toast.error(isArabic ? "خطأ في حذف السجلات" : "Error deleting records");
    } finally {
      setActionLoading(false);
      setDeleteAllDialogOpen(false);
    }
  };

  return (
    <div className={`p-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {isArabic ? "سجلات حضور ZK" : "ZK Attendance Logs"}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {/* View Mode Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "detailed" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("detailed")}
                className="rounded-none"
              >
                <List className="h-4 w-4 mr-2" />
                {isArabic ? "تفصيلي" : "Detailed"}
              </Button>
              <Button
                variant={viewMode === "summary" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("summary")}
                className="rounded-none"
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                {isArabic ? "ملخص" : "Summary"}
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteAllDialogOpen(true)}
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isArabic ? `حذف الكل (${totalCount})` : `Delete All (${totalCount})`}
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              {isArabic ? "تصدير" : "Export"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {isArabic ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={isArabic ? "بحث برقم الموظف..." : "Search by employee code..."}
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="w-full"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP", { locale: isArabic ? ar : undefined })
                  ) : (
                    <span>{isArabic ? "اختر التاريخ" : "Pick a date"}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                {isArabic ? "مسح التاريخ" : "Clear Date"}
              </Button>
            )}

            <Select value={recordTypeFilter} onValueChange={setRecordTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={isArabic ? "النوع" : "Type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
                <SelectItem value="entry">{isArabic ? "دخول" : "Entry"}</SelectItem>
                <SelectItem value="exit">{isArabic ? "خروج" : "Exit"}</SelectItem>
                <SelectItem value="unknown">{isArabic ? "غير محدد" : "Unknown"}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[250px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder={isArabic ? "اختر الموظف" : "Select Employee"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع الموظفين" : "All Employees"}</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.zk_employee_code || ""}>
                    {emp.zk_employee_code} - {isArabic && emp.first_name_ar 
                      ? `${emp.first_name_ar} ${emp.last_name_ar || ""}`.trim()
                      : `${emp.first_name} ${emp.last_name}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{totalCount}</div>
                <div className="text-sm text-muted-foreground">
                  {isArabic ? "إجمالي السجلات" : "Total Records"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {new Set(logs.map((l) => l.employee_code)).size}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isArabic ? "عدد الموظفين" : "Unique Employees"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {new Set(logs.map((l) => l.attendance_date)).size}
                </div>
                <div className="text-sm text-muted-foreground">
                  {isArabic ? "عدد الأيام" : "Days Covered"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Table - Detailed View */}
          {viewMode === "detailed" && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? "كود الموظف" : "Employee Code"}</TableHead>
                    <TableHead>{isArabic ? "اسم الموظف" : "Employee Name"}</TableHead>
                    <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isArabic ? "الوقت" : "Time"}</TableHead>
                    <TableHead>{isArabic ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isArabic ? "تاريخ الاستلام" : "Received At"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        {isArabic ? "جاري التحميل..." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {isArabic ? "لا توجد سجلات" : "No records found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const employeeName = getEmployeeName(log.employee_code);
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono">{log.employee_code}</TableCell>
                          <TableCell>
                            {employeeName ? (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {employeeName}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{log.attendance_date}</TableCell>
                          <TableCell className="font-mono">{log.attendance_time}</TableCell>
                          <TableCell>{getRecordTypeBadge(log.record_type)}</TableCell>
                          <TableCell>
                            {log.is_processed ? (
                              <Badge className="bg-blue-500">{isArabic ? "معتمد" : "Approved"}</Badge>
                            ) : (
                              <Badge variant="outline">{isArabic ? "قيد الانتظار" : "Pending"}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              {!log.is_processed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApproveClick(log)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title={isArabic ? "اعتماد" : "Approve"}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(log)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title={isArabic ? "تعديل" : "Edit"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(log)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title={isArabic ? "حذف" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Data Table - Summary View */}
          {viewMode === "summary" && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? "اسم الموظف" : "Employee Name"}</TableHead>
                    <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isArabic ? "الدخول" : "In"}</TableHead>
                    <TableHead>{isArabic ? "الخروج" : "Out"}</TableHead>
                    <TableHead>{isArabic ? "إجمالي الساعات" : "Total Hours"}</TableHead>
                    <TableHead>{isArabic ? "الفرق" : "Difference"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isArabic ? "تاريخ الاستلام" : "Received At"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        {isArabic ? "جاري التحميل..." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : summaryRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {isArabic ? "لا توجد سجلات" : "No records found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    summaryRecords.map((record) => {
                      const employeeName = getEmployeeName(record.employee_code);
                      return (
                        <TableRow key={record.key}>
                          <TableCell>
                            {employeeName ? (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                {employeeName}
                              </div>
                            ) : (
                              <span className="text-muted-foreground font-mono">{record.employee_code}</span>
                            )}
                          </TableCell>
                          <TableCell>{record.attendance_date}</TableCell>
                          <TableCell className="font-mono">
                            {record.in_time ? (
                              <Badge className="bg-green-500">{record.in_time}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {record.out_time ? (
                              <Badge className="bg-red-500">{record.out_time}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {record.total_hours !== null ? (
                              <span className="font-semibold">{record.total_hours.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {record.difference_hours !== null ? (
                              <Badge 
                                className={record.difference_hours >= 0 ? "bg-green-500" : "bg-red-500"}
                              >
                                {record.difference_hours >= 0 ? "+" : ""}{record.difference_hours.toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.is_processed ? (
                              <Badge className="bg-blue-500">{isArabic ? "معتمد" : "Approved"}</Badge>
                            ) : (
                              <Badge variant="outline">{isArabic ? "قيد الانتظار" : "Pending"}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(record.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              {!record.is_processed && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    setActionLoading(true);
                                    try {
                                      const { error } = await supabase
                                        .from("zk_attendance_logs")
                                        .update({ is_processed: true, processed_at: new Date().toISOString() })
                                        .in("id", record.log_ids);
                                      if (error) throw error;
                                      toast.success(isArabic ? "تم الاعتماد بنجاح" : "Approved successfully");
                                      fetchLogs();
                                    } catch (error) {
                                      toast.error(isArabic ? "خطأ في الاعتماد" : "Error approving");
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title={isArabic ? "اعتماد" : "Approve"}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedSummary(record);
                                  setSummaryEditFormData({
                                    employee_code: record.employee_code,
                                    attendance_date: record.attendance_date,
                                    in_time: record.in_time || "",
                                    out_time: record.out_time || "",
                                  });
                                  setEditDialogOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title={isArabic ? "تعديل" : "Edit"}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm(isArabic ? "هل أنت متأكد من حذف هذه السجلات؟" : "Are you sure you want to delete these records?")) {
                                    setActionLoading(true);
                                    try {
                                      const { error } = await supabase
                                        .from("zk_attendance_logs")
                                        .delete()
                                        .in("id", record.log_ids);
                                      if (error) throw error;
                                      toast.success(isArabic ? "تم الحذف بنجاح" : "Deleted successfully");
                                      fetchLogs();
                                    } catch (error) {
                                      toast.error(isArabic ? "خطأ في الحذف" : "Error deleting");
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title={isArabic ? "حذف" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {viewMode === "detailed" 
                  ? (isArabic
                      ? `عرض ${((currentPage - 1) * pageSize) + 1} - ${Math.min(currentPage * pageSize, totalCount)} من ${totalCount} سجل`
                      : `Showing ${((currentPage - 1) * pageSize) + 1} - ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} records`)
                  : (isArabic
                      ? `عرض ${summaryRecords.length} موظف/يوم`
                      : `Showing ${summaryRecords.length} employee/day records`)
                }
              </div>
              
              <div className="flex items-center gap-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <Label className="text-sm">{isArabic ? "عدد الصفوف:" : "Rows:"}</Label>
                  <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(Number(val))}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                      <SelectItem value="1000">1000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1 || loading}
                  >
                    {isArabic ? "الأولى" : "First"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    {isArabic ? "السابق" : "Prev"}
                  </Button>
                  <span className="text-sm px-2">
                    {isArabic 
                      ? `صفحة ${currentPage} من ${Math.ceil(totalCount / pageSize)}`
                      : `Page ${currentPage} of ${Math.ceil(totalCount / pageSize)}`
                    }
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                  >
                    {isArabic ? "التالي" : "Next"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.ceil(totalCount / pageSize))}
                    disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                  >
                    {isArabic ? "الأخيرة" : "Last"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArabic ? "تأكيد الحذف" : "Confirm Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic
                ? `هل أنت متأكد من حذف سجل الحضور للموظف ${selectedLog?.employee_code} بتاريخ ${selectedLog?.attendance_date} الساعة ${selectedLog?.attendance_time}؟`
                : `Are you sure you want to delete the attendance record for employee ${selectedLog?.employee_code} on ${selectedLog?.attendance_date} at ${selectedLog?.attendance_time}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {isArabic ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading
                ? isArabic ? "جاري الحذف..." : "Deleting..."
                : isArabic ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArabic ? "تأكيد الاعتماد" : "Confirm Approval"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic
                ? `هل أنت متأكد من اعتماد سجل الحضور للموظف ${selectedLog?.employee_code} (${getEmployeeName(selectedLog?.employee_code || "") || "-"}) بتاريخ ${selectedLog?.attendance_date} الساعة ${selectedLog?.attendance_time}؟ سيتم إضافته إلى دوام الموظف.`
                : `Are you sure you want to approve the attendance record for employee ${selectedLog?.employee_code} (${getEmployeeName(selectedLog?.employee_code || "") || "-"}) on ${selectedLog?.attendance_date} at ${selectedLog?.attendance_time}? It will be added to the employee's timesheet.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {isArabic ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveConfirm}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading
                ? isArabic ? "جاري الاعتماد..." : "Approving..."
                : isArabic ? "اعتماد" : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Filtered Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isArabic ? "تأكيد حذف الكل" : "Confirm Delete All"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {isArabic
                  ? `هل أنت متأكد من حذف جميع السجلات المطابقة للفلتر الحالي؟`
                  : `Are you sure you want to delete all records matching the current filter?`}
              </p>
              <div className="bg-muted p-3 rounded-md text-sm">
                <p className="font-semibold mb-1">{isArabic ? "الفلاتر الحالية:" : "Current filters:"}</p>
                <ul className="list-disc list-inside space-y-1">
                  {searchCode && (
                    <li>{isArabic ? `كود الموظف: ${searchCode}` : `Employee code: ${searchCode}`}</li>
                  )}
                  {selectedDate && (
                    <li>{isArabic ? `التاريخ: ${format(selectedDate, "yyyy-MM-dd")}` : `Date: ${format(selectedDate, "yyyy-MM-dd")}`}</li>
                  )}
                  {recordTypeFilter !== "all" && (
                    <li>{isArabic ? `النوع: ${recordTypeFilter}` : `Type: ${recordTypeFilter}`}</li>
                  )}
                  {!searchCode && !selectedDate && recordTypeFilter === "all" && (
                    <li className="text-destructive font-semibold">
                      {isArabic ? "لا توجد فلاتر - سيتم حذف جميع السجلات!" : "No filters - ALL records will be deleted!"}
                    </li>
                  )}
                </ul>
                <p className="mt-2 font-semibold text-destructive">
                  {isArabic ? `عدد السجلات: ${totalCount}` : `Records count: ${totalCount}`}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {isArabic ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllFiltered}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading
                ? isArabic ? "جاري الحذف..." : "Deleting..."
                : isArabic ? `حذف ${totalCount} سجل` : `Delete ${totalCount} records`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog - Detailed View */}
      <Dialog open={editDialogOpen && viewMode === "detailed"} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setSelectedLog(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isArabic ? "تعديل سجل الحضور" : "Edit Attendance Record"}
            </DialogTitle>
            <DialogDescription>
              {isArabic ? "قم بتعديل بيانات سجل الحضور" : "Modify the attendance record details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employee_code">
                {isArabic ? "كود الموظف" : "Employee Code"}
              </Label>
              <Input
                id="employee_code"
                value={editFormData.employee_code}
                onChange={(e) => setEditFormData({ ...editFormData, employee_code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance_date">
                {isArabic ? "التاريخ" : "Date"}
              </Label>
              <Input
                id="attendance_date"
                type="date"
                value={editFormData.attendance_date}
                onChange={(e) => setEditFormData({ ...editFormData, attendance_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendance_time">
                {isArabic ? "الوقت" : "Time"}
              </Label>
              <Input
                id="attendance_time"
                type="time"
                step="1"
                value={editFormData.attendance_time}
                onChange={(e) => setEditFormData({ ...editFormData, attendance_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="record_type">
                {isArabic ? "النوع" : "Type"}
              </Label>
              <Select
                value={editFormData.record_type}
                onValueChange={(value) => setEditFormData({ ...editFormData, record_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">{isArabic ? "دخول" : "Entry"}</SelectItem>
                  <SelectItem value="exit">{isArabic ? "خروج" : "Exit"}</SelectItem>
                  <SelectItem value="unknown">{isArabic ? "غير محدد" : "Unknown"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={actionLoading}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              {actionLoading
                ? isArabic ? "جاري الحفظ..." : "Saving..."
                : isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog - Summary View */}
      <Dialog open={editDialogOpen && viewMode === "summary"} onOpenChange={(open) => {
        if (!open) {
          setEditDialogOpen(false);
          setSelectedSummary(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isArabic ? "تعديل سجل الحضور" : "Edit Attendance Record"}
            </DialogTitle>
            <DialogDescription>
              {isArabic 
                ? `تعديل أوقات الدخول والخروج للموظف ${getEmployeeName(summaryEditFormData.employee_code) || summaryEditFormData.employee_code}` 
                : `Edit In/Out times for ${getEmployeeName(summaryEditFormData.employee_code) || summaryEditFormData.employee_code}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{isArabic ? "التاريخ" : "Date"}</Label>
              <div className="font-medium">{summaryEditFormData.attendance_date}</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="in_time">
                {isArabic ? "وقت الدخول (In)" : "In Time"}
              </Label>
              <Input
                id="in_time"
                type="time"
                step="1"
                value={summaryEditFormData.in_time}
                onChange={(e) => setSummaryEditFormData({ ...summaryEditFormData, in_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="out_time">
                {isArabic ? "وقت الخروج (Out)" : "Out Time"}
              </Label>
              <Input
                id="out_time"
                type="time"
                step="1"
                value={summaryEditFormData.out_time}
                onChange={(e) => setSummaryEditFormData({ ...summaryEditFormData, out_time: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={actionLoading}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedSummary) return;
                setActionLoading(true);
                try {
                  // Delete existing logs and create new ones with updated times
                  const { error: deleteError } = await supabase
                    .from("zk_attendance_logs")
                    .delete()
                    .in("id", selectedSummary.log_ids);
                  
                  if (deleteError) throw deleteError;

                  const newRecords = [];
                  
                  // Add In record
                  if (summaryEditFormData.in_time) {
                    let inTime = summaryEditFormData.in_time;
                    if (inTime.split(":").length === 2) inTime = `${inTime}:00`;
                    newRecords.push({
                      employee_code: summaryEditFormData.employee_code,
                      attendance_date: summaryEditFormData.attendance_date,
                      attendance_time: inTime,
                      record_type: "entry",
                    });
                  }
                  
                  // Add Out record
                  if (summaryEditFormData.out_time) {
                    let outTime = summaryEditFormData.out_time;
                    if (outTime.split(":").length === 2) outTime = `${outTime}:00`;
                    newRecords.push({
                      employee_code: summaryEditFormData.employee_code,
                      attendance_date: summaryEditFormData.attendance_date,
                      attendance_time: outTime,
                      record_type: "exit",
                    });
                  }

                  if (newRecords.length > 0) {
                    const { error: insertError } = await supabase
                      .from("zk_attendance_logs")
                      .insert(newRecords);
                    
                    if (insertError) throw insertError;
                  }

                  toast.success(isArabic ? "تم تحديث السجل بنجاح" : "Record updated successfully");
                  fetchLogs();
                } catch (error: any) {
                  console.error("Error updating summary record:", error);
                  toast.error(isArabic ? "خطأ في تحديث السجل" : "Error updating record");
                } finally {
                  setActionLoading(false);
                  setEditDialogOpen(false);
                  setSelectedSummary(null);
                }
              }} 
              disabled={actionLoading}
            >
              {actionLoading
                ? isArabic ? "جاري الحفظ..." : "Saving..."
                : isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ZKAttendanceLogs;
