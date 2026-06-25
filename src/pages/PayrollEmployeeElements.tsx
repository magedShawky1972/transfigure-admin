import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Emp = { id: string; first_name: string; last_name: string; employee_number: string; basic_salary: number | null };
type Element = { id: string; code: string; name_en: string; element_type: string; default_amount: number | null };
type Assign = {
  id: string;
  employee_id: string;
  element_id: string;
  amount: number;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
};

export default function PayrollEmployeeElements() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [rows, setRows] = useState<Assign[]>([]);
  const [newElement, setNewElement] = useState<string>("");
  const [newAmount, setNewAmount] = useState<string>("0");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const load = async () => {
    const [e, el] = await Promise.all([
      supabase.from("employees").select("id, first_name, last_name, employee_number, basic_salary").order("first_name"),
      supabase.from("payroll_elements").select("id, code, name_en, element_type, default_amount").eq("is_active", true).order("name_en"),
    ]);
    setEmps((e.data || []) as Emp[]);
    setElements((el.data || []) as Element[]);
  };

  const loadRows = async () => {
    if (!selectedEmp) { setRows([]); return; }
    const { data } = await supabase
      .from("payroll_employee_elements")
      .select("*")
      .eq("employee_id", selectedEmp)
      .order("created_at");
    setRows((data || []) as Assign[]);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadRows(); }, [selectedEmp]);

  const add = async () => {
    if (!selectedEmp || !newElement) {
      toast({ title: "Pick employee and element", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("payroll_employee_elements").insert({
      employee_id: selectedEmp,
      element_id: newElement,
      amount: Number(newAmount) || 0,
      effective_from: from || null,
      effective_to: to || null,
      is_active: true,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      setNewElement(""); setNewAmount("0"); setFrom(""); setTo("");
      loadRows();
    }
  };

  const updateAmount = async (id: string, amount: number) => {
    await supabase.from("payroll_employee_elements").update({ amount }).eq("id", id);
    loadRows();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from("payroll_employee_elements").update({ is_active }).eq("id", id);
    loadRows();
  };

  const remove = async (id: string) => {
    await supabase.from("payroll_employee_elements").delete().eq("id", id);
    loadRows();
  };

  const elName = (id: string) => {
    const e = elements.find((x) => x.id === id);
    return e ? `${e.name_en} (${e.element_type})` : id;
  };

  const assignAllToAll = async () => {
    if (!confirm(`Assign all ${elements.length} active elements to all ${emps.length} employees? Existing assignments will be skipped.`)) return;
    const { data: existing } = await supabase
      .from("payroll_employee_elements")
      .select("employee_id, element_id");
    const existSet = new Set((existing || []).map((r: any) => `${r.employee_id}|${r.element_id}`));
    const rowsToInsert: any[] = [];
    for (const emp of emps) {
      for (const el of elements) {
        if (existSet.has(`${emp.id}|${el.id}`)) continue;
        rowsToInsert.push({
          employee_id: emp.id,
          element_id: el.id,
          amount: Number(el.default_amount) || 0,
          is_active: true,
        });
      }
    }
    if (rowsToInsert.length === 0) {
      toast({ title: "Nothing to add", description: "All employees already have all elements." });
      return;
    }
    // chunk inserts
    const chunkSize = 500;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from("payroll_employee_elements").insert(chunk);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }
    toast({ title: "Done", description: `Inserted ${rowsToInsert.length} assignments.` });
    loadRows();
  };


  const selectedEmpObj = emps.find((e) => e.id === selectedEmp);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Employee Element Assign & Values</h1>

      <Card>
        <CardHeader>
          <CardTitle>Select Employee</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedEmp} onValueChange={setSelectedEmp}>
            <SelectTrigger className="max-w-lg"><SelectValue placeholder="Pick employee..." /></SelectTrigger>
            <SelectContent>
              {emps.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.employee_number} — {e.first_name} {e.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedEmpObj && (
            <p className="text-sm text-muted-foreground mt-2">
              Basic salary: <strong>{Number(selectedEmpObj.basic_salary || 0).toFixed(2)}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      {selectedEmp && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Elements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-3 items-end p-3 border rounded-md bg-muted/30">
              <div className="col-span-2">
                <Label>Element</Label>
                <Select value={newElement} onValueChange={(v) => {
                  setNewElement(v);
                  const el = elements.find((x) => x.id === v);
                  if (el && el.default_amount) setNewAmount(String(el.default_amount));
                }}>
                  <SelectTrigger><SelectValue placeholder="Pick element..." /></SelectTrigger>
                  <SelectContent>
                    {elements.map((e) => (
                      <SelectItem key={e.id} value={e.id}>[{e.element_type}] {e.name_en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
              </div>
              <div>
                <Label>From</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <Button onClick={add}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Element</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{elName(r.element_id)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-32"
                        defaultValue={r.amount}
                        onBlur={(e) => updateAmount(r.id, Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell>{r.effective_from || "—"}</TableCell>
                    <TableCell>{r.effective_to || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={r.is_active ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => toggleActive(r.id, !r.is_active)}
                      >
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      No elements assigned
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
