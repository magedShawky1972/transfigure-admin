import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Eye, EyeOff, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_TYPES = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

interface SajelErpSettings {
  id?: string;
  api_key: string;
  ap_invoice_api_url: string;
  ap_invoice_api_type: string;
  payment_api_url: string;
  payment_api_type: string;
  one_step_combined_transaction_url: string;
  one_step_combined_transaction_api_type: string;
  expense_entry_api_url: string;
  expense_entry_api_type: string;
  generate_batch_number_url: string;
  generate_batch_number_api_type: string;
  stock_issue_api_url: string;
  stock_issue_api_type: string;
  stock_movement_api_url: string;
  stock_movement_api_type: string;
  payroll_api_url: string;
  payroll_api_type: string;
  chart_of_account_api_url: string;
  chart_of_account_api_type: string;
}

const EMPTY: SajelErpSettings = {
  api_key: "",
  ap_invoice_api_url: "",
  ap_invoice_api_type: "POST",
  payment_api_url: "",
  payment_api_type: "POST",
  one_step_combined_transaction_url: "",
  one_step_combined_transaction_api_type: "POST",
  expense_entry_api_url: "",
  expense_entry_api_type: "POST",
  generate_batch_number_url: "",
  generate_batch_number_api_type: "GET",
  stock_issue_api_url: "",
  stock_issue_api_type: "POST",
  stock_movement_api_url: "",
  stock_movement_api_type: "POST",
  payroll_api_url: "",
  payroll_api_type: "POST",
  chart_of_account_api_url: "",
  chart_of_account_api_type: "GET",
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
          ap_invoice_api_type: data.ap_invoice_api_type ?? "POST",
          payment_api_url: data.payment_api_url ?? "",
          payment_api_type: data.payment_api_type ?? "POST",
          one_step_combined_transaction_url: data.one_step_combined_transaction_url ?? "",
          one_step_combined_transaction_api_type: data.one_step_combined_transaction_api_type ?? "POST",
          expense_entry_api_url: data.expense_entry_api_url ?? "",
          expense_entry_api_type: data.expense_entry_api_type ?? "POST",
          generate_batch_number_url: (data as any).generate_batch_number_url ?? "",
          generate_batch_number_api_type: (data as any).generate_batch_number_api_type ?? "GET",
          stock_issue_api_url: (data as any).stock_issue_api_url ?? "",
          stock_issue_api_type: (data as any).stock_issue_api_type ?? "POST",
          stock_movement_api_url: (data as any).stock_movement_api_url ?? "",
          stock_movement_api_type: (data as any).stock_movement_api_type ?? "POST",
          payroll_api_url: (data as any).payroll_api_url ?? "",
          payroll_api_type: (data as any).payroll_api_type ?? "POST",
          chart_of_account_api_url: (data as any).chart_of_account_api_url ?? "",
          chart_of_account_api_type: (data as any).chart_of_account_api_type ?? "GET",
        });
      }
      setLoading(false);
    })();
  }, []);

  const update = (k: keyof SajelErpSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const updateType = (k: keyof SajelErpSettings) => (value: string) =>
    setForm((f) => ({ ...f, [k]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        api_key: form.api_key || null,
        ap_invoice_api_url: form.ap_invoice_api_url || null,
        ap_invoice_api_type: form.ap_invoice_api_type || "POST",
        payment_api_url: form.payment_api_url || null,
        payment_api_type: form.payment_api_type || "POST",
        one_step_combined_transaction_url: form.one_step_combined_transaction_url || null,
        one_step_combined_transaction_api_type: form.one_step_combined_transaction_api_type || "POST",
        expense_entry_api_url: form.expense_entry_api_url || null,
        expense_entry_api_type: form.expense_entry_api_type || "POST",
        generate_batch_number_url: form.generate_batch_number_url || null,
        generate_batch_number_api_type: form.generate_batch_number_api_type || "GET",
        stock_issue_api_url: form.stock_issue_api_url || null,
        stock_issue_api_type: form.stock_issue_api_type || "POST",
        stock_movement_api_url: form.stock_movement_api_url || null,
        stock_movement_api_type: form.stock_movement_api_type || "POST",
        payroll_api_url: form.payroll_api_url || null,
        payroll_api_type: form.payroll_api_type || "POST",
        chart_of_account_api_url: form.chart_of_account_api_url || null,
        chart_of_account_api_type: form.chart_of_account_api_type || "GET",
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

  const renderUrlRow = (
    label: string,
    urlKey: keyof SajelErpSettings,
    typeKey: keyof SajelErpSettings,
    placeholder: string
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={form[urlKey] as string}
          onChange={update(urlKey)}
          placeholder={placeholder}
          dir="ltr"
          className="flex-1"
        />
        <Select
          value={(form[typeKey] as string) || "POST"}
          onValueChange={updateType(typeKey)}
        >
          <SelectTrigger className="w-[120px]" dir="ltr">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {API_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

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

          {renderUrlRow(
            isAr ? "رابط AP Invoice API" : "AP Invoice API URL",
            "ap_invoice_api_url",
            "ap_invoice_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط Payment API" : "Payment API URL",
            "payment_api_url",
            "payment_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط One-Step Combined Transaction" : "One-Step Combined Transaction URL",
            "one_step_combined_transaction_url",
            "one_step_combined_transaction_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط Expense Entry API" : "Expense Entry API URL",
            "expense_entry_api_url",
            "expense_entry_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط توليد رقم الدفعة" : "Generate Batch Number URL",
            "generate_batch_number_url",
            "generate_batch_number_api_type",
            "https://erp.edaraasus.com/ap/batch-number/reset"
          )}

          {renderUrlRow(
            isAr ? "رابط Stock Issue API (نقاط)" : "Stock Issue API URL (Points)",
            "stock_issue_api_url",
            "stock_issue_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط Stock Movement API" : "Stock Movement API URL",
            "stock_movement_api_url",
            "stock_movement_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط Payroll API" : "Payroll API URL",
            "payroll_api_url",
            "payroll_api_type",
            "https://..."
          )}

          {renderUrlRow(
            isAr ? "رابط Chart Of Account API" : "Chart Of Account API URL",
            "chart_of_account_api_url",
            "chart_of_account_api_type",
            "https://..."
          )}

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
