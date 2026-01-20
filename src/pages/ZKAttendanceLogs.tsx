import { useState, useEffect, useMemo, type ReactNode } from "react";
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
import { CalendarIcon, RefreshCw, Clock, User, Download, Trash2, CheckCircle, Pencil, List, LayoutGrid, Printer, ArrowUpDown, ArrowUp, ArrowDown, X, Save, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  requires_attendance_signin: boolean | null;
  religion: string | null;
}

interface VacationRequest {
  id: string;
  employee_id: string;
  vacation_code_id: string;
  start_date: string;
  end_date: string;
  status: string;
  vacation_codes: {
    code: string;
    name_en: string;
    name_ar: string;
  } | null;
}

interface OfficialHoliday {
  id: string;
  holiday_name: string;
  holiday_name_ar: string | null;
  holiday_date: string;
  is_recurring: boolean;
  year: number | null;
  religion: string | null;
}

interface HolidayAttendanceType {
  holiday_id: string;
  attendance_type_id: string;
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
  record_status?: 'normal' | 'absent' | 'vacation';
  vacation_type?: string;
}

interface EmployeeTotalRecord {
  employee_code: string;
  employee_name: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  vacation_days: number;
  total_worked_hours: number;
  total_expected_hours: number;
  total_difference_hours: number;
}

interface DeductionRule {
  id: string;
  rule_name: string;
  rule_name_ar: string | null;
  rule_type: string;
  min_minutes: number | null;
  max_minutes: number | null;
  deduction_type: string;
  deduction_value: number;
  is_active: boolean;
}

const printStyles = `
  /* default: hide print-only paginated layout */
  .print-only-pages {
    display: none;
  }

  @media print {
    body * {
      visibility: hidden;
    }

    /* show only our printable area */
    .print-area, .print-area * {
      visibility: visible;
      color: black !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* IMPORTANT: keep normal flow so the browser can paginate */
    .print-area {
      position: static;
      width: 100%;
      padding: 0;
    }

    .no-print {
      display: none !important;
    }

    /* hide the on-screen (non-paginated) table; show our paginated pages */
    .screen-only {
      display: none !important;
    }
    .print-only-pages {
      display: block !important;
    }

    /* each "page" is a separate block with a footer */
    .print-page {
      position: relative;
      padding: 20px;
      padding-bottom: 44px;
      page-break-after: always;
    }
    .print-page:last-child {
      page-break-after: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }

    th, td {
      border: none !important;
      padding: 8px 12px;
      text-align: left;
      color: black !important;
      font-size: 12px;
    }

    th {
      background-color: #f3f4f6 !important;
      font-weight: 600;
      color: black !important;
    }

    tr:nth-child(even) {
      background-color: #f9fafb !important;
    }

    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    thead {
      display: table-header-group;
    }

    .print-header {
      text-align: center;
      margin-bottom: 14px;
      color: black !important;
    }

    .print-header h1 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 5px;
      color: black !important;
    }

    .print-header p {
      font-size: 12px;
      color: black !important;
    }

    .print-date {
      font-size: 10px;
      color: #666 !important;
      margin-top: 5px;
    }

    .print-page-footer {
      position: absolute;
      left: 20px;
      right: 20px;
      bottom: 14px;
      text-align: center;
      font-size: 10px;
      color: #666 !important;
      padding-top: 6px;
      border-top: 1px solid #eee;
    }

    @page {
      size: A4 landscape;
      margin: 12mm 10mm 12mm 10mm;
    }
  }
`;

