import { useLanguage } from "@/contexts/LanguageContext";
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
  is_absence_element: boolean;
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
  is_absence_element: false,
  is_active: true,
  sort_order: 0,
};

export default function PayrollElementSetup() {
  const { language } = useLanguage();
  const [rows, setRows] = useState<Element[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Element>>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("payroll_elements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("element_type")
      .order("name_en");
    if (error) toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
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
      toast({ title: language === "ar" ? "الحقول المطلوبة مفقودة" : "Missing required fields", variant: "destructive" });
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
      is_absence_element: !!form.is_absence_element,
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
      toast({ title: language === "ar" ? "فشل الحفظ" : "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? (language === "ar" ? "تم التحديث" : "Updated") : (language === "ar" ? "تم الإنشاء" : "Created") });
      setOpen(false);
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm(language === "ar" ? "هل تريد حذف هذا العنصر؟" : "Delete this element?")) return;
    const { error } = await supabase.from("payroll_elements").delete().eq("id", id);
    if (error) toast({ title: language === "ar" ? "فشل الحذف" : "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
      load();
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{language === "ar" ? "إعداد عناصر الرواتب" : "Payroll Element Setup"}</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> {language === "ar" ? "عنصر جديد" : "New Element"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "العناصر" : "Elements"} ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
          ) : (
            <Table dir={language === "ar" ? "rtl" : "ltr"}>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الرمز" : "Code"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم (انجليزي)" : "Name (EN)"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم (عربي)" : "Name (AR)"}</TableHead>
                  <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                  <TableHead>{language === "ar" ? "الحساب" : "Calc"}</TableHead>
                  <TableHead>{language === "ar" ? "المبلغ الافتراضي" : "Default Amount"}</TableHead>
                  <TableHead>{language === "ar" ? "دقائق التأخير" : "Delay Minutes"}</TableHead>
                  <TableHead>{language === "ar" ? "نشط" : "Active"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
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
                        {r.element_type === "earning" ? (language === "ar" ? "استحقاق" : "earning") : r.element_type === "deduction" ? (language === "ar" ? "استقطاع" : "deduction") : r.element_type === "employer_contribution" ? (language === "ar" ? "مساهمة صاحب العمل" : "employer_contribution") : (language === "ar" ? "للمعلومات فقط" : r.element_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.calculation_type === "fixed" ? (language === "ar" ? "مبلغ ثابت" : "fixed") : r.calculation_type === "formula" ? (language === "ar" ? "معادلة" : "formula") : r.calculation_type === "variable" ? (language === "ar" ? "متغير" : "variable") : (language === "ar" ? "دقائق التأخير" : r.calculation_type)}</TableCell>
                    <TableCell>{Number(r.default_amount || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      {r.is_delay_minutes_element && (
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" /> {language === "ar" ? "إدارة الوقت" : "Time Mgmt"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.is_active ? (language === "ar" ? "نعم" : "Yes") : (language === "ar" ? "لا" : "No")}</TableCell>
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
                      {language === "ar" ? "لا توجد عناصر بعد" : "No elements yet"}
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
            <DialogTitle>{editingId ? (language === "ar" ? "تعديل العنصر" : "Edit Element") : (language === "ar" ? "عنصر جديد" : "New Element")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{language === "ar" ? "الرمز *" : "Code *"}</Label>
              <Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>{language === "ar" ? "نوع العنصر *" : "Element Type *"}</Label>
              <Select
                value={form.element_type}
                onValueChange={(v) => setForm({ ...form, element_type: v })}
                disabled={!!form.is_delay_minutes_element}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">{language === "ar" ? "استحقاق" : "Earning"}</SelectItem>
                  <SelectItem value="deduction">{language === "ar" ? "استقطاع" : "Deduction"}</SelectItem>
                  <SelectItem value="employer_contribution">{language === "ar" ? "مساهمة صاحب العمل" : "Employer Contribution"}</SelectItem>
                  <SelectItem value="information">{language === "ar" ? "للمعلومات فقط" : "Information Only"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "الاسم (انجليزي) *" : "Name (EN) *"}</Label>
              <Input value={form.name_en || ""} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div>
              <Label>{language === "ar" ? "الاسم (عربي)" : "Name (AR)"}</Label>
              <Input value={form.name_ar || ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
            </div>
            <div>
              <Label>{language === "ar" ? "التصنيف" : "Classification"}</Label>
              <Input
                value={form.classification || ""}
                onChange={(e) => setForm({ ...form, classification: e.target.value })}
                placeholder={language === "ar" ? "أساسي، بدل، مكافأة، وقت إضافي، قرض، سلفة، تأمين، غوسي..." : "basic, allowance, bonus, overtime, loan, advance, insurance, gosi..."}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "نوع الحساب" : "Calculation Type"}</Label>
              <Select
                value={form.calculation_type}
                onValueChange={(v) => setForm({ ...form, calculation_type: v })}
                disabled={!!form.is_delay_minutes_element}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">{language === "ar" ? "مبلغ ثابت" : "Fixed amount"}</SelectItem>
                  <SelectItem value="formula">{language === "ar" ? "معادلة" : "Formula"}</SelectItem>
                  <SelectItem value="variable">{language === "ar" ? "متغير (يدخل شهرياً)" : "Variable (entered monthly)"}</SelectItem>
                  <SelectItem value="delay_minutes">{language === "ar" ? "دقائق التأخير (من إدارة الوقت)" : "Delay Minutes (from Time Mgmt)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "المبلغ الافتراضي" : "Default Amount"}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.default_amount ?? 0}
                onChange={(e) => setForm({ ...form, default_amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "ترتيب الفرز" : "Sort Order"}</Label>
              <Input
                type="number"
                value={form.sort_order ?? 0}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label>{language === "ar" ? "المعادلة (اختياري)" : "Formula (optional)"}</Label>
              <Input
                value={form.formula || ""}
                onChange={(e) => setForm({ ...form, formula: e.target.value })}
                placeholder={language === "ar" ? "مثال: basic_salary * 0.1" : "e.g. basic_salary * 0.1"}
              />
            </div>
            <div className="col-span-2 flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Switch
                checked={!!form.is_delay_minutes_element}
                onCheckedChange={(v) => setForm({ ...form, is_delay_minutes_element: v })}
              />
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" /> {language === "ar" ? "هذا العنصر لدقائق التأخير" : "This element is for Delay Minutes"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "عند التفعيل، ستقوم إدارة الوقت بإرسال إجمالي دقائق التأخير إلى هذا العنصر." : "When enabled, Time Management will send total delay minutes to this element."}
                  {language === "ar" ? "الحساب: (إجمالي الراتب الشهري / 30 / 8 / 60) × دقائق التأخير. يتم فرض نوع العنصر كاستقطاع." : "Calculation: (Total monthly salary / 30 / 8 / 60) × delay minutes. Element type is forced to Deduction."}
                </p>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Switch
                checked={!!form.is_basic_salary_element}
                onCheckedChange={(v) => setForm({ ...form, is_basic_salary_element: v })}
              />
              <div>
                <div className="font-medium">{language === "ar" ? "هذا العنصر هو الراتب الأساسي" : "This element is the Basic Salary"}</div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "عند التفعيل، يستخدم ملخص الاستقطاعات المبلغ المعين للموظف في هذا العنصر" : "When enabled, Deduction Summary uses the employee's assigned amount on this element"}
                  {language === "ar" ? "كراتب أساسي في المعادلة (الراتب / 30 / 8 / 60) × دقائق التأخير. يمكن تحديد عنصر واحد فقط." : "as the basic salary in the formula (salary / 30 / 8 / 60) × delay minutes. Only one element can be marked."}
                </p>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-3 p-3 rounded-md border bg-muted/30">
              <Switch
                checked={!!form.is_absence_element}
                onCheckedChange={(v) => setForm({ ...form, is_absence_element: v, element_type: v ? "deduction" : form.element_type })}
              />
              <div>
                <div className="font-medium">{language === "ar" ? "هذا العنصر للغياب" : "This element is for Absence"}</div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "عند التفعيل، يرسل ملخص الاستقطاعات إجمالي استقطاع الغياب إلى هذا العنصر." : "When enabled, Deduction Summary sends the total absence deduction to this element."}
                  {language === "ar" ? "يستخدم الحساب قاعدة الغياب المطابقة من إعداد قواعد الاستقطاع" : "Calculation uses the matching Absence rule from Deduction Rules Setup"}
                  {language === "ar" ? "(بعذر أو بدون عذر) × (الراتب الأساسي / 30) × أيام الغياب." : "(with-notice or without-notice) × (basic salary / 30) × absent days."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active !== false}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>{language === "ar" ? "نشط" : "Active"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={save}>{language === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
