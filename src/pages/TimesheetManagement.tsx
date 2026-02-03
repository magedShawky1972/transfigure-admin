import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Clock, CheckCircle, XCircle, AlertTriangle, Calculator, Mail, MailX, Send, Loader2, Pencil } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

interface AttendanceType {
  id: string;
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  allow_late_minutes: number | null;
  allow_early_exit_minutes: number | null;
}

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  shift_type: string;
  fixed_shift_start: string | null;
  fixed_shift_end: string | null;
  basic_salary: number | null;
  attendance_type_id: string | null;
  attendance_types?: AttendanceType;
}

interface Timesheet {
  id: string;
  employee_id: string;
  work_date: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  break_duration_minutes: number;
  status: string;
  is_absent: boolean;
  absence_reason: string | null;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  total_work_minutes: number;
  deduction_amount: number;
  deduction_rule_id: string | null;
  overtime_amount: number;
  notes: string | null;
  employees?: {
    employee_number: string;
    first_name: string;
    last_name: string;
    zk_employee_code: string | null;
  };
  mailSent?: boolean;
  deduction_rules?: {
    rule_name: string;
    rule_name_ar: string | null;
    deduction_type: string;
    deduction_value: number;
  };
}

interface DeductionRule {
  id: string;
  rule_name: string;
  rule_type: string;
  min_minutes: number | null;
  max_minutes: number | null;
  deduction_type: string;
  deduction_value: number;
  is_overtime: boolean;
  overtime_multiplier: number;
}

