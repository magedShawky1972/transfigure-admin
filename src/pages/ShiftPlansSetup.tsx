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
import { Plus, Edit, Trash2, Clock, Calendar, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ShiftPlan {
  id: string;
  plan_name: string;
  plan_name_ar: string | null;
  description: string | null;
  is_active: boolean;
}

interface ShiftPlanDetail {
  id: string;
  shift_plan_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  is_off_day: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, en: "Sunday", ar: "الأحد" },
  { value: 1, en: "Monday", ar: "الإثنين" },
  { value: 2, en: "Tuesday", ar: "الثلاثاء" },
  { value: 3, en: "Wednesday", ar: "الأربعاء" },
  { value: 4, en: "Thursday", ar: "الخميس" },
  { value: 5, en: "Friday", ar: "الجمعة" },
  { value: 6, en: "Saturday", ar: "السبت" },
];

export default function ShiftPlansSetup() {
  const { language } = useLanguage();
  const [plans, setPlans] = useState<ShiftPlan[]>([]);
  const [planDetails, setPlanDetails] = useState<Record<string, ShiftPlanDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ShiftPlan | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    plan_name: "",
    plan_name_ar: "",
    description: "",
    is_active: true,
  });
  const [detailsFormData, setDetailsFormData] = useState<ShiftPlanDetail[]>([]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const [plansRes, detailsRes] = await Promise.all([
        supabase.from("shift_plans").select("*").order("plan_name"),
        supabase.from("shift_plan_details").select("*").order("day_of_week"),
      ]);

      if (plansRes.error) throw plansRes.error;
      setPlans(plansRes.data || []);

      // Group details by plan_id
      const groupedDetails: Record<string, ShiftPlanDetail[]> = {};
      detailsRes.data?.forEach((detail) => {
        if (!groupedDetails[detail.shift_plan_id]) {
          groupedDetails[detail.shift_plan_id] = [];
        }
        groupedDetails[detail.shift_plan_id].push(detail);
      });
      setPlanDetails(groupedDetails);
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
      description: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (plan: ShiftPlan) => {
    setSelectedPlan(plan);
    setFormData({
      plan_name: plan.plan_name,
      plan_name_ar: plan.plan_name_ar || "",
      description: plan.description || "",
      is_active: plan.is_active,
    });
    setDialogOpen(true);
  };

  const openDetailsDialog = (plan: ShiftPlan) => {
    setSelectedPlan(plan);
    const existingDetails = planDetails[plan.id] || [];
    
    // Create full week with existing or default values
    const fullWeek = DAYS_OF_WEEK.map((day) => {
      const existing = existingDetails.find((d) => d.day_of_week === day.value);
      return existing || {
        id: "",
        shift_plan_id: plan.id,
        day_of_week: day.value,
        start_time: "08:00",
        end_time: "17:00",
        break_duration_minutes: 60,
        is_off_day: day.value === 5 || day.value === 6, // Friday & Saturday off
      };
    });
    
    setDetailsFormData(fullWeek);
    setDetailsDialogOpen(true);
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
        description: formData.description || null,
        is_active: formData.is_active,
      };

      if (selectedPlan) {
        const { error } = await supabase.from("shift_plans").update(payload).eq("id", selectedPlan.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("shift_plans").insert(payload);
        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSaveDetails = async () => {
    if (!selectedPlan) return;

    try {
      // Delete existing details
      await supabase.from("shift_plan_details").delete().eq("shift_plan_id", selectedPlan.id);

      // Insert new details
      const detailsToInsert = detailsFormData.map((d) => ({
        shift_plan_id: selectedPlan.id,
        day_of_week: d.day_of_week,
        start_time: d.start_time,
        end_time: d.end_time,
        break_duration_minutes: d.break_duration_minutes,
        is_off_day: d.is_off_day,
      }));

      const { error } = await supabase.from("shift_plan_details").insert(detailsToInsert);
      if (error) throw error;

      toast.success(language === "ar" ? "تم حفظ تفاصيل الخطة" : "Plan details saved");
      setDetailsDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan) return;
    try {
      const { error } = await supabase.from("shift_plans").delete().eq("id", selectedPlan.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      setDeleteDialogOpen(false);
      fetchPlans();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleExpand = (planId: string) => {
    const newExpanded = new Set(expandedPlans);
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId);
    } else {
      newExpanded.add(planId);
    }
    setExpandedPlans(newExpanded);
  };

  const updateDetailField = (dayOfWeek: number, field: keyof ShiftPlanDetail, value: any) => {
    setDetailsFormData((prev) =>
      prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, [field]: value } : d))
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {language === "ar" ? "إعداد خطط الورديات" : "Shift Plans Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة خطة" : "Add Plan"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا توجد خطط" : "No plans found"}
              </div>
            ) : (
              plans.map((plan) => (
                <Collapsible key={plan.id} open={expandedPlans.has(plan.id)}>
                  <Card>
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => toggleExpand(plan.id)}>
                              {expandedPlans.has(plan.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                          <div>
                            <p className="font-medium">
                              {language === "ar" ? plan.plan_name_ar || plan.plan_name : plan.plan_name}
                            </p>
                            {plan.description && (
                              <p className="text-sm text-muted-foreground">{plan.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {plan.is_active ? (
                            <Badge className="bg-green-100 text-green-800">{language === "ar" ? "نشط" : "Active"}</Badge>
                          ) : (
                            <Badge variant="secondary">{language === "ar" ? "غير نشط" : "Inactive"}</Badge>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openDetailsDialog(plan)}>
                            <Calendar className="h-4 w-4 mr-2" />
                            {language === "ar" ? "تفاصيل الأيام" : "Day Details"}
                          </Button>
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
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{language === "ar" ? "اليوم" : "Day"}</TableHead>
                              <TableHead>{language === "ar" ? "البداية" : "Start"}</TableHead>
                              <TableHead>{language === "ar" ? "النهاية" : "End"}</TableHead>
                              <TableHead>{language === "ar" ? "الاستراحة" : "Break"}</TableHead>
                              <TableHead>{language === "ar" ? "يوم إجازة" : "Off Day"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {DAYS_OF_WEEK.map((day) => {
                              const detail = planDetails[plan.id]?.find((d) => d.day_of_week === day.value);
                              return (
                                <TableRow key={day.value}>
                                  <TableCell>{language === "ar" ? day.ar : day.en}</TableCell>
                                  <TableCell>{detail?.is_off_day ? "-" : detail?.start_time || "-"}</TableCell>
                                  <TableCell>{detail?.is_off_day ? "-" : detail?.end_time || "-"}</TableCell>
                                  <TableCell>
                                    {detail?.is_off_day ? "-" : `${detail?.break_duration_minutes || 0}m`}
                                  </TableCell>
                                  <TableCell>
                                    {detail?.is_off_day ? (
                                      <Check className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <X className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Plan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedPlan
                ? language === "ar"
                  ? "تعديل خطة الورديات"
                  : "Edit Shift Plan"
                : language === "ar"
                ? "إضافة خطة ورديات"
                : "Add Shift Plan"}
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

            <div className="space-y-2">
              <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
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

      {/* Day Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تفاصيل أيام الخطة" : "Plan Day Details"}: {selectedPlan?.plan_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {DAYS_OF_WEEK.map((day) => {
              const detail = detailsFormData.find((d) => d.day_of_week === day.value);
              return (
                <Card key={day.value} className={detail?.is_off_day ? "opacity-60" : ""}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 font-medium">{language === "ar" ? day.ar : day.en}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={detail?.is_off_day || false}
                          onChange={(e) => updateDetailField(day.value, "is_off_day", e.target.checked)}
                          className="h-4 w-4"
                        />
                        <Label className="text-sm">{language === "ar" ? "يوم إجازة" : "Off Day"}</Label>
                      </div>
                      {!detail?.is_off_day && (
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">{language === "ar" ? "من" : "From"}</Label>
                            <Input
                              type="time"
                              value={detail?.start_time || "08:00"}
                              onChange={(e) => updateDetailField(day.value, "start_time", e.target.value)}
                              className="w-32"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">{language === "ar" ? "إلى" : "To"}</Label>
                            <Input
                              type="time"
                              value={detail?.end_time || "17:00"}
                              onChange={(e) => updateDetailField(day.value, "end_time", e.target.value)}
                              className="w-32"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">{language === "ar" ? "استراحة" : "Break"}</Label>
                            <Input
                              type="number"
                              value={detail?.break_duration_minutes || 60}
                              onChange={(e) =>
                                updateDetailField(day.value, "break_duration_minutes", parseInt(e.target.value) || 0)
                              }
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">min</span>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveDetails}>
              {language === "ar" ? "حفظ التفاصيل" : "Save Details"}
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
              ? `هل أنت متأكد من حذف خطة الورديات "${selectedPlan?.plan_name}"؟`
              : `Are you sure you want to delete shift plan "${selectedPlan?.plan_name}"?`}
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
