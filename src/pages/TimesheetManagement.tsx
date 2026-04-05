import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Plus, Clock, CheckCircle, XCircle, AlertTriangle, Calculator, Mail, MailX, Send, Loader2, Pencil, UserX, Printer, ArrowUpDown, ArrowUp, ArrowDown, Download, RefreshCw, Lock, Unlock, ShieldCheck, Home, Building2, MessageSquare } from "lucide-react";
import AttendancePrintDialog from "@/components/AttendancePrintDialog";
import { getPrintLogoUrl } from "@/lib/printLogo";
import { format, parseISO, differenceInMinutes } from "date-fns";
import ExcelJS from "exceljs";

type SortKey = "work_date" | "employee" | "late_minutes" | "overtime_minutes" | "total_work_minutes" | "status" | "deduction";
interface SortCriteria { key: SortKey; direction: "asc" | "desc"; }

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
  user_id: string | null;
  department_id: string | null;
  attendance_types?: AttendanceType;
}

interface Department {
  id: string;
  department_name: string;
  parent_department_id: string | null;
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

const NAWAF_USER_ID = "6ac2d3f0-775e-401f-87ce-da2e09c14f07";

export default function TimesheetManagement() {
  const { language } = useLanguage();
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<Timesheet | null>(null);
  const [sendingDeductionMails, setSendingDeductionMails] = useState(false);
  const [filterMode, setFilterMode] = useState<"date" | "month" | "range">("date");
  const [dateFrom, setDateFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [formData, setFormData] = useState({
    employee_id: "",
    work_date: format(new Date(), "yyyy-MM-dd"),
    scheduled_start: "",
    scheduled_end: "",
    actual_start: "",
    actual_end: "",
    changed_start: "",
    changed_end: "",
    break_duration_minutes: 0,
    is_absent: false,
    absence_reason: "",
    notes: "",
  });
  const [frequentlyLateEmployees, setFrequentlyLateEmployees] = useState<{employeeId: string; name: string; count: number; photoUrl: string | null}[]>([]);
  const [naughtyDrilldownOpen, setNaughtyDrilldownOpen] = useState(false);
  const [naughtyDrilldownEmployee, setNaughtyDrilldownEmployee] = useState<{employeeId: string; name: string} | null>(null);
  const [naughtyDrilldownRecords, setNaughtyDrilldownRecords] = useState<{work_date: string; late_minutes: number; scheduled_start: string | null; actual_start: string | null; deduction_rule_name: string | null}[]>([]);
  const [naughtyDrilldownLoading, setNaughtyDrilldownLoading] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>([
    { key: "work_date", direction: "asc" },
    { key: "employee", direction: "asc" },
  ]);
  const [isNawaf, setIsNawaf] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [monthLocked, setMonthLocked] = useState(false);
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set());
  const [lockLoading, setLockLoading] = useState(false);
  const [managerNoteDialogOpen, setManagerNoteDialogOpen] = useState(false);
  const [managerNoteTimesheetId, setManagerNoteTimesheetId] = useState<string>("");
  const [managerNoteText, setManagerNoteText] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  const handleSort = (key: SortKey, ctrlKey: boolean) => {
    setSortCriteria((prev) => {
      const existingIndex = prev.findIndex((s) => s.key === key);
      if (ctrlKey) {
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { key, direction: updated[existingIndex].direction === "asc" ? "desc" : "asc" };
          return updated;
        }
        return [...prev, { key, direction: "asc" }];
      }
      if (existingIndex >= 0 && prev.length === 1) {
        return [{ key, direction: prev[0].direction === "asc" ? "desc" : "asc" }];
      }
      return [{ key, direction: "asc" }];
    });
  };

  const getSortIcon = (key: SortKey) => {
    const criteria = sortCriteria.find((s) => s.key === key);
    const index = sortCriteria.findIndex((s) => s.key === key);
    if (!criteria) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    const Icon = criteria.direction === "asc" ? ArrowUp : ArrowDown;
    return (
      <span className="inline-flex items-center gap-0.5">
        <Icon className="h-3 w-3" />
        {sortCriteria.length > 1 && <span className="text-[10px] font-bold">{index + 1}</span>}
      </span>
    );
  };

  const getEmployeeName = (ts: Timesheet) =>
    ts.employees ? `${ts.employees.first_name} ${ts.employees.last_name}` : "";

  const sortedTimesheets = [...timesheets].sort((a, b) => {
    for (const { key, direction } of sortCriteria) {
      const dir = direction === "asc" ? 1 : -1;
      let cmp = 0;
      switch (key) {
        case "work_date":
          cmp = a.work_date.localeCompare(b.work_date);
          break;
        case "employee":
          cmp = getEmployeeName(a).localeCompare(getEmployeeName(b));
          break;
        case "late_minutes":
          cmp = a.late_minutes - b.late_minutes;
          break;
        case "overtime_minutes":
          cmp = a.overtime_minutes - b.overtime_minutes;
          break;
        case "total_work_minutes":
          cmp = a.total_work_minutes - b.total_work_minutes;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "deduction":
          cmp = (a.deduction_rules?.rule_name || "").localeCompare(b.deduction_rules?.rule_name || "");
          break;
      }
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });

  const exportToExcel = async () => {
    if (sortedTimesheets.length === 0) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(language === "ar" ? "كشف الحضور" : "Timesheet");

    const headers = [
      language === "ar" ? "التاريخ" : "Date",
      language === "ar" ? "رقم الموظف" : "Emp #",
      language === "ar" ? "الموظف" : "Employee",
      language === "ar" ? "المجدول" : "Scheduled",
      language === "ar" ? "الفعلي" : "Actual",
      language === "ar" ? "ساعات العمل" : "Work Hours",
      language === "ar" ? "التأخير (دقائق)" : "Late (min)",
      language === "ar" ? "الإضافي (دقائق)" : "Overtime (min)",
      language === "ar" ? "نوع الخصم" : "Deduction Type",
      language === "ar" ? "الحالة" : "Status",
    ];

    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1a1a2e" } };
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    sortedTimesheets.forEach((ts) => {
      ws.addRow([
        ts.work_date,
        ts.employees?.employee_number || "",
        getEmployeeName(ts),
        ts.scheduled_start && ts.scheduled_end ? `${ts.scheduled_start} - ${ts.scheduled_end}` : "-",
        ts.actual_start || ts.actual_end ? `${ts.actual_start || "-"} - ${ts.actual_end || "-"}` : "-",
        `${Math.floor(ts.total_work_minutes / 60)}h ${ts.total_work_minutes % 60}m`,
        ts.late_minutes,
        ts.overtime_minutes,
        ts.deduction_rules && ts.deduction_rules.deduction_value > 0
          ? (language === "ar" ? ts.deduction_rules.rule_name_ar || ts.deduction_rules.rule_name : ts.deduction_rules.rule_name)
          : "-",
        ts.is_absent ? (language === "ar" ? "غائب" : "Absent") : ts.status,
      ]);
    });

    ws.columns.forEach((col) => { col.width = 18; });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(language === "ar" ? "تم التصدير بنجاح" : "Exported successfully");
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedMonth, filterMode, selectedEmployee, dateFrom, dateTo, selectedDepartment]);

