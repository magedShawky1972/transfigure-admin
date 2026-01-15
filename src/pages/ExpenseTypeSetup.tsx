import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Receipt, Save } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface ExpenseType {
  id: string;
  expense_code: string;
  expense_name: string;
  expense_name_ar: string | null;
  category_id: string | null;
  default_account_code: string | null;
  is_asset: boolean;
  is_active: boolean;
}

interface ExpenseCategory {
  id: string;
  category_name: string;
  category_name_ar: string | null;
}

const ExpenseTypeSetup = () => {
  const { language } = useLanguage();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseType | null>(null);
  const [formData, setFormData] = useState({
    expense_code: "",
    expense_name: "",
    expense_name_ar: "",
    category_id: "",
    default_account_code: "",
    is_asset: false,
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, categoriesRes] = await Promise.all([
        supabase.from("expense_types").select("*").order("expense_name"),
        supabase.from("expense_categories").select("id, category_name, category_name_ar").eq("is_active", true),
      ]);

      if (typesRes.error) throw typesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setExpenseTypes(typesRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.expense_code || !formData.expense_name) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        expense_code: formData.expense_code,
        expense_name: formData.expense_name,
        expense_name_ar: formData.expense_name_ar || null,
        category_id: formData.category_id || null,
        default_account_code: formData.default_account_code || null,
        is_asset: formData.is_asset,
        is_active: formData.is_active,
      };

      if (editingType) {
        const { error } = await supabase.from("expense_types").update(payload).eq("id", editingType.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث نوع المصروف بنجاح" : "Expense type updated successfully");
      } else {
        const { error } = await supabase.from("expense_types").insert([payload]);
        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة نوع المصروف بنجاح" : "Expense type added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving expense type:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحفظ" : "Error saving"));
    }
  };

  const handleEdit = (type: ExpenseType) => {
    setEditingType(type);
    setFormData({
      expense_code: type.expense_code,
      expense_name: type.expense_name,
      expense_name_ar: type.expense_name_ar || "",
      category_id: type.category_id || "",
      default_account_code: type.default_account_code || "",
      is_asset: type.is_asset,
      is_active: type.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    
    try {
      const { error } = await supabase.from("expense_types").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحذف" : "Error deleting"));
    }
  };

  const resetForm = () => {
    setEditingType(null);
    setFormData({
      expense_code: "",
      expense_name: "",
      expense_name_ar: "",
      category_id: "",
      default_account_code: "",
      is_asset: false,
      is_active: true,
    });
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "-";
    const cat = categories.find((c) => c.id === catId);
    return cat ? (language === "ar" && cat.category_name_ar ? cat.category_name_ar : cat.category_name) : "-";
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "أنواع المصروفات" : "Expense Types"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة نوع" : "Add Type"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingType 
                  ? (language === "ar" ? "تعديل نوع المصروف" : "Edit Expense Type")
                  : (language === "ar" ? "إضافة نوع مصروف جديد" : "Add New Expense Type")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الكود *" : "Code *"}</Label>
                  <Input
                    value={formData.expense_code}
                    onChange={(e) => setFormData({ ...formData, expense_code: e.target.value })}
                    placeholder="EXP001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الاسم *" : "Name *"}</Label>
                  <Input
                    value={formData.expense_name}
                    onChange={(e) => setFormData({ ...formData, expense_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                  <Input
                    value={formData.expense_name_ar}
                    onChange={(e) => setFormData({ ...formData, expense_name_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "التصنيف" : "Category"}</Label>
                  <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v === "none" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر التصنيف" : "Select Category"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{language === "ar" ? "بدون تصنيف" : "No Category"}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {language === "ar" && c.category_name_ar ? c.category_name_ar : c.category_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "كود الحساب الافتراضي" : "Default Account Code"}</Label>
                <Input
                  value={formData.default_account_code}
                  onChange={(e) => setFormData({ ...formData, default_account_code: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_asset}
                    onCheckedChange={(v) => setFormData({ ...formData, is_asset: v })}
                  />
                  <Label>{language === "ar" ? "أصل ثابت" : "Is Asset"}</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>{language === "ar" ? "نشط" : "Active"}</Label>
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {editingType ? (language === "ar" ? "تحديث" : "Update") : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة أنواع المصروفات" : "Expense Types List"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الكود" : "Code"}</TableHead>
                <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                <TableHead>{language === "ar" ? "التصنيف" : "Category"}</TableHead>
                <TableHead>{language === "ar" ? "كود الحساب" : "Account Code"}</TableHead>
                <TableHead>{language === "ar" ? "أصل" : "Asset"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-mono">{type.expense_code}</TableCell>
                  <TableCell>{language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name}</TableCell>
                  <TableCell>{getCategoryName(type.category_id)}</TableCell>
                  <TableCell className="font-mono">{type.default_account_code || "-"}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${type.is_asset ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}>
                      {type.is_asset ? (language === "ar" ? "نعم" : "Yes") : (language === "ar" ? "لا" : "No")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${type.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {type.is_active ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(type)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDelete(type.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {expenseTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد أنواع" : "No expense types found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseTypeSetup;
