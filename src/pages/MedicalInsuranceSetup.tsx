import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { Plus, Edit, Trash2, Shield, Check, X } from "lucide-react";

interface MedicalInsurancePlan {
  id: string;
  plan_name: string;
  plan_name_ar: string | null;
  provider: string | null;
  coverage_type: string | null;
  max_coverage_amount: number | null;
  employee_contribution: number | null;
  employer_contribution: number | null;
  includes_family: boolean;
  description: string | null;
  is_active: boolean;
}

export default function MedicalInsuranceSetup() {
  const { language } = useLanguage();
  const [plans, setPlans] = useState<MedicalInsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MedicalInsurancePlan | null>(null);
  const [formData, setFormData] = useState({
    plan_name: "",
    plan_name_ar: "",
    provider: "",
    coverage_type: "",
    max_coverage_amount: "",
    employee_contribution: "",
    employer_contribution: "",
    includes_family: false,
    description: "",
    is_active: true,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("medical_insurance_plans")
        .select("*")
        .order("plan_name");

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedPlan(null);
    setFormData({
      plan_name: "",
      plan_name_ar: "",
      provider: "",
      coverage_type: "",
      max_coverage_amount: "",
      employee_contribution: "",
      employer_contribution: "",
      includes_family: false,
      description: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (plan: MedicalInsurancePlan) => {
    setSelectedPlan(plan);
    setFormData({
      plan_name: plan.plan_name,
      plan_name_ar: plan.plan_name_ar || "",
      provider: plan.provider || "",
      coverage_type: plan.coverage_type || "",
      max_coverage_amount: plan.max_coverage_amount?.toString() || "",
      employee_contribution: plan.employee_contribution?.toString() || "",
      employer_contribution: plan.employer_contribution?.toString() || "",
      includes_family: plan.includes_family,
      description: plan.description || "",
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.plan_name) {
      toast.error(language === "ar" ? "يرجى إدخال اسم الخطة" : "Please enter plan name");
      return;
    }

    try {
      const payload = {
        plan_name: formData.plan_name,
        plan_name_ar: formData.plan_name_ar || null,
        provider: formData.provider || null,
        coverage_type: formData.coverage_type || null,
        max_coverage_amount: formData.max_coverage_amount ? parseFloat(formData.max_coverage_amount) : null,
        employee_contribution: formData.employee_contribution ? parseFloat(formData.employee_contribution) : null,
        employer_contribution: formData.employer_contribution ? parseFloat(formData.employer_contribution) : null,
        includes_family: formData.includes_family,
        description: formData.description || null,
        is_active: formData.is_active,
      };

      if (selectedPlan) {
        const { error } = await supabase.from("medical_insurance_plans").update(payload).eq("id", selectedPlan.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("medical_insurance_plans").insert(payload);
        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;
    try {
      const { error } = await supabase.from("medical_insurance_plans").delete().eq("id", selectedPlan.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      setDeleteDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {language === "ar" ? "إعداد خطط التأمين الطبي" : "Medical Insurance Plans Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة خطة" : "Add Plan"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "اسم الخطة" : "Plan Name"}</TableHead>
                  <TableHead>{language === "ar" ? "المزود" : "Provider"}</TableHead>
                  <TableHead>{language === "ar" ? "نوع التغطية" : "Coverage Type"}</TableHead>
                  <TableHead>{language === "ar" ? "الحد الأقصى" : "Max Coverage"}</TableHead>
                  <TableHead>{language === "ar" ? "مساهمة الموظف" : "Employee Contrib."}</TableHead>
                  <TableHead>{language === "ar" ? "مساهمة الشركة" : "Employer Contrib."}</TableHead>
                  <TableHead>{language === "ar" ? "تشمل العائلة" : "Family"}</TableHead>
                  <TableHead>{language === "ar" ? "نشط" : "Active"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {language === "ar" ? "لا توجد خطط" : "No plans found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">
                        {language === "ar" ? plan.plan_name_ar || plan.plan_name : plan.plan_name}
                      </TableCell>
                      <TableCell>{plan.provider || "-"}</TableCell>
                      <TableCell>{plan.coverage_type || "-"}</TableCell>
                      <TableCell>{plan.max_coverage_amount?.toLocaleString() || "-"}</TableCell>
                      <TableCell>{plan.employee_contribution?.toLocaleString() || "-"}</TableCell>
                      <TableCell>{plan.employer_contribution?.toLocaleString() || "-"}</TableCell>
                      <TableCell>
                        {plan.includes_family ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        {plan.is_active ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedPlan(plan);
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan
                ? language === "ar"
                  ? "تعديل خطة التأمين"
                  : "Edit Insurance Plan"
                : language === "ar"
                ? "إضافة خطة تأمين"
                : "Add Insurance Plan"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم الخطة (إنجليزي) *" : "Plan Name (English) *"}</Label>
                <Input
                  value={formData.plan_name}
                  onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم الخطة (عربي)" : "Plan Name (Arabic)"}</Label>
                <Input
                  value={formData.plan_name_ar}
                  onChange={(e) => setFormData({ ...formData, plan_name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "شركة التأمين" : "Provider"}</Label>
                <Input
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع التغطية" : "Coverage Type"}</Label>
                <Input
                  value={formData.coverage_type}
                  onChange={(e) => setFormData({ ...formData, coverage_type: e.target.value })}
                  placeholder="e.g., Gold, Silver, Basic"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الحد الأقصى للتغطية" : "Max Coverage"}</Label>
                <Input
                  type="number"
                  value={formData.max_coverage_amount}
                  onChange={(e) => setFormData({ ...formData, max_coverage_amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "مساهمة الموظف" : "Employee Contrib."}</Label>
                <Input
                  type="number"
                  value={formData.employee_contribution}
                  onChange={(e) => setFormData({ ...formData, employee_contribution: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "مساهمة الشركة" : "Employer Contrib."}</Label>
                <Input
                  type="number"
                  value={formData.employer_contribution}
                  onChange={(e) => setFormData({ ...formData, employer_contribution: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "تشمل العائلة" : "Includes Family"}</Label>
              <Switch
                checked={formData.includes_family}
                onCheckedChange={(checked) => setFormData({ ...formData, includes_family: checked })}
              />
            </div>

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
              ? `هل أنت متأكد من حذف خطة التأمين "${selectedPlan?.plan_name}"؟`
              : `Are you sure you want to delete insurance plan "${selectedPlan?.plan_name}"?`}
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