const ZKAttendanceLogs = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();
  const [saveLoading, setSaveLoading] = useState(false);

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<{ id: string; type_name: string; type_name_ar: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"detailed" | "summary" | "employee-totals">("detailed");
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
  // Multi-column sorting state: array of {column, direction} in priority order
  const [sortColumns, setSortColumns] = useState<Array<{ column: string; direction: "asc" | "desc" }>>([
    { column: "attendance_date", direction: "desc" }
  ]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [officialHolidays, setOfficialHolidays] = useState<OfficialHoliday[]>([]);
  const [holidayAttendanceTypes, setHolidayAttendanceTypes] = useState<HolidayAttendanceType[]>([]);
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>([]);

  // Handle multi-column sorting:
  // - Click: add/toggle column as primary sort
  // - Ctrl/Cmd + Click: add column to existing sort levels
  const handleSort = (column: string, event?: React.MouseEvent) => {
    const isMultiSort = event?.ctrlKey || event?.metaKey;
    
    setSortColumns(prev => {
      const existingIndex = prev.findIndex(s => s.column === column);
      
      if (isMultiSort) {
        // Multi-sort mode: add or toggle existing
        if (existingIndex >= 0) {
          // Toggle direction for existing column
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            direction: updated[existingIndex].direction === "asc" ? "desc" : "asc"
          };
          return updated;
        } else {
          // Add new column to sort
          return [...prev, { column, direction: "asc" }];
        }
      } else {
        // Single-sort mode: replace all with this column
        if (existingIndex >= 0 && prev.length === 1) {
          // Toggle direction if clicking the same single column
          return [{ column, direction: prev[0].direction === "asc" ? "desc" : "asc" }];
        }
        return [{ column, direction: "asc" }];
      }
    });
  };

  // Remove a specific sort column
  const removeSortColumn = (column: string) => {
    setSortColumns(prev => {
      const filtered = prev.filter(s => s.column !== column);
      // Keep at least one sort column (default to attendance_date)
      return filtered.length > 0 ? filtered : [{ column: "attendance_date", direction: "desc" }];
    });
  };

  // Clear all sort columns back to default
  const clearAllSorts = () => {
    setSortColumns([{ column: "attendance_date", direction: "desc" }]);
  };

  const SortableHeader = ({ column, children }: { column: string; children: ReactNode }) => {
    const sortIndex = sortColumns.findIndex(s => s.column === column);
    const sortConfig = sortIndex >= 0 ? sortColumns[sortIndex] : null;
    const showIndex = sortColumns.length > 1 && sortIndex >= 0;
    
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 select-none"
        onClick={(e) => handleSort(column, e)}
        title={isArabic ? "اضغط للترتيب، Ctrl+اضغط للترتيب المتعدد" : "Click to sort, Ctrl+Click for multi-sort"}
      >
        <div className="flex items-center gap-1">
          {children}
          {sortConfig ? (
            <span className="flex items-center">
              {sortConfig.direction === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {showIndex && (
                <span className="text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
                  {sortIndex + 1}
                </span>
              )}
            </span>
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-30" />
          )}
        </div>
      </TableHead>
    );
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const batchSize = 1000;

      // Base query (filters applied), pagination applied depending on viewMode
      let baseQuery = supabase
        .from("zk_attendance_logs")
        .select("*", { count: "exact" })
        .order("attendance_date", { ascending: false })
        .order("attendance_time", { ascending: false });

      if (searchCode) {
        baseQuery = baseQuery.ilike("employee_code", `%${searchCode}%`);
      }

      if (fromDate) {
        const fromDateStr = format(fromDate, "yyyy-MM-dd");
        baseQuery = baseQuery.gte("attendance_date", fromDateStr);
      }

      if (toDate) {
        const toDateStr = format(toDate, "yyyy-MM-dd");
        baseQuery = baseQuery.lte("attendance_date", toDateStr);
      }

      if (recordTypeFilter !== "all") {
        baseQuery = baseQuery.eq("record_type", recordTypeFilter);
      }

      if (selectedEmployee !== "all") {
        baseQuery = baseQuery.eq("employee_code", selectedEmployee);
      }

      // Filter by attendance type - get employee codes with that type
      if (attendanceTypeFilter !== "all") {
        const employeesWithType = employees.filter(
          (emp) => emp.attendance_type_id === attendanceTypeFilter
        );
        const employeeCodes = employeesWithType
          .map((emp) => emp.zk_employee_code)
          .filter(Boolean) as string[];
        
        if (employeeCodes.length > 0) {
          baseQuery = baseQuery.in("employee_code", employeeCodes);
        } else {
          // No employees match this attendance type, return empty
          setLogs([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }

      if (viewMode === "summary" || viewMode === "employee-totals") {
        // Summary/Employee totals need the FULL dataset (not paginated), otherwise grouping/absence looks wrong.
        const all: AttendanceLog[] = [];
        let from = 0;
        let total: number | null = null;

        while (true) {
          const to = from + batchSize - 1;
          const { data, error, count } = await baseQuery.range(from, to);
          if (error) throw error;
          if (total === null) total = count ?? null;

          const chunk = (data || []) as AttendanceLog[];
          all.push(...chunk);

          if (chunk.length < batchSize) break;
          from += batchSize;

          // Safety guard
          if (from > 50000) break;
        }

        setLogs(all);
        setTotalCount(total ?? all.length);
      } else {
        // Detailed view uses normal pagination
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await baseQuery.range(from, to);
        if (error) throw error;

        setLogs((data || []) as AttendanceLog[]);
        setTotalCount(count || 0);
      }
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
        .select("id, first_name, last_name, first_name_ar, last_name_ar, zk_employee_code, employee_number, attendance_type_id, requires_attendance_signin, religion, attendance_types(id, fixed_start_time, fixed_end_time, is_shift_based)");

      if (error) throw error;
      setEmployees((data || []) as Employee[]);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchVacationRequests = async () => {
    if (!fromDate || !toDate) {
      setVacationRequests([]);
      return;
    }
    
    try {
      const fromDateStr = format(fromDate, "yyyy-MM-dd");
      const toDateStr = format(toDate, "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("id, employee_id, vacation_code_id, start_date, end_date, status, vacation_codes(code, name_en, name_ar)")
        .eq("status", "approved")
        .or(`start_date.lte.${toDateStr},end_date.gte.${fromDateStr}`);

      if (error) throw error;
      setVacationRequests((data || []) as VacationRequest[]);
    } catch (error: any) {
      console.error("Error fetching vacation requests:", error);
    }
  };

  const fetchOfficialHolidays = async () => {
    if (!fromDate || !toDate) {
      setOfficialHolidays([]);
      setHolidayAttendanceTypes([]);
      return;
    }
    
    try {
      const fromDateStr = format(fromDate, "yyyy-MM-dd");
      const toDateStr = format(toDate, "yyyy-MM-dd");
      const fromYear = fromDate.getFullYear();
      const toYear = toDate.getFullYear();
      
      // Fetch official holidays within date range or recurring ones
      const { data: holidaysData, error: holidaysError } = await supabase
        .from("official_holidays" as any)
        .select("id, holiday_name, holiday_name_ar, holiday_date, is_recurring, year, religion")
        .or(`holiday_date.gte.${fromDateStr},is_recurring.eq.true`)
        .or(`holiday_date.lte.${toDateStr},is_recurring.eq.true`);

      if (holidaysError) throw holidaysError;
      
      // Filter holidays within date range (accounting for recurring)
      const filteredHolidays = (holidaysData || []).filter((h: any) => {
        const holidayDate = new Date(h.holiday_date);
        if (h.is_recurring) {
          // For recurring, check if the month/day falls within range for any year
          for (let year = fromYear; year <= toYear; year++) {
            const thisYearDate = new Date(year, holidayDate.getMonth(), holidayDate.getDate());
            if (thisYearDate >= fromDate && thisYearDate <= toDate) {
              return true;
            }
          }
          return false;
        }
        return holidayDate >= fromDate && holidayDate <= toDate;
      });
      
      setOfficialHolidays(filteredHolidays as unknown as OfficialHoliday[]);

      // Fetch holiday-attendance type associations
      const { data: holidayTypesData, error: holidayTypesError } = await supabase
        .from("holiday_attendance_types" as any)
        .select("holiday_id, attendance_type_id");

      if (holidayTypesError) throw holidayTypesError;
      setHolidayAttendanceTypes((holidayTypesData || []) as unknown as HolidayAttendanceType[]);
    } catch (error: any) {
      console.error("Error fetching official holidays:", error);
    }
  };

  const fetchAttendanceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("attendance_types")
        .select("id, type_name, type_name_ar")
        .eq("is_active", true)
        .order("type_name");

      if (error) throw error;
      setAttendanceTypes(data || []);
    } catch (error: any) {
      console.error("Error fetching attendance types:", error);
    }
  };

  const fetchDeductionRules = async () => {
    try {
      const { data, error } = await supabase
        .from("deduction_rules")
        .select("id, rule_name, rule_name_ar, rule_type, min_minutes, max_minutes, deduction_type, deduction_value, is_active")
        .eq("is_active", true)
        .order("rule_type")
        .order("min_minutes", { nullsFirst: true });

      if (error) throw error;
      setDeductionRules(data || []);
    } catch (error) {
      console.error("Error fetching deduction rules:", error);
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

  // Get expected start time for an employee based on their attendance type
  const getExpectedStartTime = (employeeCode: string): string | null => {
    const employee = employees.find((e) => e.zk_employee_code === employeeCode);
    if (!employee?.attendance_types) return null;
    const { fixed_start_time, is_shift_based } = employee.attendance_types;
    if (is_shift_based || !fixed_start_time) return null;
    return fixed_start_time;
  };

  // Get expected end time for an employee based on their attendance type
  const getExpectedEndTime = (employeeCode: string): string | null => {
    const employee = employees.find((e) => e.zk_employee_code === employeeCode);
    if (!employee?.attendance_types) return null;
    const { fixed_end_time, is_shift_based } = employee.attendance_types;
    if (is_shift_based || !fixed_end_time) return null;
    return fixed_end_time;
  };

  // Calculate late arrival minutes based on in_time vs expected start time
  const calculateLateMinutes = (employeeCode: string, inTime: string | null): number => {
    if (!inTime) return 0;
    const expectedStart = getExpectedStartTime(employeeCode);
    if (!expectedStart) return 0;

    const [expectedH, expectedM] = expectedStart.split(":").map(Number);
    const [actualH, actualM] = inTime.split(":").map(Number);
    const expectedMinutes = expectedH * 60 + expectedM;
    const actualMinutes = actualH * 60 + actualM;

    const lateMinutes = actualMinutes - expectedMinutes;
    return lateMinutes > 0 ? lateMinutes : 0;
  };

  // Calculate early exit minutes based on out_time vs expected end time
  const calculateEarlyExitMinutes = (employeeCode: string, outTime: string | null): number => {
    if (!outTime) return 0;
    const expectedEnd = getExpectedEndTime(employeeCode);
    if (!expectedEnd) return 0;

    const [expectedH, expectedM] = expectedEnd.split(":").map(Number);
    const [actualH, actualM] = outTime.split(":").map(Number);
    const expectedMinutes = expectedH * 60 + expectedM;
    let actualMinutes = actualH * 60 + actualM;

    // Handle overnight shifts (out time after midnight)
    if (actualMinutes < expectedMinutes - 12 * 60) {
      actualMinutes += 24 * 60;
    }

    const earlyMinutes = expectedMinutes - actualMinutes;
    return earlyMinutes > 0 ? earlyMinutes : 0;
  };

  // Find the appropriate deduction rule based on late/early minutes
  const findDeductionRule = (lateMinutes: number, earlyExitMinutes: number, recordStatus: string): DeductionRule | null => {
    // For absent records, find absence rule
    if (recordStatus === 'absent') {
      const absenceRule = deductionRules.find(r => r.rule_type === 'absence');
      return absenceRule || null;
    }

    // First check late arrival rules
    if (lateMinutes > 0) {
      const lateRule = deductionRules
        .filter(r => r.rule_type === 'late_arrival')
        .find(r => {
          const minOk = r.min_minutes === null || lateMinutes >= r.min_minutes;
          const maxOk = r.max_minutes === null || lateMinutes <= r.max_minutes;
          return minOk && maxOk;
        });
      if (lateRule) return lateRule;
    }

    // Then check early departure rules
    if (earlyExitMinutes > 0) {
      const earlyRule = deductionRules
        .filter(r => r.rule_type === 'early_departure')
        .find(r => {
          const minOk = r.min_minutes === null || earlyExitMinutes >= r.min_minutes;
          const maxOk = r.max_minutes === null || earlyExitMinutes <= r.max_minutes;
          return minOk && maxOk;
        });
      if (earlyRule) return earlyRule;
    }

    return null;
  };

  useEffect(() => {
    fetchLogs();
    fetchEmployees();
    fetchAttendanceTypes();
    fetchDeductionRules();
    fetchVacationRequests();
    fetchOfficialHolidays();
  }, [searchCode, fromDate, toDate, recordTypeFilter, selectedEmployee, attendanceTypeFilter, viewMode, currentPage, pageSize]);

  // Reset to page 1 when filters / view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchCode, fromDate, toDate, recordTypeFilter, selectedEmployee, attendanceTypeFilter, viewMode]);

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
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "";

    if (viewMode === "detailed") {
      // Export detailed logs
      headers = isArabic 
        ? ["كود الموظف", "اسم الموظف", "التاريخ", "الوقت", "النوع", "الحالة", "تاريخ الاستلام"]
        : ["Employee Code", "Employee Name", "Date", "Time", "Type", "Status", "Received At"];
      rows = sortedLogs.map((log) => [
        log.employee_code,
        getEmployeeName(log.employee_code) || "-",
        log.attendance_date,
        log.attendance_time,
        log.record_type,
        log.is_processed ? (isArabic ? "معتمد" : "Approved") : (isArabic ? "قيد الانتظار" : "Pending"),
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
      ]);
      filename = `zk_attendance_detailed_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    } else if (viewMode === "summary") {
      // Export summary view
      headers = isArabic 
        ? ["اسم الموظف", "التاريخ", "الدخول", "الخروج", "إجمالي الساعات", "الساعات المتوقعة", "الفرق", "الحالة"]
        : ["Employee Name", "Date", "In", "Out", "Total Hours", "Expected Hours", "Difference", "Status"];
      rows = sortedSummaryRecords.map((record) => {
        const statusText = record.record_status === "absent" 
          ? (isArabic ? "غائب" : "Absent")
          : record.record_status === "vacation"
            ? (record.vacation_type || (isArabic ? "إجازة" : "Vacation"))
            : record.is_processed 
              ? (isArabic ? "معتمد" : "Approved") 
              : (isArabic ? "قيد الانتظار" : "Pending");
        return [
          getEmployeeName(record.employee_code) || record.employee_code,
          record.attendance_date,
          record.in_time || "-",
          record.out_time || "-",
          record.total_hours !== null ? record.total_hours.toFixed(2) : "-",
          record.expected_hours !== null ? record.expected_hours.toFixed(2) : "-",
          record.difference_hours !== null ? `${record.difference_hours >= 0 ? "+" : ""}${record.difference_hours.toFixed(2)}` : "-",
          statusText,
        ];
      });
      filename = `zk_attendance_summary_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    } else if (viewMode === "employee-totals") {
      // Export employee totals view
      headers = isArabic 
        ? ["اسم الموظف", "إجمالي الأيام", "أيام الحضور", "أيام الغياب", "أيام الإجازة", "ساعات العمل", "الساعات المتوقعة", "الفرق (تأخير/إضافي)"]
        : ["Employee Name", "Total Days", "Present Days", "Absent Days", "Vacation Days", "Worked Hours", "Expected Hours", "Difference (Delay/Extra)"];
      rows = employeeTotals.map((emp) => [
        emp.employee_name,
        emp.total_days.toString(),
        emp.present_days.toString(),
        emp.absent_days.toString(),
        emp.vacation_days.toString(),
        emp.total_worked_hours.toFixed(2),
        emp.total_expected_hours.toFixed(2),
        `${emp.total_difference_hours >= 0 ? "+" : ""}${emp.total_difference_hours.toFixed(2)}`,
      ]);
      filename = `zk_attendance_employee_totals_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    }

    // Add BOM for proper Arabic encoding in Excel
    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((r) => r.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to check if time is after midnight (00:00 - 06:00 is treated as "out" from previous shift)
  const isAfterMidnightEarlyMorning = (time: string): boolean => {
    const [hours] = time.split(":").map(Number);
    return hours >= 0 && hours < 6; // 00:00 to 05:59 is considered "out" time
  };

  // Helper to get all dates between two dates
  const getDateRange = (start: Date, end: Date): string[] => {
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
      dates.push(format(current, "yyyy-MM-dd"));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Check if an employee has vacation on a specific date
  const getVacationForDate = (employeeId: string, dateStr: string): VacationRequest | null => {
    return vacationRequests.find(vr => {
      if (vr.employee_id !== employeeId) return false;
      const startDate = new Date(vr.start_date);
      const endDate = new Date(vr.end_date);
      const checkDate = new Date(dateStr);
      return checkDate >= startDate && checkDate <= endDate;
    }) || null;
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
    
    const summaryRecords: SummaryRecord[] = Object.entries(grouped).map(([key, data]) => {
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
        record_status: 'normal' as const,
      };
    });

    // Add absent/vacation rows for employees who require attendance sign-in but didn't sign
    // Only when attendance type filter is selected and date range is provided
    if (attendanceTypeFilter !== "all" && fromDate && toDate) {
      const dateRange = getDateRange(fromDate, toDate);
      
      // Get employees who match the attendance type filter and require sign-in
      const requiredEmployees = employees.filter(emp => 
        emp.attendance_type_id === attendanceTypeFilter && 
        emp.requires_attendance_signin === true &&
        emp.zk_employee_code
      );

      // Create a set of existing records for quick lookup
      const existingKeys = new Set(summaryRecords.map(r => r.key));

      // Helper to check if a date is a weekend (Friday = 5, Saturday = 6)
      const isWeekend = (dateStr: string): boolean => {
        const date = new Date(dateStr);
        const day = date.getDay();
        return day === 5 || day === 6; // Friday or Saturday
      };

      // Helper to check if a date is an official holiday for the employee's attendance type and religion
      const isOfficialHoliday = (attendanceTypeId: string, employeeReligion: string | null, dateStr: string): OfficialHoliday | null => {
        const targetDate = new Date(dateStr);
        
        for (const holiday of officialHolidays) {
          const holidayDate = new Date(holiday.holiday_date);
          
          // Check if this holiday applies to the employee's attendance type
          const appliesTo = holidayAttendanceTypes.filter(h => h.holiday_id === holiday.id);
          
          // If no specific attendance types, skip (or if you want it to apply to all, change logic)
          if (appliesTo.length === 0) continue;
          
          const appliesToThisType = appliesTo.some(h => h.attendance_type_id === attendanceTypeId);
          if (!appliesToThisType) continue;
          
          // Check if holiday is religion-specific
          if (holiday.religion && holiday.religion !== 'all') {
            // Holiday is for a specific religion, check if employee matches
            if (!employeeReligion || employeeReligion !== holiday.religion) {
              continue; // Skip this holiday if employee's religion doesn't match
            }
          }
          
          // Check date match
          if (holiday.is_recurring) {
            // For recurring holidays, match month and day
            if (holidayDate.getMonth() === targetDate.getMonth() && 
                holidayDate.getDate() === targetDate.getDate()) {
              return holiday;
            }
          } else {
            // For non-recurring, match exact date
            if (holidayDate.getFullYear() === targetDate.getFullYear() &&
                holidayDate.getMonth() === targetDate.getMonth() &&
                holidayDate.getDate() === targetDate.getDate()) {
              return holiday;
            }
          }
        }
        
        return null;
      };

      for (const emp of requiredEmployees) {
        for (const dateStr of dateRange) {
          // Skip weekends (Friday and Saturday)
          if (isWeekend(dateStr)) continue;
          
          const key = `${emp.zk_employee_code}_${dateStr}`;
          
          // Skip if record already exists
          if (existingKeys.has(key)) continue;

          // Check if this date is an official holiday for this employee's attendance type and religion
          const holiday = emp.attendance_type_id ? isOfficialHoliday(emp.attendance_type_id, emp.religion, dateStr) : null;
          
          if (holiday) {
            // Add official holiday row
            const holidayName = isArabic 
              ? holiday.holiday_name_ar || holiday.holiday_name
              : holiday.holiday_name;
            
            summaryRecords.push({
              key,
              employee_code: emp.zk_employee_code!,
              attendance_date: dateStr,
              in_time: null,
              out_time: null,
              is_processed: true,
              created_at: new Date().toISOString(),
              log_ids: [],
              total_hours: null,
              expected_hours: getExpectedHours(emp.zk_employee_code!),
              difference_hours: null,
              record_status: 'vacation',
              vacation_type: holidayName,
            });
            continue;
          }

          // Check if employee has vacation on this date
          const vacation = getVacationForDate(emp.id, dateStr);
          
          if (vacation) {
            // Add vacation row
            const vacationType = isArabic 
              ? vacation.vacation_codes?.name_ar || vacation.vacation_codes?.name_en || 'إجازة'
              : vacation.vacation_codes?.name_en || 'Vacation';
            
            summaryRecords.push({
              key,
              employee_code: emp.zk_employee_code!,
              attendance_date: dateStr,
              in_time: null,
              out_time: null,
              is_processed: true,
              created_at: new Date().toISOString(),
              log_ids: [],
              total_hours: null,
              expected_hours: getExpectedHours(emp.zk_employee_code!),
              difference_hours: null,
              record_status: 'vacation',
              vacation_type: vacationType,
            });
          } else {
            // Add absent row
            summaryRecords.push({
              key,
              employee_code: emp.zk_employee_code!,
              attendance_date: dateStr,
              in_time: null,
              out_time: null,
              is_processed: false,
              created_at: new Date().toISOString(),
              log_ids: [],
              total_hours: 0,
              expected_hours: getExpectedHours(emp.zk_employee_code!),
              difference_hours: null,
              record_status: 'absent',
            });
          }
        }
      }
    }

    return summaryRecords;
  };

  // Sort summary records based on current sort column and direction
  const sortedSummaryRecords = useMemo(() => {
    const records = getSummaryRecords();
    const getEmployeeNameForSort = (code: string) => {
      const employee = employees.find((e) => e.zk_employee_code === code);
      if (!employee) return code;
      if (isArabic && employee.first_name_ar) {
        return `${employee.first_name_ar} ${employee.last_name_ar || ""}`.trim();
      }
      return `${employee.first_name} ${employee.last_name}`.trim();
    };

    const dateToNumber = (d: string) => {
      const t = Date.parse(d);
      return Number.isNaN(t) ? 0 : t;
    };

    const timeToMinutes = (t: string | null) => {
      if (!t) return -1;
      const [hh, mm, ss] = t.split(":").map((x) => Number(x));
      if (Number.isNaN(hh) || Number.isNaN(mm)) return -1;
      return hh * 60 + mm + (Number.isNaN(ss) ? 0 : ss / 60);
    };

    // Multi-column sort comparator
    const compareByColumn = (a: SummaryRecord, b: SummaryRecord, column: string, dir: number): number => {
      switch (column) {
        case "employee_name": {
          const nameA = getEmployeeNameForSort(a.employee_code);
          const nameB = getEmployeeNameForSort(b.employee_code);
          return nameA.localeCompare(nameB) * dir;
        }
        case "attendance_date":
          return (dateToNumber(a.attendance_date) - dateToNumber(b.attendance_date)) * dir;
        case "in_time":
          return (timeToMinutes(a.in_time) - timeToMinutes(b.in_time)) * dir;
        case "out_time":
          return (timeToMinutes(a.out_time) - timeToMinutes(b.out_time)) * dir;
        case "total_hours": {
          const totalA = a.total_hours ?? -999;
          const totalB = b.total_hours ?? -999;
          return (totalA - totalB) * dir;
        }
        case "difference_hours": {
          const diffA = a.difference_hours ?? -999;
          const diffB = b.difference_hours ?? -999;
          return (diffA - diffB) * dir;
        }
        case "is_processed":
          return (Number(a.is_processed) - Number(b.is_processed)) * dir;
        case "created_at":
          return a.created_at.localeCompare(b.created_at) * dir;
        default:
          return 0;
      }
    };

    return [...records].sort((a, b) => {
      for (const { column, direction } of sortColumns) {
        const dir = direction === "asc" ? 1 : -1;
        const result = compareByColumn(a, b, column, dir);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [logs, employees, vacationRequests, attendanceTypeFilter, fromDate, toDate, sortColumns, isArabic]);

  // Print pagination (manual + reliable): render fixed-size pages in print mode
  const ROWS_PER_PRINT_PAGE = 18;
  const printSummaryPages = useMemo(() => {
    const pages: SummaryRecord[][] = [];
    for (let i = 0; i < sortedSummaryRecords.length; i += ROWS_PER_PRINT_PAGE) {
      pages.push(sortedSummaryRecords.slice(i, i + ROWS_PER_PRINT_PAGE));
    }
    return pages;
  }, [sortedSummaryRecords]);

  // Employee totals aggregation for the selected period
  const employeeTotals = useMemo((): EmployeeTotalRecord[] => {
    const totalsMap = new Map<string, EmployeeTotalRecord>();

    for (const record of sortedSummaryRecords) {
      const empCode = record.employee_code;
      let existing = totalsMap.get(empCode);

      if (!existing) {
        existing = {
          employee_code: empCode,
          employee_name: getEmployeeName(empCode) || empCode,
          total_days: 0,
          present_days: 0,
          absent_days: 0,
          vacation_days: 0,
          total_worked_hours: 0,
          total_expected_hours: 0,
          total_difference_hours: 0,
        };
        totalsMap.set(empCode, existing);
      }

      existing.total_days += 1;

      if (record.record_status === 'absent') {
        existing.absent_days += 1;
      } else if (record.record_status === 'vacation') {
        existing.vacation_days += 1;
      } else {
        // Only count as present if there's actual attendance (in_time or out_time)
        if (record.in_time || record.out_time) {
          existing.present_days += 1;
          if (record.total_hours !== null) {
            existing.total_worked_hours += record.total_hours;
          }
          if (record.expected_hours !== null) {
            existing.total_expected_hours += record.expected_hours;
          }
          if (record.difference_hours !== null) {
            existing.total_difference_hours += record.difference_hours;
          }
        } else {
          // No actual attendance data - count as absent
          existing.absent_days += 1;
        }
      }
    }

    // Sort by employee name
    const results = Array.from(totalsMap.values());
    // Multi-column sort comparator for employee totals
    const compareByColumn = (a: EmployeeTotalRecord, b: EmployeeTotalRecord, column: string, dir: number): number => {
      switch (column) {
        case "employee_name":
          return a.employee_name.localeCompare(b.employee_name) * dir;
        case "total_days":
          return (a.total_days - b.total_days) * dir;
        case "present_days":
          return (a.present_days - b.present_days) * dir;
        case "absent_days":
          return (a.absent_days - b.absent_days) * dir;
        case "vacation_days":
          return (a.vacation_days - b.vacation_days) * dir;
        case "total_worked_hours":
          return (a.total_worked_hours - b.total_worked_hours) * dir;
        case "total_expected_hours":
          return (a.total_expected_hours - b.total_expected_hours) * dir;
        case "total_difference_hours":
        case "difference_hours":
          return (a.total_difference_hours - b.total_difference_hours) * dir;
        default:
          return a.employee_name.localeCompare(b.employee_name);
      }
    };

    return results.sort((a, b) => {
      for (const { column, direction } of sortColumns) {
        const dir = direction === "asc" ? 1 : -1;
        const result = compareByColumn(a, b, column, dir);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [sortedSummaryRecords, sortColumns]);

  // Print pages for employee totals
  const printEmployeeTotalsPages = useMemo(() => {
    const pages: EmployeeTotalRecord[][] = [];
    for (let i = 0; i < employeeTotals.length; i += ROWS_PER_PRINT_PAGE) {
      pages.push(employeeTotals.slice(i, i + ROWS_PER_PRINT_PAGE));
    }
    return pages;
  }, [employeeTotals]);

  // Sort detailed logs based on current sort column and direction
  const sortedLogs = useMemo(() => {
    const dateToNumber = (d: string) => {
      const t = Date.parse(d);
      return Number.isNaN(t) ? 0 : t;
    };

    const timeToKey = (t: string) => {
      // keep as string if format is HH:mm:ss; otherwise fallback
      return t || "";
    };

    // Multi-column sort comparator for detailed logs
    const compareByColumn = (a: AttendanceLog, b: AttendanceLog, column: string, dir: number): number => {
      switch (column) {
        case "employee_code":
          return a.employee_code.localeCompare(b.employee_code) * dir;
        case "employee_name": {
          const nameA = getEmployeeName(a.employee_code) || a.employee_code;
          const nameB = getEmployeeName(b.employee_code) || b.employee_code;
          return nameA.localeCompare(nameB) * dir;
        }
        case "attendance_date":
          return (dateToNumber(a.attendance_date) - dateToNumber(b.attendance_date)) * dir;
        case "attendance_time":
          return timeToKey(a.attendance_time).localeCompare(timeToKey(b.attendance_time)) * dir;
        case "record_type":
          return a.record_type.localeCompare(b.record_type) * dir;
        case "is_processed":
          return (Number(a.is_processed) - Number(b.is_processed)) * dir;
        case "created_at":
          return a.created_at.localeCompare(b.created_at) * dir;
        default:
          return 0;
      }
    };

    return [...logs].sort((a, b) => {
      for (const { column, direction } of sortColumns) {
        const dir = direction === "asc" ? 1 : -1;
        const result = compareByColumn(a, b, column, dir);
        if (result !== 0) return result;
      }
      return 0;
    });
  }, [logs, employees, sortColumns]);

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

      if (fromDate) {
        const fromDateStr = format(fromDate, "yyyy-MM-dd");
        query = query.gte("attendance_date", fromDateStr);
      }

      if (toDate) {
        const toDateStr = format(toDate, "yyyy-MM-dd");
        query = query.lte("attendance_date", toDateStr);
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

  // Save summary records to saved_attendance table
  const handleSaveSummary = async () => {
    if (!fromDate || !toDate) {
      toast.error(isArabic ? "يرجى تحديد نطاق التاريخ" : "Please select a date range");
      return;
    }

    if (sortedSummaryRecords.length === 0) {
      toast.error(isArabic ? "لا توجد سجلات للحفظ" : "No records to save");
      return;
    }

    setSaveLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error(isArabic ? "يجب تسجيل الدخول" : "You must be logged in");
        return;
      }

      const batchId = crypto.randomUUID();
      const fromDateStr = format(fromDate, "yyyy-MM-dd");
      const toDateStr = format(toDate, "yyyy-MM-dd");

      // Prepare records for insertion with auto-calculated deduction rules
      const recordsToSave = sortedSummaryRecords.map(record => {
        // Calculate late arrival and early exit minutes
        const lateMinutes = calculateLateMinutes(record.employee_code, record.in_time);
        const earlyExitMinutes = calculateEarlyExitMinutes(record.employee_code, record.out_time);
        
        // Find matching deduction rule
        const deductionRule = findDeductionRule(lateMinutes, earlyExitMinutes, record.record_status || 'normal');
        
        return {
          employee_code: record.employee_code,
          attendance_date: record.attendance_date,
          in_time: record.in_time,
          out_time: record.out_time,
          total_hours: record.total_hours,
          expected_hours: record.expected_hours,
          difference_hours: record.difference_hours,
          record_status: record.record_status || 'normal',
          vacation_type: record.vacation_type,
          saved_by: userData.user.id,
          saved_at: new Date().toISOString(),
          filter_from_date: fromDateStr,
          filter_to_date: toDateStr,
          batch_id: batchId,
          is_confirmed: false,
          deduction_rule_id: deductionRule?.id || null,
          deduction_amount: deductionRule?.deduction_value || 0,
        };
      });

      // Use upsert to handle existing records (based on unique constraint)
      const { error } = await supabase
        .from("saved_attendance")
        .upsert(recordsToSave, { 
          onConflict: 'employee_code,attendance_date,batch_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast.success(
        isArabic 
          ? `تم حفظ ${recordsToSave.length} سجل بنجاح` 
          : `Successfully saved ${recordsToSave.length} records`
      );

      // Navigate to saved attendance page
      navigate("/saved-attendance");
    } catch (error: any) {
      console.error("Error saving summary:", error);
      toast.error(isArabic ? "خطأ في حفظ السجلات" : "Error saving records");
    } finally {
      setSaveLoading(false);
    }
  };

  // Print single employee summary with delay/overtime details
  const handlePrintEmployeeSummary = (emp: EmployeeTotalRecord) => {
    // Get the employee's daily records from sortedSummaryRecords
    const employeeRecords = sortedSummaryRecords.filter(r => r.employee_code === emp.employee_code);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(isArabic ? "تعذر فتح نافذة الطباعة" : "Could not open print window");
      return;
    }

    const dateRangeText = fromDate || toDate
      ? `${fromDate ? format(fromDate, "yyyy-MM-dd") : ""} ${toDate ? `- ${format(toDate, "yyyy-MM-dd")}` : ""}`
      : isArabic ? "جميع التواريخ" : "All Dates";

    const printContent = `
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="UTF-8">
        <title>${isArabic ? 'ملخص حضور الموظف' : 'Employee Attendance Summary'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            direction: ${isArabic ? 'rtl' : 'ltr'};
            color: black;
          }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 14px; color: #666; }
          .summary-box { 
            display: grid; 
            grid-template-columns: repeat(4, 1fr); 
            gap: 15px; 
            margin-bottom: 30px; 
            background: #f5f5f5; 
            padding: 20px; 
            border-radius: 8px; 
          }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 12px; color: #666; margin-bottom: 5px; }
          .summary-item .value { font-size: 18px; font-weight: bold; }
          .summary-item .value.positive { color: #16a34a; }
          .summary-item .value.negative { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: ${isArabic ? 'right' : 'left'}; font-size: 12px; }
          th { background: #333; color: white; font-weight: 600; }
          tr:nth-child(even) { background: #f9f9f9; }
          .mono { font-family: monospace; }
          .status-absent { color: #ea580c; font-weight: 600; }
          .status-vacation { color: #9333ea; font-weight: 600; }
          .status-normal { color: #16a34a; }
          .diff-positive { color: #16a34a; font-weight: 600; }
          .diff-negative { color: #dc2626; font-weight: 600; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 15px; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${isArabic ? 'ملخص حضور الموظف' : 'Employee Attendance Summary'}</h1>
          <p><strong>${emp.employee_name}</strong></p>
          <p>${dateRangeText}</p>
          <p>${isArabic ? 'تاريخ الطباعة:' : 'Print Date:'} ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}</p>
        </div>

        <div class="summary-box">
          <div class="summary-item">
            <div class="label">${isArabic ? 'إجمالي الأيام' : 'Total Days'}</div>
            <div class="value">${emp.total_days}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'أيام الحضور' : 'Present Days'}</div>
            <div class="value positive">${emp.present_days}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'أيام الغياب' : 'Absent Days'}</div>
            <div class="value ${emp.absent_days > 0 ? 'negative' : ''}">${emp.absent_days}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'أيام الإجازة' : 'Vacation Days'}</div>
            <div class="value">${emp.vacation_days}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'ساعات العمل' : 'Worked Hours'}</div>
            <div class="value">${emp.total_worked_hours.toFixed(2)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'الساعات المتوقعة' : 'Expected Hours'}</div>
            <div class="value">${emp.total_expected_hours.toFixed(2)}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'إجمالي التأخير' : 'Total Delay'}</div>
            <div class="value ${emp.total_difference_hours < 0 ? 'negative' : ''}">${emp.total_difference_hours < 0 ? Math.abs(emp.total_difference_hours).toFixed(2) : '0.00'}</div>
          </div>
          <div class="summary-item">
            <div class="label">${isArabic ? 'إجمالي الإضافي' : 'Total Overtime'}</div>
            <div class="value ${emp.total_difference_hours > 0 ? 'positive' : ''}">${emp.total_difference_hours > 0 ? emp.total_difference_hours.toFixed(2) : '0.00'}</div>
          </div>
        </div>

        <h3 style="margin-bottom: 10px;">${isArabic ? 'تفاصيل الحضور اليومي' : 'Daily Attendance Details'}</h3>
        <table>
          <thead>
            <tr>
              <th>${isArabic ? 'التاريخ' : 'Date'}</th>
              <th>${isArabic ? 'الدخول' : 'In'}</th>
              <th>${isArabic ? 'الخروج' : 'Out'}</th>
              <th>${isArabic ? 'ساعات العمل' : 'Worked'}</th>
              <th>${isArabic ? 'المتوقع' : 'Expected'}</th>
              <th>${isArabic ? 'الفرق' : 'Difference'}</th>
              <th>${isArabic ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            ${employeeRecords.sort((a, b) => a.attendance_date.localeCompare(b.attendance_date)).map(record => {
              const statusClass = record.record_status === 'absent' ? 'status-absent' : 
                                  record.record_status === 'vacation' ? 'status-vacation' : 'status-normal';
              const statusText = record.record_status === 'absent' 
                ? (isArabic ? 'غائب' : 'Absent')
                : record.record_status === 'vacation'
                  ? (record.vacation_type || (isArabic ? 'إجازة' : 'Vacation'))
                  : (isArabic ? 'حاضر' : 'Present');
              const diffClass = record.difference_hours !== null 
                ? (record.difference_hours >= 0 ? 'diff-positive' : 'diff-negative') 
                : '';
              return `
                <tr>
                  <td>${record.attendance_date}</td>
                  <td class="mono">${record.in_time || '-'}</td>
                  <td class="mono">${record.out_time || '-'}</td>
                  <td class="mono">${record.total_hours !== null ? record.total_hours.toFixed(2) : '-'}</td>
                  <td class="mono">${record.expected_hours !== null ? record.expected_hours.toFixed(2) : '-'}</td>
                  <td class="mono ${diffClass}">${record.difference_hours !== null 
                    ? `${record.difference_hours >= 0 ? '+' : ''}${record.difference_hours.toFixed(2)}` 
                    : '-'}</td>
                  <td class="${statusClass}">${statusText}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          ${isArabic ? 'ملخص حضور الموظف - نظام إدارة' : 'Employee Attendance Summary - Edara System'}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <>
      <style>{printStyles}</style>
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
              <Button
                variant={viewMode === "employee-totals" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("employee-totals")}
                className="rounded-none"
              >
                <User className="h-4 w-4 mr-2" />
                {isArabic ? "إجماليات الموظفين" : "Employee Totals"}
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
            {(viewMode === "summary" || viewMode === "employee-totals") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Give the browser a tick to finish the click handler before opening print dialog
                  requestAnimationFrame(() => {
                    try {
                      window.print();
                    } catch {
                      // ignore
                    }
                  });
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                {isArabic ? "طباعة" : "Print"}
              </Button>
            )}
            {viewMode === "summary" && fromDate && toDate && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveSummary}
                disabled={saveLoading || sortedSummaryRecords.length === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className={`h-4 w-4 mr-2 ${saveLoading ? "animate-spin" : ""}`} />
                {isArabic ? "حفظ الملخص" : "Save Summary"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/saved-attendance")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isArabic ? "الحضور المحفوظ" : "Saved Attendance"}
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
                    "w-[160px] justify-start text-left font-normal",
                    !fromDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fromDate ? (
                    format(fromDate, "yyyy-MM-dd")
                  ) : (
                    <span>{isArabic ? "من تاريخ" : "From Date"}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={setFromDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[160px] justify-start text-left font-normal",
                    !toDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {toDate ? (
                    format(toDate, "yyyy-MM-dd")
                  ) : (
                    <span>{isArabic ? "إلى تاريخ" : "To Date"}</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={setToDate}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={() => { setFromDate(undefined); setToDate(undefined); }}>
                {isArabic ? "مسح التاريخ" : "Clear Dates"}
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
                {employees.filter(emp => emp.zk_employee_code).map((emp) => (
                  <SelectItem key={emp.id} value={emp.zk_employee_code!}>
                    {emp.zk_employee_code} - {isArabic && emp.first_name_ar 
                      ? `${emp.first_name_ar} ${emp.last_name_ar || ""}`.trim()
                      : `${emp.first_name} ${emp.last_name}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={attendanceTypeFilter} onValueChange={setAttendanceTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue placeholder={isArabic ? "نوع الدوام" : "Attendance Type"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع الأنواع" : "All Types"}</SelectItem>
                {attendanceTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {isArabic && type.type_name_ar ? type.type_name_ar : type.type_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Active Sort Columns Indicator */}
          {sortColumns.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium text-muted-foreground">
                {isArabic ? "الترتيب:" : "Sort by:"}
              </span>
              {sortColumns.map((sort, index) => {
                const columnLabels: Record<string, { en: string; ar: string }> = {
                  employee_code: { en: "Employee Code", ar: "رمز الموظف" },
                  employee_name: { en: "Employee Name", ar: "اسم الموظف" },
                  attendance_date: { en: "Date", ar: "التاريخ" },
                  attendance_time: { en: "Time", ar: "الوقت" },
                  record_type: { en: "Type", ar: "النوع" },
                  is_processed: { en: "Status", ar: "الحالة" },
                  created_at: { en: "Received At", ar: "تاريخ الاستلام" },
                  in_time: { en: "In", ar: "الدخول" },
                  out_time: { en: "Out", ar: "الخروج" },
                  total_hours: { en: "Total Hours", ar: "إجمالي الساعات" },
                  difference_hours: { en: "Difference", ar: "الفرق" },
                  total_days: { en: "Total Days", ar: "إجمالي الأيام" },
                  present_days: { en: "Present Days", ar: "أيام الحضور" },
                  absent_days: { en: "Absent Days", ar: "أيام الغياب" },
                  vacation_days: { en: "Vacation Days", ar: "أيام الإجازة" },
                  total_worked_hours: { en: "Worked Hours", ar: "ساعات العمل" },
                  total_expected_hours: { en: "Expected Hours", ar: "الساعات المتوقعة" },
                  total_difference_hours: { en: "Difference Hours", ar: "فرق الساعات" },
                };
                const label = columnLabels[sort.column] 
                  ? (isArabic ? columnLabels[sort.column].ar : columnLabels[sort.column].en)
                  : sort.column;
                
                return (
                  <Badge 
                    key={sort.column} 
                    variant="secondary" 
                    className="flex items-center gap-1 pr-1"
                  >
                    <span className="text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                      {index + 1}
                    </span>
                    {label}
                    {sort.direction === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                    {sortColumns.length > 1 && (
                      <button
                        onClick={() => removeSortColumn(sort.column)}
                        className="ml-1 hover:bg-muted rounded p-0.5"
                        title={isArabic ? "إزالة" : "Remove"}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
              {sortColumns.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllSorts}
                  className="h-6 px-2 text-xs"
                >
                  {isArabic ? "مسح الكل" : "Clear All"}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {isArabic 
                  ? "(Ctrl+اضغط على العمود للترتيب المتعدد)" 
                  : "(Ctrl+Click column for multi-sort)"}
              </span>
            </div>
          )}

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
                    <SortableHeader column="employee_code">{isArabic ? "كود الموظف" : "Employee Code"}</SortableHeader>
                    <SortableHeader column="employee_name">{isArabic ? "اسم الموظف" : "Employee Name"}</SortableHeader>
                    <SortableHeader column="attendance_date">{isArabic ? "التاريخ" : "Date"}</SortableHeader>
                    <SortableHeader column="attendance_time">{isArabic ? "الوقت" : "Time"}</SortableHeader>
                    <SortableHeader column="record_type">{isArabic ? "النوع" : "Type"}</SortableHeader>
                    <SortableHeader column="is_processed">{isArabic ? "الحالة" : "Status"}</SortableHeader>
                    <SortableHeader column="created_at">{isArabic ? "تاريخ الاستلام" : "Received At"}</SortableHeader>
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
                    sortedLogs.map((log) => {
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
            <div className="print-area">
              {/* Print Header - only visible when printing */}
              <div className="print-header hidden print:block">
                <h1>{isArabic ? "تقرير سجلات الحضور" : "Attendance Logs Report"}</h1>
                <p>
                  {fromDate || toDate
                    ? `${fromDate ? format(fromDate, "yyyy-MM-dd") : ""} ${toDate ? `- ${format(toDate, "yyyy-MM-dd")}` : ""}`
                    : isArabic ? "جميع التواريخ" : "All Dates"}
                  {selectedEmployee !== "all" && ` - ${getEmployeeName(selectedEmployee) || selectedEmployee}`}
                </p>
                <p>
                  {isArabic
                    ? `إجمالي السجلات: ${sortedSummaryRecords.length}`
                    : `Total Records: ${sortedSummaryRecords.length}`}
                </p>
                <p className="print-date">
                  {isArabic
                    ? `تاريخ الطباعة: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
                    : `Print Date: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}
                </p>
              </div>

              {/* On-screen table (single continuous table) */}
              <div className="screen-only border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader column="employee_name">{isArabic ? "اسم الموظف" : "Employee Name"}</SortableHeader>
                      <SortableHeader column="attendance_date">{isArabic ? "التاريخ" : "Date"}</SortableHeader>
                      <SortableHeader column="in_time">{isArabic ? "الدخول" : "In"}</SortableHeader>
                      <SortableHeader column="out_time">{isArabic ? "الخروج" : "Out"}</SortableHeader>
                      <SortableHeader column="total_hours">{isArabic ? "إجمالي الساعات" : "Total Hours"}</SortableHeader>
                      <SortableHeader column="difference_hours">{isArabic ? "الفرق" : "Difference"}</SortableHeader>
                      <SortableHeader column="is_processed">{isArabic ? "الحالة" : "Status"}</SortableHeader>
                      <TableHead className="no-print">{isArabic ? "تاريخ الاستلام" : "Received At"}</TableHead>
                      <TableHead className="text-center no-print">{isArabic ? "الإجراءات" : "Actions"}</TableHead>
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
                    ) : sortedSummaryRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {isArabic ? "لا توجد سجلات" : "No records found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedSummaryRecords.map((record) => (
                        <TableRow key={`${record.employee_code}-${record.attendance_date}`}>
                          <TableCell className="font-medium">{getEmployeeName(record.employee_code) || record.employee_code}</TableCell>
                          <TableCell>{record.attendance_date}</TableCell>
                          <TableCell className="font-mono">{record.in_time || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell className="font-mono">{record.out_time || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell className="font-mono">
                            {record.total_hours !== null ? (
                              <span className="font-semibold">{record.total_hours.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {record.difference_hours !== null ? (
                              <Badge className={record.difference_hours >= 0 ? "bg-green-500" : "bg-red-500"}>
                                {record.difference_hours >= 0 ? "+" : ""}
                                {record.difference_hours.toFixed(2)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.record_status === "absent" ? (
                              <Badge className="bg-orange-500">{isArabic ? "غائب" : "Absent"}</Badge>
                            ) : record.record_status === "vacation" ? (
                              <Badge className="bg-purple-500">{record.vacation_type || (isArabic ? "إجازة" : "Vacation")}</Badge>
                            ) : record.is_processed ? (
                              <Badge className="bg-blue-500">{isArabic ? "معتمد" : "Approved"}</Badge>
                            ) : (
                              <Badge variant="outline">{isArabic ? "قيد الانتظار" : "Pending"}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground no-print">
                            {record.record_status === "absent" || record.record_status === "vacation"
                              ? "-"
                              : format(new Date(record.created_at), "yyyy-MM-dd HH:mm:ss")}
                          </TableCell>
                          <TableCell className="no-print">
                            <div className="flex items-center gap-1 justify-center">
                              {/* Print Summary for this employee */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Get all records for this employee
                                  const empRecords = sortedSummaryRecords.filter(r => r.employee_code === record.employee_code);
                                  const empName = getEmployeeName(record.employee_code) || record.employee_code;
                                  
                                  // Calculate totals
                                  const totalDays = empRecords.length;
                                  const presentDays = empRecords.filter(r => r.record_status === 'normal' && (r.in_time || r.out_time)).length;
                                  const absentDays = empRecords.filter(r => r.record_status === 'absent').length;
                                  const vacationDays = empRecords.filter(r => r.record_status === 'vacation').length;
                                  const totalWorked = empRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
                                  const totalExpected = empRecords.reduce((sum, r) => sum + (r.expected_hours || 0), 0);
                                  const totalDiff = empRecords.reduce((sum, r) => sum + (r.difference_hours || 0), 0);
                                  
                                  handlePrintEmployeeSummary({
                                    employee_code: record.employee_code,
                                    employee_name: empName,
                                    total_days: totalDays,
                                    present_days: presentDays,
                                    absent_days: absentDays,
                                    vacation_days: vacationDays,
                                    total_worked_hours: totalWorked,
                                    total_expected_hours: totalExpected,
                                    total_difference_hours: totalDiff,
                                  });
                                }}
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                title={isArabic ? "طباعة ملخص الموظف" : "Print Employee Summary"}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {record.record_status !== "absent" && record.record_status !== "vacation" && (
                                <>
                                  {!record.is_processed && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={actionLoading}
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

              {/* Print-only paginated layout with manual page numbers */}
              <div className="print-only-pages">
                {loading ? (
                  <div className="print-page">
                    <div className="print-header">
                      <h1>{isArabic ? "تقرير سجلات الحضور" : "Attendance Logs Report"}</h1>
                      <p className="print-date">{isArabic ? "جاري التحميل..." : "Loading..."}</p>
                    </div>
                  </div>
                ) : sortedSummaryRecords.length === 0 ? (
                  <div className="print-page">
                    <div className="print-header">
                      <h1>{isArabic ? "تقرير سجلات الحضور" : "Attendance Logs Report"}</h1>
                      <p className="print-date">{isArabic ? "لا توجد سجلات" : "No records found"}</p>
                    </div>
                  </div>
                ) : (
                  printSummaryPages.map((pageRecords, idx) => {
                    const pageNumber = idx + 1;
                    const totalPages = printSummaryPages.length;
                    return (
                      <div className="print-page" key={`print-page-${pageNumber}`}>
                        <div className="print-header">
                          <h1>{isArabic ? "تقرير سجلات الحضور" : "Attendance Logs Report"}</h1>
                          <p>
                            {fromDate || toDate
                              ? `${fromDate ? format(fromDate, "yyyy-MM-dd") : ""} ${toDate ? `- ${format(toDate, "yyyy-MM-dd")}` : ""}`
                              : isArabic ? "جميع التواريخ" : "All Dates"}
                            {selectedEmployee !== "all" && ` - ${getEmployeeName(selectedEmployee) || selectedEmployee}`}
                          </p>
                          <p className="print-date">
                            {isArabic
                              ? `تاريخ الطباعة: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
                              : `Print Date: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}
                          </p>
                        </div>

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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageRecords.map((record) => (
                              <TableRow key={`${record.employee_code}-${record.attendance_date}-${pageNumber}`}>
                                <TableCell className="font-medium">{getEmployeeName(record.employee_code) || record.employee_code}</TableCell>
                                <TableCell>{record.attendance_date}</TableCell>
                                <TableCell className="font-mono">{record.in_time || "-"}</TableCell>
                                <TableCell className="font-mono">{record.out_time || "-"}</TableCell>
                                <TableCell className="font-mono">
                                  {record.total_hours !== null ? record.total_hours.toFixed(2) : "-"}
                                </TableCell>
                                <TableCell className="font-mono">
                                  {record.difference_hours !== null
                                    ? `${record.difference_hours >= 0 ? "+" : ""}${record.difference_hours.toFixed(2)}`
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {record.record_status === "absent"
                                    ? isArabic
                                      ? "غائب"
                                      : "Absent"
                                    : record.record_status === "vacation"
                                      ? record.vacation_type || (isArabic ? "إجازة" : "Vacation")
                                      : record.is_processed
                                        ? isArabic
                                          ? "معتمد"
                                          : "Approved"
                                        : isArabic
                                          ? "قيد الانتظار"
                                          : "Pending"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <div className="print-page-footer">
                          {isArabic
                            ? `تقرير سجلات الحضور - نظام إدارة - صفحة ${pageNumber} من ${totalPages}`
                            : `Attendance Logs Report - Edara System - Page ${pageNumber} of ${totalPages}`}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Employee Totals View */}
          {viewMode === "employee-totals" && (
            <div className="print-area">
              {/* Print Header */}
              <div className="print-header hidden print:block">
                <h1>{isArabic ? "تقرير إجماليات الموظفين" : "Employee Totals Report"}</h1>
                <p>
                  {fromDate || toDate
                    ? `${fromDate ? format(fromDate, "yyyy-MM-dd") : ""} ${toDate ? `- ${format(toDate, "yyyy-MM-dd")}` : ""}`
                    : isArabic ? "جميع التواريخ" : "All Dates"}
                  {attendanceTypeFilter !== "all" && ` - ${attendanceTypes.find(t => t.id === attendanceTypeFilter)?.[isArabic ? "type_name_ar" : "type_name"] || attendanceTypeFilter}`}
                </p>
                <p>
                  {isArabic
                    ? `عدد الموظفين: ${employeeTotals.length}`
                    : `Employees: ${employeeTotals.length}`}
                </p>
                <p className="print-date">
                  {isArabic
                    ? `تاريخ الطباعة: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
                    : `Print Date: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}
                </p>
              </div>

              {/* On-screen table */}
              <div className="screen-only border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader column="employee_name">{isArabic ? "اسم الموظف" : "Employee Name"}</SortableHeader>
                      <SortableHeader column="total_days">{isArabic ? "إجمالي الأيام" : "Total Days"}</SortableHeader>
                      <SortableHeader column="present_days">{isArabic ? "أيام الحضور" : "Present Days"}</SortableHeader>
                      <SortableHeader column="absent_days">{isArabic ? "أيام الغياب" : "Absent Days"}</SortableHeader>
                      <SortableHeader column="vacation_days">{isArabic ? "أيام الإجازة" : "Vacation Days"}</SortableHeader>
                      <SortableHeader column="total_worked_hours">{isArabic ? "ساعات العمل" : "Worked Hours"}</SortableHeader>
                      <SortableHeader column="total_expected_hours">{isArabic ? "الساعات المتوقعة" : "Expected Hours"}</SortableHeader>
                      <SortableHeader column="total_difference_hours">{isArabic ? "الفرق (تأخير/إضافي)" : "Difference (Delay/Extra)"}</SortableHeader>
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
                    ) : employeeTotals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {isArabic ? "لا توجد سجلات" : "No records found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {employeeTotals.map((emp) => (
                          <TableRow key={emp.employee_code}>
                            <TableCell className="font-medium">{emp.employee_name}</TableCell>
                            <TableCell>{emp.total_days}</TableCell>
                            <TableCell>
                              <Badge className="bg-green-500">{emp.present_days}</Badge>
                            </TableCell>
                            <TableCell>
                              {emp.absent_days > 0 ? (
                                <Badge className="bg-orange-500">{emp.absent_days}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {emp.vacation_days > 0 ? (
                                <Badge className="bg-purple-500">{emp.vacation_days}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">{emp.total_worked_hours.toFixed(2)}</TableCell>
                            <TableCell className="font-mono">{emp.total_expected_hours.toFixed(2)}</TableCell>
                            <TableCell className="font-mono">
                              <Badge className={emp.total_difference_hours >= 0 ? "bg-green-500" : "bg-red-500"}>
                                {emp.total_difference_hours >= 0 ? "+" : ""}{emp.total_difference_hours.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintEmployeeSummary(emp)}
                                title={isArabic ? "طباعة ملخص الموظف" : "Print Employee Summary"}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell>{isArabic ? "الإجمالي" : "Total"}</TableCell>
                          <TableCell>{employeeTotals.reduce((sum, e) => sum + e.total_days, 0)}</TableCell>
                          <TableCell>{employeeTotals.reduce((sum, e) => sum + e.present_days, 0)}</TableCell>
                          <TableCell>{employeeTotals.reduce((sum, e) => sum + e.absent_days, 0)}</TableCell>
                          <TableCell>{employeeTotals.reduce((sum, e) => sum + e.vacation_days, 0)}</TableCell>
                          <TableCell className="font-mono">{employeeTotals.reduce((sum, e) => sum + e.total_worked_hours, 0).toFixed(2)}</TableCell>
                          <TableCell className="font-mono">{employeeTotals.reduce((sum, e) => sum + e.total_expected_hours, 0).toFixed(2)}</TableCell>
                          <TableCell className="font-mono">
                            {(() => {
                              const total = employeeTotals.reduce((sum, e) => sum + e.total_difference_hours, 0);
                              return (
                                <Badge className={total >= 0 ? "bg-green-500" : "bg-red-500"}>
                                  {total >= 0 ? "+" : ""}{total.toFixed(2)}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Print-only paginated layout */}
              <div className="print-only-pages">
                {loading ? (
                  <div className="print-page">
                    <div className="print-header">
                      <h1>{isArabic ? "تقرير إجماليات الموظفين" : "Employee Totals Report"}</h1>
                      <p className="print-date">{isArabic ? "جاري التحميل..." : "Loading..."}</p>
                    </div>
                  </div>
                ) : employeeTotals.length === 0 ? (
                  <div className="print-page">
                    <div className="print-header">
                      <h1>{isArabic ? "تقرير إجماليات الموظفين" : "Employee Totals Report"}</h1>
                      <p className="print-date">{isArabic ? "لا توجد سجلات" : "No records found"}</p>
                    </div>
                  </div>
                ) : (
                  printEmployeeTotalsPages.map((pageRecords, idx) => {
                    const pageNumber = idx + 1;
                    const totalPages = printEmployeeTotalsPages.length;
                    const isLastPage = idx === printEmployeeTotalsPages.length - 1;
                    return (
                      <div className="print-page" key={`print-emp-page-${pageNumber}`}>
                        <div className="print-header">
                          <h1>{isArabic ? "تقرير إجماليات الموظفين" : "Employee Totals Report"}</h1>
                          <p>
                            {fromDate || toDate
                              ? `${fromDate ? format(fromDate, "yyyy-MM-dd") : ""} ${toDate ? `- ${format(toDate, "yyyy-MM-dd")}` : ""}`
                              : isArabic ? "جميع التواريخ" : "All Dates"}
                            {attendanceTypeFilter !== "all" && ` - ${attendanceTypes.find(t => t.id === attendanceTypeFilter)?.[isArabic ? "type_name_ar" : "type_name"] || attendanceTypeFilter}`}
                          </p>
                          <p className="print-date">
                            {isArabic
                              ? `تاريخ الطباعة: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
                              : `Print Date: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}
                          </p>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{isArabic ? "اسم الموظف" : "Employee Name"}</TableHead>
                              <TableHead>{isArabic ? "إجمالي الأيام" : "Total Days"}</TableHead>
                              <TableHead>{isArabic ? "أيام الحضور" : "Present"}</TableHead>
                              <TableHead>{isArabic ? "أيام الغياب" : "Absent"}</TableHead>
                              <TableHead>{isArabic ? "أيام الإجازة" : "Vacation"}</TableHead>
                              <TableHead>{isArabic ? "ساعات العمل" : "Worked"}</TableHead>
                              <TableHead>{isArabic ? "الساعات المتوقعة" : "Expected"}</TableHead>
                              <TableHead>{isArabic ? "الفرق" : "Difference"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageRecords.map((emp) => (
                              <TableRow key={`${emp.employee_code}-${pageNumber}`}>
                                <TableCell className="font-medium">{emp.employee_name}</TableCell>
                                <TableCell>{emp.total_days}</TableCell>
                                <TableCell>{emp.present_days}</TableCell>
                                <TableCell>{emp.absent_days}</TableCell>
                                <TableCell>{emp.vacation_days}</TableCell>
                                <TableCell className="font-mono">{emp.total_worked_hours.toFixed(2)}</TableCell>
                                <TableCell className="font-mono">{emp.total_expected_hours.toFixed(2)}</TableCell>
                                <TableCell className="font-mono">
                                  {emp.total_difference_hours >= 0 ? "+" : ""}{emp.total_difference_hours.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Show totals on the last page */}
                            {isLastPage && (
                              <TableRow className="font-bold border-t-2">
                                <TableCell>{isArabic ? "الإجمالي" : "Total"}</TableCell>
                                <TableCell>{employeeTotals.reduce((sum, e) => sum + e.total_days, 0)}</TableCell>
                                <TableCell>{employeeTotals.reduce((sum, e) => sum + e.present_days, 0)}</TableCell>
                                <TableCell>{employeeTotals.reduce((sum, e) => sum + e.absent_days, 0)}</TableCell>
                                <TableCell>{employeeTotals.reduce((sum, e) => sum + e.vacation_days, 0)}</TableCell>
                                <TableCell className="font-mono">{employeeTotals.reduce((sum, e) => sum + e.total_worked_hours, 0).toFixed(2)}</TableCell>
                                <TableCell className="font-mono">{employeeTotals.reduce((sum, e) => sum + e.total_expected_hours, 0).toFixed(2)}</TableCell>
                                <TableCell className="font-mono">
                                  {(() => {
                                    const total = employeeTotals.reduce((sum, e) => sum + e.total_difference_hours, 0);
                                    return `${total >= 0 ? "+" : ""}${total.toFixed(2)}`;
                                  })()}
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>

                        <div className="print-page-footer">
                          {isArabic
                            ? `تقرير إجماليات الموظفين - نظام إدارة - صفحة ${pageNumber} من ${totalPages}`
                            : `Employee Totals Report - Edara System - Page ${pageNumber} of ${totalPages}`}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
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
                  : viewMode === "summary"
                    ? (isArabic
                        ? `عرض ${sortedSummaryRecords.length} موظف/يوم`
                        : `Showing ${sortedSummaryRecords.length} employee/day records`)
                    : (isArabic
                        ? `عرض ${employeeTotals.length} موظف`
                        : `Showing ${employeeTotals.length} employees`)
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
                  {fromDate && (
                    <li>{isArabic ? `من تاريخ: ${format(fromDate, "yyyy-MM-dd")}` : `From: ${format(fromDate, "yyyy-MM-dd")}`}</li>
                  )}
                  {toDate && (
                    <li>{isArabic ? `إلى تاريخ: ${format(toDate, "yyyy-MM-dd")}` : `To: ${format(toDate, "yyyy-MM-dd")}`}</li>
                  )}
                  {recordTypeFilter !== "all" && (
                    <li>{isArabic ? `النوع: ${recordTypeFilter}` : `Type: ${recordTypeFilter}`}</li>
                  )}
                  {!searchCode && !fromDate && !toDate && recordTypeFilter === "all" && (
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
    </>
  );
};

export default ZKAttendanceLogs;
