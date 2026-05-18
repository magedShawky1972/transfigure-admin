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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Receipt, Save, Download, Upload, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, X, ChevronRight, ChevronDown, FolderTree, List } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import * as XLSX from "xlsx";

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
  category_code: string;
  category_name: string;
  category_name_ar: string | null;
  parent_category_id: string | null;
}

const ExpenseTypeSetup = () => {
  const { language } = useLanguage();
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ExpenseType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sorts, setSorts] = useState<{ key: string; dir: "asc" | "desc" }[]>([{ key: "expense_code", dir: "asc" }]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "tree">("tree");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
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
        supabase.from("expense_categories").select("id, category_code, category_name, category_name_ar, parent_category_id").eq("is_active", true),
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

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(language === "ar" ? `حذف ${ids.length} نوع؟` : `Delete ${ids.length} types?`)) return;
    try {
      const { error } = await supabase.from("expense_types").delete().in("id", ids);
      if (error) throw error;
      toast.success(language === "ar" ? `تم حذف ${ids.length} نوع` : `${ids.length} types deleted`);
      setSelected(new Set());
      fetchData();
    } catch (error: any) {
      console.error("Bulk delete error:", error);
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

  const handleExport = () => {
    const rows = expenseTypes.map((t) => ({
      expense_code: t.expense_code,
      expense_name: t.expense_name,
      expense_name_ar: t.expense_name_ar || "",
      category_code: t.category_id ? categories.find((c) => c.id === t.category_id)?.category_code || "" : "",
      default_account_code: t.default_account_code || "",
      is_asset: t.is_asset ? "TRUE" : "FALSE",
      is_active: t.is_active ? "TRUE" : "FALSE",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ExpenseTypes");
    XLSX.writeFile(wb, "expense_types.xlsx");
  };

  const handleTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        expense_code: "EXP001",
        expense_name: "Office Supplies",
        expense_name_ar: "مستلزمات مكتبية",
        category_code: "OFF",
        default_account_code: "5100",
        is_asset: "FALSE",
        is_active: "TRUE",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "expense_types_template.xlsx");
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

      const truthy = (v: any) => !["FALSE", "0", "NO", ""].includes(String(v ?? "").trim().toUpperCase());
      const codeMap = new Map(expenseTypes.map((t) => [t.expense_code, t.id]));
      const catCodeMap = new Map(categories.map((c) => [c.category_code, c.id]));

      let nextSeq = expenseTypes.reduce((max, t) => {
        const m = /^EXP(\d+)$/i.exec(t.expense_code.trim());
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);
      const genFallback = () => {
        let code = "";
        do {
          nextSeq++;
          code = `EXP${String(nextSeq).padStart(3, "0")}`;
        } while (codeMap.has(code));
        return code;
      };

      let inserted = 0, updated = 0, failed = 0;
      for (const r of rows) {
        const name = String(r.expense_name || "").trim();
        if (!name) { failed++; continue; }
        const catCode = String(r.category_code || "").trim();
        const category_id = catCode ? catCodeMap.get(catCode) || null : null;
        let code = String(r.expense_code || "").trim();
        if (!code) code = genFallback();

        const payload = {
          expense_code: code,
          expense_name: name,
          expense_name_ar: String(r.expense_name_ar || "").trim() || null,
          category_id,
          default_account_code: String(r.default_account_code || "").trim() || null,
          is_asset: truthy(r.is_asset) && String(r.is_asset ?? "").trim() !== "",
          is_active: !["FALSE", "0", "NO"].includes(String(r.is_active ?? "TRUE").trim().toUpperCase()),
        };
        const existingId = codeMap.get(code);
        if (existingId) {
          const { error } = await supabase.from("expense_types").update(payload).eq("id", existingId);
          if (error) failed++; else updated++;
        } else {
          const { data, error } = await supabase.from("expense_types").insert([payload]).select("id").single();
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

  type SortKey = "expense_code" | "expense_name" | "category" | "default_account_code" | "is_asset" | "status";
  const cols: { key: SortKey; label: string }[] = [
    { key: "expense_code", label: language === "ar" ? "الكود" : "Code" },
    { key: "expense_name", label: language === "ar" ? "الاسم" : "Name" },
    { key: "category", label: language === "ar" ? "التصنيف" : "Category" },
    { key: "default_account_code", label: language === "ar" ? "كود الحساب" : "Account Code" },
    { key: "is_asset", label: language === "ar" ? "أصل" : "Asset" },
    { key: "status", label: language === "ar" ? "الحالة" : "Status" },
  ];
  const codeSortKey = (code: string) => {
    const m = /^([^\d]*)(\d+)?(.*)$/.exec(String(code || "").trim());
    const prefix = (m?.[1] || "").toLowerCase();
    const num = m?.[2] ? parseInt(m[2], 10) : -1;
    const rest = (m?.[3] || "").toLowerCase();
    return `${prefix}|${String(num + 1).padStart(12, "0")}|${rest}`;
  };
  const getVal = (t: ExpenseType, k: SortKey) => {
    if (k === "expense_code") return codeSortKey(t.expense_code);
    if (k === "category") return getCategoryName(t.category_id).toLowerCase();
    if (k === "status") return t.is_active ? "active" : "inactive";
    if (k === "is_asset") return t.is_asset ? "yes" : "no";
    return String((t as any)[k] || "").toLowerCase();
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
  const filtered = expenseTypes.filter((t) =>
    cols.every((col) => {
      const f = (filters[col.key] || "").trim().toLowerCase();
      if (!f) return true;
      return getVal(t, col.key).includes(f);
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

  const renderTypeRow = (type: ExpenseType, depth = 0) => (
    <TableRow key={type.id} data-state={selected.has(type.id) ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={selected.has(type.id)}
          onCheckedChange={(v) => {
            const next = new Set(selected);
            if (v) next.add(type.id); else next.delete(type.id);
            setSelected(next);
          }}
        />
      </TableCell>
      <TableCell className="font-mono">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
          {viewMode === "tree" && <span className="w-3" />}
          {type.expense_code}
        </div>
      </TableCell>
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
  );

  const renderRows = () => {
    if (viewMode === "list") {
      if (!sorted.length) {
        return (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
              {language === "ar" ? "لا توجد أنواع" : "No expense types found"}
            </TableCell>
          </TableRow>
        );
      }
      return sorted.map((t) => renderTypeRow(t));
    }

    // Tree mode: group by category
    const byCategory = new Map<string | null, ExpenseType[]>();
    sorted.forEach((t) => {
      const key = t.category_id || null;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(t);
    });

    const rows: JSX.Element[] = [];
    const groupKeys = Array.from(byCategory.keys()).sort((a, b) => {
      const an = a ? getCategoryName(a) : "~uncategorized";
      const bn = b ? getCategoryName(b) : "~uncategorized";
      return an.localeCompare(bn);
    });

    for (const catId of groupKeys) {
      const groupId = `cat:${catId ?? "none"}`;
      const types = byCategory.get(catId)!;
      const isExp = expandedNodes.has(groupId);
      const allSelected = types.every((t) => selected.has(t.id));
      const someSelected = types.some((t) => selected.has(t.id));
      rows.push(
        <TableRow key={groupId} className="bg-muted/40 font-medium">
          <TableCell>
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => {
                const next = new Set(selected);
                if (v) types.forEach((t) => next.add(t.id));
                else types.forEach((t) => next.delete(t.id));
                setSelected(next);
              }}
            />
          </TableCell>
          <TableCell colSpan={7}>
            <button
              onClick={() => {
                const next = new Set(expandedNodes);
                if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
                setExpandedNodes(next);
              }}
              className="flex items-center gap-2 hover:text-foreground"
            >
              {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <FolderTree className="h-4 w-4 text-primary" />
              <span>
                {catId ? getCategoryName(catId) : (language === "ar" ? "بدون تصنيف" : "Uncategorized")}
              </span>
              <span className="text-xs text-muted-foreground">({types.length})</span>
            </button>
          </TableCell>
        </TableRow>
      );
      if (isExp) {
        types.forEach((t) => rows.push(renderTypeRow(t, 1)));
      }
    }

    if (!rows.length) {
      return (
        <TableRow>
          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
            {language === "ar" ? "لا توجد أنواع" : "No expense types found"}
          </TableCell>
        </TableRow>
      );
    }
    return rows;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "أنواع المصروفات" : "Expense Types"}</h1>
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
                    <Select value={formData.category_id || "none"} onValueChange={(v) => setFormData({ ...formData, category_id: v === "none" ? "" : v })}>
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
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            {language === "ar" ? "قائمة أنواع المصروفات" : "Expense Types List"}
            {selected.size > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({selected.size} {language === "ar" ? "محدد" : "selected"})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === "list" ? "tree" : "list")}
              className="gap-1"
            >
              {viewMode === "list" ? <FolderTree className="h-3 w-3" /> : <List className="h-3 w-3" />}
              {viewMode === "list"
                ? (language === "ar" ? "عرض شجري" : "Tree View")
                : (language === "ar" ? "عرض قائمة" : "List View")}
            </Button>
            {selected.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1">
                <Trash2 className="h-3 w-3" />
                {language === "ar" ? `حذف المحدد (${selected.size})` : `Delete Selected (${selected.size})`}
              </Button>
            )}
            {(sorts.length > 0 || Object.values(filters).some((v) => v)) && (
              <Button variant="ghost" size="sm" onClick={() => { setSorts([]); setFilters({}); }} className="gap-1">
                <X className="h-3 w-3" />
                {language === "ar" ? "مسح" : "Clear"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={sorted.length > 0 && sorted.every((t) => selected.has(t.id))}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) sorted.forEach((t) => next.add(t.id));
                      else sorted.forEach((t) => next.delete(t.id));
                      setSelected(next);
                    }}
                  />
                </TableHead>
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
                <TableHead />
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
            <TableBody>{renderRows()}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseTypeSetup;
