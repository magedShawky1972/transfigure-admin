import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";

interface BusinessUnit {
  id: string;
  unit_name: string;
  unit_name_ar: string | null;
  unit_code: string | null;
}
interface CostCenter {
  id: string;
  cost_center_code: string | null;
  cost_center_name: string;
  cost_center_name_ar: string | null;
}
interface Mapping {
  id: string;
  business_unit_id: string;
  cost_center_id: string;
  payroll_dr_account: string | null;
  business_units?: BusinessUnit;
  cost_centers?: CostCenter;
}

const BusinessUnitCostCenterMapping = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/business-unit-cost-center-mapping");

  const [rows, setRows] = useState<Mapping[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [ccs, setCcs] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    business_unit_id: "",
    cost_center_id: "",
    payroll_dr_account: "",
  });

  useEffect(() => {
    if (hasAccess) load();
  }, [hasAccess]);

  const load = async () => {
    setLoading(true);
    try {
      const [m, u, c] = await Promise.all([
        supabase
          .from("business_unit_cost_center_mapping")
          .select("*, business_units(id,unit_name,unit_name_ar,unit_code), cost_centers(id,cost_center_code,cost_center_name,cost_center_name_ar)")
          .order("created_at", { ascending: false }),
        supabase.from("business_units").select("id,unit_name,unit_name_ar,unit_code").eq("is_active", true).order("unit_name"),
        supabase.from("cost_centers").select("id,cost_center_code,cost_center_name,cost_center_name_ar").eq("is_active", true).order("cost_center_name"),
      ]);
      if (m.error) throw m.error;
      setRows((m.data || []) as any);
      setUnits((u.data || []) as any);
      setCcs((c.data || []) as any);
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ business_unit_id: "", cost_center_id: "", payroll_dr_account: "" });
    setDialogOpen(true);
  };

  const openEdit = (r: Mapping) => {
    setEditingId(r.id);
    setForm({
      business_unit_id: r.business_unit_id,
      cost_center_id: r.cost_center_id,
      payroll_dr_account: r.payroll_dr_account || "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.business_unit_id || !form.cost_center_id) {
      toast({ title: isAr ? "بيانات ناقصة" : "Missing data", description: isAr ? "اختر وحدة العمل ومركز التكلفة" : "Select business unit and cost center", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        business_unit_id: form.business_unit_id,
        cost_center_id: form.cost_center_id,
        payroll_dr_account: form.payroll_dr_account || null,
      };
      let res;
      if (editingId) {
        res = await supabase.from("business_unit_cost_center_mapping").update(payload).eq("id", editingId).select();
      } else {
        res = await supabase.from("business_unit_cost_center_mapping").insert(payload).select();
      }
      if (res.error) throw res.error;
      toast({ title: isAr ? "تم الحفظ" : "Saved" });
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: isAr ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm(isAr ? "حذف السجل؟" : "Delete this mapping?")) return;
    const { error } = await supabase.from("business_unit_cost_center_mapping").delete().eq("id", id);
    if (error) {
      toast({ title: isAr ? "خطأ" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isAr ? "تم الحذف" : "Deleted" });
    load();
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!hasAccess) return <AccessDenied />;

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.business_units?.unit_name?.toLowerCase().includes(s) ||
      r.business_units?.unit_name_ar?.toLowerCase().includes(s) ||
      r.cost_centers?.cost_center_name?.toLowerCase().includes(s) ||
      r.cost_centers?.cost_center_name_ar?.toLowerCase().includes(s) ||
      r.payroll_dr_account?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isAr ? "ربط وحدات العمل بمراكز التكلفة" : "Business Unit ↔ Cost Center Mapping"}</CardTitle>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 me-2" />
            {isAr ? "جديد" : "New"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isAr ? "بحث..." : "Search..."}
              className="ps-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "وحدة العمل" : "Business Unit"}</TableHead>
                  <TableHead>{isAr ? "مركز التكلفة" : "Cost Center"}</TableHead>
                  <TableHead>{isAr ? "حساب مدين للرواتب" : "Payroll Dr. Account"}</TableHead>
                  <TableHead className="w-32 text-end">{isAr ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {isAr ? "لا توجد بيانات" : "No data"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        {r.business_units?.unit_code ? `${r.business_units.unit_code} - ` : ""}
                        {isAr && r.business_units?.unit_name_ar ? r.business_units.unit_name_ar : r.business_units?.unit_name}
                      </TableCell>
                      <TableCell>
                        {r.cost_centers?.cost_center_code ? `${r.cost_centers.cost_center_code} - ` : ""}
                        {isAr && r.cost_centers?.cost_center_name_ar ? r.cost_centers.cost_center_name_ar : r.cost_centers?.cost_center_name}
                      </TableCell>
                      <TableCell>{r.payroll_dr_account || "-"}</TableCell>
                      <TableCell className="text-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? (isAr ? "تعديل الربط" : "Edit Mapping") : (isAr ? "ربط جديد" : "New Mapping")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isAr ? "وحدة العمل" : "Business Unit"} *</Label>
              <Select value={form.business_unit_id} onValueChange={(v) => setForm({ ...form, business_unit_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? "اختر..." : "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.unit_code ? `${u.unit_code} - ` : ""}
                      {isAr && u.unit_name_ar ? u.unit_name_ar : u.unit_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "مركز التكلفة" : "Cost Center"} *</Label>
              <Select value={form.cost_center_id} onValueChange={(v) => setForm({ ...form, cost_center_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={isAr ? "اختر..." : "Select..."} />
                </SelectTrigger>
                <SelectContent>
                  {ccs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cost_center_code ? `${c.cost_center_code} - ` : ""}
                      {isAr && c.cost_center_name_ar ? c.cost_center_name_ar : c.cost_center_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "حساب مدين للرواتب" : "Payroll Dr. Account"}</Label>
              <Input
                value={form.payroll_dr_account}
                onChange={(e) => setForm({ ...form, payroll_dr_account: e.target.value })}
                placeholder="e.g. 501200"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={save}>{isAr ? "حفظ" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessUnitCostCenterMapping;
