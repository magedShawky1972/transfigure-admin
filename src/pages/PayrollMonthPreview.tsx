import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Download, RefreshCw } from "lucide-react";
import { TopHorizontalScrollbar } from "@/components/TopHorizontalScrollbar";
import * as XLSX from "xlsx";

const typeColors: Record<string, { head: string; cell: string; label: string }> = {
  earning: { head: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200", cell: "bg-emerald-50/40 dark:bg-emerald-950/10", label: "text-emerald-700 dark:text-emerald-300" },
  deduction: { head: "bg-rose-100 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200", cell: "bg-rose-50/40 dark:bg-rose-950/10", label: "text-rose-700 dark:text-rose-300" },
  employer_contribution: { head: "bg-sky-100 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200", cell: "bg-sky-50/40 dark:bg-sky-950/10", label: "text-sky-700 dark:text-sky-300" },
  information: { head: "bg-muted text-muted-foreground", cell: "", label: "text-muted-foreground" },
};

const numFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n: number) => (n === 0 ? "" : numFmt.format(n));

type Emp = {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department_id: string | null;
  job_position_id: string | null;
  employment_status: string | null;
  departments?: { department_name: string } | null;
  job_positions?: { position_name: string } | null;
};
type Element = { id: string; code: string; name_en: string; element_type: string; calculation_type?: string | null };
type SortRule = { key: string; dir: "asc" | "desc" };

const now = new Date();

