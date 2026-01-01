import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, CalendarClock } from "lucide-react";

interface AttendanceType {
  id: string;
  type_code: string;
  type_name: string;
  type_name_ar: string | null;
  description: string | null;
  is_shift_based: boolean;
  is_active: boolean;
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  allow_late_minutes: number | null;
  allow_early_exit_minutes: number | null;
  created_at: string;
  updated_at: string;
}

const AttendanceTypeSetup = () => {
  const { language } = useLanguage();
  const [attendanceTypes, setAttendanceTypes] = useState<AttendanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AttendanceType | null>(null);
  const [formData, setFormData] = useState({
    type_code: "",
    type_name: "",
    type_name_ar: "",
    description: "",
    is_shift_based: false,
    is_active: true,
    fixed_start_time: "",
    fixed_end_time: "",
    allow_late_minutes: "0",
    allow_early_exit_minutes: "0",
  });

  const fetchAttendanceTypes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendance_types")
        .select("*")
        .order("type_name");

      if (error) throw error;
      setAttendanceTypes(data || []);
    } catch (error: any) {
      toast.error(language === "ar" ? "فشل في تحميل البيانات" : "Failed to load data");
      console.error("Error fetching attendance types:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceTypes();
  }, []);

  const openAddDialog = () => {
    setSelectedType(null);
    setFormData({
      type_code: "",
      type_name: "",
      type_name_ar: "",
      description: "",
      is_shift_based: false,
      is_active: true,
      fixed_start_time: "",
      fixed_end_time: "",
      allow_late_minutes: "0",
      allow_early_exit_minutes: "0",
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: AttendanceType) => {
    setSelectedType(type);
    setFormData({
      type_code: type.type_code,
      type_name: type.type_name,
      type_name_ar: type.type_name_ar || "",
      description: type.description || "",
      is_shift_based: type.is_shift_based,
      is_active: type.is_active,
      fixed_start_time: type.fixed_start_time || "",
      fixed_end_time: type.fixed_end_time || "",
      allow_late_minutes: type.allow_late_minutes?.toString() || "0",
      allow_early_exit_minutes: type.allow_early_exit_minutes?.toString() || "0",
    });
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (type: AttendanceType) => {
    setSelectedType(type);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.type_code || !formData.type_name) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    try {
      const payload = {
        type_code: formData.type_code,
        type_name: formData.type_name,
        type_name_ar: formData.type_name_ar || null,
        description: formData.description || null,
        is_shift_based: formData.is_shift_based,
        is_active: formData.is_active,
        fixed_start_time: !formData.is_shift_based && formData.fixed_start_time ? formData.fixed_start_time : null,
        fixed_end_time: !formData.is_shift_based && formData.fixed_end_time ? formData.fixed_end_time : null,
        allow_late_minutes: parseInt(formData.allow_late_minutes) || 0,
        allow_early_exit_minutes: parseInt(formData.allow_early_exit_minutes) || 0,
      };

      if (selectedType) {
        const { error } = await supabase
          .from("attendance_types")
          .update(payload)
          .eq("id", selectedType.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("attendance_types").insert(payload);

        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setIsDialogOpen(false);
      fetchAttendanceTypes();
    } catch (error: any) {
      toast.error(error.message || (language === "ar" ? "حدث خطأ" : "An error occurred"));
      console.error("Error saving attendance type:", error);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;

    try {
      const { error } = await supabase
        .from("attendance_types")
        .delete()
        .eq("id", selectedType.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      setIsDeleteDialogOpen(false);
      fetchAttendanceTypes();
    } catch (error: any) {
      toast.error(error.message || (language === "ar" ? "حدث خطأ" : "An error occurred"));
      console.error("Error deleting attendance type:", error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "إعداد أنواع الحضور" : "Attendance Type Setup"}
        </h1>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة نوع" : "Add Type"}
        </Button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === "ar" ? "الرمز" : "Code"}</TableHead>
              <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
              <TableHead>{language === "ar" ? "الاسم بالعربي" : "Arabic Name"}</TableHead>
              <TableHead>{language === "ar" ? "نظام الورديات" : "Shift Based"}</TableHead>
              <TableHead>{language === "ar" ? "وقت البداية" : "Start Time"}</TableHead>
              <TableHead>{language === "ar" ? "وقت النهاية" : "End Time"}</TableHead>
              <TableHead>{language === "ar" ? "السماح بالتأخير (دقائق)" : "Late Allow (min)"}</TableHead>
              <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead className="text-center">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  {language === "ar" ? "جاري التحميل..." : "Loading..."}
                </TableCell>
              </TableRow>
            ) : attendanceTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد بيانات" : "No data found"}
                </TableCell>
              </TableRow>
            ) : (
              attendanceTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.type_code}</TableCell>
                  <TableCell>{type.type_name}</TableCell>
                  <TableCell>{type.type_name_ar || "-"}</TableCell>
                  <TableCell>
                    {type.is_shift_based ? (
                      <Badge variant="default" className="gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {language === "ar" ? "نعم" : "Yes"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {language === "ar" ? "لا" : "No"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!type.is_shift_based && type.fixed_start_time 
                      ? type.fixed_start_time.slice(0, 5) 
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {!type.is_shift_based && type.fixed_end_time 
                      ? type.fixed_end_time.slice(0, 5) 
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {type.allow_late_minutes || 0} / {type.allow_early_exit_minutes || 0}
                  </TableCell>
                  <TableCell>
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active
                        ? language === "ar"
                          ? "نشط"
                          : "Active"
                        : language === "ar"
                        ? "غير نشط"
                        : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(type)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedType
                ? language === "ar"
                  ? "تعديل نوع الحضور"
                  : "Edit Attendance Type"
                : language === "ar"
                ? "إضافة نوع حضور"
                : "Add Attendance Type"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "أدخل تفاصيل نوع الحضور"
                : "Enter the attendance type details"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="type_code">
                {language === "ar" ? "الرمز" : "Code"} *
              </Label>
              <Input
                id="type_code"
                value={formData.type_code}
                onChange={(e) => setFormData({ ...formData, type_code: e.target.value.toUpperCase() })}
                placeholder={language === "ar" ? "مثال: FIXED" : "e.g., FIXED"}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type_name">
                {language === "ar" ? "الاسم بالإنجليزي" : "English Name"} *
              </Label>
              <Input
                id="type_name"
                value={formData.type_name}
                onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
                placeholder={language === "ar" ? "مثال: Fixed Time" : "e.g., Fixed Time"}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type_name_ar">
                {language === "ar" ? "الاسم بالعربي" : "Arabic Name"}
              </Label>
              <Input
                id="type_name_ar"
                value={formData.type_name_ar}
                onChange={(e) => setFormData({ ...formData, type_name_ar: e.target.value })}
                placeholder={language === "ar" ? "مثال: وقت ثابت" : "e.g., وقت ثابت"}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">
                {language === "ar" ? "الوصف" : "Description"}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_shift_based">
                {language === "ar" ? "نظام الورديات (مرتبط بتقويم الورديات)" : "Shift Based (Linked to Shift Calendar)"}
              </Label>
              <Switch
                id="is_shift_based"
                checked={formData.is_shift_based}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  is_shift_based: checked,
                  fixed_start_time: checked ? "" : formData.fixed_start_time,
                  fixed_end_time: checked ? "" : formData.fixed_end_time,
                })}
              />
            </div>

            {/* Fixed Time Fields - Only show when NOT shift based */}
            {!formData.is_shift_based && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="grid gap-2">
                  <Label htmlFor="fixed_start_time">
                    {language === "ar" ? "وقت بداية الدوام" : "Work Start Time"} *
                  </Label>
                  <Input
                    id="fixed_start_time"
                    type="time"
                    value={formData.fixed_start_time}
                    onChange={(e) => setFormData({ ...formData, fixed_start_time: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fixed_end_time">
                    {language === "ar" ? "وقت نهاية الدوام" : "Work End Time"} *
                  </Label>
                  <Input
                    id="fixed_end_time"
                    type="time"
                    value={formData.fixed_end_time}
                    onChange={(e) => setFormData({ ...formData, fixed_end_time: e.target.value })}
                  />
                </div>
              </div>
            )}

            {formData.is_shift_based && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {language === "ar" 
                    ? "سيتم تحديد أوقات الحضور والانصراف بناءً على جلسات الورديات (فتح/إغلاق) في تقويم الورديات"
                    : "Working hours will be determined based on shift sessions (open/close) from the shift calendar"}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="allow_late_minutes">
                  {language === "ar" ? "السماح بالتأخير (دقائق)" : "Allow Late (minutes)"}
                </Label>
                <Input
                  id="allow_late_minutes"
                  type="number"
                  min="0"
                  value={formData.allow_late_minutes}
                  onChange={(e) => setFormData({ ...formData, allow_late_minutes: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="allow_early_exit_minutes">
                  {language === "ar" ? "السماح بالخروج المبكر (دقائق)" : "Allow Early Exit (minutes)"}
                </Label>
                <Input
                  id="allow_early_exit_minutes"
                  type="number"
                  min="0"
                  value={formData.allow_early_exit_minutes}
                  onChange={(e) => setFormData({ ...formData, allow_early_exit_minutes: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">
                {language === "ar" ? "نشط" : "Active"}
              </Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>
              {language === "ar" ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? `هل أنت متأكد من حذف "${selectedType?.type_name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${selectedType?.type_name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AttendanceTypeSetup;
