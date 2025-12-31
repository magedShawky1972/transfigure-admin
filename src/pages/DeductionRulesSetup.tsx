import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Calculator, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeductionRule {
  id: string;
  rule_name: string;
  rule_name_ar: string | null;
  rule_type: string;
  min_minutes: number | null;
  max_minutes: number | null;
  deduction_type: string;
  deduction_value: number;
  is_overtime: boolean;
  overtime_multiplier: number;
  is_active: boolean;
}

export default function DeductionRulesSetup() {
  const { language } = useLanguage();
  const [rules, setRules] = useState<DeductionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<DeductionRule | null>(null);
  const [formData, setFormData] = useState({
    rule_name: "",
    rule_name_ar: "",
    rule_type: "late_arrival",
    min_minutes: "",
    max_minutes: "",
    deduction_type: "percentage",
    deduction_value: "",
    is_overtime: false,
    overtime_multiplier: "1.5",
    is_active: true,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deduction_rules")
        .select("*")
        .order("rule_type")
        .order("min_minutes");

      if (error) throw error;
      setRules(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedRule(null);
    setFormData({
      rule_name: "",
      rule_name_ar: "",
      rule_type: "late_arrival",
      min_minutes: "",
      max_minutes: "",
      deduction_type: "percentage",
      deduction_value: "",
      is_overtime: false,
      overtime_multiplier: "1.5",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DeductionRule) => {
    setSelectedRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      rule_name_ar: rule.rule_name_ar || "",
      rule_type: rule.rule_type,
      min_minutes: rule.min_minutes?.toString() || "",
      max_minutes: rule.max_minutes?.toString() || "",
      deduction_type: rule.deduction_type,
      deduction_value: rule.deduction_value.toString(),
      is_overtime: rule.is_overtime,
      overtime_multiplier: rule.overtime_multiplier.toString(),
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.rule_name || !formData.deduction_value) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        rule_name: formData.rule_name,
        rule_name_ar: formData.rule_name_ar || null,
        rule_type: formData.rule_type,
        min_minutes: formData.min_minutes ? parseInt(formData.min_minutes) : null,
        max_minutes: formData.max_minutes ? parseInt(formData.max_minutes) : null,
        deduction_type: formData.deduction_type,
        deduction_value: parseFloat(formData.deduction_value),
        is_overtime: formData.is_overtime,
        overtime_multiplier: parseFloat(formData.overtime_multiplier),
        is_active: formData.is_active,
      };

      if (selectedRule) {
        const { error } = await supabase.from("deduction_rules").update(payload).eq("id", selectedRule.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("deduction_rules").insert(payload);
        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setDialogOpen(false);
      fetchRules();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedRule) return;
    try {
      const { error } = await supabase.from("deduction_rules").delete().eq("id", selectedRule.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      setDeleteDialogOpen(false);
      fetchRules();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getRuleTypeBadge = (type: string) => {
    switch (type) {
      case "late_arrival":
        return <Badge variant="secondary">{language === "ar" ? "تأخير" : "Late Arrival"}</Badge>;
      case "early_departure":
        return <Badge variant="outline">{language === "ar" ? "انصراف مبكر" : "Early Departure"}</Badge>;
      case "absence":
        return <Badge variant="destructive">{language === "ar" ? "غياب" : "Absence"}</Badge>;
      case "overtime":
        return <Badge className="bg-green-100 text-green-800">{language === "ar" ? "إضافي" : "Overtime"}</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getDeductionTypeLabel = (type: string) => {
    switch (type) {
      case "fixed":
        return language === "ar" ? "مبلغ ثابت" : "Fixed Amount";
      case "percentage":
        return language === "ar" ? "نسبة مئوية" : "Percentage";
      case "hourly":
        return language === "ar" ? "بالساعة" : "Hourly";
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            {language === "ar" ? "إعداد قواعد الخصم والحوافز" : "Deduction & Overtime Rules Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة قاعدة" : "Add Rule"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "اسم القاعدة" : "Rule Name"}</TableHead>
                  <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                  <TableHead>{language === "ar" ? "النطاق (دقائق)" : "Range (minutes)"}</TableHead>
                  <TableHead>{language === "ar" ? "نوع الخصم" : "Deduction Type"}</TableHead>
                  <TableHead>{language === "ar" ? "القيمة" : "Value"}</TableHead>
                  <TableHead>{language === "ar" ? "معامل الإضافي" : "OT Multiplier"}</TableHead>
                  <TableHead>{language === "ar" ? "نشط" : "Active"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {language === "ar" ? "لا توجد قواعد" : "No rules found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{language === "ar" ? rule.rule_name_ar || rule.rule_name : rule.rule_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRuleTypeBadge(rule.rule_type)}</TableCell>
                      <TableCell>
                        {rule.min_minutes !== null || rule.max_minutes !== null
                          ? `${rule.min_minutes ?? 0} - ${rule.max_minutes ?? "∞"}`
                          : "-"}
                      </TableCell>
                      <TableCell>{getDeductionTypeLabel(rule.deduction_type)}</TableCell>
                      <TableCell className="font-mono">
                        {rule.deduction_type === "percentage"
                          ? `${(rule.deduction_value * 100).toFixed(0)}%`
                          : rule.deduction_value}
                      </TableCell>
                      <TableCell>
                        {rule.is_overtime ? `${rule.overtime_multiplier}x` : "-"}
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedRule(rule);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRule
                ? language === "ar"
                  ? "تعديل قاعدة"
                  : "Edit Rule"
                : language === "ar"
                ? "إضافة قاعدة"
                : "Add Rule"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم القاعدة (إنجليزي) *" : "Rule Name (English) *"}</Label>
                <Input
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم القاعدة (عربي)" : "Rule Name (Arabic)"}</Label>
                <Input
                  value={formData.rule_name_ar}
                  onChange={(e) => setFormData({ ...formData, rule_name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "نوع القاعدة" : "Rule Type"}</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    rule_type: value,
                    is_overtime: value === "overtime",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="late_arrival">{language === "ar" ? "تأخير" : "Late Arrival"}</SelectItem>
                  <SelectItem value="early_departure">{language === "ar" ? "انصراف مبكر" : "Early Departure"}</SelectItem>
                  <SelectItem value="absence">{language === "ar" ? "غياب" : "Absence"}</SelectItem>
                  <SelectItem value="overtime">{language === "ar" ? "عمل إضافي" : "Overtime"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.rule_type !== "absence" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الحد الأدنى (دقائق)" : "Min Minutes"}</Label>
                  <Input
                    type="number"
                    value={formData.min_minutes}
                    onChange={(e) => setFormData({ ...formData, min_minutes: e.target.value })}
                    placeholder="e.g., 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الحد الأقصى (دقائق)" : "Max Minutes"}</Label>
                  <Input
                    type="number"
                    value={formData.max_minutes}
                    onChange={(e) => setFormData({ ...formData, max_minutes: e.target.value })}
                    placeholder={language === "ar" ? "اتركه فارغاً لـ ∞" : "Leave empty for ∞"}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع الخصم/الحافز" : "Deduction/Bonus Type"}</Label>
                <Select
                  value={formData.deduction_type}
                  onValueChange={(value) => setFormData({ ...formData, deduction_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{language === "ar" ? "مبلغ ثابت" : "Fixed Amount"}</SelectItem>
                    <SelectItem value="percentage">{language === "ar" ? "نسبة من الراتب اليومي" : "% of Daily Salary"}</SelectItem>
                    <SelectItem value="hourly">{language === "ar" ? "بالساعة" : "Hourly Rate"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {formData.deduction_type === "percentage"
                    ? language === "ar"
                      ? "النسبة (0-1) *"
                      : "Percentage (0-1) *"
                    : language === "ar"
                    ? "القيمة *"
                    : "Value *"}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.deduction_value}
                  onChange={(e) => setFormData({ ...formData, deduction_value: e.target.value })}
                  placeholder={formData.deduction_type === "percentage" ? "e.g., 0.25 for 25%" : "e.g., 50"}
                />
              </div>
            </div>

            {formData.rule_type === "overtime" && (
              <div className="space-y-2">
                <Label>{language === "ar" ? "معامل العمل الإضافي" : "Overtime Multiplier"}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.overtime_multiplier}
                  onChange={(e) => setFormData({ ...formData, overtime_multiplier: e.target.value })}
                  placeholder="e.g., 1.5"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "نشط" : "Active"}</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p>
            {language === "ar"
              ? `هل أنت متأكد من حذف القاعدة "${selectedRule?.rule_name}"؟`
              : `Are you sure you want to delete rule "${selectedRule?.rule_name}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {language === "ar" ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