  useEffect(() => {
    fetchFrequentlyLateEmployees();
    checkCurrentUser();
  }, []);

  // Fetch month lock status whenever the selected month changes
  const getActiveMonthKey = (): string => {
    if (filterMode === "month") return selectedMonth;
    if (filterMode === "date") return selectedDate.substring(0, 7);
    if (filterMode === "range") return dateFrom.substring(0, 7);
    return format(new Date(), "yyyy-MM");
  };

  useEffect(() => {
    fetchMonthLockStatus();
  }, [selectedMonth, selectedDate, dateFrom, filterMode]);

  const checkCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setIsNawaf(user.id === NAWAF_USER_ID);
        const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user.id).single();
        if (profile) setCurrentUserName(profile.user_name || user.email || "");
      }
    } catch (error) {
      console.error("Error checking user:", error);
    }
  };

  const fetchMonthLockStatus = async () => {
    try {
      const monthKey = getActiveMonthKey();
      if (!monthKey) return;

      const [lockRes, permRes] = await Promise.all([
        supabase.from("timesheet_month_locks").select("*").eq("month_key", monthKey).maybeSingle(),
        supabase.from("timesheet_edit_permissions").select("employee_id").eq("month_key", monthKey).eq("is_active", true),
      ]);

      setMonthLocked(lockRes.data?.is_confirmed === true);
      setEditPermissions(new Set((permRes.data || []).map((p: any) => p.employee_id)));
    } catch (error) {
      console.error("Error fetching lock status:", error);
    }
  };

  const handleConfirmMonth = async () => {
    const monthKey = getActiveMonthKey();
    if (!monthKey) return;
    setLockLoading(true);
    try {
      const { error } = await supabase.from("timesheet_month_locks").upsert({
        month_key: monthKey,
        is_confirmed: true,
        confirmed_by: currentUserId,
        confirmed_at: new Date().toISOString(),
      }, { onConflict: "month_key" });
      if (error) throw error;

      // Revoke all edit permissions for this month
      await supabase.from("timesheet_edit_permissions")
        .update({ is_active: false })
        .eq("month_key", monthKey);

      setMonthLocked(true);
      setEditPermissions(new Set());
      toast.success(language === "ar" ? "تم تأكيد الشهر وإغلاق التعديل" : "Month confirmed and editing locked");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlockMonth = async () => {
    const monthKey = getActiveMonthKey();
    if (!monthKey) return;
    setLockLoading(true);
    try {
      const { error } = await supabase.from("timesheet_month_locks").upsert({
        month_key: monthKey,
        is_confirmed: false,
        confirmed_by: null,
        confirmed_at: null,
      }, { onConflict: "month_key" });
      if (error) throw error;
      setMonthLocked(false);
      toast.success(language === "ar" ? "تم فتح التعديل للشهر" : "Month editing unlocked");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleToggleEmployeeEdit = async (employeeId: string) => {
    const monthKey = getActiveMonthKey();
    if (!monthKey) return;
    
    const hasPermission = editPermissions.has(employeeId);
    try {
      if (hasPermission) {
        // Revoke permission
        await supabase.from("timesheet_edit_permissions")
          .update({ is_active: false })
          .eq("month_key", monthKey)
          .eq("employee_id", employeeId);
        setEditPermissions(prev => { const n = new Set(prev); n.delete(employeeId); return n; });
        toast.success(language === "ar" ? "تم إغلاق التعديل للموظف" : "Edit closed for employee");
      } else {
        // Grant permission
        await supabase.from("timesheet_edit_permissions").upsert({
          month_key: monthKey,
          employee_id: employeeId,
          granted_by: currentUserId,
          is_active: true,
        }, { onConflict: "month_key,employee_id" });
        setEditPermissions(prev => new Set(prev).add(employeeId));
        toast.success(language === "ar" ? "تم فتح التعديل للموظف" : "Edit opened for employee");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const canEditTimesheet = (ts: Timesheet): boolean => {
    // Nawaf can always edit
    if (isNawaf) return true;
    // Other users can only edit if Nawaf explicitly granted them permission
    return editPermissions.has(ts.employee_id);
  };

  const fetchFrequentlyLateEmployees = async () => {
    try {
      // Fetch timesheets with late minutes > 0 from the current month only
      const now = new Date();
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      
      const [timesheetsRes, delaysRes] = await Promise.all([
        supabase
          .from("timesheets")
          .select(`employee_id, work_date, late_minutes, employees(first_name, last_name, photo_url)`)
          .gt("late_minutes", 0)
          .gte("work_date", monthStart),
        supabase
          .from("employee_requests")
          .select("employee_id, delay_date")
          .eq("request_type", "delay")
          .eq("status", "approved")
          .not("delay_date", "is", null),
      ]);
      
      if (timesheetsRes.error) throw timesheetsRes.error;
      
      // Build set of approved delay days
      const approvedDelaySet = new Set<string>();
      (delaysRes.data || []).forEach((r: any) => approvedDelaySet.add(`${r.employee_id}_${r.delay_date}`));
      
      // Group by employee and count late occurrences, excluding approved delays
      const lateCount = new Map<string, {employeeId: string; name: string; count: number; photoUrl: string | null}>();
      
      (timesheetsRes.data || []).forEach((record: any) => {
        const empId = record.employee_id;
        const key = `${empId}_${record.work_date}`;
        if (approvedDelaySet.has(key)) return; // Skip approved delay days
        
        const empName = record.employees ? `${record.employees.first_name} ${record.employees.last_name}` : "Unknown";
        const photoUrl = record.employees?.photo_url || null;
        
        if (lateCount.has(empId)) {
          lateCount.get(empId)!.count++;
        } else {
          lateCount.set(empId, { employeeId: empId, name: empName, count: 1, photoUrl });
        }
      });
      
      // Filter employees with 3+ late occurrences and sort by count
      const frequentlyLate = Array.from(lateCount.values())
        .filter(emp => emp.count >= 3)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Top 5
      
      setFrequentlyLateEmployees(frequentlyLate);
    } catch (error) {
      console.error("Error fetching frequently late employees:", error);
    }
  };

  const openNaughtyDrilldown = async (employeeId: string, employeeName: string) => {
    setNaughtyDrilldownEmployee({ employeeId, name: employeeName });
    setNaughtyDrilldownOpen(true);
    setNaughtyDrilldownLoading(true);
    try {
      const now = new Date();
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");

      const [tsRes, delaysRes] = await Promise.all([
        supabase
          .from("timesheets")
          .select("work_date, late_minutes, scheduled_start, actual_start, deduction_rules(rule_name, rule_name_ar)")
          .eq("employee_id", employeeId)
          .gt("late_minutes", 0)
          .gte("work_date", monthStart)
          .order("work_date", { ascending: false }),
        supabase
          .from("employee_requests")
          .select("delay_date")
          .eq("employee_id", employeeId)
          .eq("request_type", "delay")
          .eq("status", "approved")
          .not("delay_date", "is", null),
      ]);

      if (tsRes.error) throw tsRes.error;

      const approvedDates = new Set((delaysRes.data || []).map((r: any) => r.delay_date));

      setNaughtyDrilldownRecords((tsRes.data || [])
        .filter((r: any) => !approvedDates.has(r.work_date))
        .map((r: any) => ({
          work_date: r.work_date,
          late_minutes: r.late_minutes,
          scheduled_start: r.scheduled_start,
          actual_start: r.actual_start,
          deduction_rule_name: r.deduction_rules ? (language === 'ar' ? r.deduction_rules.rule_name_ar || r.deduction_rules.rule_name : r.deduction_rules.rule_name) : null,
        })));
    } catch (error) {
      console.error("Error fetching drilldown:", error);
    } finally {
      setNaughtyDrilldownLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesRes, rulesRes, deptsRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, employee_number, first_name, last_name, shift_type, fixed_shift_start, fixed_shift_end, basic_salary, attendance_type_id, user_id, department_id, attendance_types(id, fixed_start_time, fixed_end_time, allow_late_minutes, allow_early_exit_minutes)")
          .eq("employment_status", "active")
          .order("employee_number"),
        supabase.from("deduction_rules").select("*").eq("is_active", true).order("rule_type"),
        supabase.from("departments").select("id, department_name, parent_department_id").eq("is_active", true),
      ]);

      setEmployees(employeesRes.data || []);
      setDeductionRules(rulesRes.data || []);
      setDepartments(deptsRes.data || []);

      // Helper: get all descendant department IDs (including the given one)
      const getAllDescendantDeptIds = (parentId: string, allDepts: Department[]): string[] => {
        const result: string[] = [parentId];
        const children = allDepts.filter(d => d.parent_department_id === parentId);
        for (const child of children) {
          result.push(...getAllDescendantDeptIds(child.id, allDepts));
        }
        return result;
      };

      // Determine employee IDs to filter by department
      let departmentEmployeeIds: string[] | null = null;
      if (selectedDepartment) {
        const deptIds = getAllDescendantDeptIds(selectedDepartment, deptsRes.data || []);
        departmentEmployeeIds = (employeesRes.data || [])
          .filter(emp => emp.department_id && deptIds.includes(emp.department_id))
          .map(emp => emp.id);
      }

      // Only fetch timesheets if we have a valid date/month
      if (filterMode === "date" && !selectedDate) {
        setTimesheets([]);
        setLoading(false);
        return;
      }
      if (filterMode === "month" && !selectedMonth) {
        setTimesheets([]);
        setLoading(false);
        return;
      }
      if (filterMode === "range" && (!dateFrom || !dateTo)) {
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
        .order("work_date", { ascending: true });

      if (filterMode === "date") {
        query = query.eq("work_date", selectedDate);
      } else if (filterMode === "range") {
        query = query.gte("work_date", dateFrom).lte("work_date", dateTo);
      } else {
        // Month mode: filter by month range
        const [year, month] = selectedMonth.split("-").map(Number);
        const startDate = `${selectedMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("work_date", startDate).lte("work_date", endDate);
      }

      if (selectedEmployee) {
        query = query.eq("employee_id", selectedEmployee);
      } else if (departmentEmployeeIds !== null) {
        if (departmentEmployeeIds.length === 0) {
          // No employees in this department hierarchy - return empty
          setTimesheets([]);
          setLoading(false);
          return;
        }
        query = query.in("employee_id", departmentEmployeeIds);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Determine date range for vacation lookup
      let vacDateFrom = selectedDate;
      let vacDateTo = selectedDate;
      if (filterMode === "range") {
        vacDateFrom = dateFrom;
        vacDateTo = dateTo;
      } else if (filterMode === "month") {
        const [year, month] = selectedMonth.split("-").map(Number);
        vacDateFrom = `${selectedMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        vacDateTo = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      }

      // Fetch approved vacation/sick leave requests that overlap with the date range
      const { data: approvedLeaves } = await supabase
        .from("employee_requests")
        .select("employee_id, start_date, end_date, request_type, delay_date")
        .in("request_type", ["vacation", "sick_leave"])
        .eq("status", "approved")
        .lte("start_date", vacDateTo)
        .gte("end_date", vacDateFrom);

      // Also fetch manual vacation_requests
      const { data: manualVacations } = await supabase
        .from("vacation_requests")
        .select("employee_id, start_date, end_date")
        .eq("status", "approved")
        .lte("start_date", vacDateTo)
        .gte("end_date", vacDateFrom);

      // Fetch approved delay and early_leave requests that overlap with the date range
      const { data: approvedDelays } = await supabase
        .from("employee_requests")
        .select("employee_id, delay_date, request_type")
        .in("request_type", ["delay", "early_leave"])
        .eq("status", "approved")
        .not("delay_date", "is", null);

      // Fetch WFH check-ins for the date range
      // Build a map from user_id to employee_id
      const userToEmployee = new Map<string, string>();
      (employeesRes.data || []).forEach((emp: any) => {
        if (emp.user_id) userToEmployee.set(emp.user_id, emp.id);
      });

      let wfhQuery = supabase
        .from("wfh_checkins")
        .select("user_id, checkin_date, checkin_time, checkout_time");
      if (filterMode === "date") {
        wfhQuery = wfhQuery.eq("checkin_date", selectedDate);
      } else {
        wfhQuery = wfhQuery.gte("checkin_date", vacDateFrom).lte("checkin_date", vacDateTo);
      }

      // Fetch company WFH days (specific + recurring) in parallel with WFH check-ins
      const [{ data: wfhData }, { data: companyWfhSpecific }, { data: companyWfhRecurring }] = await Promise.all([
        wfhQuery,
        supabase.from("company_wfh_days").select("wfh_date").gte("wfh_date", vacDateFrom).lte("wfh_date", vacDateTo),
        supabase.from("company_wfh_recurring").select("day_of_week").eq("is_active", true),
      ]);

      // Build set of company WFH dates
      const companyWfhDateSet = new Set<string>();
      (companyWfhSpecific || []).forEach((d: any) => companyWfhDateSet.add(d.wfh_date));
      const activeRecurringDows = (companyWfhRecurring || []).map((r: any) => r.day_of_week as number);
      // Add recurring dates within range
      if (activeRecurringDows.length > 0) {
        const rangeStart = new Date(vacDateFrom + "T00:00:00");
        const rangeEnd = new Date(vacDateTo + "T00:00:00");
        for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
          if (activeRecurringDows.includes(d.getDay())) {
            companyWfhDateSet.add(d.toISOString().split("T")[0]);
          }
        }
      }

      // Build WFH sessions list (each check-in is a separate session)
      const wfhSessions: { empId: string; date: string; checkin_time: string | null; checkout_time: string | null }[] = [];
      const wfhDaysForApproval = new Set<string>(); // still used to clear deductions for ZK rows on WFH days
      (wfhData || []).forEach((wfh: any) => {
        const empId = userToEmployee.get(wfh.user_id);
        if (empId) {
          const key = `${empId}_${wfh.checkin_date}`;
          wfhDaysForApproval.add(key);
          wfhSessions.push({ empId, date: wfh.checkin_date, checkin_time: wfh.checkin_time, checkout_time: wfh.checkout_time });
        }
      });

      // Build a set of employee_id + date combos that are vacation days
      const vacationDays = new Set<string>();
      (approvedLeaves || []).forEach((leave: any) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          vacationDays.add(`${leave.employee_id}_${d.toISOString().split("T")[0]}`);
        }
      });
      (manualVacations || []).forEach((vac: any) => {
        const start = new Date(vac.start_date);
        const end = new Date(vac.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          vacationDays.add(`${vac.employee_id}_${d.toISOString().split("T")[0]}`);
        }
      });

      // Build sets for approved delay/early_leave dates
      const approvedDelayDays = new Set<string>();
      const approvedEarlyLeaveDays = new Set<string>();
      (approvedDelays || []).forEach((req: any) => {
        const key = `${req.employee_id}_${req.delay_date}`;
        if (req.request_type === "delay") {
          approvedDelayDays.add(key);
        } else if (req.request_type === "early_leave") {
          approvedEarlyLeaveDays.add(key);
        }
      });

      // Mail status + auto-detect vacation days + clear delay/early leave for approved requests
      // WFH days no longer overwrite ZK rows — WFH sessions appear as separate rows
      const timesheetsWithMailStatus = (data || []).map(ts => {
        const key = `${ts.employee_id}_${ts.work_date}`;
        const isVacationDay = vacationDays.has(key);
        const hasApprovedDelay = approvedDelayDays.has(key);
        const hasApprovedEarlyLeave = approvedEarlyLeaveDays.has(key);
        return {
          ...ts,
          mailSent: ts.deduction_notification_sent === true,
          status: isVacationDay ? "vacation" : ts.status,
          is_absent: isVacationDay ? false : ts.is_absent,
          late_minutes: hasApprovedDelay ? 0 : ts.late_minutes,
          early_leave_minutes: hasApprovedEarlyLeave ? 0 : ts.early_leave_minutes,
          deduction_amount: (hasApprovedDelay || hasApprovedEarlyLeave) ? 0 : ts.deduction_amount,
          deduction_rule_id: (hasApprovedDelay || hasApprovedEarlyLeave) ? null : ts.deduction_rule_id,
          deduction_rules: (hasApprovedDelay || hasApprovedEarlyLeave) ? null : ts.deduction_rules,
          has_approved_delay: hasApprovedDelay,
          has_approved_early_leave: hasApprovedEarlyLeave,
          is_wfh: false,
          is_virtual_wfh: false,
        };
      });

      // Build set of employee+date keys that have existing ZK/timesheet records
      const existingTimesheetKeys = new Set((data || []).map((ts: any) => `${ts.employee_id}_${ts.work_date}`));

      // Create virtual WFH rows for ALL WFH sessions (even if ZK record exists for same day)
      // If it's a company WFH day → calculate delay based on WFH check-in vs scheduled start
      // If NOT a company WFH day but has ZK record → WFH work minutes count as overtime
      const virtualWfhRows: any[] = [];
      wfhSessions.forEach((session, idx) => {
        const emp = (employeesRes.data || []).find((e: any) => e.id === session.empId);
        if (emp && (!selectedEmployee || selectedEmployee === session.empId) && (departmentEmployeeIds === null || departmentEmployeeIds.includes(session.empId))) {
          const workMinutes = session.checkin_time && session.checkout_time
            ? Math.max(0, differenceInMinutes(new Date(session.checkout_time), new Date(session.checkin_time)))
            : 0;
          const hasZkRecord = existingTimesheetKeys.has(`${session.empId}_${session.date}`);
          const isCompanyWfhDay = companyWfhDateSet.has(session.date);

          let lateMinutes = 0;
          let earlyLeaveMinutes = 0;
          let overtimeMinutes = 0;
          let overtimeAmount = 0;
          let deductionAmount = 0;
          let deductionRuleId: string | null = null;
          let scheduledStart: string | null = null;
          let scheduledEnd: string | null = null;
          let notes: string | null = null;

          if (isCompanyWfhDay) {
            // Company WFH day: calculate delay based on WFH check-in vs employee schedule
            const attType = emp.attendance_types;
            const fixedStart = attType?.fixed_start_time || emp.fixed_shift_start;
            const fixedEnd = attType?.fixed_end_time || emp.fixed_shift_end;
            const allowLate = attType?.allow_late_minutes || 0;
            const allowEarlyExit = attType?.allow_early_exit_minutes || 0;

            if (fixedStart) scheduledStart = fixedStart;
            if (fixedEnd) scheduledEnd = fixedEnd;

            if (session.checkin_time && fixedStart) {
              const schedStart = parseISO(`${session.date}T${fixedStart}`);
              const actualStart = new Date(session.checkin_time);
              const lateDiff = differenceInMinutes(actualStart, schedStart);
              if (lateDiff > allowLate) {
                lateMinutes = lateDiff;
              }
            }

            if (session.checkout_time && fixedEnd) {
              const schedEnd = parseISO(`${session.date}T${fixedEnd}`);
              const actualEnd = new Date(session.checkout_time);
              const earlyDiff = differenceInMinutes(schedEnd, actualEnd);
              if (earlyDiff > allowEarlyExit) {
                earlyLeaveMinutes = earlyDiff;
              }
            }

            // Calculate deduction for late/early on company WFH day
            if ((lateMinutes > 0 || earlyLeaveMinutes > 0) && emp.basic_salary) {
              const totalLateMinutes = lateMinutes + earlyLeaveMinutes;
              const matchingRule = deductionRules
                .filter((r: any) => r.rule_type === "late" && !r.is_overtime)
                .sort((a: any, b: any) => (b.min_minutes || 0) - (a.min_minutes || 0))
                .find((r: any) => totalLateMinutes >= (r.min_minutes || 0));
              if (matchingRule) {
                const dailySalary = emp.basic_salary / 30;
                deductionAmount = dailySalary * matchingRule.deduction_value;
                deductionRuleId = matchingRule.id;
              }
            }

            notes = language === "ar" ? "يوم عمل من المنزل (شركة)" : "Company WFH Day";
          } else if (hasZkRecord) {
            // Not a company WFH day but has ZK record: overtime
            overtimeMinutes = workMinutes;
            if (workMinutes > 0 && emp.basic_salary) {
              const dailySalary = emp.basic_salary / 30;
              const hourlyRate = dailySalary / 8;
              const overtimeRule = deductionRules.find((r: any) => r.is_overtime);
              const multiplier = overtimeRule?.overtime_multiplier || 1.5;
              overtimeAmount = hourlyRate * (workMinutes / 60) * multiplier;
            }
            notes = language === "ar" ? "ساعات إضافية من المنزل" : "WFH Extra Hours";
          }

          virtualWfhRows.push({
            id: `wfh-virtual-${session.empId}_${session.date}_${idx}`,
            employee_id: session.empId,
            work_date: session.date,
            scheduled_start: scheduledStart,
            scheduled_end: scheduledEnd,
            actual_start: session.checkin_time || null,
            actual_end: session.checkout_time || null,
            break_duration_minutes: 0,
            status: "present",
            is_absent: false,
            absence_reason: null,
            late_minutes: lateMinutes,
            early_leave_minutes: earlyLeaveMinutes,
            overtime_minutes: overtimeMinutes,
            total_work_minutes: workMinutes,
            deduction_amount: deductionAmount,
            deduction_rule_id: deductionRuleId,
            overtime_amount: overtimeAmount,
            notes,
            employees: {
              employee_number: emp.employee_number,
              first_name: emp.first_name,
              last_name: emp.last_name,
              zk_employee_code: null,
            },
            mailSent: false,
            deduction_rules: null,
            is_wfh: true,
            has_approved_delay: false,
            has_approved_early_leave: false,
            is_virtual_wfh: true,
            is_company_wfh_day: isCompanyWfhDay,
          });
        }
      });

      setTimesheets([...timesheetsWithMailStatus, ...virtualWfhRows]);
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

      // Calculate overtime - only count if worked MORE than scheduled hours
      // Must first offset any late arrival time before counting overtime
      const extraMinutesAfterEnd = actualEnd > scheduledEnd ? differenceInMinutes(actualEnd, scheduledEnd) : 0;
      const netOvertime = extraMinutesAfterEnd - late_minutes - early_leave_minutes;
      overtime_minutes = netOvertime > 0 ? netOvertime : 0;

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
      changed_start: "",
      changed_end: "",
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
      changed_start: (timesheet as any).changed_start || "",
      changed_end: (timesheet as any).changed_end || "",
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
    if (!formData.scheduled_start || formData.is_absent) return 0;
    const effectiveStart = formData.changed_start || formData.actual_start;
    if (!effectiveStart) return 0;
    
    const scheduledStart = parseISO(`${formData.work_date}T${formData.scheduled_start}`);
    const actualStart = parseISO(`${formData.work_date}T${effectiveStart}`);
    
    if (actualStart > scheduledStart) {
      const lateMinutes = differenceInMinutes(actualStart, scheduledStart);
      const actualDelay = lateMinutes - allowLateMinutes;
      return actualDelay > 0 ? actualDelay : 0;
    }
    return 0;
  };

  // Calculate early leave (left before scheduled end)
  // Only count as early leave if it exceeds the allowed early exit minutes
  const calculateEarlyLeave = (): number => {
    if (!formData.scheduled_end || formData.is_absent) return 0;
    const effectiveEnd = formData.changed_end || formData.actual_end;
    if (!effectiveEnd) return 0;
    
    const scheduledEnd = parseISO(`${formData.work_date}T${formData.scheduled_end}`);
    const actualEnd = parseISO(`${formData.work_date}T${effectiveEnd}`);
    
    if (actualEnd < scheduledEnd) {
      const earlyMinutes = differenceInMinutes(scheduledEnd, actualEnd);
      const actualEarlyLeave = earlyMinutes - allowEarlyExitMinutes;
      return actualEarlyLeave > 0 ? actualEarlyLeave : 0;
    }
    return 0;
  };

  // Calculate total attendance hours
  const calculateTotalHours = (): { hours: number; minutes: number } => {
    if (formData.is_absent) return { hours: 0, minutes: 0 };
    const effectiveStart = formData.changed_start || formData.actual_start;
    const effectiveEnd = formData.changed_end || formData.actual_end;
    if (!effectiveStart || !effectiveEnd) return { hours: 0, minutes: 0 };
    
    const actualStart = parseISO(`${formData.work_date}T${effectiveStart}`);
    const actualEnd = parseISO(`${formData.work_date}T${effectiveEnd}`);
    
    let totalMinutes = differenceInMinutes(actualEnd, actualStart);
    totalMinutes -= formData.break_duration_minutes || 0;
    
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
      
      // Use changed times for calculations if provided, otherwise use actual
      const calcData = {
        ...formData,
        actual_start: formData.changed_start || formData.actual_start,
        actual_end: formData.changed_end || formData.actual_end,
      };
      const calculations = calculateTimesheet(calcData, employee);

      const { data: { user } } = await supabase.auth.getUser();

      const payload: any = {
        employee_id: formData.employee_id,
        work_date: formData.work_date,
        scheduled_start: formData.scheduled_start || null,
        scheduled_end: formData.scheduled_end || null,
        actual_start: formData.actual_start || null,
        actual_end: formData.actual_end || null,
        changed_start: formData.changed_start || null,
        changed_end: formData.changed_end || null,
        break_duration_minutes: formData.break_duration_minutes,
        is_absent: formData.is_absent,
        absence_reason: formData.absence_reason || null,
        notes: formData.notes || null,
        // Reset notification flag when editing so new deduction can be re-sent
        deduction_notification_sent: false,
        deduction_notification_sent_at: null,
        ...calculations,
      };

      // Track who made the change
      if (formData.changed_start || formData.changed_end) {
        payload.changed_by = user?.id || null;
        payload.changed_at = new Date().toISOString();
      }

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
    if (filterMode !== "date") {
      toast.error(language === "ar" ? "يرجى اختيار يوم محدد لإرسال رسائل الخصم" : "Please select a specific date to send deduction mails");
      return;
    }
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

  const handlePrintDeductionSummary = () => {
    const isAr = language === "ar";
    
    // Group by employee and sum deductions
    const employeeDeductions = new Map<string, {
      empNumber: string;
      name: string;
      totalDeduction: number;
      totalOvertime: number;
      lateCount: number;
      earlyLeaveCount: number;
      absentCount: number;
      totalLateMinutes: number;
      totalEarlyLeaveMinutes: number;
      rules: Map<string, { name: string; count: number; amount: number }>;
    }>();

    sortedTimesheets.forEach(ts => {
      const empId = ts.employee_id;
      const empName = ts.employees ? `${ts.employees.first_name} ${ts.employees.last_name}` : "-";
      const empNumber = ts.employees?.employee_number || "-";

      if (!employeeDeductions.has(empId)) {
        employeeDeductions.set(empId, {
          empNumber,
          name: empName,
          totalDeduction: 0,
          totalOvertime: 0,
          lateCount: 0,
          earlyLeaveCount: 0,
          absentCount: 0,
          totalLateMinutes: 0,
          totalEarlyLeaveMinutes: 0,
          rules: new Map(),
        });
      }

      const emp = employeeDeductions.get(empId)!;
      emp.totalDeduction += ts.deduction_amount || 0;
      emp.totalOvertime += ts.overtime_amount || 0;
      if (ts.late_minutes > 0) {
        emp.lateCount++;
        emp.totalLateMinutes += ts.late_minutes;
      }
      if (ts.early_leave_minutes > 0) {
        emp.earlyLeaveCount++;
        emp.totalEarlyLeaveMinutes += ts.early_leave_minutes;
      }
      if (ts.is_absent) emp.absentCount++;

      if (ts.deduction_rules && ts.deduction_rules.deduction_value > 0) {
        const ruleName = isAr ? (ts.deduction_rules.rule_name_ar || ts.deduction_rules.rule_name) : ts.deduction_rules.rule_name;
        const existing = emp.rules.get(ruleName) || { name: ruleName, count: 0, amount: 0 };
        existing.count++;
        existing.amount += ts.deduction_amount || 0;
        emp.rules.set(ruleName, existing);
      }
    });

    // Filter employees with any deductions, absences, or late occurrences
    const withDeductions = Array.from(employeeDeductions.entries())
      .filter(([_, e]) => e.totalDeduction > 0 || e.absentCount > 0 || e.lateCount > 0 || e.earlyLeaveCount > 0)
      .sort((a, b) => b[1].totalDeduction - a[1].totalDeduction || b[1].lateCount - a[1].lateCount);

    if (withDeductions.length === 0) {
      toast.info(isAr ? "لا توجد خصومات للطباعة" : "No deductions to print");
      return;
    }

    const filterLabel = filterMode === "date"
      ? `${isAr ? "التاريخ" : "Date"}: ${selectedDate}`
      : filterMode === "month"
        ? `${isAr ? "الشهر" : "Month"}: ${selectedMonth}`
        : `${isAr ? "من" : "From"}: ${dateFrom} - ${isAr ? "إلى" : "To"}: ${dateTo}`;

    const logoUrl = getPrintLogoUrl();

    const grandTotalDeduction = withDeductions.reduce((s, [_, e]) => s + e.totalDeduction, 0);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <title>${isAr ? "ملخص الخصومات" : "Deduction Summary"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; color: #1a1a2e; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1a1a2e; padding-bottom: 15px; }
          .header img { height: 50px; margin-bottom: 8px; }
          .header h1 { font-size: 18px; margin-bottom: 4px; }
          .header p { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #1a1a2e; color: white; padding: 8px 6px; text-align: ${isAr ? 'right' : 'left'}; font-size: 11px; }
          td { padding: 7px 6px; border-bottom: 1px solid #ddd; font-size: 11px; }
          tr:nth-child(even) { background: #f8f8fa; }
          .total-row { font-weight: bold; background: #f0f0f5 !important; border-top: 2px solid #1a1a2e; }
          .rules-detail { font-size: 10px; color: #666; margin-top: 2px; }
          .text-red { color: #dc2626; font-weight: 600; }
          .text-green { color: #16a34a; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${logoUrl}" alt="Logo" />
          <h1>${isAr ? "ملخص الخصومات" : "Deduction Summary Report"}</h1>
          <p>${filterLabel}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${isAr ? "رقم الموظف" : "Emp #"}</th>
              <th>${isAr ? "الموظف" : "Employee"}</th>
              <th>${isAr ? "عدد التأخيرات" : "Late Count"}</th>
              <th>${isAr ? "إجمالي دقائق التأخير" : "Total Late (min)"}</th>
              <th>${isAr ? "عدد الخروج المبكر" : "Early Leave Count"}</th>
              <th>${isAr ? "إجمالي دقائق الخروج المبكر" : "Early Leave (min)"}</th>
              <th>${isAr ? "أيام الغياب" : "Absent Days"}</th>
              <th>${isAr ? "تفاصيل الخصم" : "Deduction Details"}</th>
              <th>${isAr ? "إجمالي الخصم" : "Total Deduction"}</th>
            </tr>
          </thead>
          <tbody>
            ${withDeductions.map(([_, emp], i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${emp.empNumber}</td>
                <td>${emp.name}</td>
                <td>${emp.lateCount}</td>
                <td>${emp.totalLateMinutes}</td>
                <td>${emp.earlyLeaveCount}</td>
                <td>${emp.totalEarlyLeaveMinutes}</td>
                <td>${emp.absentCount || "-"}</td>
                <td>
                  ${Array.from(emp.rules.values()).map(r => 
                    `<div class="rules-detail">${r.name}: ${r.count}x</div>`
                  ).join("")}
                </td>
                <td class="text-red">${emp.totalDeduction.toFixed(2)}</td>
              </tr>
            `).join("")}
            <tr class="total-row">
              <td colspan="${isAr ? 9 : 9}" style="text-align: ${isAr ? 'left' : 'right'};">${isAr ? "الإجمالي" : "Grand Total"}</td>
              <td class="text-red">${grandTotalDeduction.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          ${isAr ? "تم الطباعة بتاريخ" : "Printed on"}: ${format(new Date(), "yyyy-MM-dd HH:mm")}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
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
        return <Badge className="bg-yellow-400 text-red-600 font-bold">{language === "ar" ? "إجازة" : "Vacation"}</Badge>;
      case "holiday":
        return <Badge className="bg-purple-500 text-white font-bold">{language === "ar" ? "إجازة رسمية" : "Holiday"}</Badge>;
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
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchData()}
              disabled={loading}
              title={language === "ar" ? "تحديث" : "Refresh"}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={timesheets.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              {language === "ar" ? "تصدير Excel" : "Export Excel"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPrintDialogOpen(true)}
              disabled={timesheets.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              {language === "ar" ? "طباعة" : "Print"}
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintDeductionSummary}
              disabled={timesheets.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              {language === "ar" ? "ملخص الخصومات" : "Deduction Summary"}
            </Button>
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
            {isNawaf && (
              <>
                {monthLocked ? (
                  <Button variant="outline" onClick={handleUnlockMonth} disabled={lockLoading} className="border-amber-500 text-amber-600 hover:bg-amber-50">
                    {lockLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                    {language === "ar" ? "فتح التعديل" : "Unlock Edit"}
                  </Button>
                ) : (
                  <Button variant="default" onClick={handleConfirmMonth} disabled={lockLoading} className="bg-green-600 hover:bg-green-700">
                    {lockLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    {language === "ar" ? "تأكيد الشهر" : "Confirm Month"}
                  </Button>
                )}
              </>
            )}
            <Button onClick={openAddDialog} disabled={!isNawaf}>
              <Plus className="h-4 w-4 mr-2" />
              {language === "ar" ? "إضافة سجل" : "Add Entry"}
            </Button>
          </div>
          {/* Month Lock Status Banner */}
          {monthLocked && (
            <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-700 dark:text-amber-400">
                {language === "ar" 
                  ? "هذا الشهر مؤكد - التعديل مغلق. فقط نواف يستطيع فتح التعديل لموظف معين."
                  : "This month is confirmed - editing is locked. Only Nawaf can open editing for specific employees."}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="space-y-2">
              <Label>{language === "ar" ? "نوع الفلتر" : "Filter By"}</Label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as "date" | "month" | "range")}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">{language === "ar" ? "يوم محدد" : "Specific Date"}</SelectItem>
                  <SelectItem value="range">{language === "ar" ? "نطاق تاريخ" : "Date Range"}</SelectItem>
                  <SelectItem value="month">{language === "ar" ? "شهر كامل" : "Full Month"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filterMode === "date" ? (
              <div className="space-y-2">
                <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
            ) : filterMode === "range" ? (
              <>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "من تاريخ" : "Date From"}</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "إلى تاريخ" : "Date To"}</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{language === "ar" ? "الشهر" : "Month"}</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-44"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {language === "ar" ? "القسم" : "Department"}
              </Label>
              <Select value={selectedDepartment || "_all_"} onValueChange={(v) => { setSelectedDepartment(v === "_all_" ? "" : v); setSelectedEmployee(""); }}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder={language === "ar" ? "جميع الأقسام" : "All Departments"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">{language === "ar" ? "جميع الأقسام" : "All Departments"}</SelectItem>
                  {departments
                    .sort((a, b) => a.department_name.localeCompare(b.department_name))
                    .map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.department_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الموظف" : "Employee"}</Label>
              <Select value={selectedEmployee || "_all_"} onValueChange={(v) => setSelectedEmployee(v === "_all_" ? "" : v)}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={language === "ar" ? "جميع الموظفين" : "All Employees"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all_">{language === "ar" ? "جميع الموظفين" : "All Employees"}</SelectItem>
                  {(() => {
                    // Helper to get all descendant dept IDs
                    const getDescendants = (parentId: string): string[] => {
                      const result: string[] = [parentId];
                      departments.filter(d => d.parent_department_id === parentId).forEach(child => {
                        result.push(...getDescendants(child.id));
                      });
                      return result;
                    };
                    const filteredEmps = selectedDepartment
                      ? employees.filter(emp => {
                          const deptIds = getDescendants(selectedDepartment);
                          return emp.department_id && deptIds.includes(emp.department_id);
                        })
                      : employees;
                    return filteredEmps.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.employee_number} - {emp.first_name} {emp.last_name}
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
            
            {/* Naughty Corner Card */}
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <UserX className="h-4 w-4 text-orange-600" />
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                    {language === "ar" ? "ركن المتأخرين" : "Naughty Corner"}
                  </p>
                </div>
                {frequentlyLateEmployees.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "لا يوجد موظفين متكررين" : "No frequent offenders"}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {frequentlyLateEmployees.map((emp, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded px-1 py-0.5 transition-colors" onClick={() => openNaughtyDrilldown(emp.employeeId, emp.name)}>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={emp.photoUrl || undefined} alt={emp.name} />
                          <AvatarFallback className="text-[8px] bg-orange-200 text-orange-800">
                            {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-orange-800 dark:text-orange-300 truncate flex-1">{emp.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700">
                          {emp.count}x
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {language === "ar" ? "الشهر الحالي (3+ تأخيرات)" : "Current month (3+ delays)"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {filterMode !== "date" && (
                    <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("work_date", e.ctrlKey || e.metaKey)}>
                      <span className="inline-flex items-center gap-1">{language === "ar" ? "التاريخ" : "Date"} {getSortIcon("work_date")}</span>
                    </TableHead>
                  )}
                  <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("employee", e.ctrlKey || e.metaKey)}>
                    <span className="inline-flex items-center gap-1">{language === "ar" ? "الموظف" : "Employee"} {getSortIcon("employee")}</span>
                  </TableHead>
                  <TableHead>{language === "ar" ? "المجدول" : "Scheduled"}</TableHead>
                  <TableHead>{language === "ar" ? "الفعلي" : "Actual"}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("total_work_minutes", e.ctrlKey || e.metaKey)}>
                    <span className="inline-flex items-center gap-1">{language === "ar" ? "ساعات العمل" : "Work Hours"} {getSortIcon("total_work_minutes")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("late_minutes", e.ctrlKey || e.metaKey)}>
                    <span className="inline-flex items-center gap-1">{language === "ar" ? "التأخير" : "Late"} {getSortIcon("late_minutes")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("overtime_minutes", e.ctrlKey || e.metaKey)}>
                    <span className="inline-flex items-center gap-1">{language === "ar" ? "الإضافي" : "Overtime"} {getSortIcon("overtime_minutes")}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("deduction", e.ctrlKey || e.metaKey)}>
                    <span className="inline-flex items-center gap-1">{language === "ar" ? "نوع الخصم" : "Deduction Type"} {getSortIcon("deduction")}</span>
                  </TableHead>
                  <TableHead>{language === "ar" ? "الوقت المعدّل" : "Changed Time"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "البريد" : "Mail Sent"}</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={(e) => handleSort("status", e.ctrlKey || e.metaKey)}>
                    <span className="inline-flex items-center gap-1">{language === "ar" ? "الحالة" : "Status"} {getSortIcon("status")}</span>
                  </TableHead>
                  <TableHead className="text-center">{language === "ar" ? "من المنزل" : "WFH"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={filterMode !== "date" ? 14 : 13} className="text-center py-8">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : sortedTimesheets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={filterMode !== "date" ? 14 : 13} className="text-center py-8">
                      {language === "ar" ? "لا توجد سجلات" : "No records found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedTimesheets.map((ts) => (
                    <TableRow key={ts.id} className={
                      (ts as any).has_approved_delay || (ts as any).has_approved_early_leave
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-l-emerald-500'
                        : ts.status === 'vacation'
                        ? 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500 [&_td]:text-yellow-600 [&_td]:dark:text-yellow-400'
                        : ts.status === 'holiday'
                        ? 'bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-500 [&_td]:text-purple-600 [&_td]:dark:text-purple-400'
                        : ''
                    }>
                      {filterMode !== "date" && (
                        <TableCell className="font-medium text-sm">
                          {format(parseISO(ts.work_date), "dd MMM")}
                        </TableCell>
                      )}
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
                          ? `${ts.actual_start ? (/^\d{4}-\d{2}-\d{2}T/.test(ts.actual_start) ? new Date(ts.actual_start).toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }) : ts.actual_start) : '-'} - ${ts.actual_end ? (/^\d{4}-\d{2}-\d{2}T/.test(ts.actual_end) ? new Date(ts.actual_end).toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' }) : ts.actual_end) : '-'}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {Math.floor(ts.total_work_minutes / 60)}h {ts.total_work_minutes % 60}m
                      </TableCell>
                      <TableCell className={(ts as any).has_approved_delay ? "text-emerald-600 dark:text-emerald-400 font-medium" : ts.late_minutes > 0 ? "text-destructive font-medium" : ""}>
                        {(ts as any).has_approved_delay
                          ? (language === "ar" ? "✓ طلب معتمد" : "✓ Approved")
                          : ts.late_minutes > 0 ? `${ts.late_minutes}m` : "-"}
                      </TableCell>
                      <TableCell className={ts.overtime_minutes > 0 ? "text-green-600 font-medium" : ""}>
                        {ts.overtime_minutes > 0 ? `${ts.overtime_minutes}m` : "-"}
                      </TableCell>
                      <TableCell className={ts.deduction_rules && ts.deduction_rules.deduction_value > 0 ? "text-destructive font-medium" : ""}>
                        {ts.deduction_rules && ts.deduction_rules.deduction_value > 0
                          ? (language === "ar" ? ts.deduction_rules.rule_name_ar || ts.deduction_rules.rule_name : ts.deduction_rules.rule_name)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {(ts as any).changed_start || (ts as any).changed_end
                          ? <span className="text-blue-600 font-medium">{`${(ts as any).changed_start || '-'} - ${(ts as any).changed_end || '-'}`}</span>
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
                      <TableCell className="text-center">
                        {(ts as any).is_wfh ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800">
                            <Home className="h-3 w-3 mr-1" />
                            {language === "ar" ? "من المنزل" : "WFH"}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(ts)} disabled={!canEditTimesheet(ts)}>
                            <Pencil className={`h-4 w-4 ${canEditTimesheet(ts) ? "text-muted-foreground" : "text-muted-foreground/30"}`} />
                          </Button>
                          {isNawaf && monthLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleEmployeeEdit(ts.employee_id)}
                              title={editPermissions.has(ts.employee_id) 
                                ? (language === "ar" ? "إغلاق التعديل" : "Close edit") 
                                : (language === "ar" ? "فتح التعديل" : "Open edit")}
                            >
                              {editPermissions.has(ts.employee_id) 
                                ? <Unlock className="h-4 w-4 text-green-600" /> 
                                : <Lock className="h-4 w-4 text-amber-500" />}
                            </Button>
                          )}
                          {ts.status === "pending" && canEditTimesheet(ts) && (
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
              {sortedTimesheets.length > 0 && (
                <tfoot>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={filterMode !== "date" ? 5 : 4} className="text-right">
                      {language === "ar" ? "الإجمالي" : "Totals"}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {sortedTimesheets.reduce((sum, ts) => sum + (ts.late_minutes || 0), 0)} {language === "ar" ? "د" : "min"}
                    </TableCell>
                    <TableCell className="text-green-700">
                      {sortedTimesheets.reduce((sum, ts) => sum + (ts.overtime_minutes || 0), 0)} {language === "ar" ? "د" : "min"}
                    </TableCell>
                    <TableCell className="text-destructive">
                      {sortedTimesheets.reduce((sum, ts) => sum + (ts.deduction_amount || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={filterMode !== "date" ? 5 : 5}></TableCell>
                  </TableRow>
                </tfoot>
              )}
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
                      disabled={!!editingTimesheet}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "وقت الانصراف الفعلي" : "Actual End"}</Label>
                    <Input
                      type="time"
                      value={formData.actual_end}
                      onChange={(e) => setFormData({ ...formData, actual_end: e.target.value })}
                      disabled={!!editingTimesheet}
                    />
                  </div>
                </div>

                {editingTimesheet && (
                  <div className="grid grid-cols-2 gap-4 p-3 border border-blue-200 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                    <div className="col-span-2">
                      <Label className="text-blue-700 dark:text-blue-400 font-semibold text-xs">
                        {language === "ar" ? "الوقت المعدّل (يُستخدم للحساب بدلاً من الفعلي)" : "Changed Time (used for calculation instead of actual)"}
                      </Label>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "حضور معدّل" : "Changed In"}</Label>
                      <Input
                        type="time"
                        value={formData.changed_start}
                        onChange={(e) => setFormData({ ...formData, changed_start: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "انصراف معدّل" : "Changed Out"}</Label>
                      <Input
                        type="time"
                        value={formData.changed_end}
                        onChange={(e) => setFormData({ ...formData, changed_end: e.target.value })}
                      />
                    </div>
                  </div>
                )}

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

      {/* Naughty Corner Drilldown Dialog */}
      <Dialog open={naughtyDrilldownOpen} onOpenChange={setNaughtyDrilldownOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              {language === 'ar' ? `تفاصيل تأخيرات ${naughtyDrilldownEmployee?.name}` : `Delay Details - ${naughtyDrilldownEmployee?.name}`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {language === 'ar' ? 'الشهر الحالي' : 'Current month'}
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المجدول' : 'Scheduled'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الفعلي' : 'Actual'}</TableHead>
                  <TableHead>{language === 'ar' ? 'التأخير' : 'Delay'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الخصم' : 'Deduction'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {naughtyDrilldownLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : naughtyDrilldownRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      {language === 'ar' ? 'لا توجد سجلات' : 'No records'}
                    </TableCell>
                  </TableRow>
                ) : (
                  naughtyDrilldownRecords.map((rec, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{rec.work_date}</TableCell>
                      <TableCell className="text-xs">{rec.scheduled_start || '-'}</TableCell>
                      <TableCell className="text-xs">{rec.actual_start || '-'}</TableCell>
                      <TableCell className="text-destructive font-medium text-xs">{rec.late_minutes}m</TableCell>
                      <TableCell className="text-xs">{rec.deduction_rule_name || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
            <span>{language === 'ar' ? 'إجمالي التأخيرات:' : 'Total delays:'} {naughtyDrilldownRecords.length}</span>
            <span>{language === 'ar' ? 'إجمالي الدقائق:' : 'Total minutes:'} {naughtyDrilldownRecords.reduce((sum, r) => sum + r.late_minutes, 0)}m</span>
          </div>
        </DialogContent>
      </Dialog>

      <AttendancePrintDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        timesheets={sortedTimesheets}
        filterLabel={
          filterMode === "date"
            ? `${language === "ar" ? "التاريخ" : "Date"}: ${selectedDate}`
            : `${language === "ar" ? "الشهر" : "Month"}: ${selectedMonth}`
        }
      />
    </div>
  );
}
