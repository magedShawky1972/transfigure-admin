import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface Company {
  id: string;
  name: string;
  is_active: boolean;
}

const CompanySetup = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [newName, setNewName] = useState("");

  const t = (ar: string, en: string) => (isAr ? ar : en);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });
    if (error) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
    } else {
      setCompanies(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: t("تنبيه", "Notice"), description: t("الاسم مطلوب", "Name is required"), variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("companies")
      .insert([{ name, is_active: true }])
      .select();
    if (error) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: t("خطأ", "Error"), description: t("لا تملك صلاحية الإضافة", "No permission"), variant: "destructive" });
      return;
    }
    setNewName("");
    fetchCompanies();
    toast({ title: t("نجاح", "Success"), description: t("تمت الإضافة", "Company added") });
  };

  const handleUpdate = async (c: Company) => {
    const { data, error } = await supabase
      .from("companies")
      .update({ name: c.name.trim(), is_active: c.is_active })
      .eq("id", c.id)
      .select();
    if (error) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
      return false;
    }
    if (!data || data.length === 0) {
      toast({ title: t("خطأ", "Error"), description: t("لا تملك صلاحية التعديل", "No permission"), variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleDelete = async (id: string) => {
    const { data, error } = await supabase.from("companies").delete().eq("id", id).select();
    if (error) {
      toast({ title: t("خطأ", "Error"), description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0) {
      toast({ title: t("خطأ", "Error"), description: t("لا تملك صلاحية الحذف", "No permission"), variant: "destructive" });
      return;
    }
    fetchCompanies();
    toast({ title: t("نجاح", "Success"), description: t("تم الحذف", "Deleted") });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    for (const c of companies) {
      await handleUpdate(c);
    }
    setSaving(false);
    fetchCompanies();
    toast({ title: t("نجاح", "Success"), description: t("تم الحفظ", "All saved") });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir={isAr ? "rtl" : "ltr"}>
      {(loading || saving) && <LoadingOverlay message={t("جارٍ المعالجة...", "Processing...")} />}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("إعداد الشركات", "Company Setup")}</CardTitle>
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("حفظ الكل", "Save All")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">{t("اسم الشركة الجديدة", "New Company Name")}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("اسم الشركة", "Company name")} />
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              {t("إضافة", "Add")}
            </Button>
          </div>

          <div className="border rounded-md divide-y">
            <div className="grid grid-cols-12 gap-2 p-3 font-medium bg-muted text-sm">
              <div className="col-span-7">{t("الاسم", "Name")}</div>
              <div className="col-span-3 text-center">{t("نشط", "Active")}</div>
              <div className="col-span-2 text-center">{t("إجراءات", "Actions")}</div>
            </div>
            {companies.map((c, idx) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 p-3 items-center">
                <div className="col-span-7">
                  <Input
                    value={c.name}
                    onChange={(e) => {
                      const copy = [...companies];
                      copy[idx] = { ...c, name: e.target.value };
                      setCompanies(copy);
                    }}
                  />
                </div>
                <div className="col-span-3 flex justify-center">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(checked) => {
                      const copy = [...companies];
                      copy[idx] = { ...c, is_active: checked };
                      setCompanies(copy);
                    }}
                  />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {companies.length === 0 && !loading && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                {t("لا توجد شركات", "No companies yet")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySetup;