export default function TimesheetManagement() {
  const { language } = useLanguage();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [sendingDeductionMails, setSendingDeductionMails] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [formData, setFormData] = useState({
    employee_id: "",
    work_date: format(new Date(), "yyyy-MM-dd"),
    scheduled_start: "",
    scheduled_end: "",
    actual_start: "",
    actual_end: "",
    break_duration_minutes: 0,
    is_absent: false,
    absence_reason: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedEmployee]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesRes, rulesRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, employee_number, first_name, last_name, shift_type, fixed_shift_start, fixed_shift_end, basic_salary, attendance_type_id, attendance_types(id, fixed_start_time, fixed_end_time, allow_late_minutes, allow_early_exit_minutes)")
          .eq("employment_status", "active")
          .order("employee_number"),
        supabase.from("deduction_rules").select("*").eq("is_active", true).order("rule_type"),
      ]);

      setEmployees(employeesRes.data || []);
      setDeductionRules(rulesRes.data || []);

      // Only fetch timesheets if we have a valid date
      if (!selectedDate) {
        setTimesheets([]);
        setLoading(false);
        return;
      }

      // Fetch timesheets
      let query = supabase
        .from("timesheets")
        .select(`
          *,
          employees(employee_number, first_name, last_name, zk_employee_code),
          deduction_rules(rule_name, rule_name_ar, deduction_type, deduction_value)
        `)
        .eq("work_date", selectedDate)
        .order("employees(employee_number)");

      if (selectedEmployee) {
        query = query.eq("employee_id", selectedEmployee);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Mail status is now directly on timesheets table (deduction_notification_sent)
      const timesheetsWithMailStatus = (data || []).map(ts => ({
        ...ts,
        mailSent: ts.deduction_notification_sent === true
      }));

      setTimesheets(timesheetsWithMailStatus);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimesheet = (data: typeof formData, employee: Employee | undefined): Partial<Timesheet> & { deduction_rule_id?: string | null } => {
    let late_minutes = 0;
    let early_leave_minutes = 0;
    let overtime_minutes = 0;
    let total_work_minutes = 0;
    let deduction_amount = 0;
    let overtime_amount = 0;
    let deduction_rule_id: string | null = null;

    if (data.is_absent) {
      // Find absence rule
      const absenceRule = deductionRules.find((r) => r.rule_type === "absence");
      if (absenceRule && employee?.basic_salary) {
        const dailySalary = employee.basic_salary / 30;
        deduction_amount = dailySalary * absenceRule.deduction_value;
        deduction_rule_id = absenceRule.id;
      }
      return { late_minutes, early_leave_minutes, overtime_minutes, total_work_minutes, deduction_amount, overtime_amount, deduction_rule_id };
    }

    if (data.actual_start && data.actual_end && data.scheduled_start && data.scheduled_end) {
      const scheduledStart = parseISO(`${data.work_date}T${data.scheduled_start}`);
      const scheduledEnd = parseISO(`${data.work_date}T${data.scheduled_end}`);
      const actualStart = parseISO(`${data.work_date}T${data.actual_start}`);
      const actualEnd = parseISO(`${data.work_date}T${data.actual_end}`);

      // Calculate late minutes
      if (actualStart > scheduledStart) {
        late_minutes = differenceInMinutes(actualStart, scheduledStart);
      }

      // Calculate early leave minutes
      if (actualEnd < scheduledEnd) {
        early_leave_minutes = differenceInMinutes(scheduledEnd, actualEnd);
      }

      // Calculate overtime
      if (actualEnd > scheduledEnd) {
        overtime_minutes = differenceInMinutes(actualEnd, scheduledEnd);
      }

      // Calculate total work minutes
      total_work_minutes = differenceInMinutes(actualEnd, actualStart) - data.break_duration_minutes;

      // Find matching deduction rule for late arrival
      if (late_minutes > 0) {
        const lateRule = deductionRules
          .filter((r) => r.rule_type === "late_arrival")
          .find((r) => {
            const min = r.min_minutes || 0;
            const max = r.max_minutes || Infinity;
            return late_minutes >= min && late_minutes <= max;
          });

        // Only assign rule if it has actual deduction value > 0
        if (lateRule && lateRule.deduction_value > 0) {
          deduction_rule_id = lateRule.id;
          
          if (employee?.basic_salary) {
            const dailySalary = employee.basic_salary / 30;
            const hourlyRate = dailySalary / 8;

            if (lateRule.deduction_type === "fixed") {
              deduction_amount = lateRule.deduction_value;
            } else if (lateRule.deduction_type === "percentage") {
              deduction_amount = dailySalary * lateRule.deduction_value;
            } else if (lateRule.deduction_type === "hourly") {
              deduction_amount = hourlyRate * (late_minutes / 60) * lateRule.deduction_value;
            }
          }
        } else {
          // Rule has 0% deduction or no rule found - don't assign
          deduction_rule_id = null;
          deduction_amount = 0;
        }
      } else {
        // No late minutes - clear deduction rule
        deduction_rule_id = null;
        deduction_amount = 0;
      }

      // Calculate overtime pay
      if (overtime_minutes > 0 && employee?.basic_salary) {
        const dailySalary = employee.basic_salary / 30;
        const hourlyRate = dailySalary / 8;
        const overtimeRule = deductionRules.find((r) => r.is_overtime);
        const multiplier = overtimeRule?.overtime_multiplier || 1.5;
        overtime_amount = hourlyRate * (overtime_minutes / 60) * multiplier;
      }
    }

    return { late_minutes, early_leave_minutes, overtime_minutes, total_work_minutes, deduction_amount, overtime_amount, deduction_rule_id };
  };

  const openAddDialog = () => {
    setEditingTimesheet(null);
    setFormData({
      employee_id: "",
      work_date: selectedDate,
      scheduled_start: "",
      scheduled_end: "",
      actual_start: "",
      actual_end: "",
      break_duration_minutes: 0,
      is_absent: false,
      absence_reason: "",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (timesheet: Timesheet) => {
    setEditingTimesheet(timesheet);
    setFormData({
      employee_id: timesheet.employee_id,
      work_date: timesheet.work_date,
      scheduled_start: timesheet.scheduled_start || "",
      scheduled_end: timesheet.scheduled_end || "",
      actual_start: timesheet.actual_start || "",
      actual_end: timesheet.actual_end || "",
      break_duration_minutes: timesheet.break_duration_minutes || 0,
      is_absent: timesheet.is_absent,
      absence_reason: timesheet.absence_reason || "",
      notes: timesheet.notes || "",
    });
    setDialogOpen(true);
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      // Prioritize attendance_type times over employee fixed times
      const scheduledStart = employee.attendance_types?.fixed_start_time || employee.fixed_shift_start || "";
      const scheduledEnd = employee.attendance_types?.fixed_end_time || employee.fixed_shift_end || "";
      
      setFormData({
        ...formData,
        employee_id: employeeId,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      });
    }
  };

  // Get the selected employee's attendance type settings
  const currentEmployee = employees.find((e) => e.id === formData.employee_id);
  const allowLateMinutes = currentEmployee?.attendance_types?.allow_late_minutes || 0;
  const allowEarlyExitMinutes = currentEmployee?.attendance_types?.allow_early_exit_minutes || 0;

  // Calculate delay (late minutes) automatically based on actual vs scheduled start
  // Only count as delay if it exceeds the allowed late minutes
  const calculateDelay = (): number => {
    if (!formData.scheduled_start || !formData.actual_start || formData.is_absent) return 0;
    
    const scheduledStart = parseISO(`${formData.work_date}T${formData.scheduled_start}`);
    const actualStart = parseISO(`${formData.work_date}T${formData.actual_start}`);
    
    if (actualStart > scheduledStart) {
      const lateMinutes = differenceInMinutes(actualStart, scheduledStart);
      // Subtract allowed late minutes - only count excess as delay
      const actualDelay = lateMinutes - allowLateMinutes;
      return actualDelay > 0 ? actualDelay : 0;
    }
    return 0;
  };

  // Calculate early leave (left before scheduled end)
  // Only count as early leave if it exceeds the allowed early exit minutes
  const calculateEarlyLeave = (): number => {
    if (!formData.scheduled_end || !formData.actual_end || formData.is_absent) return 0;
    
    const scheduledEnd = parseISO(`${formData.work_date}T${formData.scheduled_end}`);
    const actualEnd = parseISO(`${formData.work_date}T${formData.actual_end}`);
    
    if (actualEnd < scheduledEnd) {
      const earlyMinutes = differenceInMinutes(scheduledEnd, actualEnd);
      // Subtract allowed early exit minutes - only count excess as early leave
      const actualEarlyLeave = earlyMinutes - allowEarlyExitMinutes;
      return actualEarlyLeave > 0 ? actualEarlyLeave : 0;
    }
    return 0;
  };

  // Calculate total attendance hours
  const calculateTotalHours = (): { hours: number; minutes: number } => {
    if (!formData.actual_start || !formData.actual_end || formData.is_absent) {
      return { hours: 0, minutes: 0 };
    }
    
    const actualStart = parseISO(`${formData.work_date}T${formData.actual_start}`);
    const actualEnd = parseISO(`${formData.work_date}T${formData.actual_end}`);
    
    let totalMinutes = differenceInMinutes(actualEnd, actualStart);
    totalMinutes -= formData.break_duration_minutes || 0; // Subtract break time
    
    if (totalMinutes < 0) totalMinutes = 0;
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  const delayMinutes = calculateDelay();
  const earlyLeaveMinutes = calculateEarlyLeave();
  const totalAttendance = calculateTotalHours();

  const handleSave = async () => {
    if (!formData.employee_id || !formData.work_date) {
      toast.error(language === "ar" ? "يرجى اختيار الموظف والتاريخ" : "Please select employee and date");
      return;
    }

    try {
      const employee = employees.find((e) => e.id === formData.employee_id);
      const calculations = calculateTimesheet(formData, employee);

      const payload = {
        employee_id: formData.employee_id,
        work_date: formData.work_date,
        scheduled_start: formData.scheduled_start || null,
        scheduled_end: formData.scheduled_end || null,
        actual_start: formData.actual_start || null,
        actual_end: formData.actual_end || null,
        break_duration_minutes: formData.break_duration_minutes,
        is_absent: formData.is_absent,
        absence_reason: formData.absence_reason || null,
        notes: formData.notes || null,
        // Reset notification flag when editing so new deduction can be re-sent
        deduction_notification_sent: false,
        deduction_notification_sent_at: null,
        ...calculations,
      };

      const { error } = await supabase.from("timesheets").upsert(payload, {
        onConflict: "employee_id,work_date",
      });

      if (error) throw error;
      toast.success(language === "ar" ? "تم الحفظ بنجاح" : "Saved successfully");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("timesheets")
        .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تمت الموافقة" : "Approved");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("timesheets")
        .update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الرفض" : "Rejected");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleResendDeductionMails = async () => {
    if (!selectedDate) {
      toast.error(language === "ar" ? "يرجى اختيار التاريخ" : "Please select a date");
      return;
    }

    setSendingDeductionMails(true);
    try {
      // First reset the deduction_notification_sent flag for the selected date
      const { error: resetError } = await supabase
        .from('timesheets')
        .update({ 
          deduction_notification_sent: false, 
          deduction_notification_sent_at: null 
        })
        .eq('work_date', selectedDate);

      if (resetError) throw resetError;

      // Call the edge function to send deduction notifications
      const { data, error } = await supabase.functions.invoke('send-deduction-notification', {
        body: { target_date: selectedDate }
      });

      if (error) throw error;

      toast.success(
        language === "ar" 
          ? `تم إرسال ${data?.count || 0} رسائل خصم بنجاح` 
          : `Successfully sent ${data?.count || 0} deduction emails`
      );
      
      fetchData(); // Refresh to show updated mail status
    } catch (error: any) {
      console.error('Error sending deduction mails:', error);
      toast.error(error.message || (language === "ar" ? "فشل في إرسال الرسائل" : "Failed to send emails"));
    } finally {
      setSendingDeductionMails(false);
    }
  };

  const getStatusBadge = (status: string, isAbsent: boolean) => {
    if (isAbsent) {
      return <Badge variant="destructive">{language === "ar" ? "غائب" : "Absent"}</Badge>;
    }
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">{language === "ar" ? "معتمد" : "Approved"}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{language === "ar" ? "مرفوض" : "Rejected"}</Badge>;
      case "vacation":
        return <Badge className="bg-blue-100 text-blue-800">{language === "ar" ? "إجازة" : "Vacation"}</Badge>;
      default:
        return <Badge variant="secondary">{language === "ar" ? "معلق" : "Pending"}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {language === "ar" ? "إدارة سجل الحضور" : "Timesheet Management"}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleResendDeductionMails}
              disabled={sendingDeductionMails || !selectedDate}
            >
              {sendingDeductionMails ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {language === "ar" ? "إرسال رسائل الخصم" : "Send Deduction Mails"}
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {language === "ar" ? "إضافة سجل" : "Add Entry"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="space-y-2">
              <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الموظف" : "Employee"}</Label>
              <Select value={selectedEmployee || "_all_"} onValueChange={(v) => setSelectedEmployee(v === "_all_" ? "" : v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={language === "ar" ? "جميع الموظفين" : "All Employees"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">{language === "ar" ? "جميع الموظفين" : "All Employees"}</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.employee_number} - {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{timesheets.length}</p>
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "إجمالي السجلات" : "Total Entries"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {timesheets.filter((t) => t.status === "approved").length}
                  </p>
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "معتمد" : "Approved"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {timesheets.filter((t) => t.status === "pending").length}
                  </p>
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "معلق" : "Pending"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {timesheets.filter((t) => t.is_absent).length}
                  </p>
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "غياب" : "Absent"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الموظف" : "Employee"}</TableHead>
                  <TableHead>{language === "ar" ? "المجدول" : "Scheduled"}</TableHead>
                  <TableHead>{language === "ar" ? "الفعلي" : "Actual"}</TableHead>
                  <TableHead>{language === "ar" ? "ساعات العمل" : "Work Hours"}</TableHead>
                  <TableHead>{language === "ar" ? "التأخير" : "Late"}</TableHead>
                  <TableHead>{language === "ar" ? "الإضافي" : "Overtime"}</TableHead>
                  <TableHead>{language === "ar" ? "نوع الخصم" : "Deduction Type"}</TableHead>
                  <TableHead>{language === "ar" ? "الخصم" : "Deduction"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "البريد" : "Mail Sent"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : timesheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      {language === "ar" ? "لا توجد سجلات" : "No records found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  timesheets.map((ts) => (
                    <TableRow key={ts.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {ts.employees?.first_name} {ts.employees?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{ts.employees?.employee_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ts.scheduled_start && ts.scheduled_end
                          ? `${ts.scheduled_start} - ${ts.scheduled_end}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {ts.actual_start || ts.actual_end
                          ? `${ts.actual_start || '-'} - ${ts.actual_end || '-'}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {Math.floor(ts.total_work_minutes / 60)}h {ts.total_work_minutes % 60}m
                      </TableCell>
                      <TableCell className={ts.deduction_rules && ts.deduction_rules.deduction_value > 0 ? "text-destructive font-medium" : ""}>
                        {ts.late_minutes > 0 ? `${ts.late_minutes}m` : "-"}
                      </TableCell>
                      <TableCell className={ts.overtime_minutes > 0 ? "text-green-600 font-medium" : ""}>
                        {ts.overtime_minutes > 0 ? `${ts.overtime_minutes}m` : "-"}
                      </TableCell>
                      <TableCell className={ts.deduction_rules && ts.deduction_rules.deduction_value > 0 ? "text-destructive font-medium" : ""}>
                        {ts.deduction_rules && ts.deduction_rules.deduction_value > 0
                          ? (language === "ar" ? ts.deduction_rules.rule_name_ar || ts.deduction_rules.rule_name : ts.deduction_rules.rule_name)
                          : "-"}
                      </TableCell>
                      <TableCell className={ts.deduction_rules && ts.deduction_rules.deduction_value > 0 ? "text-destructive font-medium" : ""}>
                        {ts.deduction_rules && ts.deduction_rules.deduction_value > 0
                          ? ts.deduction_rules.deduction_type === 'percentage' 
                            ? `${(ts.deduction_rules.deduction_value * 100).toFixed(0)}%`
                            : ts.deduction_rules.deduction_type === 'fixed'
                              ? `${ts.deduction_rules.deduction_value.toFixed(0)}`
                              : `${ts.deduction_rules.deduction_value}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {ts.deduction_rules && ts.deduction_amount > 0 ? (
                          ts.mailSent ? (
                            <Mail className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <MailX className="h-4 w-4 text-muted-foreground mx-auto" />
                          )
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(ts.status, ts.is_absent)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(ts)}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          {ts.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleApprove(ts.id)}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleReject(ts.id)}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTimesheet 
                ? (language === "ar" ? "تعديل سجل حضور" : "Edit Timesheet Entry")
                : (language === "ar" ? "إضافة سجل حضور" : "Add Timesheet Entry")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الموظف *" : "Employee *"}</Label>
              <Select 
                value={formData.employee_id} 
                onValueChange={handleEmployeeSelect}
                disabled={!!editingTimesheet}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر الموظف" : "Select Employee"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.employee_number} - {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "التاريخ *" : "Date *"}</Label>
              <Input
                type="date"
                value={formData.work_date}
                onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                disabled={!!editingTimesheet}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_absent"
                checked={formData.is_absent}
                onChange={(e) => setFormData({ ...formData, is_absent: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_absent">{language === "ar" ? "غائب" : "Absent"}</Label>
            </div>

            {formData.is_absent ? (
              <div className="space-y-2">
                <Label>{language === "ar" ? "سبب الغياب" : "Absence Reason"}</Label>
                <Textarea
                  value={formData.absence_reason}
                  onChange={(e) => setFormData({ ...formData, absence_reason: e.target.value })}
                  rows={2}
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "بداية الوردية المجدولة" : "Scheduled Start"}</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_start}
                      onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "نهاية الوردية المجدولة" : "Scheduled End"}</Label>
                    <Input
                      type="time"
                      value={formData.scheduled_end}
                      onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "وقت الحضور الفعلي" : "Actual Start"}</Label>
                    <Input
                      type="time"
                      value={formData.actual_start}
                      onChange={(e) => setFormData({ ...formData, actual_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "وقت الانصراف الفعلي" : "Actual End"}</Label>
                    <Input
                      type="time"
                      value={formData.actual_end}
                      onChange={(e) => setFormData({ ...formData, actual_end: e.target.value })}
                    />
                  </div>
                </div>

                {/* Attendance Summary - Auto calculated */}
                {(delayMinutes > 0 || earlyLeaveMinutes > 0 || (totalAttendance.hours > 0 || totalAttendance.minutes > 0)) && (
                  <div className="p-3 bg-muted/50 border rounded-lg space-y-2">
                    {/* Total Hours */}
                    {(totalAttendance.hours > 0 || totalAttendance.minutes > 0) && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {language === "ar" ? "إجمالي ساعات الحضور:" : "Total Attendance:"} {totalAttendance.hours}{language === "ar" ? " ساعة " : "h "}{totalAttendance.minutes}{language === "ar" ? " دقيقة" : "m"}
                        </span>
                      </div>
                    )}
                    
                    {/* Delay */}
                    {delayMinutes > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">
                          {language === "ar" ? "التأخير:" : "Delay:"} {delayMinutes} {language === "ar" ? "دقيقة" : "min"}
                        </span>
                      </div>
                    )}
                    
                    {/* Early Leave */}
                    {earlyLeaveMinutes > 0 && (
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-amber-500">
                          {language === "ar" ? "الانصراف المبكر:" : "Early Leave:"} {earlyLeaveMinutes} {language === "ar" ? "دقيقة" : "min"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{language === "ar" ? "مدة الاستراحة (دقائق)" : "Break Duration (minutes)"}</Label>
                  <Input
                    type="number"
                    value={formData.break_duration_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, break_duration_minutes: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              <Calculator className="h-4 w-4 mr-2" />
              {language === "ar" ? "حفظ وحساب" : "Save & Calculate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