export default function PayrollMonthPreview() {
  const { language } = useLanguage();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({}); // key emp|element => combined amount
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [jobFilter, setJobFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([]);
  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [hideZeroEmployees, setHideZeroEmployees] = useState(false);
  const [sortRules, setSortRules] = useState<SortRule[]>([{ key: "name", dir: "asc" }]);

  const load = async () => {
    setLoading(true);
    const [e, el, pe, pv] = await Promise.all([
      supabase
        .from("employees")
        .select("id, first_name, last_name, employee_number, department_id, job_position_id, employment_status, departments(department_name), job_positions(position_name)")
        .order("first_name"),
      supabase.from("payroll_elements").select("id, code, name_en, element_type, calculation_type, sort_order").eq("is_active", true).order("sort_order", { ascending: true, nullsFirst: false }).order("name_en"),
      supabase.from("payroll_employee_elements").select("employee_id, element_id, amount, is_active").eq("is_active", true),
      supabase.from("payroll_variable_entries").select("employee_id, element_id, amount").eq("period_year", year).eq("period_month", month),
    ]);
    setEmps((e.data || []) as any);
    setElements((el.data || []) as Element[]);
    const map: Record<string, number> = {};
    for (const r of (pe.data || []) as any[]) {
      map[`${r.employee_id}|${r.element_id}`] = (map[`${r.employee_id}|${r.element_id}`] || 0) + Number(r.amount || 0);
    }
    for (const r of (pv.data || []) as any[]) {
      // Variable entries override assigned amounts for that month
      map[`${r.employee_id}|${r.element_id}`] = Number(r.amount || 0);
    }
    setAmounts(map);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  const departments = useMemo(() => {
    const map = new Map<string, string>();
    emps.forEach((e) => { if (e.department_id && e.departments?.department_name) map.set(e.department_id, e.departments.department_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [emps]);
  const jobs = useMemo(() => {
    const map = new Map<string, string>();
    emps.forEach((e) => { if (e.job_position_id && e.job_positions?.position_name) map.set(e.job_position_id, e.job_positions.position_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [emps]);
  const statuses = useMemo(() => {
    const s = new Set<string>(); emps.forEach((e) => { if (e.employment_status) s.add(e.employment_status); });
    return Array.from(s);
  }, [emps]);

  const visibleElements = useMemo(() => {
    let arr = elements;
    if (typeFilter.length) arr = arr.filter((el) => typeFilter.includes(el.element_type));
    if (elementFilter.length) arr = arr.filter((el) => elementFilter.includes(el.id));
    return arr;
  }, [elements, elementFilter, typeFilter]);

  const filtered = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return emps.filter((e) => {
      if (employeeFilter.length && !employeeFilter.includes(e.id)) return false;
      if (deptFilter.length && (!e.department_id || !deptFilter.includes(e.department_id))) return false;
      if (jobFilter.length && (!e.job_position_id || !jobFilter.includes(e.job_position_id))) return false;
      if (statusFilter.length && (!e.employment_status || !statusFilter.includes(e.employment_status))) return false;
      if (terms.length) {
        const hay = `${e.first_name} ${e.last_name} ${e.employee_number} ${e.departments?.department_name || ""} ${e.job_positions?.position_name || ""}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      if (hideZeroEmployees) {
        const has = visibleElements.some((el) => (amounts[`${e.id}|${el.id}`] || 0) !== 0);
        if (!has) return false;
      }
      return true;
    });
  }, [emps, employeeFilter, deptFilter, jobFilter, statusFilter, search, hideZeroEmployees, visibleElements, amounts]);

  const sorted = useMemo(() => {
    if (!sortRules.length) return filtered;
    const rows = [...filtered];
    rows.sort((a, b) => {
      for (const r of sortRules) {
        let av: any; let bv: any;
        if (r.key === "name") { av = `${a.first_name} ${a.last_name}`; bv = `${b.first_name} ${b.last_name}`; }
        else if (r.key === "employee_number") { av = a.employee_number; bv = b.employee_number; }
        else if (r.key === "dept") { av = a.departments?.department_name || ""; bv = b.departments?.department_name || ""; }
        else if (r.key === "job") { av = a.job_positions?.position_name || ""; bv = b.job_positions?.position_name || ""; }
        else if (r.key === "net") { av = netFor(a.id); bv = netFor(b.id); }
        else { av = amounts[`${a.id}|${r.key}`] ?? -Infinity; bv = amounts[`${b.id}|${r.key}`] ?? -Infinity; }
        if (av < bv) return r.dir === "asc" ? -1 : 1;
        if (av > bv) return r.dir === "asc" ? 1 : -1;
      }
      return 0;
    });
    return rows;
    // eslint-disable-next-line
  }, [filtered, sortRules, amounts, elements]);

  function netFor(empId: string) {
    let net = 0;
    for (const el of visibleElements) {
      const v = amounts[`${empId}|${el.id}`] || 0;
      if (el.element_type === "earning") net += v;
      else if (el.element_type === "deduction") net -= v;
    }
    return net;
  }

  const toggleSort = (key: string, e: React.MouseEvent) => {
    setSortRules((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      const multi = e.shiftKey;
      if (!multi) {
        if (idx === -1) return [{ key, dir: "asc" }];
        const cur = prev[idx];
        return [{ key, dir: cur.dir === "asc" ? "desc" : "asc" }];
      } else {
        if (idx === -1) return [...prev, { key, dir: "asc" }];
        const next = [...prev];
        next[idx] = { key, dir: next[idx].dir === "asc" ? "desc" : "asc" };
        return next;
      }
    });
  };
  const sortBadge = (key: string) => {
    const idx = sortRules.findIndex((r) => r.key === key);
    if (idx === -1) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    const r = sortRules[idx];
    return (
      <span className="inline-flex items-center gap-0.5">
        {r.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        <span className="text-[10px]">{idx + 1}</span>
      </span>
    );
  };

  // Column totals
  const columnTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const el of visibleElements) {
      let sum = 0;
      for (const emp of sorted) sum += amounts[`${emp.id}|${el.id}`] || 0;
      t[el.id] = sum;
    }
    return t;
  }, [visibleElements, sorted, amounts]);

  // Grand totals by type
  const grand = useMemo(() => {
    let earn = 0, ded = 0, emp = 0;
    for (const el of visibleElements) {
      const s = columnTotals[el.id] || 0;
      if (el.element_type === "earning") earn += s;
      else if (el.element_type === "deduction") ded += s;
      else if (el.element_type === "employer_contribution") emp += s;
    }
    return { earn, ded, emp, net: earn - ded };
  }, [visibleElements, columnTotals]);

  const exportToExcel = () => {
    const header = ["Employee #", "Employee Name", "Department", "Job", ...visibleElements.map((e) => `${e.code} - ${e.name_en} [${e.element_type}]`), language === "ar" ? "الصافي" : "Net"];
    const rows: any[][] = [header];
    for (const emp of sorted) {
      const row: any[] = [emp.employee_number, `${emp.first_name} ${emp.last_name}`, emp.departments?.department_name || "", emp.job_positions?.position_name || ""];
      for (const el of visibleElements) row.push(amounts[`${emp.id}|${el.id}`] || 0);
      row.push(netFor(emp.id));
      rows.push(row);
    }
    const totalRow: any[] = ["", (language === "ar" ? "الإجمالي" : "TOTAL"), "", ""];
    for (const el of visibleElements) totalRow.push(columnTotals[el.id] || 0);
    totalRow.push(grand.net);
    rows.push(totalRow);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)["!cols"] = header.map((_, i) => ({ wch: i < 4 ? 22 : 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${year}-${String(month).padStart(2, "0")}`);
    XLSX.writeFile(wb, `month_element_preview_${year}-${String(month).padStart(2, "0")}.xlsx`);
    toast({ title: language === "ar" ? "تم التصدير" : "Exported" });
  };

  const clearFilters = () => {
    setSearch(""); setDeptFilter([]); setJobFilter([]); setStatusFilter([]); setEmployeeFilter([]); setElementFilter([]); setTypeFilter([]); setHideZeroEmployees(false);
  };

  const MultiCheckPop = ({
    label, options, selected, onChange, searchable,
  }: { label: string; options: { id: string; name: string }[]; selected: string[]; onChange: (v: string[]) => void; searchable?: boolean }) => {
    const [q, setQ] = useState("");
    const list = searchable && q.trim()
      ? options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()))
      : options;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-3.5 w-3.5 mr-1" /> {label}
            {selected.length > 0 && <Badge variant="secondary" className="ml-2">{selected.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          {searchable && (
            <Input
              placeholder={language === "ar" ? "بحث..." : "Search..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 mb-2"
            />
          )}
          <ScrollArea className="h-60">
            <div className="space-y-1">
              {list.length === 0 && <p className="text-xs text-muted-foreground p-2">{language === "ar" ? "لا توجد خيارات" : "No options"}</p>}
              {list.map((o) => (
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
              <X className="h-3 w-3 mr-1" /> {language === "ar" ? "مسح" : "Clear"}
            </Button>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);
  const months = language === "ar"
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{language === "ar" ? "معاينة عناصر الشهر" : "Month Element Preview"}</h1>
          <p className="text-sm text-muted-foreground">{language === "ar" ? "عرض للقراءة فقط لجميع عناصر الرواتب لكل موظف للشهر المحدد، قبل تشغيل الرواتب." : "Read-only view of all payroll elements per employee for the selected month, before running payroll."}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" /> {language === "ar" ? "تصدير إكسل" : "Export Excel"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{language === "ar" ? "إجمالي المستحقات" : "Total Earnings"}</div><div className="text-xl font-bold text-emerald-600">{numFmt.format(grand.earn)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{language === "ar" ? "إجمالي الاستقطاعات" : "Total Deductions"}</div><div className="text-xl font-bold text-rose-600">{numFmt.format(grand.ded)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{language === "ar" ? "مساهمات صاحب العمل" : "Employer Contributions"}</div><div className="text-xl font-bold text-sky-600">{numFmt.format(grand.emp)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{language === "ar" ? "الصافي" : "Net"}</div><div className="text-xl font-bold">{numFmt.format(grand.net)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{language === "ar" ? "الفلاتر" : "Filters"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder={language === "ar" ? "بحث (المسافة تفصل بين المصطلحات: مثل أحمد مطور)" : "Search (space separates terms: e.g. ahmed dev)"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <MultiCheckPop
              label={language === "ar" ? "الموظف" : "Employee"}
              searchable
              options={emps.map((e) => ({ id: e.id, name: `${e.first_name} ${e.last_name} (${e.employee_number})` }))}
              selected={employeeFilter}
              onChange={setEmployeeFilter}
            />
            <MultiCheckPop label={language === "ar" ? "القسم" : "Department"} options={departments} selected={deptFilter} onChange={setDeptFilter} searchable />
            <MultiCheckPop label={language === "ar" ? "الوظيفة" : "Job"} options={jobs} selected={jobFilter} onChange={setJobFilter} searchable />
            <MultiCheckPop label={language === "ar" ? "الحالة" : "Status"} options={statuses.map((s) => ({ id: s, name: s }))} selected={statusFilter} onChange={setStatusFilter} />
            <MultiCheckPop label={language === "ar" ? "نوع العنصر" : "Element Type"} options={[
              { id: "earning", name: language === "ar" ? "مستحق" : "Earning" },
              { id: "deduction", name: language === "ar" ? "استقطاع" : "Deduction" },
              { id: "employer_contribution", name: language === "ar" ? "مساهمة صاحب العمل" : "Employer Contribution" },
              { id: "information", name: language === "ar" ? "معلومات" : "Information" },
            ]} selected={typeFilter} onChange={setTypeFilter} />
            <MultiCheckPop label={language === "ar" ? "العناصر" : "Elements"} options={elements.map((e) => ({ id: e.id, name: `[${e.element_type}] ${e.name_en}` }))} selected={elementFilter} onChange={setElementFilter} searchable />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={hideZeroEmployees} onCheckedChange={(c) => setHideZeroEmployees(!!c)} />
              {language === "ar" ? "إخفاء الموظفين الذين ليس لديهم قيم" : "Hide employees with no values"}
            </label>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> {language === "ar" ? "مسح" : "Clear"} all
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "ar" ? "تلميح: انقر فوق رأس العمود للفرز. اضغط مع الاستمرار على Shift لإضافة فرز ثانوي. العناصر المتغيرة للشهر المحدد تلغي المبلغ المحدد." : "Tip: click a column header to sort. Hold <kbd className=\"px-1 border rounded\">Shift</kbd> to add a secondary sort. Variable entries for the selected month override the assigned amount."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? (language === "ar" ? "جاري التحميل..." : "Loading...") : `${sorted.length} ${language === "ar" ? "موظفين ×" : "employees ×"} ${visibleElements.length} ${language === "ar" ? "عناصر —" : "elements —"} ${months[month - 1]} ${year}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopHorizontalScrollbar>
            <ScrollArea className="w-full">
              <div className="min-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 cursor-pointer select-none min-w-[200px]" onClick={(e) => toggleSort("name", e)}>
                        <div className="flex items-center gap-1">{language === "ar" ? "الموظف" : "Employee"} {sortBadge("name")}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={(e) => toggleSort("employee_number", e)}>
                        <div className="flex items-center gap-1">{language === "ar" ? "الرقم" : "Number"} {sortBadge("employee_number")}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={(e) => toggleSort("dept", e)}>
                        <div className="flex items-center gap-1">{language === "ar" ? "القسم" : "Department"} {sortBadge("dept")}</div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={(e) => toggleSort("job", e)}>
                        <div className="flex items-center gap-1">{language === "ar" ? "الوظيفة" : "Job"} {sortBadge("job")}</div>
                      </TableHead>
                      {visibleElements.map((el) => {
                        const c = typeColors[el.element_type] || typeColors.information;
                        return (
                          <TableHead
                            key={el.id}
                            className={`cursor-pointer select-none text-right min-w-[140px] ${c.head}`}
                            onClick={(e) => toggleSort(el.id, e)}
                            title={`${el.code} — ${el.element_type}`}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <span className="truncate">{el.name_en}</span> {sortBadge(el.id)}
                            </div>
                            <div className={`text-[10px] font-normal ${c.label}`}>{el.element_type}</div>
                          </TableHead>
                        );
                      })}
                      <TableHead className="cursor-pointer select-none text-right min-w-[120px] bg-muted" onClick={(e) => toggleSort("net", e)}>
                        <div className="flex items-center justify-end gap-1">{language === "ar" ? "الصافي" : "Net"} {sortBadge("net")}</div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5 + visibleElements.length} className="text-center text-muted-foreground py-6">
                          {language === "ar" ? "لا يوجد موظفين يطابقون الفلاتر" : "No employees match the filters"}
                        </TableCell>
                      </TableRow>
                    ) : sorted.map((emp) => {
                      const net = netFor(emp.id);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {emp.first_name} {emp.last_name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{emp.employee_number}</TableCell>
                          <TableCell className="text-xs">{emp.departments?.department_name || "—"}</TableCell>
                          <TableCell className="text-xs">{emp.job_positions?.position_name || "—"}</TableCell>
                          {visibleElements.map((el) => {
                            const v = amounts[`${emp.id}|${el.id}`] || 0;
                            const c = typeColors[el.element_type] || typeColors.information;
                            return (
                              <TableCell key={el.id} className={`text-right tabular-nums ${c.cell}`}>
                                {fmt(v)}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right tabular-nums font-semibold bg-muted/40">{numFmt.format(net)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                  {sorted.length > 0 && (
                    <tfoot>
                      <TableRow className="bg-muted/60 font-semibold">
                        <TableCell className="sticky left-0 bg-muted/60 z-10">{language === "ar" ? "الإجمالي" : "TOTAL"}</TableCell>
                        <TableCell colSpan={3} />
                        {visibleElements.map((el) => (
                          <TableCell key={el.id} className="text-right tabular-nums">{fmt(columnTotals[el.id] || 0)}</TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums">{numFmt.format(grand.net)}</TableCell>
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
              </div>
            </ScrollArea>
          </TopHorizontalScrollbar>
        </CardContent>
      </Card>
    </div>
  );
}
