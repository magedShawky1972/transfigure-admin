import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Play, CheckCircle2, Trash2, RefreshCw, Lock, Filter, X, Undo2 } from "lucide-react";

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

export default function PayrollRun() {
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

  const loadRefs = async () => {
    const [e, el, d, j] = await Promise.all([
      supabase.from("employees").select("id, first_name, last_name, employee_number, department_id, job_position_id, employment_status"),
      supabase.from("payroll_elements").select("id, name_en, element_type"),
      supabase.from("departments").select("id, department_name").order("department_name"),
      supabase.from("job_positions").select("id, position_name").order("position_name"),
    ]);
    const em: Record<string, string> = {};
    const list: any[] = [];
    (e.data || []).forEach((x: any) => {
      em[x.id] = `${x.employee_number} — ${x.first_name} ${x.last_name}`;
      if (x.employment_status !== "terminated") list.push({ id: x.id, name: `${x.employee_number} — ${x.first_name} ${x.last_name}`, department_id: x.department_id, job_position_id: x.job_position_id });
    });
    setEmpMap(em);
    list.sort((a, b) => a.name.localeCompare(b.name));
    setAllEmps(list);
    const lm: Record<string, { name: string; type: string }> = {};
    (el.data || []).forEach((x: any) => { lm[x.id] = { name: x.name_en, type: x.element_type }; });
    setElMap(lm);
    setAllDepts(((d.data || []) as any[]).map((x) => ({ id: x.id, name: x.department_name })));
    setAllJobs(((j.data || []) as any[]).map((x) => ({ id: x.id, name: x.position_name })));
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
    const { data } = await supabase
      .from("payroll_run_lines")
      .select("*")
      .eq("run_id", runId);
    setLines((data || []) as Line[]);
  };

  useEffect(() => { loadRefs(); loadRuns(); }, []);

  const computePeriod = async () => {
    setBusy(true);
    try {
      // 1. Load employees and apply scope filters
      const { data: emps, error: empErr } = await supabase
        .from("employees")
        .select("id, basic_salary, department_id, job_position_id, employment_status");
      if (empErr) throw empErr;
      let activeEmps = (emps || []).filter((e: any) => e.employment_status !== "terminated");
      if (empFilter.length) activeEmps = activeEmps.filter((e: any) => empFilter.includes(e.id));
      if (deptFilter.length) activeEmps = activeEmps.filter((e: any) => e.department_id && deptFilter.includes(e.department_id));
      if (jobFilter.length) activeEmps = activeEmps.filter((e: any) => e.job_position_id && jobFilter.includes(e.job_position_id));
      if (activeEmps.length === 0) {
        toast({ title: "No employees match the selected filters", variant: "destructive" });
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
        toast({ title: "Period already confirmed — cannot recompute", variant: "destructive" });
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

      toast({ title: `Computed ${linesToInsert.length} lines for ${new Set(linesToInsert.map((l) => l.employee_id)).size} employees${isScoped ? " (scoped run)" : ""}` });
      loadRuns();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmRun = (run: Run) => {
    askConfirm({
      title: "Confirm & Lock Payroll",
      description: `Confirm and LOCK payroll for ${run.period_year}-${String(run.period_month).padStart(2, "0")}? Once locked it cannot be recomputed without rolling back.`,
      confirmLabel: "Confirm & Lock",
      onConfirm: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("payroll_runs").update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
        }).eq("id", run.id);
        if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
        else { toast({ title: "Confirmed and locked" }); loadRuns(); }
      },
    });
  };

  const deleteRun = (run: Run) => {
    if (run.status === "confirmed") return;
    askConfirm({
      title: "Delete Draft Run",
      description: `Delete the draft payroll run for ${run.period_year}-${String(run.period_month).padStart(2, "0")}? This permanently removes the run and all its lines.`,
      confirmLabel: "Delete",
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
    askConfirm({
      title: isConf ? "Rollback Confirmed Payroll" : "Rollback Payroll Run",
      description: `Rollback ${isConf ? "confirmed" : "draft"} payroll for ${run.period_year}-${String(run.period_month).padStart(2, "0")}? This permanently removes the run and all its computed lines.`,
      confirmLabel: "Rollback & Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          const { error: delLinesErr } = await supabase.from("payroll_run_lines").delete().eq("run_id", run.id);
          if (delLinesErr) throw delLinesErr;
          const { error: delRunErr } = await supabase.from("payroll_runs").delete().eq("id", run.id);
          if (delRunErr) throw delRunErr;
          toast({ title: "Rolled back", description: "Run and all its lines were removed." });
          if (selectedRun?.id === run.id) { setSelectedRun(null); setLines([]); }
          loadRuns();
        } catch (e: any) {
          toast({ title: "Rollback failed", description: e.message, variant: "destructive" });
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
            <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} className="h-8 mb-2" />
          )}
          <ScrollArea className="h-60">
            <div className="space-y-1">
              {shown.length === 0 && <p className="text-xs text-muted-foreground p-2">No options</p>}
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
              <X className="h-3 w-3 mr-1" /> Clear
            </Button>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Payroll Run & Confirm</h1>

      <Card>
        <CardHeader>
          <CardTitle>Compute Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" />
            </div>
            <div>
              <Label>Month</Label>
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
              Run Payroll
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Label className="text-xs text-muted-foreground mr-1">Run scope (optional):</Label>
            <MultiCheckPop label="Employees" options={allEmps.map((e) => ({ id: e.id, name: e.name }))} selected={empFilter} onChange={setEmpFilter} search />
            <MultiCheckPop label="Departments" options={allDepts} selected={deptFilter} onChange={setDeptFilter} />
            <MultiCheckPop label="Jobs" options={allJobs} selected={jobFilter} onChange={setJobFilter} />
            {(empFilter.length || deptFilter.length || jobFilter.length) ? (
              <>
                <Badge variant="default">{scopedEmpCount} employee(s) in scope</Badge>
                <Button variant="ghost" size="sm" onClick={() => { setEmpFilter([]); setDeptFilter([]); setJobFilter([]); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear scope
                </Button>
              </>
            ) : (
              <Badge variant="secondary">All active employees</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            When a scope is set, only those employees are (re)computed. Existing lines for other employees in this period are preserved.
          </p>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Employer Contrib.</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} className={selectedRun?.id === r.id ? "bg-muted" : ""}>
                  <TableCell>{r.period_year}-{String(r.period_month).padStart(2, "0")}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "confirmed" ? "default" : "secondary"}>
                      {r.status === "confirmed" && <Lock className="h-3 w-3 mr-1" />}
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.employee_count}</TableCell>
                  <TableCell>{fmt(r.total_gross)}</TableCell>
                  <TableCell>{fmt(r.total_deductions)}</TableCell>
                  <TableCell className="font-semibold">{fmt(r.total_net)}</TableCell>
                  <TableCell>{fmt(r.total_employer_contributions)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => viewRun(r)}>View</Button>
                    {r.status === "draft" && (
                      <>
                        <Button size="sm" onClick={() => confirmRun(r)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => rollbackRun(r)}>
                          <Undo2 className="h-4 w-4 mr-1" /> Rollback
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteRun(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                    {r.status === "confirmed" && (
                      <Button size="sm" variant="outline" onClick={() => rollbackRun(r)}>
                        <Undo2 className="h-4 w-4 mr-1" /> Rollback
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">No runs yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>
              Run Detail — {selectedRun.period_year}-{String(selectedRun.period_month).padStart(2, "0")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(empGroups).map(([empId, empLines]) => {
              const earn = empLines.filter((l) => l.element_type === "earning").reduce((s, l) => s + Number(l.amount), 0);
              const ded = empLines.filter((l) => l.element_type === "deduction").reduce((s, l) => s + Number(l.amount), 0);
              return (
                <div key={empId} className="border rounded-md p-3">
                  <div className="flex justify-between items-center mb-2">
                    <strong>{empMap[empId] || empId}</strong>
                    <div className="text-sm">
                      Gross: {fmt(earn)} | Ded: {fmt(ded)} |
                      <span className="font-bold ml-2">Net: {fmt(earn - ded)}</span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Element</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Minutes</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empLines.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{elMap[l.element_id]?.name || l.element_id}</TableCell>
                          <TableCell>
                            <Badge variant={l.element_type === "earning" ? "default" : l.element_type === "deduction" ? "destructive" : "secondary"}>
                              {l.element_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{l.minutes ? Number(l.minutes).toFixed(0) : "—"}</TableCell>
                          <TableCell className="text-right">{Number(l.amount).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              );
            })}
            {lines.length === 0 && <p className="text-muted-foreground text-sm">No lines</p>}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDlg.open} onOpenChange={(o) => setConfirmDlg((s) => ({ ...s, open: o }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDlg.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{confirmDlg.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDlg.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={async () => {
                const fn = confirmDlg.onConfirm;
                setConfirmDlg((s) => ({ ...s, open: false }));
                if (fn) await fn();
              }}
            >
              {confirmDlg.confirmLabel || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
