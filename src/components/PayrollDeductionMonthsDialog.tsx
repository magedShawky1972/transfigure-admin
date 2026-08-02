import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Lock, LockOpen, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type MonthRow = {
  year: number;
  month: number;
  employees: number;
  entries: number;
  total: number;
  lastSent: string | null;
  isLocked: boolean;
  lockedAt: string | null;
};

type DetailRow = {
  employeeName: string;
  empNumber: string;
  elementName: string;
  amount: number;
  notes: string | null;
  createdAt: string | null;
};

const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function PayrollDeductionMonthsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [loading, setLoading] = useState(false);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [elementIds, setElementIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const monthName = (m: number) => (isAr ? MONTHS_AR : MONTHS_EN)[m - 1] || String(m);

  const load = async () => {
    setLoading(true);
    try {
      const { data: els } = await supabase
        .from("payroll_elements")
        .select("id, is_delay_minutes_element, is_absence_element, calculation_type");
      const ids = (els || [])
        .filter((e: any) => e.is_delay_minutes_element || e.is_absence_element || e.calculation_type === "delay_minutes")
        .map((e: any) => e.id as string);
      setElementIds(ids);
      if (ids.length === 0) {
        setMonths([]);
        return;
      }

      const { data: entries, error } = await supabase
        .from("payroll_variable_entries")
        .select("employee_id, period_year, period_month, amount, created_at")
        .in("element_id", ids);
      if (error) throw error;

      const { data: locks } = await supabase
        .from("payroll_month_locks")
        .select("period_year, period_month, is_locked, locked_at");
      const lockMap = new Map<string, any>();
      (locks || []).forEach((l: any) => lockMap.set(`${l.period_year}-${l.period_month}`, l));

      const map = new Map<string, MonthRow & { empSet: Set<string> }>();
      (entries || []).forEach((e: any) => {
        const key = `${e.period_year}-${e.period_month}`;
        let r = map.get(key);
        if (!r) {
          const lock = lockMap.get(key);
          r = {
            year: e.period_year,
            month: e.period_month,
            employees: 0,
            entries: 0,
            total: 0,
            lastSent: null,
            isLocked: !!lock?.is_locked,
            lockedAt: lock?.locked_at || null,
            empSet: new Set<string>(),
          };
          map.set(key, r);
        }
        r.entries += 1;
        r.total += Number(e.amount || 0);
        r.empSet.add(e.employee_id);
        if (e.created_at && (!r.lastSent || e.created_at > r.lastSent)) r.lastSent = e.created_at;
      });

      const out = Array.from(map.values()).map((r) => {
        const { empSet, ...rest } = r;
        return { ...rest, employees: empSet.size } as MonthRow;
      });
      out.sort((a, b) => (b.year - a.year) || (b.month - a.month));
      setMonths(out);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || (isAr ? "فشل التحميل" : "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelected(null);
      setDetails([]);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadDetails = async (year: number, month: number) => {
    setSelected({ year, month });
    setDetailLoading(true);
    setDetails([]);
    try {
      const { data, error } = await supabase
        .from("payroll_variable_entries")
        .select("employee_id, element_id, amount, notes, created_at")
        .in("element_id", elementIds)
        .eq("period_year", year)
        .eq("period_month", month);
      if (error) throw error;

      const empIds = Array.from(new Set((data || []).map((d: any) => d.employee_id)));
      const elIds = Array.from(new Set((data || []).map((d: any) => d.element_id)));
      const [{ data: emps }, { data: els }] = await Promise.all([
        empIds.length
          ? supabase.from("employees").select("id, employee_number, first_name, last_name, first_name_ar, last_name_ar").in("id", empIds)
          : Promise.resolve({ data: [] as any[] } as any),
        elIds.length
          ? supabase.from("payroll_elements").select("id, name_en, name_ar").in("id", elIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const empMap = new Map((emps || []).map((e: any) => [e.id, e]));
      const elMap = new Map((els || []).map((e: any) => [e.id, e]));

      const rows: DetailRow[] = (data || []).map((d: any) => {
        const emp: any = empMap.get(d.employee_id);
        const el: any = elMap.get(d.element_id);
        return {
          employeeName: emp
            ? (isAr
                ? `${emp.first_name_ar || emp.first_name || ""} ${emp.last_name_ar || emp.last_name || ""}`.trim()
                : `${emp.first_name || ""} ${emp.last_name || ""}`.trim())
            : "-",
          empNumber: emp?.employee_number || "-",
          elementName: el ? (isAr ? el.name_ar || el.name_en : el.name_en || el.name_ar) : "-",
          amount: Number(d.amount || 0),
          notes: d.notes,
          createdAt: d.created_at,
        };
      });
      rows.sort((a, b) => b.amount - a.amount);
      setDetails(rows);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || (isAr ? "فشل تحميل التفاصيل" : "Failed to load details"));
    } finally {
      setDetailLoading(false);
    }
  };

  const setLock = async (year: number, month: number, lock: boolean) => {
    setWorking(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      const payload: any = lock
        ? { period_year: year, period_month: month, is_locked: true, locked_by: uid, locked_at: new Date().toISOString(), unlocked_by: null, unlocked_at: null }
        : { period_year: year, period_month: month, is_locked: false, unlocked_by: uid, unlocked_at: new Date().toISOString() };
      const { error } = await supabase
        .from("payroll_month_locks")
        .upsert(payload, { onConflict: "period_year,period_month" })
        .select();
      if (error) throw error;
      toast.success(
        lock
          ? isAr ? "تم تأكيد وقفل الشهر" : "Month confirmed and locked"
          : isAr ? "تم فتح الشهر" : "Month unlocked"
      );
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || (isAr ? "فشل التنفيذ" : "Action failed"));
    } finally {
      setWorking(false);
    }
  };

  const detailTotal = useMemo(() => details.reduce((s, d) => s + d.amount, 0), [details]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {isAr ? "الخصومات المرسلة إلى الرواتب" : "Deductions Sent to Payroll"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "استعرض كل شهر تم إرسال خصوماته إلى الرواتب، اعرض البيانات المرسلة، ثم أكِّد الشهر لقفله."
              : "Review each month sent to payroll, view the data sent, then confirm the month to lock it."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {isAr ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <div className="flex-1 min-h-0 h-[60vh] overflow-y-auto overflow-x-hidden pr-2">
          <div className="space-y-6 pr-2">
            <div className="border rounded-md overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{isAr ? "الشهر" : "Month"}</TableHead>
                    <TableHead className="text-center">{isAr ? "الموظفون" : "Employees"}</TableHead>
                    <TableHead className="text-center">{isAr ? "الإدخالات" : "Entries"}</TableHead>
                    <TableHead className="text-right">{isAr ? "إجمالي الخصم" : "Total Deduction"}</TableHead>
                    <TableHead>{isAr ? "آخر إرسال" : "Last Sent"}</TableHead>
                    <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-right">{isAr ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin inline" />
                      </TableCell>
                    </TableRow>
                  ) : months.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isAr ? "لا توجد شهور مرسلة إلى الرواتب" : "No months sent to payroll yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    months.map((m) => {
                      const isSel = selected?.year === m.year && selected?.month === m.month;
                      return (
                        <TableRow key={`${m.year}-${m.month}`} className={isSel ? "bg-muted/50" : ""}>
                          <TableCell className="font-medium">{monthName(m.month)} {m.year}</TableCell>
                          <TableCell className="text-center">{m.employees}</TableCell>
                          <TableCell className="text-center">{m.entries}</TableCell>
                          <TableCell className="text-right font-semibold">{m.total.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">
                            {m.lastSent ? new Date(m.lastSent).toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            {m.isLocked ? (
                              <Badge variant="destructive" className="gap-1">
                                <Lock className="h-3 w-3" />
                                {isAr ? "مقفل" : "Locked"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <LockOpen className="h-3 w-3" />
                                {isAr ? "مفتوح" : "Open"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadDetails(m.year, m.month)}
                                disabled={detailLoading}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                {isAr ? "تحميل" : "Load"}
                              </Button>
                              {m.isLocked ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={working}
                                  onClick={() => setLock(m.year, m.month, false)}
                                >
                                  <LockOpen className="h-4 w-4 mr-1" />
                                  {isAr ? "فتح الشهر" : "Unlock"}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={working}
                                  onClick={() => setLock(m.year, m.month, true)}
                                >
                                  <Lock className="h-4 w-4 mr-1" />
                                  {isAr ? "تأكيد وقفل" : "Confirm & Lock"}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {selected && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {isAr ? "البيانات المرسلة" : "Data Sent"} — {monthName(selected.month)} {selected.year}
                  </h3>
                  <span className="text-sm font-semibold">
                    {isAr ? "الإجمالي" : "Total"}: {detailTotal.toFixed(2)}
                  </span>
                </div>
                <div className="border rounded-md overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isAr ? "رقم الموظف" : "Emp #"}</TableHead>
                        <TableHead>{isAr ? "الموظف" : "Employee"}</TableHead>
                        <TableHead>{isAr ? "عنصر الراتب" : "Payroll Element"}</TableHead>
                        <TableHead className="text-right">{isAr ? "المبلغ" : "Amount"}</TableHead>
                        <TableHead>{isAr ? "ملاحظات" : "Notes"}</TableHead>
                        <TableHead>{isAr ? "تاريخ الإرسال" : "Sent At"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin inline" />
                          </TableCell>
                        </TableRow>
                      ) : details.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            {isAr ? "لا توجد بيانات" : "No data"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        details.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell>{d.empNumber}</TableCell>
                            <TableCell className="font-medium">{d.employeeName}</TableCell>
                            <TableCell>{d.elementName}</TableCell>
                            <TableCell className="text-right font-semibold">{d.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate" title={d.notes || ""}>{d.notes || "-"}</TableCell>
                            <TableCell className="text-xs">{d.createdAt ? new Date(d.createdAt).toLocaleString() : "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
