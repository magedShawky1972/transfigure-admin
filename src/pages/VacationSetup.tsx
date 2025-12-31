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
import { Plus, Edit, Trash2, Calendar, Check, X } from "lucide-react";

interface VacationCode {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  description: string | null;
  default_days: number;
  is_paid: boolean;
  requires_approval: boolean;
  is_active: boolean;
}

export default function VacationSetup() {
  const { language } = useLanguage();
  const [vacationCodes, setVacationCodes] = useState<VacationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<VacationCode | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name_en: "",
    name_ar: "",
    description: "",
    default_days: 0,
    is_paid: true,
    requires_approval: true,
    is_active: true,
  });

  useEffect(() => {
    fetchVacationCodes();
  }, []);

  const fetchVacationCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vacation_codes")
        .select("*")
        .order("code");

      if (error) throw error;
      setVacationCodes(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setSelectedCode(null);
    setFormData({
      code: "",
      name_en: "",
      name_ar: "",
      description: "",
      default_days: 0,
      is_paid: true,
      requires_approval: true,
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (code: VacationCode) => {
    setSelectedCode(code);
    setFormData({
      code: code.code,
      name_en: code.name_en,
      name_ar: code.name_ar || "",
      description: code.description || "",
      default_days: code.default_days,
      is_paid: code.is_paid,
      requires_approval: code.requires_approval,
      is_active: code.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name_en) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        code: formData.code.toUpperCase(),
        name_en: formData.name_en,
        name_ar: formData.name_ar || null,
        description: formData.description || null,
        default_days: formData.default_days,
        is_paid: formData.is_paid,
        requires_approval: formData.requires_approval,
        is_active: formData.is_active,
      };

      if (selectedCode) {
        const { error } = await supabase
          .from("vacation_codes")
          .update(payload)
          .eq("id", selectedCode.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("vacation_codes").insert(payload);
        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setDialogOpen(false);
      fetchVacationCodes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedCode) return;
    try {
      const { error } = await supabase.from("vacation_codes").delete().eq("id", selectedCode.id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      setDeleteDialogOpen(false);
      fetchVacationCodes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            {language === "ar" ? "إعداد أنواع الإجازات" : "Vacation Types Setup"}
          </CardTitle>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة نوع" : "Add Type"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الرمز" : "Code"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</TableHead>
                  <TableHead>{language === "ar" ? "الأيام الافتراضية" : "Default Days"}</TableHead>
                  <TableHead>{language === "ar" ? "مدفوعة" : "Paid"}</TableHead>
                  <TableHead>{language === "ar" ? "تتطلب موافقة" : "Requires Approval"}</TableHead>
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
                ) : vacationCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {language === "ar" ? "لا توجد بيانات" : "No data found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  vacationCodes.map((vc) => (
                    <TableRow key={vc.id}>
                      <TableCell className="font-mono font-bold">{vc.code}</TableCell>
                      <TableCell>{vc.name_en}</TableCell>
                      <TableCell>{vc.name_ar || "-"}</TableCell>
                      <TableCell>{vc.default_days}</TableCell>
                      <TableCell>
                        {vc.is_paid ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        {vc.requires_approval ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        {vc.is_active ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(vc)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedCode(vc);
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
              {selectedCode
                ? language === "ar"
                  ? "تعديل نوع الإجازة"
                  : "Edit Vacation Type"
                : language === "ar"
                ? "إضافة نوع إجازة"
                : "Add Vacation Type"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الرمز *" : "Code *"}</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g., ANNUAL"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "الأيام الافتراضية" : "Default Days"}</Label>
                <Input
                  type="number"
                  value={formData.default_days}
                  onChange={(e) => setFormData({ ...formData, default_days: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم (إنجليزي) *" : "Name (English) *"}</Label>
              <Input
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
              <Input
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                dir="rtl"
              />
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
              <Label>{language === "ar" ? "إجازة مدفوعة" : "Paid Leave"}</Label>
              <Switch
                checked={formData.is_paid}
                onCheckedChange={(checked) => setFormData({ ...formData, is_paid: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "تتطلب موافقة" : "Requires Approval"}</Label>
              <Switch
                checked={formData.requires_approval}
                onCheckedChange={(checked) => setFormData({ ...formData, requires_approval: checked })}
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
              ? `هل أنت متأكد من حذف نوع الإجازة "${selectedCode?.name_en}"؟`
              : `Are you sure you want to delete vacation type "${selectedCode?.name_en}"?`}
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
