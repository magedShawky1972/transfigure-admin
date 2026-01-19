import { useState, useEffect, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { 
  CalendarIcon, RefreshCw, Clock, User, Download, Trash2, CheckCircle, 
  Pencil, List, LayoutGrid, Printer, ArrowUpDown, ArrowUp, ArrowDown, X,
  ExternalLink, Check, History, FolderOpen, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";

interface SavedAttendanceRecord {
  id: string;
  employee_code: string;
  attendance_date: string;
  in_time: string | null;
  out_time: string | null;
  total_hours: number | null;
  expected_hours: number | null;
  difference_hours: number | null;
  record_status: string;
  vacation_type: string | null;
  deduction_rule_id: string | null;
  deduction_amount: number | null;
  is_confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  saved_by: string;
  saved_at: string;
  filter_from_date: string | null;
  filter_to_date: string | null;
  batch_id: string | null;
  notes: string | null;
  created_at: string;
}

interface DeductionRule {
  id: string;
  rule_name: string;
  rule_name_ar: string | null;
  deduction_type: string;
  deduction_value: number;
  is_active: boolean;
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
}

interface AttendanceType {
  id: string;
  type_name: string;
  type_name_ar: string | null;
  allow_late_minutes: number | null;
  allow_early_exit_minutes: number | null;
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
  total_deduction: number;
}

interface SavedBatch {
  batch_id: string;
  filter_from_date: string;
  filter_to_date: string;
  saved_at: string;
  record_count: number;
  confirmed_count: number;
  pending_count: number;
}

const SavedAttendance = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();

  // View mode: "history" shows batch list, "records" shows records for selected batch
  const [pageMode, setPageMode] = useState<"history" | "records">("history");
  const [batches, setBatches] = useState<SavedBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [records, setRecords] = useState<SavedAttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceType[]>([]);
  const [deductionRules, setDeductionRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [confirmedFilter, setConfirmedFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteBatchDialogOpen, setDeleteBatchDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<SavedAttendanceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"summary" | "employee-totals">("summary");
  
  const [editFormData, setEditFormData] = useState({
    in_time: "",
    out_time: "",
    deduction_rule_id: "",
    deduction_amount: 0,
    notes: "",
  });

  // Multi-column sorting state - default sort by employee_name then attendance_date
  const [sortColumns, setSortColumns] = useState<Array<{ column: string; direction: "asc" | "desc" }>>([
    { column: "employee_name", direction: "asc" },
    { column: "attendance_date", direction: "asc" }
  ]);

  const handleSort = (column: string, event?: React.MouseEvent) => {
    const isMultiSort = event?.ctrlKey || event?.metaKey;
    
    setSortColumns(prev => {
      const existingIndex = prev.findIndex(s => s.column === column);
      
      if (isMultiSort) {
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            direction: updated[existingIndex].direction === "asc" ? "desc" : "asc"
          };
          return updated;
        } else {
          return [...prev, { column, direction: "asc" }];
        }
      } else {
        if (existingIndex >= 0 && prev.length === 1) {
          return [{ column, direction: prev[0].direction === "asc" ? "desc" : "asc" }];
        }
        return [{ column, direction: "asc" }];
      }
    });
  };

  const removeSortColumn = (column: string) => {
    setSortColumns(prev => {
      const filtered = prev.filter(s => s.column !== column);
      return filtered.length > 0 ? filtered : [{ column: "attendance_date", direction: "desc" }];
    });
  };

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

  // Fetch batches for history view
  const fetchBatches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_attendance")
        .select("batch_id, filter_from_date, filter_to_date, saved_at, is_confirmed");

      if (error) throw error;

      // Group by batch_id
      const batchMap = new Map<string, SavedBatch>();
      
      (data || []).forEach(record => {
        if (!record.batch_id) return;
        
        const existing = batchMap.get(record.batch_id);
        if (existing) {
          existing.record_count += 1;
          if (record.is_confirmed) {
            existing.confirmed_count += 1;
          } else {
            existing.pending_count += 1;
          }
        } else {
          batchMap.set(record.batch_id, {
            batch_id: record.batch_id,
            filter_from_date: record.filter_from_date || "",
            filter_to_date: record.filter_to_date || "",
            saved_at: record.saved_at,
            record_count: 1,
            confirmed_count: record.is_confirmed ? 1 : 0,
            pending_count: record.is_confirmed ? 0 : 1,
          });
        }
      });

      // Sort by saved_at descending
      const batchList = Array.from(batchMap.values()).sort((a, b) => 
        new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime()
      );

      setBatches(batchList);
    } catch (error: any) {
      console.error("Error fetching batches:", error);
      toast.error(isArabic ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    if (!selectedBatchId) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from("saved_attendance")
        .select("*", { count: "exact" })
        .eq("batch_id", selectedBatchId)
        .order("attendance_date", { ascending: false });

      if (searchCode) {
        query = query.ilike("employee_code", `%${searchCode}%`);
      }

      if (selectedEmployee !== "all") {
        query = query.eq("employee_code", selectedEmployee);
      }

      if (confirmedFilter === "confirmed") {
        query = query.eq("is_confirmed", true);
      } else if (confirmedFilter === "pending") {
        query = query.eq("is_confirmed", false);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setRecords(data || []);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching saved attendance:", error);
      toast.error(isArabic ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, first_name_ar, last_name_ar, zk_employee_code, employee_number, attendance_type_id")
        .not("zk_employee_code", "is", null);

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchAttendanceTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("attendance_types")
        .select("id, type_name, type_name_ar, allow_late_minutes, allow_early_exit_minutes");

      if (error) throw error;
      setAttendanceTypes(data || []);
    } catch (error) {
      console.error("Error fetching attendance types:", error);
    }
  };

  const fetchDeductionRules = async () => {
    try {
      const { data, error } = await supabase
        .from("deduction_rules")
        .select("id, rule_name, rule_name_ar, deduction_type, deduction_value, is_active")
        .eq("is_active", true);

      if (error) throw error;
      setDeductionRules(data || []);
    } catch (error) {
      console.error("Error fetching deduction rules:", error);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAttendanceTypes();
    fetchDeductionRules();
  }, []);

  useEffect(() => {
    if (pageMode === "history") {
      fetchBatches();
    }
  }, [pageMode]);

  useEffect(() => {
    if (pageMode === "records" && selectedBatchId) {
      fetchRecords();
    }
  }, [pageMode, selectedBatchId, searchCode, selectedEmployee, confirmedFilter]);

  const handleSelectBatch = (batchId: string) => {
    setSelectedBatchId(batchId);
    setPageMode("records");
  };

  const handleBackToHistory = () => {
    setPageMode("history");
    setSelectedBatchId(null);
    setRecords([]);
    setSearchCode("");
    setSelectedEmployee("all");
    setConfirmedFilter("all");
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("saved_attendance")
        .delete()
        .eq("batch_id", batchToDelete);

      if (error) throw error;

      toast.success(isArabic ? "تم حذف الدفعة بنجاح" : "Batch deleted successfully");
      fetchBatches();
    } catch (error: any) {
      console.error("Error deleting batch:", error);
      toast.error(isArabic ? "خطأ في حذف الدفعة" : "Error deleting batch");
    } finally {
      setActionLoading(false);
      setDeleteBatchDialogOpen(false);
      setBatchToDelete(null);
    }
  };

  const getEmployeeName = (code: string): string => {
    const emp = employees.find(e => e.zk_employee_code === code);
    if (!emp) return code;
    if (isArabic && emp.first_name_ar) {
      return `${emp.first_name_ar} ${emp.last_name_ar || ""}`.trim();
    }
    return `${emp.first_name} ${emp.last_name}`.trim();
  };

  const getDeductionRuleName = (ruleId: string | null): string => {
    if (!ruleId) return "-";
    const rule = deductionRules.find(r => r.id === ruleId);
    if (!rule) return "-";
    return isArabic && rule.rule_name_ar ? rule.rule_name_ar : rule.rule_name;
  };

  // Get employee attendance type allowances
  const getEmployeeAttendanceAllowances = (employeeCode: string): { allowLate: number | null; allowEarly: number | null } => {
    const emp = employees.find(e => e.zk_employee_code === employeeCode);
    if (!emp || !emp.attendance_type_id) return { allowLate: null, allowEarly: null };
    
    const attType = attendanceTypes.find(t => t.id === emp.attendance_type_id);
    if (!attType) return { allowLate: null, allowEarly: null };
    
    return {
      allowLate: attType.allow_late_minutes,
      allowEarly: attType.allow_early_exit_minutes
    };
  };

  // Calculate correct time status based on difference hours and allowances
  const getCorrectTimeStatus = (record: SavedAttendanceRecord): { isCorrect: boolean; hasAllowance: boolean } => {
    // Check for normal/present status (database stores "normal" for present employees)
    const isPresent = record.record_status === "present" || record.record_status === "normal";
    
    if (!isPresent) {
      return { isCorrect: false, hasAllowance: false };
    }

    // If no difference or positive difference (on time or overtime), it's correct
    if (record.difference_hours === null || record.difference_hours >= 0) {
      return { isCorrect: true, hasAllowance: true };
    }

    const allowances = getEmployeeAttendanceAllowances(record.employee_code);
    
    // If no allowance configured, check if difference is 0 or positive
    if (allowances.allowLate === null && allowances.allowEarly === null) {
      return { isCorrect: record.difference_hours >= 0, hasAllowance: false };
    }

    // Convert difference hours to minutes (negative difference = late/early exit)
    const diffMinutes = Math.abs(record.difference_hours * 60);
    
    // For negative difference, check against combined allowance
    const totalAllowance = (allowances.allowLate || 0) + (allowances.allowEarly || 0);
    
    return { isCorrect: diffMinutes <= totalAllowance, hasAllowance: true };
  };

  const sortedRecords = useMemo(() => {
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

    const compareByColumn = (a: SavedAttendanceRecord, b: SavedAttendanceRecord, column: string, dir: number): number => {
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
        case "is_confirmed":
          return (Number(a.is_confirmed) - Number(b.is_confirmed)) * dir;
        case "deduction_amount": {
          const dedA = a.deduction_amount ?? 0;
          const dedB = b.deduction_amount ?? 0;
          return (dedA - dedB) * dir;
        }
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
  }, [records, employees, sortColumns, isArabic]);

  const employeeTotals = useMemo((): EmployeeTotalRecord[] => {
    const totalsMap = new Map<string, EmployeeTotalRecord>();

    for (const record of sortedRecords) {
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
          total_deduction: 0,
        };
        totalsMap.set(empCode, existing);
      }

      existing.total_days += 1;

      if (record.record_status === 'absent') {
        existing.absent_days += 1;
      } else if (record.record_status === 'vacation') {
        existing.vacation_days += 1;
      } else if (record.in_time || record.out_time) {
        existing.present_days += 1;
      }

      existing.total_worked_hours += record.total_hours || 0;
      existing.total_expected_hours += record.expected_hours || 0;
      existing.total_difference_hours += record.difference_hours || 0;
      existing.total_deduction += record.deduction_amount || 0;
    }

    return Array.from(totalsMap.values());
  }, [sortedRecords, employees]);

  const handleEditClick = (record: SavedAttendanceRecord) => {
    setSelectedRecord(record);
    setEditFormData({
      in_time: record.in_time || "",
      out_time: record.out_time || "",
      deduction_rule_id: record.deduction_rule_id || "",
      deduction_amount: record.deduction_amount || 0,
      notes: record.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!selectedRecord) return;

    setActionLoading(true);
    try {
      // Recalculate total hours if times changed
      let totalHours = selectedRecord.total_hours;
      let differenceHours = selectedRecord.difference_hours;

      if (editFormData.in_time && editFormData.out_time) {
        const [inH, inM] = editFormData.in_time.split(":").map(Number);
        const [outH, outM] = editFormData.out_time.split(":").map(Number);
        let inMinutes = inH * 60 + inM;
        let outMinutes = outH * 60 + outM;

        // Handle overnight shifts
        if (outMinutes < inMinutes) {
          outMinutes += 24 * 60;
        }

        totalHours = (outMinutes - inMinutes) / 60;
        if (selectedRecord.expected_hours !== null) {
          differenceHours = totalHours - selectedRecord.expected_hours;
        }
      }

      const { error } = await supabase
        .from("saved_attendance")
        .update({
          in_time: editFormData.in_time || null,
          out_time: editFormData.out_time || null,
          total_hours: totalHours,
          difference_hours: differenceHours,
          deduction_rule_id: editFormData.deduction_rule_id || null,
          deduction_amount: editFormData.deduction_amount,
          notes: editFormData.notes || null,
        })
        .eq("id", selectedRecord.id);

      if (error) throw error;

      toast.success(isArabic ? "تم تحديث السجل بنجاح" : "Record updated successfully");
      fetchRecords();
    } catch (error: any) {
      console.error("Error updating record:", error);
      toast.error(isArabic ? "خطأ في تحديث السجل" : "Error updating record");
    } finally {
      setActionLoading(false);
      setEditDialogOpen(false);
      setSelectedRecord(null);
    }
  };

  const handleConfirmClick = (record: SavedAttendanceRecord) => {
    setSelectedRecord(record);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRecord = async () => {
    if (!selectedRecord) return;

    setActionLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("saved_attendance")
        .update({
          is_confirmed: true,
          confirmed_by: userData.user?.id,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", selectedRecord.id);

      if (error) throw error;

      toast.success(isArabic ? "تم اعتماد السجل بنجاح" : "Record confirmed successfully");
      fetchRecords();
    } catch (error: any) {
      console.error("Error confirming record:", error);
      toast.error(isArabic ? "خطأ في اعتماد السجل" : "Error confirming record");
    } finally {
      setActionLoading(false);
      setConfirmDialogOpen(false);
      setSelectedRecord(null);
    }
  };

  const handleConfirmAll = async () => {
    setActionLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get IDs of filtered records that are not confirmed
      const pendingIds = sortedRecords.filter(r => !r.is_confirmed).map(r => r.id);
      
      if (pendingIds.length === 0) {
        toast.info(isArabic ? "لا توجد سجلات للاعتماد" : "No records to confirm");
        return;
      }

      const { error } = await supabase
        .from("saved_attendance")
        .update({
          is_confirmed: true,
          confirmed_by: userData.user?.id,
          confirmed_at: new Date().toISOString(),
        })
        .in("id", pendingIds);

      if (error) throw error;

      toast.success(
        isArabic 
          ? `تم اعتماد ${pendingIds.length} سجل بنجاح` 
          : `Successfully confirmed ${pendingIds.length} records`
      );
      fetchRecords();
    } catch (error: any) {
      console.error("Error confirming records:", error);
      toast.error(isArabic ? "خطأ في اعتماد السجلات" : "Error confirming records");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (record: SavedAttendanceRecord) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRecord) return;
    
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("saved_attendance")
        .delete()
        .eq("id", selectedRecord.id);

      if (error) throw error;

      toast.success(isArabic ? "تم حذف السجل بنجاح" : "Record deleted successfully");
      fetchRecords();
    } catch (error: any) {
      console.error("Error deleting record:", error);
      toast.error(isArabic ? "خطأ في حذف السجل" : "Error deleting record");
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
      setSelectedRecord(null);
    }
  };

  const handleDeleteAllFiltered = async () => {
    setActionLoading(true);
    try {
      const idsToDelete = sortedRecords.map(r => r.id);
      
      if (idsToDelete.length === 0) {
        toast.info(isArabic ? "لا توجد سجلات للحذف" : "No records to delete");
        return;
      }

      const { error } = await supabase
        .from("saved_attendance")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      toast.success(
        isArabic
          ? `تم حذف ${idsToDelete.length} سجل بنجاح`
          : `Successfully deleted ${idsToDelete.length} records`
      );
      fetchRecords();
    } catch (error: any) {
      console.error("Error deleting records:", error);
      toast.error(isArabic ? "خطأ في حذف السجلات" : "Error deleting records");
    } finally {
      setActionLoading(false);
      setDeleteAllDialogOpen(false);
    }
  };

  const exportToCSV = () => {
    let headers: string[];
    let rows: string[][];
    let filename: string;

    if (viewMode === "summary") {
      headers = [
        isArabic ? "رمز الموظف" : "Employee Code",
        isArabic ? "اسم الموظف" : "Employee Name",
        isArabic ? "التاريخ" : "Date",
        isArabic ? "الدخول" : "In Time",
        isArabic ? "الخروج" : "Out Time",
        isArabic ? "إجمالي الساعات" : "Total Hours",
        isArabic ? "الفرق" : "Difference",
        isArabic ? "الحالة" : "Status",
        isArabic ? "قاعدة الخصم" : "Deduction Rule",
        isArabic ? "قيمة الخصم" : "Deduction Amount",
        isArabic ? "معتمد" : "Confirmed",
      ];
      rows = sortedRecords.map((rec) => [
        rec.employee_code,
        getEmployeeName(rec.employee_code),
        rec.attendance_date,
        rec.in_time || "-",
        rec.out_time || "-",
        rec.total_hours?.toFixed(2) || "-",
        rec.difference_hours !== null ? `${rec.difference_hours >= 0 ? "+" : ""}${rec.difference_hours.toFixed(2)}` : "-",
        rec.record_status,
        getDeductionRuleName(rec.deduction_rule_id),
        rec.deduction_amount?.toString() || "0",
        rec.is_confirmed ? (isArabic ? "نعم" : "Yes") : (isArabic ? "لا" : "No"),
      ]);
      filename = `saved_attendance_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    } else {
      headers = [
        isArabic ? "رمز الموظف" : "Employee Code",
        isArabic ? "اسم الموظف" : "Employee Name",
        isArabic ? "إجمالي الأيام" : "Total Days",
        isArabic ? "أيام الحضور" : "Present Days",
        isArabic ? "أيام الغياب" : "Absent Days",
        isArabic ? "أيام الإجازة" : "Vacation Days",
        isArabic ? "ساعات العمل" : "Worked Hours",
        isArabic ? "الساعات المتوقعة" : "Expected Hours",
        isArabic ? "الفرق" : "Difference",
        isArabic ? "إجمالي الخصومات" : "Total Deductions",
      ];
      rows = employeeTotals.map((emp) => [
        emp.employee_code,
        emp.employee_name,
        emp.total_days.toString(),
        emp.present_days.toString(),
        emp.absent_days.toString(),
        emp.vacation_days.toString(),
        emp.total_worked_hours.toFixed(2),
        emp.total_expected_hours.toFixed(2),
        `${emp.total_difference_hours >= 0 ? "+" : ""}${emp.total_difference_hours.toFixed(2)}`,
        emp.total_deduction.toFixed(2),
      ]);
      filename = `saved_attendance_totals_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    }

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

  // Get unique employee codes from records for filter
  const uniqueEmployeeCodes = useMemo(() => {
    const codes = new Set(records.map(r => r.employee_code));
    return Array.from(codes);
  }, [records]);

  const pendingCount = sortedRecords.filter(r => !r.is_confirmed).length;

  return (
    <div className={`p-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {pageMode === "records" && (
              <Button variant="ghost" size="sm" onClick={handleBackToHistory} className="mr-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <History className="h-5 w-5" />
            {pageMode === "history" 
              ? (isArabic ? "سجل الحضور المحفوظ" : "Saved Attendance History")
              : (isArabic ? "تفاصيل الحضور المحفوظ" : "Saved Attendance Details")
            }
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            {pageMode === "history" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/zk-attendance-logs")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {isArabic ? "سجلات ZK" : "ZK Logs"}
                </Button>
                <Button variant="outline" size="sm" onClick={fetchBatches}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {isArabic ? "تحديث" : "Refresh"}
                </Button>
              </>
            ) : (
              <>
                {/* View Mode Toggle */}
                <div className="flex border rounded-lg overflow-hidden">
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

                {pendingCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConfirmAll}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isArabic ? `اعتماد الكل (${pendingCount})` : `Confirm All (${pendingCount})`}
                  </Button>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteAllDialogOpen(true)}
                  disabled={sortedRecords.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isArabic ? `حذف الكل (${sortedRecords.length})` : `Delete All (${sortedRecords.length})`}
                </Button>

                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  {isArabic ? "تصدير" : "Export"}
                </Button>

                <Button variant="outline" size="sm" onClick={fetchRecords}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {isArabic ? "تحديث" : "Refresh"}
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {pageMode === "history" ? (
            /* History View - List of Batches */
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  {isArabic ? "جاري التحميل..." : "Loading..."}
                </div>
              ) : batches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">{isArabic ? "لا توجد سجلات محفوظة" : "No saved attendance records"}</p>
                  <p className="text-sm mt-2">
                    {isArabic 
                      ? "اذهب إلى سجلات ZK واحفظ ملخص الحضور"
                      : "Go to ZK Logs and save attendance summary"}
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate("/zk-attendance-logs")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {isArabic ? "الذهاب إلى سجلات ZK" : "Go to ZK Logs"}
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isArabic ? "الفترة" : "Period"}</TableHead>
                        <TableHead>{isArabic ? "تاريخ الحفظ" : "Saved At"}</TableHead>
                        <TableHead className="text-center">{isArabic ? "السجلات" : "Records"}</TableHead>
                        <TableHead className="text-center">{isArabic ? "معتمد" : "Confirmed"}</TableHead>
                        <TableHead className="text-center">{isArabic ? "قيد الانتظار" : "Pending"}</TableHead>
                        <TableHead className="text-center">{isArabic ? "الإجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow 
                          key={batch.batch_id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSelectBatch(batch.batch_id)}
                        >
                          <TableCell className="font-medium">
                            {batch.filter_from_date} - {batch.filter_to_date}
                          </TableCell>
                          <TableCell>
                            {format(new Date(batch.saved_at), "yyyy-MM-dd HH:mm")}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{batch.record_count}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-green-500">{batch.confirmed_count}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {batch.pending_count > 0 ? (
                              <Badge className="bg-yellow-500">{batch.pending_count}</Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectBatch(batch.batch_id)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title={isArabic ? "فتح" : "Open"}
                              >
                                <FolderOpen className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setBatchToDelete(batch.batch_id);
                                  setDeleteBatchDialogOpen(true);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title={isArabic ? "حذف" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            /* Records View */
            <>
              {/* Show batch info */}
              {selectedBatchId && records.length > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg mb-4">
                  <span className="text-sm text-muted-foreground">
                    {isArabic ? "الفترة:" : "Period:"} {records[0]?.filter_from_date} - {records[0]?.filter_to_date}
                  </span>
                </div>
              )}
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
                  {fromDate ? format(fromDate, "yyyy-MM-dd") : (isArabic ? "من تاريخ" : "From Date")}
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
                  {toDate ? format(toDate, "yyyy-MM-dd") : (isArabic ? "إلى تاريخ" : "To Date")}
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

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={isArabic ? "اختر موظف" : "Select Employee"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع الموظفين" : "All Employees"}</SelectItem>
                {uniqueEmployeeCodes.map(code => (
                  <SelectItem key={code} value={code}>
                    {getEmployeeName(code)} ({code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={confirmedFilter} onValueChange={setConfirmedFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={isArabic ? "حالة الاعتماد" : "Confirmation"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "الكل" : "All"}</SelectItem>
                <SelectItem value="confirmed">{isArabic ? "معتمد" : "Confirmed"}</SelectItem>
                <SelectItem value="pending">{isArabic ? "قيد الانتظار" : "Pending"}</SelectItem>
              </SelectContent>
            </Select>

            {(fromDate || toDate || searchCode || selectedEmployee !== "all" || confirmedFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate(undefined);
                  setToDate(undefined);
                  setSearchCode("");
                  setSelectedEmployee("all");
                  setConfirmedFilter("all");
                }}
              >
                <X className="h-4 w-4 mr-1" />
                {isArabic ? "مسح الفلاتر" : "Clear Filters"}
              </Button>
            )}
          </div>

          {/* Sort indicators */}
          {sortColumns.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm text-muted-foreground">{isArabic ? "مرتب حسب:" : "Sorted by:"}</span>
              {sortColumns.map((sort, idx) => (
                <Badge key={sort.column} variant="secondary" className="flex items-center gap-1">
                  <span>{sort.column}</span>
                  {sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  <button onClick={() => removeSortColumn(sort.column)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {sortColumns.length > 1 && (
                <Button variant="ghost" size="sm" onClick={clearAllSorts}>
                  {isArabic ? "مسح الكل" : "Clear All"}
                </Button>
              )}
            </div>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-muted/50 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">{sortedRecords.length}</div>
              <div className="text-sm text-muted-foreground">{isArabic ? "إجمالي السجلات" : "Total Records"}</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{sortedRecords.filter(r => r.is_confirmed).length}</div>
              <div className="text-sm text-muted-foreground">{isArabic ? "معتمد" : "Confirmed"}</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">{isArabic ? "قيد الانتظار" : "Pending"}</div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{sortedRecords.filter(r => r.record_status === 'absent').length}</div>
              <div className="text-sm text-muted-foreground">{isArabic ? "غياب" : "Absent"}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{sortedRecords.reduce((sum, r) => sum + (r.deduction_amount || 0), 0).toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">{isArabic ? "إجمالي الخصومات" : "Total Deductions"}</div>
            </div>
          </div>

          {/* Data Table */}
          {viewMode === "summary" ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader column="employee_name">{isArabic ? "اسم الموظف" : "Employee Name"}</SortableHeader>
                    <SortableHeader column="attendance_date">{isArabic ? "التاريخ" : "Date"}</SortableHeader>
                    <SortableHeader column="in_time">{isArabic ? "الدخول" : "In"}</SortableHeader>
                    <SortableHeader column="out_time">{isArabic ? "الخروج" : "Out"}</SortableHeader>
                    <SortableHeader column="total_hours">{isArabic ? "إجمالي الساعات" : "Total Hours"}</SortableHeader>
                    <SortableHeader column="difference_hours">{isArabic ? "الفرق" : "Difference"}</SortableHeader>
                    <TableHead className="text-center">{isArabic ? "الوقت الصحيح" : "Correct Time"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <SortableHeader column="deduction_amount">{isArabic ? "الخصم" : "Deduction"}</SortableHeader>
                    <SortableHeader column="is_confirmed">{isArabic ? "الاعتماد" : "Confirmed"}</SortableHeader>
                    <TableHead className="text-center">{isArabic ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        {isArabic ? "جاري التحميل..." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : sortedRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        {isArabic ? "لا توجد سجلات" : "No records found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRecords.map((record) => {
                      const correctTimeStatus = getCorrectTimeStatus(record);
                      
                      return (
                        <TableRow key={record.id} className={record.is_confirmed ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
                          <TableCell className="font-medium">{getEmployeeName(record.employee_code)}</TableCell>
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
                          <TableCell className="text-center">
                            {(record.record_status === "present" || record.record_status === "normal") ? (
                              correctTimeStatus.isCorrect ? (
                                <Check className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-red-500 mx-auto" />
                              )
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.record_status === "absent" ? (
                              <Badge className="bg-orange-500">{isArabic ? "غائب" : "Absent"}</Badge>
                            ) : record.record_status === "vacation" ? (
                              <Badge className="bg-purple-500">{record.vacation_type || (isArabic ? "إجازة" : "Vacation")}</Badge>
                            ) : (
                              <Badge variant="outline">{isArabic ? "حاضر" : "Present"}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.deduction_amount && record.deduction_amount > 0 ? (
                              <Badge className="bg-red-500">{record.deduction_amount.toFixed(2)}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.is_confirmed ? (
                              <Badge className="bg-green-500">{isArabic ? "معتمد" : "Confirmed"}</Badge>
                            ) : (
                              <Badge variant="outline">{isArabic ? "قيد الانتظار" : "Pending"}</Badge>
                            )}
                          </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 justify-center">
                            {!record.is_confirmed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfirmClick(record)}
                                disabled={actionLoading}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                title={isArabic ? "اعتماد" : "Confirm"}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClick(record)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title={isArabic ? "تعديل" : "Edit"}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(record)}
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
          ) : (
            // Employee Totals View
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? "اسم الموظف" : "Employee Name"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "إجمالي الأيام" : "Total Days"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الحضور" : "Present"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الغياب" : "Absent"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الإجازات" : "Vacation"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "ساعات العمل" : "Worked Hours"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "المتوقع" : "Expected"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الفرق" : "Difference"}</TableHead>
                    <TableHead className="text-center">{isArabic ? "الخصومات" : "Deductions"}</TableHead>
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
                    employeeTotals.map((emp) => (
                      <TableRow key={emp.employee_code}>
                        <TableCell className="font-medium">{emp.employee_name}</TableCell>
                        <TableCell className="text-center">{emp.total_days}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-50">{emp.present_days}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={emp.absent_days > 0 ? "bg-orange-500" : "bg-gray-200 text-gray-700"}>{emp.absent_days}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={emp.vacation_days > 0 ? "bg-purple-500" : "bg-gray-200 text-gray-700"}>{emp.vacation_days}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono">{emp.total_worked_hours.toFixed(2)}</TableCell>
                        <TableCell className="text-center font-mono">{emp.total_expected_hours.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={emp.total_difference_hours >= 0 ? "bg-green-500" : "bg-red-500"}>
                            {emp.total_difference_hours >= 0 ? "+" : ""}
                            {emp.total_difference_hours.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={emp.total_deduction > 0 ? "bg-red-500" : "bg-gray-200 text-gray-700"}>
                            {emp.total_deduction.toFixed(2)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "تأكيد الحذف" : "Confirm Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic 
                ? "هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this record? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={actionLoading}>
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isArabic ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "تأكيد حذف الكل" : "Confirm Delete All"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic 
                ? `هل أنت متأكد من حذف ${sortedRecords.length} سجل؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete ${sortedRecords.length} records? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllFiltered} disabled={actionLoading} className="bg-destructive text-destructive-foreground">
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isArabic ? "حذف الكل" : "Delete All")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Batch Dialog */}
      <AlertDialog open={deleteBatchDialogOpen} onOpenChange={setDeleteBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "تأكيد حذف الدفعة" : "Confirm Delete Batch"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic 
                ? "هل أنت متأكد من حذف هذه الدفعة بالكامل؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this entire batch? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} disabled={actionLoading} className="bg-destructive text-destructive-foreground">
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isArabic ? "حذف الدفعة" : "Delete Batch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "تأكيد الاعتماد" : "Confirm Record"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic 
                ? "هل أنت متأكد من اعتماد هذا السجل؟"
                : "Are you sure you want to confirm this record?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRecord} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (isArabic ? "اعتماد" : "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isArabic ? "تعديل السجل" : "Edit Record"}</DialogTitle>
            <DialogDescription>
              {selectedRecord && (
                <span>
                  {getEmployeeName(selectedRecord.employee_code)} - {selectedRecord.attendance_date}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="in_time">{isArabic ? "وقت الدخول" : "In Time"}</Label>
                <Input
                  id="in_time"
                  type="time"
                  value={editFormData.in_time}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, in_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="out_time">{isArabic ? "وقت الخروج" : "Out Time"}</Label>
                <Input
                  id="out_time"
                  type="time"
                  value={editFormData.out_time}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, out_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{isArabic ? "قاعدة الخصم" : "Deduction Rule"}</Label>
              <Select 
                value={editFormData.deduction_rule_id || "none"} 
                onValueChange={(value) => {
                  const actualValue = value === "none" ? "" : value;
                  const rule = deductionRules.find(r => r.id === actualValue);
                  setEditFormData(prev => ({ 
                    ...prev, 
                    deduction_rule_id: actualValue,
                    deduction_amount: rule ? rule.deduction_value : 0
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isArabic ? "اختر قاعدة خصم" : "Select deduction rule"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isArabic ? "بدون خصم" : "No deduction"}</SelectItem>
                  {deductionRules.map(rule => (
                    <SelectItem key={rule.id} value={rule.id}>
                      {isArabic && rule.rule_name_ar ? rule.rule_name_ar : rule.rule_name} ({rule.deduction_value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deduction_amount">{isArabic ? "قيمة الخصم" : "Deduction Amount"}</Label>
              <Input
                id="deduction_amount"
                type="number"
                step="0.01"
                value={editFormData.deduction_amount}
                onChange={(e) => setEditFormData(prev => ({ ...prev, deduction_amount: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{isArabic ? "ملاحظات" : "Notes"}</Label>
              <Input
                id="notes"
                value={editFormData.notes}
                onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleEditSave} disabled={actionLoading}>
              {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavedAttendance;
