import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Eye, EyeOff, Save } from "lucide-react";

interface SajelErpSettings {
  id?: string;
  api_key: string;
  ap_invoice_api_url: string;
  payment_api_url: string;
  one_step_combined_transaction_url: string;
  expense_entry_api_url: string;
}

const EMPTY: SajelErpSettings = {
  api_key: "",
  ap_invoice_api_url: "",
  payment_api_url: "",
  one_step_combined_transaction_url: "",
  expense_entry_api_url: "",
};

export default function SajelErpSetup() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<SajelErpSettings>(EMPTY);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("sajel_erp_settings")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setForm({
          id: data.id,
          api_key: data.api_key ?? "",
          ap_invoice_api_url: data.ap_invoice_api_url ?? "",
          payment_api_url: data.payment_api_url ?? "",
          one_step_combined_transaction_url: data.one_step_combined_transaction_url ?? "",
          expense_entry_api_url: data.expense_entry_api_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const update = (k: keyof SajelErpSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        api_key: form.api_key || null,
        ap_invoice_api_url: form.ap_invoice_api_url || null,
        payment_api_url: form.payment_api_url || null,
        one_step_combined_transaction_url: form.one_step_combined_transaction_url || null,
        expense_entry_api_url: form.expense_entry_api_url || null,
        updated_by: user?.id ?? null,
      };
      const query = form.id
        ? supabase.from("sajel_erp_settings").update(payload).eq("id", form.id).select()
        : supabase.from("sajel_erp_settings").insert(payload).select();
      const { data, error } = await query;
      if (error) throw error;
      if (data && data[0]) setForm((f) => ({ ...f, id: data[0].id }));
      toast.success(isAr ? "تم الحفظ" : "Saved successfully");
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-6" dir={isAr ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle>{isAr ? "إعداد Sajel ERP" : "Sajel ERP Setup"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{isAr ? "مفتاح API" : "API Key"}</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={form.api_key}
                onChange={update("api_key")}
                placeholder={isAr ? "أدخل مفتاح API" : "Enter API Key"}
                className={isAr ? "pl-10" : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className={`absolute top-1/2 -translate-y-1/2 ${isAr ? "left-2" : "right-2"} text-muted-foreground hover:text-foreground`}
                aria-label={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{isAr ? "رابط AP Invoice API" : "AP Invoice API URL"}</Label>
            <Input
              value={form.ap_invoice_api_url}
              onChange={update("ap_invoice_api_url")}
              placeholder="https://..."
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>{isAr ? "رابط Payment API" : "Payment API URL"}</Label>
            <Input
              value={form.payment_api_url}
              onChange={update("payment_api_url")}
              placeholder="https://..."
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>{isAr ? "رابط One-Step Combined Transaction" : "One-Step Combined Transaction URL"}</Label>
            <Input
              value={form.one_step_combined_transaction_url}
              onChange={update("one_step_combined_transaction_url")}
              placeholder="https://..."
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>{isAr ? "رابط Expense Entry API" : "Expense Entry API URL"}</Label>
            <Input
              value={form.expense_entry_api_url}
              onChange={update("expense_entry_api_url")}
              placeholder="https://..."
              dir="ltr"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {isAr ? "حفظ" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
