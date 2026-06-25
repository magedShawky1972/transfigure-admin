import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Save, Download, Upload, FileSpreadsheet } from "lucide-react";
import { TopHorizontalScrollbar } from "@/components/TopHorizontalScrollbar";
import * as XLSX from "xlsx";

const typeColors: Record<string, { head: string; cell: string; label: string }> = {
  earning: { head: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200", cell: "bg-emerald-50/40 dark:bg-emerald-950/10", label: "text-emerald-700 dark:text-emerald-300" },
  deduction: { head: "bg-rose-100 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200", cell: "bg-rose-50/40 dark:bg-rose-950/10", label: "text-rose-700 dark:text-rose-300" },
  employer_contribution: { head: "bg-sky-100 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200", cell: "bg-sky-50/40 dark:bg-sky-950/10", label: "text-sky-700 dark:text-sky-300" },
  information: { head: "bg-muted text-muted-foreground", cell: "", label: "text-muted-foreground" },
};

const numFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MatrixCellInput({
  value, dirty, onCommit, className,
}: { value: number | undefined; dirty?: boolean; onCommit: (v: number) => void; className?: string }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const display = focused
    ? draft
    : (value === undefined || value === null || isNaN(value as number) ? "" : numFmt.format(Number(value)));
  return (
    <Input
      inputMode="decimal"
      value={display}
      placeholder="0.00"
      onFocus={() => { setFocused(true); setDraft(value !== undefined && value !== null ? String(value) : ""); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = Number(draft.replace(/,/g, ""));
        onCommit(isNaN(n) ? 0 : n);
      }}
      className={`h-8 text-right ${dirty ? "border-primary ring-1 ring-primary/40" : ""} ${className || ""}`}
    />
  );
}

type Emp = {
  id: string;
  first_name: string;
  first_name_ar?: string | null;
  last_name: string;
  last_name_ar?: string | null;
  employee_number: string;
  department_id: string | null;
  job_position_id: string | null;
  employment_status: string | null;
  departments?: { department_name: string } | null;
  job_positions?: { position_name: string } | null;
};
type Element = { id: string; code: string; name_en: string; name_ar: string | null; element_type: string; default_amount: number | null };

type Cell = { id?: string; amount: number; dirty?: boolean };
type Matrix = Record<string, Cell>;
type SortRule = { key: string; dir: "asc" | "desc" };

export default function PayrollVariableEntry() {
  const { language } = useLanguage();
  const empName = (e: any) => language === "ar" ? `${e?.first_name_ar || e?.first_name || ""} ${e?.last_name_ar || e?.last_name || ""}`.trim() : `${e?.first_name || ""} ${e?.last_name || ""}`.trim();
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  const [emps, setEmps] = useState<Emp[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [matrix, setMatrix] = useState<Matrix>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [jobFilter, setJobFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [elementFilter, setElementFilter] = useState<string[]>([]);
  const [sortRules, setSortRules] = useState<SortRule[]>([{ key: "name", dir: "asc" }]);

  const loadStatic = async () => {
    const [e, el] = await Promise.all([
      supabase
        .from("employees")
        .select("id, first_name, first_name_ar, last_name, last_name_ar, employee_number, department_id, job_position_id, employment_status, departments(department_name), job_positions(position_name)")
        .order("first_name"),
      supabase
        .from("payroll_elements")
        .select("id, code, name_en, name_ar, element_type, default_amount, sort_order")
        .eq("is_active", true)
        .eq("calculation_type", "variable")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name_en"),

    ]);
    setEmps((e.data || []) as any);
    setElements((el.data || []) as Element[]);
  };

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payroll_variable_entries")
      .select("id, employee_id, element_id, amount")
      .eq("period_year", year)
      .eq("period_month", month);
    const m: Matrix = {};
    for (const row of (data || []) as any[]) {
      m[`${row.employee_id}|${row.element_id}`] = { id: row.id, amount: Number(row.amount) || 0 };
    }
    setMatrix(m);
    setLoading(false);
  };

  useEffect(() => { loadStatic(); }, []);
  useEffect(() => { loadEntries(); }, [year, month]);

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
    const s = new Set<string>();
    emps.forEach((e) => { if (e.employment_status) s.add(e.employment_status); });
    return Array.from(s);
  }, [emps]);

  const visibleElements = useMemo(() => {
    if (elementFilter.length === 0) return elements;
    return elements.filter((el) => elementFilter.includes(el.id));
  }, [elements, elementFilter]);

  const filtered = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return emps.filter((e) => {
      if (deptFilter.length && (!e.department_id || !deptFilter.includes(e.department_id))) return false;
      if (jobFilter.length && (!e.job_position_id || !jobFilter.includes(e.job_position_id))) return false;
      if (statusFilter.length && (!e.employment_status || !statusFilter.includes(e.employment_status))) return false;
      if (terms.length) {
        const hay = `${empName(e)} ${e.employee_number} ${e.departments?.department_name || ""} ${e.job_positions?.position_name || ""}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }, [emps, deptFilter, jobFilter, statusFilter, search]);

  const sorted = useMemo(() => {
    if (!sortRules.length) return filtered;
    const rows = [...filtered];
    rows.sort((a, b) => {
      for (const r of sortRules) {
        let av: any; let bv: any;
        if (r.key === "name") { av = `${empName(a)}`; bv = `${empName(b)}`; }
        else if (r.key === "employee_number") { av = a.employee_number; bv = b.employee_number; }
        else if (r.key === "dept") { av = a.departments?.department_name || ""; bv = b.departments?.department_name || ""; }
        else if (r.key === "job") { av = a.job_positions?.position_name || ""; bv = b.job_positions?.position_name || ""; }
        else {
          av = matrix[`${a.id}|${r.key}`]?.amount ?? -Infinity;
          bv = matrix[`${b.id}|${r.key}`]?.amount ?? -Infinity;
        }
        if (av < bv) return r.dir === "asc" ? -1 : 1;
        if (av > bv) return r.dir === "asc" ? 1 : -1;
      }
      return 0;
    });
    return rows;
  }, [filtered, sortRules, matrix]);

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

  const setCell = (empId: string, elementId: string, amount: number) => {
    const key = `${empId}|${elementId}`;
    setMatrix((m) => ({ ...m, [key]: { ...(m[key] || { amount: 0 }), amount, dirty: true } }));
  };

  const dirtyCount = useMemo(() => Object.values(matrix).filter((c) => c.dirty).length, [matrix]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const buildSheet = (includeData: boolean) => {
    const header = ["employee_number", "employee_name", ...elements.map((e) => e.code)];
    const subHeader = ["", "", ...elements.map((e) => `${(language === "ar" && e.name_ar) ? e.name_ar : e.name_en} [${e.element_type}]`)];
    const rows: any[][] = [header, subHeader];
    const list = includeData ? sorted : emps;
    for (const emp of list) {
      const row: any[] = [emp.employee_number, `${empName(emp)}`];
      for (const el of elements) {
        if (includeData) {
          const c = matrix[`${emp.id}|${el.id}`];
          row.push(c ? c.amount : "");
        } else {
          row.push("");
        }
      }
      rows.push(row);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    (ws as any)["!cols"] = header.map((_, i) => ({ wch: i < 2 ? 22 : 16 }));
    return ws;
  };

  const downloadTemplate = () => {
    if (elements.length === 0) { toast({ title: language === "ar" ? "لا توجد عناصر متغيرة نشطة" : "No active variable elements" }); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSheet(false), (language === "ar" ? "نموذج" : "Template"));
    XLSX.writeFile(wb, `payroll_variable_template_${year}_${String(month).padStart(2, "0")}.xlsx`);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSheet(true), "Variables");
    XLSX.writeFile(wb, `payroll_variable_${year}_${String(month).padStart(2, "0")}.xlsx`);
  };

  const importFromExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (rows.length < 2) { toast({ title: language === "ar" ? "ملف فارغ" : "Empty file", variant: "destructive" }); return; }
      const header = (rows[0] as any[]).map((h) => String(h || "").trim());
      const codeToElement = new Map(elements.map((e) => [e.code, e]));
      const numberToEmp = new Map(emps.map((e) => [e.employee_number, e]));
      const colElements: ({ id: string } | null)[] = header.map((h, i) => i < 2 ? null : (codeToElement.get(h) ? { id: codeToElement.get(h)!.id } : null));
      const unknownCols = header.slice(2).filter((h) => !codeToElement.get(h));
      let touched = 0; let skippedEmps = 0;
      const next: Matrix = { ...matrix };
      const startRow = (rows[1] && String(rows[1][0] || "").trim() === "") ? 2 : 1;
      for (let r = startRow; r < rows.length; r++) {
        const row = rows[r] as any[];
        const empNum = String(row[0] || "").trim();
        if (!empNum) continue;
        const emp = numberToEmp.get(empNum);
        if (!emp) { skippedEmps++; continue; }
        for (let c = 2; c < row.length; c++) {
          const el = colElements[c];
          if (!el) continue;
          const raw = row[c];
          if (raw === "" || raw === null || raw === undefined) continue;
          const amount = Number(raw);
          if (isNaN(amount)) continue;
          const key = `${emp.id}|${el.id}`;
          const existing = next[key];
          if (existing && Number(existing.amount) === amount && !existing.dirty) continue;
          next[key] = { ...(existing || { amount: 0 }), amount, dirty: true };
          touched++;
        }
      }
      setMatrix(next);
      toast({
        title: language === "ar" ? "تم الاستيراد" : "Imported",
        description: language === "ar" ? `${touched} خلايا تم تعليمها. ${skippedEmps} موظفون غير معروفين تم تجاهلهم.${unknownCols.length ? ` أعمدة غير معروفة: ${unknownCols.join(", ")}` : ""} انقر على حفظ الكل للاستمرار.` : `${touched} cell(s) marked. ${skippedEmps} unknown employees skipped.${unknownCols.length ? ` Unknown columns: ${unknownCols.join(", ")}` : ""} Click Save All to persist.`,
      });
    } catch (err: any) {
      toast({ title: language === "ar" ? "فشل الاستيراد" : "Import failed", description: err.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveAll = async () => {
    const dirty = Object.entries(matrix).filter(([, v]) => v.dirty);
    if (dirty.length === 0) { toast({ title: language === "ar" ? "لا توجد تغييرات" : "No changes" }); return; }
    setSaving(true);
    const updates: { id: string; amount: number }[] = [];
    const inserts: { employee_id: string; element_id: string; amount: number; period_year: number; period_month: number }[] = [];
    for (const [key, cell] of dirty) {
      const [employee_id, element_id] = key.split("|");
      if (cell.id) updates.push({ id: cell.id, amount: cell.amount });
      else inserts.push({ employee_id, element_id, amount: cell.amount, period_year: year, period_month: month });
    }
    try {
      for (const u of updates) {
        const { error } = await supabase.from("payroll_variable_entries").update({ amount: u.amount }).eq("id", u.id);
        if (error) throw error;
      }
      if (inserts.length) {
        const { data, error } = await supabase.from("payroll_variable_entries").insert(inserts).select("id, employee_id, element_id");
        if (error) throw error;
        const next: Matrix = { ...matrix };
        for (const row of data || []) {
          const k = `${row.employee_id}|${row.element_id}`;
          next[k] = { ...(next[k] || { amount: 0 }), id: row.id, dirty: false };
        }
        for (const u of updates) {
          for (const k of Object.keys(next)) if (next[k].id === u.id) next[k] = { ...next[k], dirty: false };
        }
        setMatrix(next);
      } else {
        const next: Matrix = { ...matrix };
        for (const u of updates) {
          for (const k of Object.keys(next)) if (next[k].id === u.id) next[k] = { ...next[k], dirty: false };
        }
        setMatrix(next);
      }
      toast({ title: language === "ar" ? "تم الحفظ" : "Saved", description: language === "ar" ? `${dirty.length} خلايا تم حفظها.` : `${dirty.length} cell(s) saved.` });
    } catch (err: any) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch(""); setDeptFilter([]); setJobFilter([]); setStatusFilter([]); setElementFilter([]);
  };

  const MultiCheckPop = ({
    label, options, selected, onChange,
  }: { label: string; options: { id: string; name: string }[]; selected: string[]; onChange: (v: string[]) => void }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Filter className="h-3.5 w-3.5 mr-1" /> {label}
          {selected.length > 0 && <Badge variant="secondary" className="ml-2">{selected.length}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <ScrollArea className="h-60">
          <div className="space-y-1">
            {options.length === 0 && <p className="text-xs text-muted-foreground p-2">{language === "ar" ? "لا توجد خيارات" : "No options"}</p>}
            {options.map((o) => (
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{language === "ar" ? "إدخال العناصر المتغيرة" : "Variable Element Entry"}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importFromExcel(f); }}
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> {language === "ar" ? "نموذج" : "Template"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> {language === "ar" ? "استيراد" : "Import"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" /> {language === "ar" ? "تصدير" : "Export"}
          </Button>
          <Badge variant={dirtyCount > 0 ? "default" : "secondary"}>{dirtyCount} {language === "ar" ? "غير محفوظ" : "unsaved"}</Badge>
          <Button onClick={saveAll} disabled={saving || dirtyCount === 0}>
            <Save className="h-4 w-4 mr-2" /> {saving ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : (language === "ar" ? "حفظ الكل" : "Save All")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{language === "ar" ? "الفترة والفلاتر" : "Period & Filters"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label>{language === "ar" ? "السنة" : "Year"}</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
            </div>
            <div>
              <Label>{language === "ar" ? "الشهر" : "Month"}</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const months = language === "ar"
                      ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
                      : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    return (
                      <SelectItem key={i + 1} value={String(i + 1)}>{language === "ar" ? months[i] : i + 1}</SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              placeholder={language === "ar" ? "بحث (المسافة تفصل بين المصطلحات)" : "Search (space separates terms)"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
            <MultiCheckPop label={language === "ar" ? "القسم" : "Department"} options={departments} selected={deptFilter} onChange={setDeptFilter} />
            <MultiCheckPop label={language === "ar" ? "الوظيفة" : "Job"} options={jobs} selected={jobFilter} onChange={setJobFilter} />
            <MultiCheckPop label={language === "ar" ? "الحالة" : "Status"} options={statuses.map((s) => ({ id: s, name: s }))} selected={statusFilter} onChange={setStatusFilter} />
            <MultiCheckPop label={language === "ar" ? "العناصر" : "Elements"} options={elements.map((e) => ({ id: e.id, name: `[${e.element_type}] ${(language === "ar" && e.name_ar) ? e.name_ar : e.name_en}` }))} selected={elementFilter} onChange={setElementFilter} />
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" /> {language === "ar" ? "مسح" : "Clear"} all
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "ar" ? "تلميح: انقر فوق رأس العمود للفرز. اضغط مع الاستمرار على Shift أثناء النقر لإضافة فرز ثانوي." : "Tip: click a column header to sort. Hold <kbd className=\"px-1 border rounded\">Shift</kbd> while clicking to add a secondary sort."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? (language === "ar" ? "جاري التحميل..." : "Loading...") : `${sorted.length} ${language === "ar" ? "موظفين ×" : "employees ×"} ${visibleElements.length} ${language === "ar" ? "عناصر متغيرة —" : "variable elements —"} ${year}-${String(month).padStart(2, "0")}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TopHorizontalScrollbar>
            <ScrollArea className="w-full">
              <div className="min-w-full overflow-x-auto">
                <Table dir={language === "ar" ? "rtl" : "ltr"}>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="sticky left-0 bg-background z-10 cursor-pointer select-none min-w-[200px]"
                        onClick={(e) => toggleSort("name", e)}
                      >
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
                              <span className="truncate">{(language === "ar" && el.name_ar) ? el.name_ar : el.name_en}</span> {sortBadge(el.id)}
                            </div>
                            <div className={`text-[10px] font-normal ${c.label}`}>{el.element_type}</div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4 + visibleElements.length} className="text-center text-muted-foreground py-6">
                          {language === "ar" ? "لا يوجد موظفين يطابقون الفلاتر" : "No employees match the filters"}
                        </TableCell>
                      </TableRow>
                    ) : sorted.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="sticky left-0 bg-background z-10 font-medium">
                          {empName(emp)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{emp.employee_number}</TableCell>
                        <TableCell className="text-xs">{emp.departments?.department_name || "—"}</TableCell>
                        <TableCell className="text-xs">{emp.job_positions?.position_name || "—"}</TableCell>
                        {visibleElements.map((el) => {
                          const key = `${emp.id}|${el.id}`;
                          const cell = matrix[key];
                          const c = typeColors[el.element_type] || typeColors.information;
                          return (
                            <TableCell key={el.id} className={`p-1 ${c.cell}`}>
                              <MatrixCellInput
                                value={cell?.amount}
                                dirty={cell?.dirty}
                                onCommit={(v) => setCell(emp.id, el.id, v)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </TopHorizontalScrollbar>
        </CardContent>
      </Card>
    </div>
  );
}
