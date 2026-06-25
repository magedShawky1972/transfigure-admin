import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";

type Element = {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  element_type: string;
  classification: string | null;
  calculation_type: string;
  default_amount: number | null;
  formula: string | null;
  is_delay_minutes_element: boolean;
  is_basic_salary_element: boolean;
  is_active: boolean;
  sort_order: number | null;
};

const EMPTY: Partial<Element> = {
  code: "",
  name_en: "",
  name_ar: "",
  element_type: "earning",
  classification: "",
  calculation_type: "fixed",
  default_amount: 0,
  formula: "",
  is_delay_minutes_element: false,
  is_basic_salary_element: false,
  is_active: true,
  sort_order: 0,
};

export default function PayrollElementSetup() {
  const [rows, setRows] = useState<Element[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Element>>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payroll_elements")
      .select("*")
      .order("element_type")
      .order("sort_order")
      .order("name_en");
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setRows((data || []) as Element[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(EMPTY);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (r: Element) => {
    setForm(r);
    setEditingId(r.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.code || !form.name_en) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    const payload: any = {
      code: form.code,
      name_en: form.name_en,
      name_ar: form.name_ar || null,
      element_type: form.element_type,
      classification: form.classification || null,
      calculation_type: form.calculation_type,
      default_amount: Number(form.default_amount) || 0,
      formula: form.formula || null,
      is_delay_minutes_element: !!form.is_delay_minutes_element,
      is_basic_salary_element: !!form.is_basic_salary_element,
      is_active: form.is_active !== false,
      sort_order: Number(form.sort_order) || 0,
    };
    // If delay minutes is set, force calculation type
    if (payload.is_delay_minutes_element) {
      payload.calculation_type = "delay_minutes";
      payload.element_type = "deduction";
    }
    let error;
    if (editingId) {
      ({ error } = await supabase.from("payroll_elements").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("payroll_elements").insert(payload));
    }
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Updated" : "Created" });
      setOpen(false);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this element?")) return;
    const { error } = await supabase.from("payroll_elements").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Deleted" });
      load();
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payroll Element Setup</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> New Element
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elements ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name (EN)</TableHead>
                  <TableHead>Name (AR)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Calc</TableHead>
                  <TableHead>Default Amount</TableHead>
                  <TableHead>Delay Minutes</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name_en}</TableCell>
                    <TableCell>{r.name_ar}</TableCell>
                    <TableCell>
                      <Badge variant={r.element_type === "earning" ? "default" : r.element_type === "deduction" ? "destructive" : "secondary"}>
                        {r.element_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.calculation_type}</TableCell>
                    <TableCell>{Number(r.default_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {r.is_delay_minutes_element && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" /> Time Mgmt
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No elements yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Element" : "New Element"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Code *</Label>
              <Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>Element Type *</Label>
              <Select
                value={form.element_type}
                onValueChange={(v) => setForm({ ...form, element_type: v })}
                disabled={!!form.is_delay_minutes_element}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                  <SelectItem value="employer_contribution">Employer Contribution</SelectItem>
                  <SelectItem value="information">Information Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name (EN) *</Label>
              <Input value={form.name_en || ""} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div>
              <Label>Name (AR)</Label>
              <Input value={form.name_ar || ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
            </div>
            <div>
              <Label>Classification</Label>
              <Input
                value={form.classification || ""}
                onChange={(e) => setForm({ ...form, classification: e.target.value })}
                placeholder="basic, allowance, bonus, overtime, loan, advance, insurance, gosi..."
              />
            </div>
            <div>
              <Label>Calculation Type</Label>
              <Select
                value={form.calculation_type}
                onValueChange={(v) => setForm({ ...form, calculation_type: v })}
                disabled={!!form.is_delay_minutes_element}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed amount</SelectItem>
                  <SelectItem value="formula">Formula</SelectItem>
                  <SelectItem value="variable">Variable (entered monthly)</SelectItem>
                  <SelectItem value="delay_minutes">Delay Minutes (from Time Mgmt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.default_amount ?? 0}
                onChange={(e) => setForm({ ...form, default_amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label>Formula (optional)</Label>
              <Input
                value={form.formula || ""}
                onChange={(e) => setForm({ ...form, formula: e.target.value })}
                placeholder="e.g. basic_salary * 0.1"
              />
            </div>
            <div className="col-span-2 flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Switch
                checked={!!form.is_delay_minutes_element}
                onCheckedChange={(v) => setForm({ ...form, is_delay_minutes_element: v })}
              />
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" /> This element is for Delay Minutes
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, Time Management will send total delay minutes to this element.
                  Calculation: (Total monthly salary / 30 / 8 / 60) × delay minutes. Element type is forced to Deduction.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active !== false}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
