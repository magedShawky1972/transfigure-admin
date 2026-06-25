import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Download, Upload, FileSpreadsheet } from "lucide-react";

type Emp = { id: string; first_name: string; last_name: string; employee_number: string };
type Element = { id: string; code: string; name_en: string; element_type: string; calculation_type: string };
type Entry = {
  id: string;
  employee_id: string;
  element_id: string;
  period_year: number;
  period_month: number;
  amount: number;
  notes: string | null;
};

export default function PayrollVariableEntry() {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [emp, setEmp] = useState<string>("");
  const [el, setEl] = useState<string>("");
  const [amount, setAmount] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  const load = async () => {
    const [e, els] = await Promise.all([
      supabase.from("employees").select("id, first_name, last_name, employee_number").order("first_name"),
      supabase.from("payroll_elements").select("id, code, name_en, element_type, calculation_type").eq("is_active", true).eq("calculation_type", "variable").order("name_en"),
    ]);
    setEmps((e.data || []) as Emp[]);
    setElements((els.data || []) as Element[]);
  };

  const loadRows = async () => {
    const { data } = await supabase
      .from("payroll_variable_entries")
      .select("*")
      .eq("period_year", year)
      .eq("period_month", month);
    setRows((data || []) as Entry[]);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadRows(); }, [year, month]);

  const add = async () => {
    if (!emp || !el) {
      toast({ title: "Pick employee and element", variant: "destructive" });
      return;
    }
    const targets = emp === "__all__" ? emps.map((x) => x.id) : [emp];
    const payload = targets.map((eid) => ({
      employee_id: eid,
      element_id: el,
      period_year: year,
      period_month: month,
      amount: Number(amount) || 0,
      notes: notes || null,
    }));
    const { error } = await supabase.from("payroll_variable_entries").insert(payload);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Added", description: `${payload.length} entr${payload.length === 1 ? "y" : "ies"} added` });
      setEmp(""); setEl(""); setAmount("0"); setNotes("");
      loadRows();
    }
  };

  const remove = async (id: string) => {
    await supabase.from("payroll_variable_entries").delete().eq("id", id);
    loadRows();
  };

  const empName = (id: string) => {
    const e = emps.find((x) => x.id === id);
    return e ? `${e.employee_number} — ${e.first_name} ${e.last_name}` : id;
  };
  const elName = (id: string) => elements.find((x) => x.id === id)?.name_en || id;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = () => {
    const aoa = [
      ["employee_number", "employee_name", "element_code", "element_name", "amount", "notes"],
      ...(emps[0] && elements[0]
        ? [[emps[0].employee_number, `${emps[0].first_name} ${emps[0].last_name}`, elements[0].code, elements[0].name_en, 0, ""]]
        : []),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `payroll_variable_template_${year}_${String(month).padStart(2, "0")}.xlsx`);
  };

  const exportToExcel = () => {
    const aoa: (string | number)[][] = [
      ["employee_number", "employee_name", "element_code", "element_name", "amount", "notes"],
    ];
    rows.forEach((r) => {
      const e = emps.find((x) => x.id === r.employee_id);
      const el = elements.find((x) => x.id === r.element_id);
      aoa.push([
        e?.employee_number || "",
        e ? `${e.first_name} ${e.last_name}` : "",
        el?.code || "",
        el?.name_en || "",
        Number(r.amount) || 0,
        r.notes || "",
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entries");
    XLSX.writeFile(wb, `payroll_variable_${year}_${String(month).padStart(2, "0")}.xlsx`);
  };

  const importFromExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      const payload: any[] = [];
      let skipped = 0;
      for (const row of data) {
        const empNum = String(row.employee_number || "").trim();
        const elCode = String(row.element_code || "").trim();
        const e = emps.find((x) => x.employee_number === empNum);
        const el = elements.find((x) => x.code === elCode);
        if (!e || !el) { skipped++; continue; }
        payload.push({
          employee_id: e.id,
          element_id: el.id,
          period_year: year,
          period_month: month,
          amount: Number(row.amount) || 0,
          notes: row.notes ? String(row.notes) : null,
        });
      }
      if (!payload.length) {
        toast({ title: "Nothing to import", description: `Skipped ${skipped} rows`, variant: "destructive" });
        return;
      }
      const { error } = await supabase.from("payroll_variable_entries").insert(payload);
      if (error) {
        toast({ title: "Import error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Imported", description: `${payload.length} rows added, ${skipped} skipped` });
        loadRows();
      }
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Variable Element Entry</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importFromExcel(e.target.files[0])}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Period</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries for {year}-{String(month).padStart(2, "0")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-3 items-end p-3 border rounded-md bg-muted/30">
            <div>
              <Label>Employee</Label>
              <Select value={emp} onValueChange={setEmp}>
                <SelectTrigger><SelectValue placeholder="Pick..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">★ All Employees ({emps.length})</SelectItem>
                  {emps.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.employee_number} — {e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Element (variable)</Label>
              <Select value={el} onValueChange={setEl}>
                <SelectTrigger><SelectValue placeholder="Pick..." /></SelectTrigger>
                <SelectContent>
                  {elements.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Element</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{empName(r.employee_id)}</TableCell>
                  <TableCell>{elName(r.element_id)}</TableCell>
                  <TableCell>{Number(r.amount).toFixed(2)}</TableCell>
                  <TableCell>{r.notes}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No variable entries for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
