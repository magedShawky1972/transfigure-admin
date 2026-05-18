import { useState, useEffect, useRef } from "react";
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
import { Plus, Edit, Trash2, FolderTree, Save, Download, Upload, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import * as XLSX from "xlsx";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sorts, setSorts] = useState<{ key: string; dir: "asc" | "desc" }[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(language === "ar" ? `حذف ${ids.length} تصنيف؟` : `Delete ${ids.length} categories?`)) return;
    try {
      const { error } = await supabase.from("expense_categories").delete().in("id", ids);
      if (error) throw error;
      toast.success(language === "ar" ? `تم حذف ${ids.length} تصنيف` : `${ids.length} categories deleted`);
      setSelected(new Set());
      fetchData();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحذف" : "Error deleting"));
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

  const handleExport = () => {
    const rows = categories.map((c) => ({
      category_code: c.category_code,
      category_name: c.category_name,
      category_name_ar: c.category_name_ar || "",
      parent_category_code: c.parent_category_id
        ? categories.find((p) => p.id === c.parent_category_id)?.category_code || ""
        : "",
      is_active: c.is_active ? "TRUE" : "FALSE",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ExpenseCategories");
    XLSX.writeFile(wb, "expense_categories.xlsx");
  };

  const handleTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        category_code: "CAT001",
        category_name: "Office Supplies",
        category_name_ar: "مستلزمات مكتبية",
        parent_category_code: "",
        is_active: "TRUE",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "expense_categories_template.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!rows.length) {
        toast.error(language === "ar" ? "الملف فارغ" : "Empty file");
        return;
      }
      const codeMap = new Map(categories.map((c) => [c.category_code, c.id]));
      let nextSeq = categories.reduce((max, c) => {
        const m = /^CAT(\d+)$/i.exec(c.category_code.trim());
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const genCode = () => {
        let code = "";
        do {
          nextSeq++;
          code = `CAT${String(nextSeq).padStart(4, "0")}`;
        } while (codeMap.has(code));
        return code;
      };
      let inserted = 0, updated = 0, failed = 0;
      for (const r of rows) {
        let code = String(r.category_code || "").trim();
        const name = String(r.category_name || "").trim();
        if (!name) { failed++; continue; }
        if (!code) code = genCode();
        const parentCode = String(r.parent_category_code || "").trim();
        const parent_category_id = parentCode ? codeMap.get(parentCode) || null : null;
        const isActiveRaw = String(r.is_active ?? "TRUE").trim().toUpperCase();
        const payload = {
          category_code: code,
          category_name: name,
          category_name_ar: String(r.category_name_ar || "").trim() || null,
          parent_category_id,
          is_active: !["FALSE", "0", "NO"].includes(isActiveRaw),
        };
        const existingId = codeMap.get(code);
        if (existingId) {
          const { error } = await supabase.from("expense_categories").update(payload).eq("id", existingId);
          if (error) failed++; else updated++;
        } else {
          const { data, error } = await supabase.from("expense_categories").insert([payload]).select("id").single();
          if (error) failed++; else { inserted++; if (data) codeMap.set(code, data.id); }
        }
      }
      toast.success(
        language === "ar"
          ? `تم: ${inserted} إضافة، ${updated} تحديث، ${failed} فشل`
          : `Done: ${inserted} added, ${updated} updated, ${failed} failed`
      );
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (language === "ar" ? "فشل الاستيراد" : "Import failed"));
    }
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderTree className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "تصنيفات المصروفات" : "Expense Categories"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleTemplate}>
            <FileSpreadsheet className="h-4 w-4" />
            {language === "ar" ? "قالب" : "Template"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {language === "ar" ? "تصدير" : "Export"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {language === "ar" ? "استيراد" : "Import"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
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
      </div>

      {(() => {
        type SortKey = "category_code" | "category_name" | "category_name_ar" | "parent" | "status";
        const cols: { key: SortKey; label: string }[] = [
          { key: "category_code", label: language === "ar" ? "الكود" : "Code" },
          { key: "category_name", label: language === "ar" ? "الاسم" : "Name" },
          { key: "category_name_ar", label: language === "ar" ? "الاسم (عربي)" : "Name (Arabic)" },
          { key: "parent", label: language === "ar" ? "التصنيف الأب" : "Parent" },
          { key: "status", label: language === "ar" ? "الحالة" : "Status" },
        ];
        const getVal = (c: ExpenseCategory, k: SortKey) => {
          if (k === "parent") return getParentName(c.parent_category_id).toLowerCase();
          if (k === "status") return c.is_active ? "active" : "inactive";
          return String((c as any)[k] || "").toLowerCase();
        };
        const handleSort = (k: SortKey, e: React.MouseEvent) => {
          const multi = e.shiftKey;
          const existing = sorts.find((s) => s.key === k);
          let next = multi ? [...sorts] : existing ? [existing] : [];
          if (existing) {
            if (existing.dir === "asc") existing.dir = "desc";
            else next = next.filter((s) => s.key !== k);
          } else {
            next.push({ key: k, dir: "asc" });
          }
          setSorts(next);
        };
        const filtered = categories.filter((c) =>
          cols.every((col) => {
            const f = (filters[col.key] || "").trim().toLowerCase();
            if (!f) return true;
            return getVal(c, col.key).includes(f);
          })
        );
        const sorted = [...filtered].sort((a, b) => {
          for (const s of sorts) {
            const av = getVal(a, s.key as SortKey);
            const bv = getVal(b, s.key as SortKey);
            if (av < bv) return s.dir === "asc" ? -1 : 1;
            if (av > bv) return s.dir === "asc" ? 1 : -1;
          }
          return 0;
        });
        return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{language === "ar" ? "قائمة التصنيفات" : "Categories List"}</CardTitle>
          {(sorts.length > 0 || Object.values(filters).some((v) => v)) && (
            <Button variant="ghost" size="sm" onClick={() => { setSorts([]); setFilters({}); }} className="gap-1">
              <X className="h-3 w-3" />
              {language === "ar" ? "مسح" : "Clear"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((col) => {
                  const s = sorts.find((x) => x.key === col.key);
                  const idx = sorts.findIndex((x) => x.key === col.key);
                  return (
                    <TableHead key={col.key}>
                      <button
                        onClick={(e) => handleSort(col.key, e)}
                        className="flex items-center gap-1 hover:text-foreground"
                        title={language === "ar" ? "Shift+النقر للفرز المتعدد" : "Shift+Click for multi-sort"}
                      >
                        {col.label}
                        {s ? (s.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        {s && sorts.length > 1 && <span className="text-xs text-muted-foreground">{idx + 1}</span>}
                      </button>
                    </TableHead>
                  );
                })}
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
              <TableRow>
                {cols.map((col) => (
                  <TableHead key={col.key} className="py-1">
                    <Input
                      value={filters[col.key] || ""}
                      onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })}
                      placeholder={language === "ar" ? "تصفية..." : "Filter..."}
                      className="h-7 text-xs"
                    />
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((category) => (
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
              {sorted.length === 0 && (
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
        );
      })()}
    </div>
  );
};

export default ExpenseCategorySetup;
