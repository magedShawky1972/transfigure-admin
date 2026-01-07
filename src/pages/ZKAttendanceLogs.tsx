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
import { CalendarIcon, RefreshCw, Clock, User, Download, Trash2, CheckCircle, Pencil } from "lucide-react";
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

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  first_name_ar: string | null;
  last_name_ar: string | null;
  zk_employee_code: string | null;
  employee_number: string;
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
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    employee_code: "",
    attendance_date: "",
    attendance_time: "",
    record_type: "unknown",
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("zk_attendance_logs")
        .select("*", { count: "exact" })
        .order("attendance_date", { ascending: false })
        .order("attendance_time", { ascending: false })
        .limit(500);

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
        .select("id, first_name, last_name, first_name_ar, last_name_ar, zk_employee_code, employee_number")
        .not("zk_employee_code", "is", null);

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchEmployees();
  }, [searchCode, selectedDate, recordTypeFilter]);

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

  // Group logs by employee and date for summary
  const getDailySummary = () => {
    const summary: Record<string, { entry: string | null; exit: string | null }> = {};
    
    logs.forEach((log) => {
      const key = `${log.employee_code}_${log.attendance_date}`;
      if (!summary[key]) {
        summary[key] = { entry: null, exit: null };
      }
      
      if (log.record_type === "entry" || (!summary[key].entry && log.record_type !== "exit")) {
        if (!summary[key].entry || log.attendance_time < summary[key].entry!) {
          summary[key].entry = log.attendance_time;
        }
      }
      
      if (log.record_type === "exit" || summary[key].entry) {
        if (!summary[key].exit || log.attendance_time > summary[key].exit!) {
          summary[key].exit = log.attendance_time;
        }
      }
    });
    
    return summary;
  };

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

  return (
    <div className={`p-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {isArabic ? "سجلات حضور ZK" : "ZK Attendance Logs"}
          </CardTitle>
          <div className="flex gap-2">
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

          {/* Data Table */}
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
                    <TableCell colSpan={6} className="text-center py-8">
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

          {logs.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              {isArabic
                ? `عرض ${logs.length} من ${totalCount} سجل`
                : `Showing ${logs.length} of ${totalCount} records`}
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
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
    </div>
  );
};

export default ZKAttendanceLogs;
