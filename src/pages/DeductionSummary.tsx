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
import { ArrowLeft, Calculator, Loader2, Send } from "lucide-react";
import { format } from "date-fns";

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
  const [selectedElementId, setSelectedElementId] = useState<string>("");
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
            basicSalary: Number(e.basic_salary) || 0,
            totalDeduction: 0,
            totalLateMinutes: 0,
            totalEarlyLeaveMinutes: 0,
            lateCount: 0,
            earlyLeaveCount: 0,
            absentCount: 0,
            rules: new Map(),
          };
          map.set(empId, row);
        }
        row.totalDeduction += ded;
        row.totalLateMinutes += lateMin;
        row.totalEarlyLeaveMinutes += earlyMin;
        if (lateMin > 0) row.lateCount++;
        if (earlyMin > 0) row.earlyLeaveCount++;
        if (ts.is_absent) row.absentCount++;
        if (ts.deduction_rules && (ts.deduction_amount || 0) > 0 && !lateApproved && !earlyApproved) {
          const ruleName = isAr
            ? (ts.deduction_rules.rule_name_ar || ts.deduction_rules.rule_name)
            : ts.deduction_rules.rule_name;
          const existing = row.rules.get(ruleName) || { name: ruleName, count: 0, amount: 0 };
          existing.count++;
          existing.amount += ts.deduction_amount || 0;
          row.rules.set(ruleName, existing);
        }
      });

      const out = Array.from(map.values())
        .filter(r => r.totalDeduction > 0 || r.lateCount > 0 || r.earlyLeaveCount > 0 || r.absentCount > 0)
        .sort((a, b) => b.totalDeduction - a.totalDeduction);
      setRows(out);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const fetchDelayElements = async () => {
    const { data } = await supabase
      .from("payroll_elements")
      .select("id, code, name_en, name_ar, is_active, is_delay_minutes_element, calculation_type")
      .eq("is_active", true);
    const els = (data || []).filter((e: any) => e.is_delay_minutes_element || e.calculation_type === "delay_minutes");
    setDelayElements(els as any);
    if (els.length > 0 && !selectedElementId) setSelectedElementId((els[0] as any).id);
  };

  useEffect(() => { fetchData(); fetchDelayElements(); /* eslint-disable-next-line */ }, []);

  const grandTotal = rows.reduce((s, r) => s + r.totalDeduction, 0);
  const grandMinutes = rows.reduce((s, r) => s + r.totalLateMinutes + r.totalEarlyLeaveMinutes, 0);

  const handleConfirm = async () => {
    if (!selectedElementId) {
      toast.error(isAr ? "اختر عنصر الخصم" : "Select a delay element");
      return;
    }
    setSending(true);
    try {
      // Fetch existing entries for this period+element
      const { data: existing, error: exErr } = await supabase
        .from("payroll_variable_entries")
        .select("id, employee_id")
        .eq("element_id", selectedElementId)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth);
      if (exErr) throw exErr;
      const existingMap = new Map<string, string>();
      (existing || []).forEach((e: any) => existingMap.set(e.employee_id, e.id));

      const toUpdate: { id: string; amount: number }[] = [];
      const toInsert: any[] = [];
      const note = isAr
        ? `خصم تأخير من سجل الحضور (${filterLabel})`
        : `Delay deduction from timesheet (${filterLabel})`;

      rows.forEach(r => {
        if (r.totalDeduction <= 0) return;
        const amt = Number(r.totalDeduction.toFixed(2));
        const id = existingMap.get(r.employee_id);
        if (id) toUpdate.push({ id, amount: amt });
        else toInsert.push({
          employee_id: r.employee_id,
          element_id: selectedElementId,
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
          .eq("id", u.id)
          .select();
        if (error) throw error;
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from("payroll_variable_entries").insert(toInsert);
        if (error) throw error;
      }

      toast.success(
        isAr
          ? `تم إرسال ${toInsert.length + toUpdate.length} خصم إلى كشف الرواتب`
          : `Sent ${toInsert.length + toUpdate.length} deductions to payroll`
      );
      setConfirmOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [existingCount, setExistingCount] = useState(0);

  // Check existing variable entries for selected element+period
  useEffect(() => {
    const check = async () => {
      if (!selectedElementId) { setExistingCount(0); return; }
      const { count } = await supabase
        .from("payroll_variable_entries")
        .select("id", { count: "exact", head: true })
        .eq("element_id", selectedElementId)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth);
      setExistingCount(count || 0);
    };
    check();
  }, [selectedElementId, periodYear, periodMonth, sending, rollingBack]);

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

      const { error, count } = await supabase
        .from("payroll_variable_entries")
        .delete({ count: "exact" })
        .eq("element_id", selectedElementId)
        .eq("period_year", periodYear)
        .eq("period_month", periodMonth);
      if (error) throw error;

      toast.success(isAr
        ? `تم التراجع عن ${count || 0} إدخال خصم تأخير`
        : `Rolled back ${count || 0} delay deduction entries`);
      setRollbackOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to rollback");
    } finally {
      setRollingBack(false);
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="container mx-auto p-6 space-y-6" dir={isAr ? "rtl" : "ltr"}>
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
          <div className="flex gap-2 flex-wrap items-end">
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

              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{isAr ? "رقم الموظف" : "Emp #"}</TableHead>
                      <TableHead>{isAr ? "الموظف" : "Employee"}</TableHead>
                      <TableHead className="text-right">{isAr ? "عدد التأخيرات" : "Late Count"}</TableHead>
                      <TableHead className="text-right">{isAr ? "دقائق التأخير" : "Late Min"}</TableHead>
                      <TableHead className="text-right">{isAr ? "خروج مبكر" : "Early Leave"}</TableHead>
                      <TableHead className="text-right">{isAr ? "غياب" : "Absent"}</TableHead>
                      <TableHead>{isAr ? "القواعد المطبقة" : "Applied Rules"}</TableHead>
                      <TableHead className="text-right">{isAr ? "إجمالي الخصم" : "Total Deduction"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
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
    </div>
  );
}
