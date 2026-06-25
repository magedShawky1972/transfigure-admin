import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { ArrowLeft, Calculator, Loader2, Send, Printer, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Row {
  employee_id: string;
  empNumber: string;
  name: string;
  basicSalary: number;
  totalDeduction: number;
  totalLateMinutes: number;
  totalEarlyLeaveMinutes: number;
  lateCount: number;
  earlyLeaveCount: number;
  absentCount: number;
  absentWithNoticeCount: number;
  absentWithoutNoticeCount: number;
  absenceDeduction: number;
  rules: Map<string, { name: string; count: number; amount: number }>;
}

export default function DeductionSummary() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const mode = (params.get("mode") as "date" | "month" | "range") || "date";
  const date = params.get("date") || "";
  const month = params.get("month") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const employeeFilter = params.get("employee") || "";
  const departmentFilter = params.get("department") || "";

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [delayElements, setDelayElements] = useState<{ id: string; code: string; name_en: string; name_ar: string | null }[]>([]);
  const [absenceElements, setAbsenceElements] = useState<{ id: string; code: string; name_en: string; name_ar: string | null }[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string>("");
  const [selectedAbsenceElementId, setSelectedAbsenceElementId] = useState<string>("");
  const now = new Date();
  const [periodYear, setPeriodYear] = useState<number>(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState<number>(now.getMonth() + 1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Derive default period from filters
  useEffect(() => {
    if (mode === "month" && month) {
      const [y, m] = month.split("-").map(Number);
      setPeriodYear(y); setPeriodMonth(m);
    } else if (mode === "date" && date) {
      const d = new Date(date);
      setPeriodYear(d.getFullYear()); setPeriodMonth(d.getMonth() + 1);
    } else if (mode === "range" && to) {
      const d = new Date(to);
      setPeriodYear(d.getFullYear()); setPeriodMonth(d.getMonth() + 1);
    }
  }, [mode, month, date, to]);

  const filterLabel = useMemo(() => {
    if (mode === "date") return `${isAr ? "التاريخ" : "Date"}: ${date}`;
    if (mode === "month") return `${isAr ? "الشهر" : "Month"}: ${month}`;
    return `${isAr ? "من" : "From"}: ${from} - ${isAr ? "إلى" : "To"}: ${to}`;
  }, [mode, date, month, from, to, isAr]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build employee scope (department hierarchy)
      let scopedEmployeeIds: string[] | null = null;
      if (departmentFilter) {
        const { data: depts } = await supabase
          .from("departments")
          .select("id, parent_department_id");
        const ids = new Set<string>([departmentFilter]);
        let changed = true;
        while (changed) {
          changed = false;
          (depts || []).forEach((d: any) => {
            if (d.parent_department_id && ids.has(d.parent_department_id) && !ids.has(d.id)) {
              ids.add(d.id); changed = true;
            }
          });
        }
        const { data: emps } = await supabase
          .from("employees")
          .select("id, department_id")
          .in("department_id", Array.from(ids));
        scopedEmployeeIds = (emps || []).map((e: any) => e.id);
        if (scopedEmployeeIds.length === 0) {
          setRows([]); setLoading(false); return;
        }
      }

      let q = supabase.from("timesheets").select(`
        *,
        employees(employee_number, first_name, last_name, basic_salary),
        deduction_rules(rule_name, rule_name_ar, deduction_type, deduction_value)
      `);

      if (mode === "date") q = q.eq("work_date", date);
      else if (mode === "range") q = q.gte("work_date", from).lte("work_date", to);
      else if (mode === "month" && month) {
        const [y, m] = month.split("-").map(Number);
        const start = `${month}-01`;
        const last = new Date(y, m, 0).getDate();
        const end = `${month}-${String(last).padStart(2, "0")}`;
        q = q.gte("work_date", start).lte("work_date", end);
      }
      if (employeeFilter) q = q.eq("employee_id", employeeFilter);
      else if (scopedEmployeeIds) q = q.in("employee_id", scopedEmployeeIds);

      const { data, error } = await q;
      if (error) throw error;

      // Exclude approved delays/early_leave
      const dFrom = mode === "date" ? date : mode === "range" ? from : `${month}-01`;
      const dTo = mode === "date" ? date : mode === "range" ? to :
        (() => { const [y, m] = month.split("-").map(Number); return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; })();

      const { data: approved } = await supabase
        .from("employee_requests")
        .select("employee_id, delay_date, request_type")
        .in("request_type", ["delay", "early_leave"])
        .eq("status", "approved")
        .gte("delay_date", dFrom)
        .lte("delay_date", dTo);

      const approvedSet = new Set<string>();
      (approved || []).forEach((r: any) => approvedSet.add(`${r.employee_id}_${r.delay_date}_${r.request_type}`));

      // Load Basic Salary from the payroll element flagged as is_basic_salary_element
      const { data: basicEl } = await supabase
        .from("payroll_elements")
        .select("id")
        .eq("is_basic_salary_element", true)
        .eq("is_active", true)
        .maybeSingle();
      const basicSalaryMap = new Map<string, number>();
      if (basicEl?.id) {
        const { data: assigns } = await supabase
          .from("payroll_employee_elements")
          .select("employee_id, amount")
          .eq("element_id", basicEl.id);
        (assigns || []).forEach((a: any) => basicSalaryMap.set(a.employee_id, Number(a.amount) || 0));
      }

      // Load absence rules (with/without notice multipliers)
      const { data: absRules } = await supabase
        .from("deduction_rules")
        .select("id, rule_name, rule_name_ar, deduction_value, is_absence_with_notice, is_absence_without_notice")
        .eq("rule_type", "absence")
        .eq("is_active", true);
      const withNoticeRule: any = (absRules || []).find((r: any) => r.is_absence_with_notice);
      const withoutNoticeRule: any = (absRules || []).find((r: any) => r.is_absence_without_notice);
      const defaultAbsenceRule: any = (absRules || [])[0];

      const map = new Map<string, Row>();
      (data || []).forEach((ts: any) => {
        const empId = ts.employee_id;
        const e = ts.employees;
        if (!e) return;
        const lateApproved = approvedSet.has(`${empId}_${ts.work_date}_delay`);
        const earlyApproved = approvedSet.has(`${empId}_${ts.work_date}_early_leave`);
        const lateMin = lateApproved ? 0 : (ts.late_minutes || 0);
        const earlyMin = earlyApproved ? 0 : (ts.early_leave_minutes || 0);
        const ded = (lateApproved || earlyApproved) ? 0 : (ts.deduction_amount || 0);

        let row = map.get(empId);
        if (!row) {
          row = {
            employee_id: empId,
            empNumber: e.employee_number || "-",
            name: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
            basicSalary: basicSalaryMap.get(empId) ?? (Number(e.basic_salary) || 0),
            totalDeduction: 0,
            totalLateMinutes: 0,
            totalEarlyLeaveMinutes: 0,
            lateCount: 0,
            earlyLeaveCount: 0,
            absentCount: 0,
            absentWithNoticeCount: 0,
            absentWithoutNoticeCount: 0,
            absenceDeduction: 0,
            rules: new Map(),
          };
          map.set(empId, row);
        }
        row.totalLateMinutes += lateMin;
        row.totalEarlyLeaveMinutes += earlyMin;
        if (lateMin > 0) row.lateCount++;
        if (earlyMin > 0) row.earlyLeaveCount++;

        if (ts.is_absent) {
          row.absentCount++;
          const hasNotice = ts.absence_has_notice;
          // Default: any absence not explicitly marked "with notice" is treated as "without notice"
          let rule: any;
          if (hasNotice === true) {
            row.absentWithNoticeCount++;
            rule = withNoticeRule || defaultAbsenceRule;
          } else {
            row.absentWithoutNoticeCount++;
            rule = withoutNoticeRule || defaultAbsenceRule;
          }
          if (rule && row.basicSalary > 0) {
            const amt = (row.basicSalary / 30) * Number(rule.deduction_value || 0);
            row.absenceDeduction += amt;
            const ruleName = isAr ? (rule.rule_name_ar || rule.rule_name) : rule.rule_name;
            const existing = row.rules.get(ruleName) || { name: ruleName, count: 0, amount: 0 };
            existing.count++;
            existing.amount += amt;
            row.rules.set(ruleName, existing);
          }
        } else {
          // Only count non-absence rule deductions (late/early) here; absence is computed above
          row.totalDeduction += ded;
          if (ts.deduction_rules && (ts.deduction_amount || 0) > 0 && !lateApproved && !earlyApproved) {
            const ruleName = isAr
              ? (ts.deduction_rules.rule_name_ar || ts.deduction_rules.rule_name)
              : ts.deduction_rules.rule_name;
            const existing = row.rules.get(ruleName) || { name: ruleName, count: 0, amount: 0 };
            existing.count++;
            existing.amount += ts.deduction_amount || 0;
            row.rules.set(ruleName, existing);
          }
        }
      });

      // Fallback: if no rule-based deduction was saved, compute from minutes using
      // (basic_salary / 30 / 8 / 60) * total_minutes
      const fallbackLabel = isAr ? "تأخير محسوب (راتب/30/8/60 × دقائق)" : "Auto (salary/30/8/60 × min)";
      Array.from(map.values()).forEach(r => {
        const minutes = r.totalLateMinutes + r.totalEarlyLeaveMinutes;
        if (r.totalDeduction <= 0 && minutes > 0 && r.basicSalary > 0) {
          const amt = (r.basicSalary / 30 / 8 / 60) * minutes;
          r.totalDeduction = amt;
          r.rules.set(fallbackLabel, { name: fallbackLabel, count: minutes, amount: amt });
        }
        // Roll absence deduction into total
        r.totalDeduction += r.absenceDeduction;
      });

      const out = Array.from(map.values())
        .filter(r => r.totalDeduction > 0 || r.lateCount > 0 || r.earlyLeaveCount > 0 || r.absentCount > 0)
        .sort((a, b) => b.totalDeduction - a.totalDeduction);
      setRows(out);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || (isAr ? "فشل التحميل" : "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  const fetchDelayElements = async () => {
    const { data } = await supabase
      .from("payroll_elements")
      .select("id, code, name_en, name_ar, is_active, is_delay_minutes_element, is_absence_element, calculation_type")
      .eq("is_active", true);
    const delayEls = (data || []).filter((e: any) => e.is_delay_minutes_element || e.calculation_type === "delay_minutes");
    const absenceEls = (data || []).filter((e: any) => e.is_absence_element);
    setDelayElements(delayEls as any);
    setAbsenceElements(absenceEls as any);
    if (delayEls.length > 0 && !selectedElementId) setSelectedElementId((delayEls[0] as any).id);
    if (absenceEls.length > 0 && !selectedAbsenceElementId) setSelectedAbsenceElementId((absenceEls[0] as any).id);
  };

  useEffect(() => { fetchData(); fetchDelayElements(); /* eslint-disable-next-line */ }, []);

  type SortKey = "empNumber" | "name" | "lateCount" | "totalLateMinutes" | "earlyLeaveCount" | "absentCount" | "rules" | "totalDeduction";
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sorts, setSorts] = useState<{ key: SortKey; dir: "asc" | "desc" }[]>([{ key: "totalDeduction", dir: "desc" }]);

  const toggleSort = (key: SortKey, additive: boolean) => {
    setSorts(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (!additive) {
        if (idx === -1) return [{ key, dir: "asc" }];
        const cur = prev[idx];
        if (cur.dir === "asc") return [{ key, dir: "desc" }];
        return [];
      }
      if (idx === -1) return [...prev, { key, dir: "asc" }];
      const cur = prev[idx];
      const next = [...prev];
      if (cur.dir === "asc") next[idx] = { key, dir: "desc" };
      else next.splice(idx, 1);
      return next;
    });
  };

  const sortIndicator = (key: SortKey) => {
    const idx = sorts.findIndex(s => s.key === key);
    if (idx === -1) return <ArrowUpDown className="h-3 w-3 inline opacity-40 ml-1" />;
    const s = sorts[idx];
    return (
      <span className="inline-flex items-center ml-1 text-primary">
        {s.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {sorts.length > 1 && <span className="text-[10px] ml-0.5">{idx + 1}</span>}
      </span>
    );
  };

  const getValue = (r: Row, key: SortKey): string | number => {
    switch (key) {
      case "rules": return Array.from(r.rules.values()).map(x => x.name).join(", ");
      default: return r[key] as any;
    }
  };

  const displayRows = useMemo(() => {
    const matchesFilter = (val: string, q: string) =>
      !q || String(val ?? "").toLowerCase().includes(q.toLowerCase());
    let out = rows.filter(r =>
      matchesFilter(r.empNumber, filters.empNumber || "") &&
      matchesFilter(r.name, filters.name || "") &&
      matchesFilter(String(r.lateCount), filters.lateCount || "") &&
      matchesFilter(String(r.totalLateMinutes), filters.totalLateMinutes || "") &&
      matchesFilter(`${r.earlyLeaveCount} ${r.totalEarlyLeaveMinutes}`, filters.earlyLeaveCount || "") &&
      matchesFilter(String(r.absentCount), filters.absentCount || "") &&
      matchesFilter(Array.from(r.rules.values()).map(x => x.name).join(" "), filters.rules || "") &&
      matchesFilter(r.totalDeduction.toFixed(2), filters.totalDeduction || "")
    );
    if (sorts.length > 0) {
      out = [...out].sort((a, b) => {
        for (const s of sorts) {
          const av = getValue(a, s.key);
          const bv = getValue(b, s.key);
          let cmp = 0;
          if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
          else cmp = String(av).localeCompare(String(bv));
          if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    }
    return out;
  }, [rows, filters, sorts]);

  const clearFiltersSorts = () => { setFilters({}); setSorts([]); };

  const grandTotal = displayRows.reduce((s, r) => s + r.totalDeduction, 0);
  const grandMinutes = displayRows.reduce((s, r) => s + r.totalLateMinutes + r.totalEarlyLeaveMinutes, 0);


  const handleConfirm = async () => {
    if (!selectedElementId) {
      toast.error(isAr ? "اختر عنصر الخصم" : "Select a delay element");
      return;
    }
    setSending(true);
    try {
      // Helper to upsert variable entries against a given element with per-employee amounts
      const sendForElement = async (
        elementId: string,
        getAmount: (r: Row) => number,
        note: string,
      ) => {
        const { data: existing, error: exErr } = await supabase
          .from("payroll_variable_entries")
          .select("id, employee_id")
          .eq("element_id", elementId)
          .eq("period_year", periodYear)
          .eq("period_month", periodMonth);
        if (exErr) throw exErr;
        const existingMap = new Map<string, string>();
        (existing || []).forEach((e: any) => existingMap.set(e.employee_id, e.id));

        const toUpdate: { id: string; amount: number }[] = [];
        const toInsert: any[] = [];
        rows.forEach(r => {
          const amt = Number((getAmount(r) || 0).toFixed(2));
          if (amt <= 0) return;
          const id = existingMap.get(r.employee_id);
          if (id) toUpdate.push({ id, amount: amt });
          else toInsert.push({
            employee_id: r.employee_id,
            element_id: elementId,
            period_year: periodYear,
            period_month: periodMonth,
            amount: amt,
            notes: note,
          });
        });

        for (const u of toUpdate) {
          const { error } = await supabase
            .from("payroll_variable_entries")
            .update({ amount: u.amount, notes: note })
            .eq("id", u.id);
          if (error) throw error;
        }
        if (toInsert.length > 0) {
          const { error } = await supabase.from("payroll_variable_entries").insert(toInsert);
          if (error) throw error;
        }
        return toInsert.length + toUpdate.length;
      };

      // Late/early goes to delay element = totalDeduction MINUS absenceDeduction
      const delayNote = isAr
        ? `خصم تأخير من سجل الحضور (${filterLabel})`
        : `Delay deduction from timesheet (${filterLabel})`;
      const delayCount = await sendForElement(
        selectedElementId,
        (r) => Math.max(0, r.totalDeduction - r.absenceDeduction),
        delayNote,
      );

      // Absence goes to absence element (if set & there's anything to send)
      let absenceCount = 0;
      const totalAbsenceAmt = rows.reduce((s, r) => s + r.absenceDeduction, 0);
      if (selectedAbsenceElementId && totalAbsenceAmt > 0) {
        const absenceNote = isAr
          ? `خصم غياب من سجل الحضور (${filterLabel})`
          : `Absence deduction from timesheet (${filterLabel})`;
        absenceCount = await sendForElement(
          selectedAbsenceElementId,
          (r) => r.absenceDeduction,
          absenceNote,
        );
      }

      toast.success(
        isAr
          ? `تم إرسال ${delayCount} خصم تأخير و ${absenceCount} خصم غياب إلى كشف الرواتب`
          : `Sent ${delayCount} delay and ${absenceCount} absence deductions to payroll`
      );
      setConfirmOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || (isAr ? "فشل الإرسال" : "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  // Check existing variable entries for selected element+period (scoped to current rows)
  useEffect(() => {
    const check = async () => {
      if (!selectedElementId) { setExistingCount(0); return; }
      const empIds = rows.map((r) => r.employee_id);
      if (empIds.length === 0) { setExistingCount(0); return; }
      const elIds = [selectedElementId];
      if (selectedAbsenceElementId) elIds.push(selectedAbsenceElementId);
      const { count } = await supabase
        .from("payroll_variable_entries")
        .select("id", { count: "exact", head: true })
        .in("element_id", elIds)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth)
        .in("employee_id", empIds);
      setExistingCount(count || 0);
    };
    check();
  }, [selectedElementId, selectedAbsenceElementId, periodYear, periodMonth, sending, rollingBack, rows]);

  const handleRollback = async () => {
    if (!selectedElementId) return;
    setRollingBack(true);
    try {
      // Block if payroll already confirmed for this period
      const { data: run } = await supabase
        .from("payroll_runs")
        .select("id, status")
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth)
        .maybeSingle();
      if (run && run.status === "confirmed") {
        toast.error(isAr
          ? "تم تأكيد كشف الرواتب لهذا الشهر — لا يمكن التراجع"
          : "Payroll already confirmed for this period — rollback not allowed");
        setRollingBack(false);
        return;
      }

      const empIds = rows.map((r) => r.employee_id);
      if (empIds.length === 0) {
        toast.error(isAr ? "لا يوجد موظفين للتراجع" : "No employees in current view to rollback");
        setRollingBack(false);
        return;
      }
      const elIds = [selectedElementId];
      if (selectedAbsenceElementId) elIds.push(selectedAbsenceElementId);

      const { error, count } = await supabase
        .from("payroll_variable_entries")
        .delete({ count: "exact" })
        .in("element_id", elIds)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth)
        .in("employee_id", empIds);
      if (error) throw error;

      toast.success(isAr
        ? `تم التراجع عن ${count || 0} إدخال خصم`
        : `Rolled back ${count || 0} deduction entries for ${empIds.length} employee(s) in view`);
      setRollbackOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || (language === "ar" ? "فشل التراجع" : "Failed to rollback"));
    } finally {
      setRollingBack(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  const handlePrint = () => { setTimeout(() => window.print(), 100); };

  const handleExportExcel = () => {
    const header = [
      "#",
      isAr ? "رقم الموظف" : "Emp #",
      isAr ? "الموظف" : "Employee",
      isAr ? "الراتب الأساسي" : "Basic Salary",
      isAr ? "عدد التأخيرات" : "Late Count",
      isAr ? "دقائق التأخير" : "Late Min",
      isAr ? "خروج مبكر (عدد)" : "Early Leave Count",
      isAr ? "دقائق الخروج المبكر" : "Early Leave Min",
      isAr ? "غياب" : "Absent",
      isAr ? "القواعد المطبقة" : "Applied Rules",
      isAr ? "إجمالي الخصم" : "Total Deduction",
    ];
    const body = displayRows.map((r, i) => [
      i + 1,
      r.empNumber,
      r.name,
      r.basicSalary,
      r.lateCount,
      r.totalLateMinutes,
      r.earlyLeaveCount,
      r.totalEarlyLeaveMinutes,
      r.absentCount,
      Array.from(r.rules.values()).map(x => `${x.name}: ${x.count}x (${x.amount.toFixed(2)})`).join(" | "),
      Number(r.totalDeduction.toFixed(2)),
    ]);
    body.push(["", "", isAr ? "الإجمالي" : "Grand Total", "", "", "", "", "", "", "", Number(grandTotal.toFixed(2))]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    if (isAr) (ws as any)["!views"] = [{ RTL: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isAr ? "ملخص الخصومات" : "Deductions");
    XLSX.writeFile(wb, `deduction-summary-${periodYear}-${String(periodMonth).padStart(2, "0")}.xlsx`);
  };


  return (
    <div className="container mx-auto p-6 space-y-6 print-area" dir={isAr ? "rtl" : "ltr"}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute; inset: 0; margin: 0 !important; padding: 0 !important; max-width: 100% !important; width: 100% !important; }
          aside, nav, header[role="banner"], [data-sidebar], .print\\:hidden { display: none !important; }
          .print-area .grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 8px !important; }
          .print-area table { width: 100% !important; font-size: 11px !important; border-collapse: collapse !important; }
          .print-area th, .print-area td { padding: 4px 6px !important; border: 1px solid #ddd !important; }
          .print-area .text-2xl { font-size: 16px !important; }
          .print-area .overflow-x-auto { overflow: visible !important; }
          .print-area [class*="shadow"] { box-shadow: none !important; }
        }
      `}</style>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-6 w-6" />
              {isAr ? "ملخص الخصومات" : "Deduction Summary"}
            </CardTitle>
            <Badge variant="secondary">{filterLabel}</Badge>
          </div>
          <div className="flex gap-2 flex-wrap items-end print:hidden">
            <div>
              <Label className="text-xs">{isAr ? "عنصر الخصم" : "Delay Element"}</Label>
              <Select value={selectedElementId} onValueChange={setSelectedElementId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder={isAr ? "اختر" : "Select"} /></SelectTrigger>
                <SelectContent>
                  {delayElements.length === 0 ? (
                    <SelectItem value="none" disabled>{isAr ? "لا يوجد عنصر معرف" : "No delay element defined"}</SelectItem>
                  ) : delayElements.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.code} - {isAr ? (e.name_ar || e.name_en) : e.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isAr ? "عنصر الغياب" : "Absence Element"}</Label>
              <Select value={selectedAbsenceElementId} onValueChange={setSelectedAbsenceElementId}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder={isAr ? "اختر" : "Select"} /></SelectTrigger>
                <SelectContent>
                  {absenceElements.length === 0 ? (
                    <SelectItem value="none" disabled>{isAr ? "لا يوجد عنصر غياب معرف" : "No absence element defined"}</SelectItem>
                  ) : absenceElements.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.code} - {isAr ? (e.name_ar || e.name_en) : e.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isAr ? "السنة" : "Year"}</Label>
              <Select value={String(periodYear)} onValueChange={v => setPeriodYear(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{isAr ? "الشهر" : "Month"}</Label>
              <Select value={String(periodMonth)} onValueChange={v => setPeriodMonth(Number(v))}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={loading || rows.length === 0 || !selectedElementId || grandTotal <= 0}
            >
              <Send className="h-4 w-4 mr-2" />
              {isAr ? "تأكيد وإرسال إلى الرواتب" : "Confirm & Send to Payroll"}
            </Button>
            <Button variant="outline" onClick={handleExportExcel} disabled={loading || rows.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {isAr ? "تصدير Excel" : "Export Excel"}
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={loading || rows.length === 0}>
              <Printer className="h-4 w-4 mr-2" />
              {isAr ? "طباعة" : "Print"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setRollbackOpen(true)}
              disabled={!selectedElementId || existingCount === 0 || rollingBack}
              title={isAr ? "التراجع عن خصومات التأخير لهذا الشهر" : "Rollback delay deductions for this period"}
            >
              {isAr ? `تراجع (${existingCount})` : `Rollback (${existingCount})`}
            </Button>

          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {isAr ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {isAr ? "لا توجد خصومات" : "No deductions found"}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isAr ? "عدد الموظفين" : "Employees"}</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isAr ? "إجمالي دقائق التأخير/الخروج" : "Total Late/Early Min"}</div><div className="text-2xl font-bold">{grandMinutes}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isAr ? "إجمالي أيام الغياب" : "Total Absent Days"}</div><div className="text-2xl font-bold">{rows.reduce((s, r) => s + r.absentCount, 0)}</div></CardContent></Card>
                <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{isAr ? "إجمالي الخصم" : "Total Deduction"}</div><div className="text-2xl font-bold text-red-600">{grandTotal.toFixed(2)}</div></CardContent></Card>
              </div>

              <div className="flex items-center justify-between mb-2 print:hidden">
                <div className="text-xs text-muted-foreground">
                  {isAr ? "اضغط على العنوان للترتيب • Shift+اضغط لترتيب متعدد" : "Click header to sort • Shift+click for multi-sort"}
                </div>
                {(sorts.length > 0 || Object.values(filters).some(v => v)) && (
                  <Button variant="ghost" size="sm" onClick={clearFiltersSorts}>
                    <X className="h-3 w-3 mr-1" /> {isAr ? "مسح الترتيب والتصفية" : "Clear sorts & filters"}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      {([
                        { k: "empNumber", l: isAr ? "رقم الموظف" : "Emp #", right: false },
                        { k: "name", l: isAr ? "الموظف" : "Employee", right: false },
                        { k: "lateCount", l: isAr ? "عدد التأخيرات" : "Late Count", right: true },
                        { k: "totalLateMinutes", l: isAr ? "دقائق التأخير" : "Late Min", right: true },
                        { k: "earlyLeaveCount", l: isAr ? "خروج مبكر" : "Early Leave", right: true },
                        { k: "absentCount", l: isAr ? "غياب" : "Absent", right: true },
                        { k: "rules", l: isAr ? "القواعد المطبقة" : "Applied Rules", right: false },
                        { k: "totalDeduction", l: isAr ? "إجمالي الخصم" : "Total Deduction", right: true },
                      ] as { k: SortKey; l: string; right: boolean }[]).map(col => (
                        <TableHead
                          key={col.k}
                          className={`cursor-pointer select-none ${col.right ? "text-right" : ""}`}
                          onClick={(e) => toggleSort(col.k, e.shiftKey)}
                        >
                          {col.l}{sortIndicator(col.k)}
                        </TableHead>
                      ))}
                    </TableRow>
                    <TableRow className="print:hidden">
                      <TableHead></TableHead>
                      {(["empNumber","name","lateCount","totalLateMinutes","earlyLeaveCount","absentCount","rules","totalDeduction"] as const).map(k => (
                        <TableHead key={k} className="py-1">
                          <Input
                            value={filters[k] || ""}
                            onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
                            placeholder={isAr ? "تصفية..." : "Filter..."}
                            className="h-7 text-xs"
                          />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRows.map((r, i) => (
                      <TableRow key={r.employee_id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{r.empNumber}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{r.lateCount}</TableCell>
                        <TableCell className="text-right">{r.totalLateMinutes}</TableCell>
                        <TableCell className="text-right">{r.earlyLeaveCount} ({r.totalEarlyLeaveMinutes}m)</TableCell>
                        <TableCell className="text-right">{r.absentCount || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Array.from(r.rules.values()).map(rule => (
                            <div key={rule.name}>{rule.name}: {rule.count}x ({rule.amount.toFixed(2)})</div>
                          ))}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{r.totalDeduction.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={8} className={isAr ? "text-left" : "text-right"}>{isAr ? "الإجمالي" : "Grand Total"}</TableCell>
                      <TableCell className="text-right text-red-600">{grandTotal.toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>

                </Table>
              </div>

              <div className="text-xs text-muted-foreground mt-3">
                {isAr ? "تم الإنشاء في" : "Generated at"}: {format(new Date(), "yyyy-MM-dd HH:mm")}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "تأكيد الإرسال إلى الرواتب" : "Confirm Send to Payroll"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `سيتم إرسال خصم ${rows.length} موظف بإجمالي ${grandTotal.toFixed(2)} إلى عنصر الخصم المختار لفترة ${periodYear}-${String(periodMonth).padStart(2, "0")}. سيتم تحديث أي إدخالات سابقة لنفس الفترة والعنصر.`
                : `This will send deductions for ${rows.length} employees totaling ${grandTotal.toFixed(2)} to the selected delay element for period ${periodYear}-${String(periodMonth).padStart(2, "0")}. Any existing entries for the same period and element will be overwritten.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirm(); }} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {isAr ? "تأكيد" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "تأكيد التراجع" : "Confirm Rollback"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `سيتم حذف ${existingCount} إدخال خصم تأخير للفترة ${periodYear}/${periodMonth}. لا يمكن التراجع إذا تم تأكيد كشف الرواتب لهذا الشهر.`
                : `This will delete ${existingCount} delay deduction entries for ${periodYear}/${periodMonth}. Not allowed if payroll is already confirmed for this period.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleRollback(); }} disabled={rollingBack}>
              {rollingBack && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isAr ? "تراجع" : "Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
