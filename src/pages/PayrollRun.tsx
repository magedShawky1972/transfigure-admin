import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Play, CheckCircle2, Trash2, RefreshCw, Lock, Filter, X, Undo2, Printer } from "lucide-react";
import { useHRBusinessUnitScope } from "@/hooks/useHRBusinessUnitScope";

type Run = {
  id: string;
  period_year: number;
  period_month: number;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_employer_contributions: number;
  total_net: number;
  employee_count: number;
  confirmed_at: string | null;
};

type Line = {
  id: string;
  employee_id: string;
  element_id: string;
  element_type: string;
  amount: number;
  minutes: number | null;
};

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildPayslipHtml(opts: {
  period: string;
  status: string;
  lang: "ar" | "en";
  employees: Array<{
    id: string;
    name: string;
    lines: Array<{ name: string; type: string; minutes: number | null; amount: number }>;
  }>;
}) {
  const isAr = opts.lang === "ar";
  const isDraft = opts.status !== "confirmed";
  const printedOn = new Date().toLocaleString(isAr ? "ar-SA" : "en-GB");
  const dir = isAr ? 'dir="rtl" lang="ar"' : 'lang="en"';

  const t = {
    payslip: isAr ? "قسيمة راتب" : "PAY SLIP",
    payPeriod: isAr ? "فترة الراتب:" : "Pay Period:",
    idLabel: isAr ? "الرقم:" : "ID:",
    statusLabel: isAr ? "الحالة:" : "Status:",
    draft: isAr ? "مسودة" : "Draft",
    confirmed: isAr ? "مؤكد" : "Confirmed",
    earnings: isAr ? "الاستحقاقات" : "Earnings",
    amount: isAr ? "المبلغ" : "Amount",
    noEarnings: isAr ? "لا استحقاقات" : "No earnings",
    totalEarnings: isAr ? "إجمالي الاستحقاقات" : "Total Earnings",
    deductions: isAr ? "الخصومات" : "Deductions",
    noDeductions: isAr ? "لا خصومات" : "No deductions",
    totalDeductions: isAr ? "إجمالي الخصومات" : "Total Deductions",
    other: isAr ? "أخرى" : "Other",
    grossEarnings: isAr ? "إجمالي الاستحقاقات" : "Gross Earnings",
    netPay: isAr ? "صافي الراتب" : "Net Pay",
    printed: isAr ? "طُبع في:" : "Printed:",
    sysGenerated: isAr ? "هذه قسيمة راتب صادرة من النظام" : "This is a system-generated payslip",
    draftNote: isAr ? " (مسودة — غير نهائية)" : " (DRAFT — not final)",
    watermark: isAr ? "مسودة" : "DRAFT",
    printBtn: isAr ? "طباعة" : "Print",
  };

  const slips = opts.employees.map((e) => {
    const earnings = e.lines.filter((l) => l.type === "earning");
    const deductions = e.lines.filter((l) => l.type === "deduction");
    const other = e.lines.filter((l) => l.type !== "earning" && l.type !== "deduction");
    const gross = earnings.reduce((s, l) => s + Number(l.amount || 0), 0);
    const ded = deductions.reduce((s, l) => s + Number(l.amount || 0), 0);
    const net = gross - ded;

    const sideRows = (items: typeof earnings, emptyLabel: string) => {
      if (!items.length) return `<tr><td class="muted" colspan="2">${emptyLabel}</td></tr>`;
      return items.map((l) => `<tr><td>${l.name}</td><td class="r mono">${fmt(l.amount)}</td></tr>`).join("");
    };

    return `
      <section class="slip">
        ${isDraft ? `<div class="watermark">${t.watermark}</div>` : ""}
        <header class="head">
          <div>
            <div class="title">${t.payslip}</div>
            <div class="muted">${t.payPeriod} <strong>${opts.period}</strong></div>
          </div>
          <div class="r">
            <div class="emp-name">${e.name}</div>
            <div class="muted">${t.idLabel} ${e.id}</div>
            <div class="muted">${t.statusLabel} ${isDraft ? t.draft : t.confirmed}</div>
          </div>
        </header>

        <div class="two-col">
          <table class="block earnings">
            <thead><tr><th>${t.earnings}</th><th class="r">${t.amount}</th></tr></thead>
            <tbody>${sideRows(earnings, t.noEarnings)}</tbody>
            <tfoot><tr><td>${t.totalEarnings}</td><td class="r mono">${fmt(gross)}</td></tr></tfoot>
          </table>
          <table class="block deductions">
            <thead><tr><th>${t.deductions}</th><th class="r">${t.amount}</th></tr></thead>
            <tbody>${sideRows(deductions, t.noDeductions)}</tbody>
            <tfoot><tr><td>${t.totalDeductions}</td><td class="r mono">${fmt(ded)}</td></tr></tfoot>
          </table>
        </div>

        ${other.length ? `<table class="block other">
          <thead><tr><th>${t.other}</th><th class="r">${t.amount}</th></tr></thead>
          <tbody>${other.map((l) => `<tr><td>${l.name}</td><td class="r mono">${fmt(l.amount)}</td></tr>`).join("")}</tbody>
        </table>` : ""}

        <div class="summary">
          <div class="sum-row"><span>${t.grossEarnings}</span><span class="mono">${fmt(gross)}</span></div>
          <div class="sum-row"><span>${t.totalDeductions}</span><span class="mono">- ${fmt(ded)}</span></div>
          <div class="sum-row net"><span>${t.netPay}</span><span class="mono">${fmt(net)}</span></div>
        </div>

        <footer class="foot">
          <div class="muted">${t.printed} ${printedOn}</div>
          <div class="muted">${t.sysGenerated}${isDraft ? t.draftNote : ""}.</div>
        </footer>
      </section>`;
  }).join("");

  return `<!doctype html><html ${dir}><head><meta charset="utf-8"><title>${opts.lang === "ar" ? "قسيمة راتب" : "Pay Slip"} — ${opts.period}</title>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#f4f4f4;padding:20px}
    .mono{font-variant-numeric:tabular-nums;font-family:"Courier New",monospace}
    .muted{color:#6b7280;font-size:12px}
    .r{text-align:right}
    .slip{position:relative;background:#fff;max-width:780px;margin:0 auto 20px;padding:28px 32px;border:1px solid #d1d5db;border-radius:4px;overflow:hidden}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #111;padding-bottom:14px;margin-bottom:18px}
    .title{font-size:22px;font-weight:bold;letter-spacing:3px}
    .emp-name{font-size:16px;font-weight:bold}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    table.block{width:100%;border-collapse:collapse;font-size:13px;border:1px solid #d1d5db}
    table.block th,table.block td{padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
    table.block th{background:#f3f4f6;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
    table.block tfoot td{background:#f9fafb;font-weight:bold;border-top:2px solid #111;border-bottom:none}
    table.block.other{margin-top:14px}
    .summary{margin-top:18px;border:1px solid #111;border-radius:4px;padding:12px 16px;background:#fafafa}
    .sum-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
    .sum-row.net{border-top:2px solid #111;margin-top:6px;padding-top:8px;font-size:16px;font-weight:bold}
    .foot{margin-top:18px;display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:10px}
    .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:140px;color:rgba(220,0,0,.10);font-weight:bold;pointer-events:none;letter-spacing:10px;z-index:0;white-space:nowrap}
    .slip > *{position:relative;z-index:1}
    .toolbar{max-width:780px;margin:0 auto 12px;text-align:right}
    .toolbar button{padding:8px 16px;border:1px solid #111;background:#111;color:#fff;border-radius:4px;cursor:pointer;font-size:13px}
    @media print{
      body{background:#fff;padding:0}
      .toolbar{display:none}
      .slip{box-shadow:none;border:none;margin:0;padding:14mm;max-width:none;page-break-after:always;border-radius:0}
      .slip:last-child{page-break-after:auto}
      @page{size:A4;margin:0}
    }
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">${opts.lang === "ar" ? "طباعة" : "Print"}</button></div>
  ${slips}
  </body></html>`;
}

