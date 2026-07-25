import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Loader2, Download, Upload, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface BusinessUnit {
  id: string;
  unit_code: string | null;
  unit_name: string;
  unit_name_ar: string | null;
  is_active: boolean;
  created_at: string;
}

const BusinessUnitSetup = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/business-unit-setup");
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [filtered, setFiltered] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    unit_code: "",
    unit_name: "",
    unit_name_ar: "",
    is_active: true,
  });

  useEffect(() => {
    if (hasAccess) fetchUnits();
  }, [hasAccess]);

  useEffect(() => {
    let f = [...units];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(
        (u) =>
          (u.unit_code || "").toLowerCase().includes(q) ||
          u.unit_name.toLowerCase().includes(q) ||
          (u.unit_name_ar || "").includes(searchQuery)
      );
    }
    setFiltered(f);
  }, [units, searchQuery]);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_units")
        .select("*")
        .order("unit_code", { nullsFirst: false });
      if (error) throw error;
      setUnits((data as any) || []);
    } catch (error: any) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ unit_code: "", unit_name: "", unit_name_ar: "", is_active: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        unit_code: formData.unit_code || null,
        unit_name: formData.unit_name,
        unit_name_ar: formData.unit_name_ar || null,
        is_active: formData.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("business_units").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: language === "ar" ? "تم التحديث" : "Updated" });
      } else {
        const { error } = await supabase.from("business_units").insert([payload]);
        if (error) throw error;
        toast({ title: language === "ar" ? "تم الحفظ" : "Saved" });
      }
      setIsDialogOpen(false);
      resetForm();
      setEditingId(null);
      fetchUnits();
    } catch (error: any) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (u: BusinessUnit) => {
    setFormData({
      unit_code: u.unit_code || "",
      unit_name: u.unit_name,
      unit_name_ar: u.unit_name_ar || "",
      is_active: u.is_active,
    });
    setEditingId(u.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    try {
      const { error } = await supabase.from("business_units").delete().eq("id", id);
      if (error) throw error;
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
      fetchUnits();
    } catch (error: any) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(
      language === "ar"
        ? `هل أنت متأكد من حذف ${ids.length} وحدة عمل؟`
        : `Are you sure you want to delete ${ids.length} business unit(s)?`
    )) return;
    try {
      const { error } = await supabase.from("business_units").delete().in("id", ids);
      if (error) throw error;
      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? `تم حذف ${ids.length} وحدة` : `Deleted ${ids.length} unit(s)`,
      });
      setSelectedIds(new Set());
      fetchUnits();
    } catch (error: any) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (filtered.length && filtered.every((u) => selectedIds.has(u.id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((u) => u.id)));
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { unit_code: "BU001", unit_name: "Sample Business Unit", unit_name_ar: "وحدة عمل", is_active: true },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BusinessUnits");
    XLSX.writeFile(wb, "business_units_template.xlsx");
  };

  const handleExport = () => {
    const rows = filtered.map((u) => ({
      unit_code: u.unit_code || "",
      unit_name: u.unit_name,
      unit_name_ar: u.unit_name_ar || "",
      is_active: u.is_active,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BusinessUnits");
    XLSX.writeFile(wb, "business_units.xlsx");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
      if (!rows.length) throw new Error(language === "ar" ? "الملف فارغ" : "File is empty");

      const existingByCode = new Map(units.filter((u) => u.unit_code).map((u) => [u.unit_code!, u.id]));
      const existingByName = new Map(units.map((u) => [u.unit_name, u.id]));
      let inserted = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const [idx, row] of rows.entries()) {
        const code = String(row.unit_code ?? "").trim();
        const name = String(row.unit_name ?? "").trim();
        if (!name) {
          errors.push(`Row ${idx + 2}: missing unit_name`);
          continue;
        }
        const activeRaw = row.is_active;
        const is_active =
          typeof activeRaw === "boolean"
            ? activeRaw
            : ["true", "1", "yes", "y", "نشط"].includes(String(activeRaw).toLowerCase().trim());

        const payload = {
          unit_code: code || null,
          unit_name: name,
          unit_name_ar: row.unit_name_ar ? String(row.unit_name_ar) : null,
          is_active,
        };

        const existingId = (code && existingByCode.get(code)) || existingByName.get(name);
        if (existingId) {
          const { error } = await supabase.from("business_units").update(payload).eq("id", existingId);
          if (error) errors.push(`Row ${idx + 2}: ${error.message}`);
          else updated++;
        } else {
          const { error } = await supabase.from("business_units").insert([payload]);
          if (error) errors.push(`Row ${idx + 2}: ${error.message}`);
          else inserted++;
        }
      }

      toast({
        title: language === "ar" ? "تم الاستيراد" : "Import complete",
        description:
          (language === "ar"
            ? `تمت الإضافة: ${inserted}، التحديث: ${updated}`
            : `Inserted: ${inserted}, Updated: ${updated}`) +
          (errors.length ? ` — ${errors.length} error(s)` : ""),
        variant: errors.length ? "destructive" : "default",
      });
      if (errors.length) console.error("Business unit import errors:", errors);
      fetchUnits();
    } catch (err: any) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {language === "ar" ? "وحدات العمل" : "Business Units"}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileDown className="h-4 w-4 mr-2" />
            {language === "ar" ? "قالب Excel" : "Template"}
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {language === "ar" ? "استيراد" : "Import"}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
            </label>
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تصدير" : "Export"}
          </Button>
          <Button onClick={() => { resetForm(); setEditingId(null); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            {language === "ar" ? "إضافة وحدة" : "Add Business Unit"}
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "ar" ? "بحث..." : "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm">
            {language === "ar" ? `تم اختيار ${selectedIds.size}` : `${selectedIds.size} selected`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              {language === "ar" ? "إلغاء" : "Clear"}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              {language === "ar" ? "حذف المحدد" : "Delete Selected"}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>{language === "ar" ? "الرمز" : "Code"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم بالإنجليزية" : "English Name"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم بالعربية" : "Arabic Name"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد وحدات عمل" : "No business units found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id} data-state={selectedIds.has(u.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(u.id)}
                          onCheckedChange={() => toggleSelect(u.id)}
                          aria-label={`Select ${u.unit_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono">{u.unit_code || "-"}</TableCell>
                      <TableCell>{u.unit_name}</TableCell>
                      <TableCell>{u.unit_name_ar || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={u.is_active ? "default" : "secondary"}>
                          {u.is_active
                            ? language === "ar" ? "نشط" : "Active"
                            : language === "ar" ? "غير نشط" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)}>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? language === "ar" ? "تعديل وحدة العمل" : "Edit Business Unit"
                : language === "ar" ? "إضافة وحدة عمل" : "Add Business Unit"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>{language === "ar" ? "الرمز" : "Code"}</Label>
              <Input
                value={formData.unit_code}
                onChange={(e) => setFormData({ ...formData, unit_code: e.target.value })}
                placeholder="BU001"
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الاسم بالإنجليزية *" : "English Name *"}</Label>
              <Input
                required
                value={formData.unit_name}
                onChange={(e) => setFormData({ ...formData, unit_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الاسم بالعربية" : "Arabic Name"}</Label>
              <Input
                value={formData.unit_name_ar}
                onChange={(e) => setFormData({ ...formData, unit_name_ar: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{language === "ar" ? "نشط" : "Active"}</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessUnitSetup;
