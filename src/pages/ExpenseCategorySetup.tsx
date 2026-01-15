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
import { Plus, Edit, Trash2, FolderTree, Save } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface ExpenseCategory {
  id: string;
  category_code: string;
  category_name: string;
  category_name_ar: string | null;
  parent_category_id: string | null;
  is_active: boolean;
}

const ExpenseCategorySetup = () => {
  const { language } = useLanguage();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState({
    category_code: "",
    category_name: "",
    category_name_ar: "",
    parent_category_id: "",
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("category_name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.category_code || !formData.category_name) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        category_code: formData.category_code,
        category_name: formData.category_name,
        category_name_ar: formData.category_name_ar || null,
        parent_category_id: formData.parent_category_id || null,
        is_active: formData.is_active,
      };

      if (editingCategory) {
        const { error } = await supabase.from("expense_categories").update(payload).eq("id", editingCategory.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث التصنيف بنجاح" : "Category updated successfully");
      } else {
        const { error } = await supabase.from("expense_categories").insert([payload]);
        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة التصنيف بنجاح" : "Category added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving category:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حفظ التصنيف" : "Error saving category"));
    }
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormData({
      category_code: category.category_code,
      category_name: category.category_name,
      category_name_ar: category.category_name_ar || "",
      parent_category_id: category.parent_category_id || "",
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    
    try {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف التصنيف بنجاح" : "Category deleted successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حذف التصنيف" : "Error deleting category"));
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setFormData({
      category_code: "",
      category_name: "",
      category_name_ar: "",
      parent_category_id: "",
      is_active: true,
    });
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return "-";
    const parent = categories.find((c) => c.id === parentId);
    return parent ? (language === "ar" && parent.category_name_ar ? parent.category_name_ar : parent.category_name) : "-";
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderTree className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "تصنيفات المصروفات" : "Expense Categories"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة تصنيف" : "Add Category"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory 
                  ? (language === "ar" ? "تعديل التصنيف" : "Edit Category")
                  : (language === "ar" ? "إضافة تصنيف جديد" : "Add New Category")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "كود التصنيف *" : "Category Code *"}</Label>
                <Input
                  value={formData.category_code}
                  onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                  placeholder="CAT001"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم التصنيف *" : "Category Name *"}</Label>
                <Input
                  value={formData.category_name}
                  onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم التصنيف (عربي)" : "Category Name (Arabic)"}</Label>
                <Input
                  value={formData.category_name_ar}
                  onChange={(e) => setFormData({ ...formData, category_name_ar: e.target.value })}
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "التصنيف الأب" : "Parent Category"}</Label>
                <Select 
                  value={formData.parent_category_id} 
                  onValueChange={(v) => setFormData({ ...formData, parent_category_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "بدون أب" : "No Parent"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{language === "ar" ? "بدون أب" : "No Parent"}</SelectItem>
                    {categories.filter(c => c.id !== editingCategory?.id).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {language === "ar" && c.category_name_ar ? c.category_name_ar : c.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>{language === "ar" ? "نشط" : "Active"}</Label>
              </div>
              <Button onClick={handleSubmit} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {editingCategory 
                  ? (language === "ar" ? "تحديث" : "Update")
                  : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة التصنيفات" : "Categories List"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الكود" : "Code"}</TableHead>
                <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                <TableHead>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</TableHead>
                <TableHead>{language === "ar" ? "التصنيف الأب" : "Parent"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-mono">{category.category_code}</TableCell>
                  <TableCell>{category.category_name}</TableCell>
                  <TableCell dir="rtl">{category.category_name_ar || "-"}</TableCell>
                  <TableCell>{getParentName(category.parent_category_id)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${category.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {category.is_active ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد تصنيفات" : "No categories found"}
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

export default ExpenseCategorySetup;