function printPayslips(args: {
  run: Run;
  empIds: string[];
  lines: Line[];
  empMap: Record<string, string>;
  elMap: Record<string, { name: string; type: string }>;
  lang: "ar" | "en";
}) {
  const period = `${args.run.period_year}-${String(args.run.period_month).padStart(2, "0")}`;
  const employees = args.empIds.map((id) => ({
    id,
    name: args.empMap[id] || id,
    lines: args.lines
      .filter((l) => l.employee_id === id)
      .map((l) => ({
        name: args.elMap[l.element_id]?.name || l.element_id,
        type: l.element_type,
        minutes: l.minutes,
        amount: Number(l.amount),
      })),
  }));
  const html = buildPayslipHtml({ period, status: args.run.status, lang: args.lang, employees });
  const w = window.open("", "_blank");
  if (!w) {
    toast({ title: args.lang === "ar" ? "تم حظر النافذة المنبثقة" : "Popup blocked", description: args.lang === "ar" ? "يرجى السماح بالنوافذ المنبثقة لطباعة القسائم." : "Allow popups to print payslips.", variant: "destructive" });
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export default function PayrollRun() {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [empMap, setEmpMap] = useState<Record<string, string>>({});
  const [elMap, setElMap] = useState<Record<string, { name: string; type: string }>>({});
  const [busy, setBusy] = useState(false);

  // Scope filters
  const [allEmps, setAllEmps] = useState<{ id: string; name: string; department_id: string | null; job_position_id: string | null }[]>([]);
  const [allDepts, setAllDepts] = useState<{ id: string; name: string }[]>([]);
  const [allJobs, setAllJobs] = useState<{ id: string; name: string }[]>([]);
  const [empFilter, setEmpFilter] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [jobFilter, setJobFilter] = useState<string[]>([]);

  // App-level confirm dialog (replaces window.confirm)
  const [confirmDlg, setConfirmDlg] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm?: () => void | Promise<void>;
  }>({ open: false, title: "", description: "" });
  const askConfirm = (opts: Omit<typeof confirmDlg, "open">) => setConfirmDlg({ ...opts, open: true });

  const { allowedEmployeeIds, loading: scopeLoading } = useHRBusinessUnitScope();

  const loadRefs = async () => {
    let empQuery = supabase.from("employees").select("id, first_name, first_name_ar, last_name, last_name_ar, employee_number, department_id, job_position_id, employment_status");
    if (allowedEmployeeIds !== null) {
      if (allowedEmployeeIds.length === 0) { setEmpMap({}); setAllEmps([]); return; }
      empQuery = empQuery.in("id", allowedEmployeeIds);
    }
    const [e, el, d, j] = await Promise.all([
      empQuery,
      supabase.from("payroll_elements").select("id, name_en, name_ar, element_type"),
      supabase.from("departments").select("id, department_name, department_name_ar").order("department_name"),
      supabase.from("job_positions").select("id, position_name, position_name_ar").order("position_name"),
    ]);
    const em: Record<string, string> = {};
    const list: any[] = [];
    const fullName = (x: any) => language === "ar"
      ? `${x.first_name_ar || x.first_name || ""} ${x.last_name_ar || x.last_name || ""}`.trim()
      : `${x.first_name || ""} ${x.last_name || ""}`.trim();
    (e.data || []).forEach((x: any) => {
      em[x.id] = `${x.employee_number} — ${fullName(x)}`;
      if (x.employment_status !== "terminated") list.push({ id: x.id, name: `${x.employee_number} — ${fullName(x)}`, department_id: x.department_id, job_position_id: x.job_position_id });
    });
    setEmpMap(em);
    list.sort((a, b) => a.name.localeCompare(b.name));
    setAllEmps(list);
    const lm: Record<string, { name: string; type: string }> = {};
    (el.data || []).forEach((x: any) => { lm[x.id] = { name: (language === "ar" && x.name_ar) ? x.name_ar : x.name_en, type: x.element_type }; });
    setElMap(lm);
    setAllDepts(((d.data || []) as any[]).map((x) => ({ id: x.id, name: (language === "ar" && x.department_name_ar) ? x.department_name_ar : x.department_name })));
    setAllJobs(((j.data || []) as any[]).map((x) => ({ id: x.id, name: (language === "ar" && x.position_name_ar) ? x.position_name_ar : x.position_name })));
  };

  const loadRuns = async () => {
    const { data } = await supabase
      .from("payroll_runs")
      .select("*")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });
    setRuns((data || []) as Run[]);
  };

  const loadLines = async (runId: string) => {
    let q = supabase
      .from("payroll_run_lines")
      .select("*")
      .eq("run_id", runId);
    if (allowedEmployeeIds !== null) {
      if (allowedEmployeeIds.length === 0) { setLines([]); return; }
      q = q.in("employee_id", allowedEmployeeIds);
    }
    const { data } = await q;
    setLines((data || []) as Line[]);
  };

  useEffect(() => { if (!scopeLoading) { loadRefs(); loadRuns(); } }, [scopeLoading, allowedEmployeeIds]);

  const computePeriod = async () => {
    setBusy(true);
    try {
      // 1. Load employees and apply scope filters
      let empBaseQuery = supabase
        .from("employees")
        .select("id, basic_salary, department_id, job_position_id, employment_status");
      if (allowedEmployeeIds !== null) {
        if (allowedEmployeeIds.length === 0) {
          toast({ title: isAr ? "لا يوجد موظفون ضمن وحدات العمل المخصصة لك" : "No employees in your assigned Business Units", variant: "destructive" });
          setBusy(false);
          return;
        }
        empBaseQuery = empBaseQuery.in("id", allowedEmployeeIds);
      }
      const { data: emps, error: empErr } = await empBaseQuery;
      if (empErr) throw empErr;
      let activeEmps = (emps || []).filter((e: any) => e.employment_status !== "terminated");
      if (empFilter.length) activeEmps = activeEmps.filter((e: any) => empFilter.includes(e.id));
      if (deptFilter.length) activeEmps = activeEmps.filter((e: any) => e.department_id && deptFilter.includes(e.department_id));
      if (jobFilter.length) activeEmps = activeEmps.filter((e: any) => e.job_position_id && jobFilter.includes(e.job_position_id));
      if (activeEmps.length === 0) {
        toast({ title: isAr ? "لا يوجد موظفون يطابقون الفلاتر المختارة" : "No employees match the selected filters", variant: "destructive" });
        setBusy(false);
        return;
      }
      const scopeEmpIds = new Set(activeEmps.map((e: any) => e.id));
      const isScoped = empFilter.length + deptFilter.length + jobFilter.length > 0;

      // 2. Load elements + eligibility
      const [{ data: elements }, { data: eligibility }, { data: empElements }, { data: variables }] = await Promise.all([
        supabase.from("payroll_elements").select("*").eq("is_active", true),
        supabase.from("payroll_element_eligibility").select("*"),
        supabase.from("payroll_employee_elements").select("*").eq("is_active", true),
        supabase.from("payroll_variable_entries").select("*").eq("period_year", year).eq("period_month", month),
      ]);

      // 3. Compute delay minutes per employee (from saved_attendance for the month)
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDate = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;

      const empCodeToId: Record<string, string> = {};
      const { data: empCodes } = await supabase
        .from("employees")
        .select("id, employee_number, zk_employee_code");
      (empCodes || []).forEach((e: any) => {
        if (e.employee_number) empCodeToId[String(e.employee_number)] = e.id;
        if (e.zk_employee_code) empCodeToId[String(e.zk_employee_code)] = e.id;
      });

      const { data: attendance } = await supabase
        .from("saved_attendance")
        .select("employee_code, difference_hours")
        .gte("attendance_date", firstDay)
        .lte("attendance_date", lastDay);
      const delayMinutesByEmp: Record<string, number> = {};
      (attendance || []).forEach((a: any) => {
        const empId = empCodeToId[String(a.employee_code)];
        if (!empId) return;
        const diff = Number(a.difference_hours) || 0;
        if (diff < 0) {
          delayMinutesByEmp[empId] = (delayMinutesByEmp[empId] || 0) + Math.abs(diff) * 60;
        }
      });

      // 4. Build run
      // Delete or get existing run for the period
      const { data: existing } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("period_year", year)
        .eq("period_month", month)
        .maybeSingle();
      if (existing && existing.status === "confirmed") {
        toast({ title: isAr ? "الفترة مؤكدة — لا يمكن إعادة الاحتساب" : "Period already confirmed — cannot recompute", variant: "destructive" });
        setBusy(false);
        return;
      }
      let runId = existing?.id;
      if (!runId) {
        const { data: created, error: cErr } = await supabase
          .from("payroll_runs")
          .insert({ period_year: year, period_month: month, status: "draft" })
          .select("id")
          .single();
        if (cErr) throw cErr;
        runId = created.id;
      } else {
        // If scoped, only remove existing lines for employees in scope; otherwise wipe all.
        if (isScoped) {
          await supabase.from("payroll_run_lines").delete().eq("run_id", runId).in("employee_id", Array.from(scopeEmpIds));
        } else {
          await supabase.from("payroll_run_lines").delete().eq("run_id", runId);
        }
      }

      // 5. Compute lines
      const linesToInsert: any[] = [];
      let totalGross = 0, totalDed = 0, totalEmpC = 0;

      // Pre-compute basic salary per employee from is_basic_salary_element assigned amount
      const basicElement = ((elements || []) as any[]).find((e: any) => e.is_basic_salary_element);
      const basicSalaryByEmp: Record<string, number> = {};
      for (const emp of activeEmps) {
        let bs = 0;
        if (basicElement) {
          const a = (empElements || []).find((x: any) => x.employee_id === emp.id && x.element_id === basicElement.id);
          if (a) bs = Number(a.amount) || 0;
        }
        if (!bs) bs = Number(emp.basic_salary) || 0; // fallback to legacy field
        basicSalaryByEmp[emp.id] = bs;
      }

      for (const emp of activeEmps) {
        // Determine which elements are eligible
        for (const el of (elements || []) as any[]) {
          const rules = (eligibility || []).filter((r: any) => r.element_id === el.id);
          let eligible = false;
          if (rules.length === 0) {
            // No eligibility rules defined → treat as eligible for everyone
            eligible = true;
          } else {
            eligible = rules.some((r: any) => {
              const jobOk = !r.job_position_id || r.job_position_id === emp.job_position_id;
              const deptOk = !r.department_id || r.department_id === emp.department_id;
              return jobOk && deptOk;
            });
          }
          if (!eligible) continue;

          let amount = 0;
          let minutes: number | null = null;

          if (el.is_delay_minutes_element || el.calculation_type === "delay_minutes") {
            // Prefer value coming from Deduction Summary (payroll_variable_entries) if present
            const v = (variables || []).find((x: any) => x.employee_id === emp.id && x.element_id === el.id);
            if (v) {
              amount = Number(v.amount) || 0;
              minutes = null;
            } else {
              const mins = delayMinutesByEmp[emp.id] || 0;
              const totalSalary = basicSalaryByEmp[emp.id] || 0;
              const perMinute = totalSalary > 0 ? totalSalary / 30 / 8 / 60 : 0;
              amount = mins * perMinute;
              minutes = mins;
            }
            if (amount <= 0 && !minutes) continue;
          } else if (el.calculation_type === "variable") {
            const v = (variables || []).find((x: any) => x.employee_id === emp.id && x.element_id === el.id);
            if (!v) continue;
            amount = Number(v.amount) || 0;
          } else {
            const assign = (empElements || []).find((x: any) => x.employee_id === emp.id && x.element_id === el.id);
            if (assign) amount = Number(assign.amount) || 0;
            else if (el.calculation_type === "fixed" && Number(el.default_amount) > 0) amount = Number(el.default_amount);
            else continue;
          }

          if (amount === 0 && !minutes) continue;

          linesToInsert.push({
            run_id: runId,
            employee_id: emp.id,
            element_id: el.id,
            element_type: el.element_type,
            amount: Number(amount.toFixed(2)),
            minutes,
          });

          if (el.element_type === "earning") totalGross += amount;
          else if (el.element_type === "deduction") totalDed += amount;
          else if (el.element_type === "employer_contribution") totalEmpC += amount;
        }
      }


      if (linesToInsert.length > 0) {
        // batch insert in chunks of 500
        for (let i = 0; i < linesToInsert.length; i += 500) {
          const chunk = linesToInsert.slice(i, i + 500);
          const { error } = await supabase.from("payroll_run_lines").insert(chunk);
          if (error) throw error;
        }
      }

      // Recompute totals from ALL current lines on this run (covers partial / scoped runs)
      const { data: allLines } = await supabase
        .from("payroll_run_lines")
        .select("employee_id, element_type, amount")
        .eq("run_id", runId);
      let gGross = 0, gDed = 0, gEmpC = 0;
      const empSet = new Set<string>();
      (allLines || []).forEach((l: any) => {
        empSet.add(l.employee_id);
        const a = Number(l.amount) || 0;
        if (l.element_type === "earning") gGross += a;
        else if (l.element_type === "deduction") gDed += a;
        else if (l.element_type === "employer_contribution") gEmpC += a;
      });
      await supabase.from("payroll_runs").update({
        total_gross: Number(gGross.toFixed(2)),
        total_deductions: Number(gDed.toFixed(2)),
        total_employer_contributions: Number(gEmpC.toFixed(2)),
        total_net: Number((gGross - gDed).toFixed(2)),
        employee_count: empSet.size,
      }).eq("id", runId);

      const empCount = new Set(linesToInsert.map((l) => l.employee_id)).size;
      toast({
        title: isAr
          ? `تم احتساب ${linesToInsert.length} سطر لـ ${empCount} موظف${isScoped ? " (نطاق محدد)" : ""}`
          : `Computed ${linesToInsert.length} lines for ${empCount} employees${isScoped ? " (scoped run)" : ""}`,
      });
      loadRuns();
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmRun = (run: Run) => {
    const period = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;
    askConfirm({
      title: isAr ? "تأكيد وقفل الرواتب" : "Confirm & Lock Payroll",
      description: isAr
        ? `هل تريد تأكيد وقفل مسيرة الرواتب للفترة ${period}؟ بعد القفل لا يمكن إعادة الاحتساب دون تراجع.`
        : `Confirm and LOCK payroll for ${period}? Once locked it cannot be recomputed without rolling back.`,
      confirmLabel: isAr ? "تأكيد وقفل" : "Confirm & Lock",
      onConfirm: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("payroll_runs").update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
        }).eq("id", run.id);
        if (error) toast({ title: isAr ? "خطأ" : "Error", description: error.message, variant: "destructive" });
        else { toast({ title: isAr ? "تم التأكيد والقفل" : "Confirmed and locked" }); loadRuns(); }
      },
    });
  };

  const deleteRun = (run: Run) => {
    if (run.status === "confirmed") return;
    const period = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;
    askConfirm({
      title: isAr ? "حذف مسودة المسيرة" : "Delete Draft Run",
      description: isAr
        ? `هل تريد حذف مسودة مسيرة الرواتب للفترة ${period}؟ سيتم حذف المسيرة وجميع سطورها نهائياً.`
        : `Delete the draft payroll run for ${period}? This permanently removes the run and all its lines.`,
      confirmLabel: isAr ? "حذف" : "Delete",
      destructive: true,
      onConfirm: async () => {
        await supabase.from("payroll_runs").delete().eq("id", run.id);
        setSelectedRun(null);
        setLines([]);
        loadRuns();
      },
    });
  };

  const rollbackRun = (run: Run) => {
    const isConf = run.status === "confirmed";
    const period = `${run.period_year}-${String(run.period_month).padStart(2, "0")}`;
    askConfirm({
      title: isAr
        ? (isConf ? "تراجع عن مسيرة مؤكدة" : "تراجع عن مسيرة الرواتب")
        : (isConf ? "Rollback Confirmed Payroll" : "Rollback Payroll Run"),
      description: isAr
        ? `هل تريد التراجع عن مسيرة الرواتب ${isConf ? "المؤكدة" : "المسودة"} للفترة ${period}؟ سيتم حذف المسيرة وجميع السطور المحتسبة نهائياً.`
        : `Rollback ${isConf ? "confirmed" : "draft"} payroll for ${period}? This permanently removes the run and all its computed lines.`,
      confirmLabel: isAr ? "تراجع وحذف" : "Rollback & Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          const { error: delLinesErr } = await supabase.from("payroll_run_lines").delete().eq("run_id", run.id);
          if (delLinesErr) throw delLinesErr;
          const { error: delRunErr } = await supabase.from("payroll_runs").delete().eq("id", run.id);
          if (delRunErr) throw delRunErr;
          toast({ title: isAr ? "تم التراجع" : "Rolled back", description: isAr ? "تم حذف المسيرة وجميع سطورها." : "Run and all its lines were removed." });
          if (selectedRun?.id === run.id) { setSelectedRun(null); setLines([]); }
          loadRuns();
        } catch (e: any) {
          toast({ title: isAr ? "فشل التراجع" : "Rollback failed", description: e.message, variant: "destructive" });
        }
      },
    });
  };

  const viewRun = async (run: Run) => {
    setSelectedRun(run);
    loadLines(run.id);
  };

  // Group lines per employee for view
  const empGroups: Record<string, Line[]> = {};
  lines.forEach((l) => {
    if (!empGroups[l.employee_id]) empGroups[l.employee_id] = [];
    empGroups[l.employee_id].push(l);
  });

  const scopedEmpCount = (() => {
    let arr = allEmps;
    if (empFilter.length) arr = arr.filter((e) => empFilter.includes(e.id));
    if (deptFilter.length) arr = arr.filter((e) => e.department_id && deptFilter.includes(e.department_id));
    if (jobFilter.length) arr = arr.filter((e) => e.job_position_id && jobFilter.includes(e.job_position_id));
    return arr.length;
  })();

  const MultiCheckPop = ({
    label, options, selected, onChange, search: enableSearch,
  }: { label: string; options: { id: string; name: string }[]; selected: string[]; onChange: (v: string[]) => void; search?: boolean }) => {
    const [q, setQ] = useState("");
    const shown = enableSearch && q ? options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase())) : options;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1" /> {label}
            {selected.length > 0 && <Badge variant="secondary" className="ml-2">{selected.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          {enableSearch && (
            <Input placeholder={isAr ? "بحث..." : "Search..."} value={q} onChange={(e) => setQ(e.target.value)} className="h-8 mb-2" />
          )}
          <ScrollArea className="h-60">
            <div className="space-y-1">
              {shown.length === 0 && <p className="text-xs text-muted-foreground p-2">{isAr ? "لا توجد خيارات" : "No options"}</p>}
              {shown.map((o) => (
                <label key={o.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-sm">
                  <Checkbox
                    checked={selected.includes(o.id)}
                    onCheckedChange={(c) => {
                      if (c) onChange([...selected, o.id]);
                      else onChange(selected.filter((x) => x !== o.id));
                    }}
                  />
                  <span className="flex-1">{o.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => onChange([])}>
              <X className="h-3 w-3 mr-1" /> {isAr ? "مسح" : "Clear"}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const elementTypeBadge = (type: string) => {
    if (type === "earning") return isAr ? "استحقاق" : "earning";
    if (type === "deduction") return isAr ? "خصم" : "deduction";
    if (type === "employer_contribution") return isAr ? "مساهمة صاحب العمل" : "employer_contribution";
    return type;
  };

  const statusLabel = (status: string) => {
    if (status === "confirmed") return isAr ? "مؤكد" : "Confirmed";
    if (status === "draft") return isAr ? "مسودة" : "Draft";
    return status;
  };

  return (
    <div className="p-6 space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <h1 className="text-2xl font-bold">{isAr ? "تشغيل وتأكيد الرواتب" : "Payroll Run & Confirm"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "احتساب الفترة" : "Compute Period"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>{isAr ? "السنة" : "Year"}</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" />
            </div>
            <div>
              <Label>{isAr ? "الشهر" : "Month"}</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={computePeriod} disabled={busy}>
              {busy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {isAr ? "تشغيل الرواتب" : "Run Payroll"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground mr-1">{isAr ? "النطاق (اختياري):" : "Run scope (optional):"}</Label>
            <MultiCheckPop label={isAr ? "الموظفون" : "Employees"} options={allEmps.map((e) => ({ id: e.id, name: e.name }))} selected={empFilter} onChange={setEmpFilter} search />
            <MultiCheckPop label={isAr ? "الأقسام" : "Departments"} options={allDepts} selected={deptFilter} onChange={setDeptFilter} />
            <MultiCheckPop label={isAr ? "الوظائف" : "Jobs"} options={allJobs} selected={jobFilter} onChange={setJobFilter} />
            {(empFilter.length || deptFilter.length || jobFilter.length) ? (
              <>
                <Badge variant="default">{isAr ? `${scopedEmpCount} موظف في النطاق` : `${scopedEmpCount} employee(s) in scope`}</Badge>
                <Button variant="ghost" size="sm" onClick={() => { setEmpFilter([]); setDeptFilter([]); setJobFilter([]); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> {isAr ? "مسح النطاق" : "Clear scope"}
                </Button>
              </>
            ) : (
              <Badge variant="secondary">{isAr ? "جميع الموظفين النشطين" : "All active employees"}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "عند تحديد نطاق، يُعاد احتساب الموظفين المحددين فقط. تُحفظ سطور الموظفين الآخرين في نفس الفترة."
              : "When a scope is set, only those employees are (re)computed. Existing lines for other employees in this period are preserved."}
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "مسيرات الرواتب" : "Payroll Runs"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table dir={language === "ar" ? "rtl" : "ltr"}>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "الفترة" : "Period"}</TableHead>
                <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead>{isAr ? "الموظفون" : "Employees"}</TableHead>
                <TableHead>{isAr ? "الإجمالي" : "Gross"}</TableHead>
                <TableHead>{isAr ? "الخصومات" : "Deductions"}</TableHead>
                <TableHead>{isAr ? "الصافي" : "Net"}</TableHead>
                <TableHead>{isAr ? "مساهمة صاحب العمل" : "Employer Contrib."}</TableHead>
                <TableHead className="text-right">{isAr ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} className={selectedRun?.id === r.id ? "bg-muted" : ""}>
                  <TableCell>{r.period_year}-{String(r.period_month).padStart(2, "0")}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                      {r.status === "confirmed" && <Lock className="h-3 w-3 mr-1" />}
                      {statusLabel(r.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.employee_count}</TableCell>
                  <TableCell>{fmt(r.total_gross)}</TableCell>
                  <TableCell>{fmt(r.total_deductions)}</TableCell>
                  <TableCell className="font-semibold">{fmt(r.total_net)}</TableCell>
                  <TableCell>{fmt(r.total_employer_contributions)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => viewRun(r)}>{isAr ? "عرض" : "View"}</Button>
                    {r.status === "draft" && (
                      <>
                        <Button size="sm" onClick={() => confirmRun(r)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> {isAr ? "تأكيد" : "Confirm"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rollbackRun(r)}>
                          <Undo2 className="h-4 w-4 mr-1" /> {isAr ? "تراجع" : "Rollback"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRun(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {r.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => rollbackRun(r)}>
                        <Undo2 className="h-4 w-4 mr-1" /> {isAr ? "تراجع" : "Rollback"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">{isAr ? "لا توجد مسيرات بعد" : "No runs yet"}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {isAr ? "تفاصيل المسيرة" : "Run Detail"} — {selectedRun.period_year}-{String(selectedRun.period_month).padStart(2, "0")}
              {selectedRun.status !== "confirmed" && <Badge variant="secondary" className="ml-2">{isAr ? "مسودة" : "DRAFT"}</Badge>}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              disabled={lines.length === 0}
              onClick={() =>
                printPayslips({
                  run: selectedRun,
                  empIds: Object.keys(empGroups),
                  lines,
                  empMap,
                  elMap,
                  lang: isAr ? "ar" : "en",
                })
              }
            >
              <Printer className="h-4 w-4 mr-1" /> {isAr ? "طباعة جميع القسائم" : "Print All Payslips"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(empGroups).map(([empId, empLines]) => {
              const earn = empLines.filter((l) => l.element_type === "earning").reduce((s, l) => s + Number(l.amount), 0);
              const ded = empLines.filter((l) => l.element_type === "deduction").reduce((s, l) => s + Number(l.amount), 0);
              return (
                <div key={empId} className="border rounded-md p-3">
                  <div className="flex justify-between items-center mb-2">
                    <strong>{empMap[empId] || empId}</strong>
                    <div className="text-sm flex items-center gap-3">
                      <span>
                        {isAr ? "إجمالي:" : "Gross:"} {fmt(earn)} | {isAr ? "خصم:" : "Ded:"} {fmt(ded)} |
                        <span className="font-bold ml-2">{isAr ? "صافي:" : "Net:"} {fmt(earn - ded)}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          printPayslips({
                            run: selectedRun,
                            empIds: [empId],
                            lines,
                            empMap,
                            elMap,
                            lang: isAr ? "ar" : "en",
                          })
                        }
                      >
                        <Printer className="h-4 w-4 mr-1" /> {isAr ? "طباعة" : "Print"}
                      </Button>
                    </div>
                  </div>
                  <Table dir={language === "ar" ? "rtl" : "ltr"}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isAr ? "العنصر" : "Element"}</TableHead>
                        <TableHead>{isAr ? "النوع" : "Type"}</TableHead>
                        <TableHead>{isAr ? "الدقائق" : "Minutes"}</TableHead>
                        <TableHead className="text-right">{isAr ? "المبلغ" : "Amount"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empLines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{elMap[l.element_id]?.name || l.element_id}</TableCell>
                          <TableCell>
                            <Badge variant={l.element_type === "earning" ? "default" : l.element_type === "deduction" ? "destructive" : "secondary"}>
                              {elementTypeBadge(l.element_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>{l.minutes ? Number(l.minutes).toFixed(0) : "—"}</TableCell>
                          <TableCell className="text-right">{fmt(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
            {lines.length === 0 && <p className="text-muted-foreground text-sm">{isAr ? "لا توجد سطور" : "No lines"}</p>}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDlg.open} onOpenChange={(o) => setConfirmDlg((s) => ({ ...s, open: o }))}>
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDlg.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{confirmDlg.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDlg.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={async () => {
                const fn = confirmDlg.onConfirm;
                setConfirmDlg((s) => ({ ...s, open: false }));
                if (fn) await fn();
              }}
            >
              {confirmDlg.confirmLabel || (isAr ? "تأكيد" : "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
