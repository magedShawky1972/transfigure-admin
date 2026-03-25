import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Settings, ArrowRightLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";

// Define source table columns
const SOURCE_COLUMNS: Record<string, string[]> = {
  sales_order_header: [
    "order_number", "customer_phone", "customer_name", "order_date", "payment_term",
    "sales_person", "transaction_type", "media", "profit_center", "company",
    "status", "status_description", "customer_ip", "device_fingerprint",
    "transaction_location", "register_user_id", "player_id", "is_point", "point_value"
  ],
  sales_order_line: [
    "order_number", "line_number", "product_sku", "product_id", "quantity",
    "unit_price", "total", "coins_number", "cost_price", "total_cost",
    "point", "player_id", "vendor_name"
  ],
  payment_transactions: [
    "order_number", "payment_method", "payment_brand", "payment_amount",
    "payment_reference", "payment_card_number", "bank_transaction_id",
    "redemption_ip", "payment_location"
  ],
  computed: [
    "customer_name_lookup", "brand_name_lookup", "brand_code_lookup",
    "product_name_lookup", "bank_fee_calc", "profit_calc", "ordernumber_concat",
    "vendor_name_from_brand"
  ],
  fixed: []
};

// Target fields for purpletransaction
const TARGET_FIELDS = [
  "order_number", "ordernumber", "created_at_date", "created_at_date_int", "user_name",
  "customer_phone", "customer_name", "customer_ip", "device_fingerprint",
  "transaction_location", "register_user_id", "player_id",
  "brand_name", "brand_code", "product_name", "product_id",
  "coins_number", "unit_price", "cost_price", "qty", "cost_sold",
  "total", "profit", "payment_method", "payment_type", "payment_brand",
  "payment_reference", "payment_card_number", "bank_fee",
  "company", "status", "status_description", "is_point", "point_value",
  "media", "profit_center", "payment_term", "transaction_type",
  "trans_type", "is_deleted", "is_api_reviewed", "vendor_name",
  "order_status", "sendodoo"
];

// Default mappings based on current edge function logic
const DEFAULT_MAPPINGS = [
  { target_field: "order_number", source_table: "sales_order_header", source_field: "order_number" },
  { target_field: "ordernumber", source_table: "computed", source_field: "ordernumber_concat" },
  { target_field: "created_at_date", source_table: "sales_order_header", source_field: "order_date" },
  { target_field: "user_name", source_table: "sales_order_header", source_field: "sales_person" },
  { target_field: "customer_phone", source_table: "sales_order_header", source_field: "customer_phone" },
  { target_field: "customer_name", source_table: "computed", source_field: "customer_name_lookup" },
  { target_field: "customer_ip", source_table: "sales_order_header", source_field: "customer_ip" },
  { target_field: "device_fingerprint", source_table: "sales_order_header", source_field: "device_fingerprint" },
  { target_field: "transaction_location", source_table: "sales_order_header", source_field: "transaction_location" },
  { target_field: "register_user_id", source_table: "sales_order_header", source_field: "register_user_id" },
  { target_field: "player_id", source_table: "sales_order_header", source_field: "player_id" },
  { target_field: "brand_name", source_table: "computed", source_field: "brand_name_lookup" },
  { target_field: "brand_code", source_table: "computed", source_field: "brand_code_lookup" },
  { target_field: "product_name", source_table: "computed", source_field: "product_name_lookup" },
  { target_field: "product_id", source_table: "sales_order_line", source_field: "product_sku" },
  { target_field: "coins_number", source_table: "sales_order_line", source_field: "coins_number" },
  { target_field: "unit_price", source_table: "sales_order_line", source_field: "unit_price" },
  { target_field: "cost_price", source_table: "sales_order_line", source_field: "cost_price" },
  { target_field: "qty", source_table: "sales_order_line", source_field: "quantity" },
  { target_field: "cost_sold", source_table: "sales_order_line", source_field: "total_cost" },
  { target_field: "total", source_table: "sales_order_line", source_field: "total" },
  { target_field: "profit", source_table: "computed", source_field: "profit_calc" },
  { target_field: "payment_method", source_table: "payment_transactions", source_field: "payment_method" },
  { target_field: "payment_type", source_table: "payment_transactions", source_field: "payment_method" },
  { target_field: "payment_brand", source_table: "payment_transactions", source_field: "payment_brand" },
  { target_field: "payment_reference", source_table: "payment_transactions", source_field: "payment_reference" },
  { target_field: "payment_card_number", source_table: "payment_transactions", source_field: "payment_card_number" },
  { target_field: "bank_fee", source_table: "computed", source_field: "bank_fee_calc" },
  { target_field: "company", source_table: "sales_order_header", source_field: "company" },
  { target_field: "status", source_table: "sales_order_header", source_field: "status" },
  { target_field: "status_description", source_table: "sales_order_header", source_field: "status_description" },
  { target_field: "is_point", source_table: "sales_order_header", source_field: "is_point" },
  { target_field: "point_value", source_table: "sales_order_header", source_field: "point_value" },
  { target_field: "media", source_table: "sales_order_header", source_field: "media" },
  { target_field: "profit_center", source_table: "sales_order_header", source_field: "profit_center" },
  { target_field: "payment_term", source_table: "sales_order_header", source_field: "payment_term" },
  { target_field: "transaction_type", source_table: "sales_order_header", source_field: "transaction_type" },
  { target_field: "trans_type", source_table: "fixed", source_field: "automatic" },
  { target_field: "is_deleted", source_table: "fixed", source_field: "false" },
  { target_field: "is_api_reviewed", source_table: "fixed", source_field: "false" },
];

interface MappingRow {
  id?: string;
  target_field: string;
  source_table: string;
  source_field: string;
  is_active: boolean;
  display_order: number;
}

interface IntegrationSettings {
  trigger_mode: string;
  schedule_interval_minutes: number;
  is_enabled: boolean;
  start_date: string;
}

const SOURCE_TABLE_LABELS: Record<string, { en: string; ar: string }> = {
  sales_order_header: { en: "Sales Header", ar: "رأس أمر البيع" },
  sales_order_line: { en: "Sales Line", ar: "بند أمر البيع" },
  payment_transactions: { en: "Payment", ar: "الدفع" },
  computed: { en: "Computed", ar: "محسوب" },
  fixed: { en: "Fixed Value", ar: "قيمة ثابتة" },
};

const ApiTransactionMapping = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [settings, setSettings] = useState<IntegrationSettings>({
    trigger_mode: "scheduled",
    schedule_interval_minutes: 60,
    is_enabled: false,
    start_date: "2025-03-11",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchMappings();
    fetchSettings();
  }, []);

  const fetchMappings = async () => {
    const { data, error } = await supabase
      .from("api_transaction_mapping" as any)
      .select("*")
      .order("display_order");

    if (error) {
      console.error("Error fetching mappings:", error);
      // If no data, seed with defaults
      setMappings(DEFAULT_MAPPINGS.map((m, i) => ({
        ...m,
        is_active: true,
        display_order: i,
      })));
    } else if (!data || (data as any[]).length === 0) {
      // Seed defaults
      setMappings(DEFAULT_MAPPINGS.map((m, i) => ({
        ...m,
        is_active: true,
        display_order: i,
      })));
    } else {
      setMappings((data as any[]).map((d: any) => ({
        id: d.id,
        target_field: d.target_field,
        source_table: d.source_table,
        source_field: d.source_field,
        is_active: d.is_active,
        display_order: d.display_order,
      })));
    }
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("api_integration_settings")
      .select("*");

    if (data && data.length > 0) {
      const triggerMode = data.find((d: any) => d.setting_key === "trigger_mode");
      const interval = data.find((d: any) => d.setting_key === "schedule_interval_minutes");
      const enabled = data.find((d: any) => d.setting_key === "is_enabled");
      const startDate = data.find((d: any) => d.setting_key === "start_date");

      setSettings({
        trigger_mode: triggerMode?.setting_value || "scheduled",
        schedule_interval_minutes: parseInt(interval?.setting_value || "60"),
        is_enabled: enabled?.setting_value === "true",
        start_date: startDate?.setting_value || "2025-03-11",
      });
    }
  };

  const handleMappingChange = (index: number, field: string, value: any) => {
    setMappings(prev => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      // Reset source_field when source_table changes
      if (field === "source_table") {
        updated[index].source_field = "";
      }
      return updated;
    });
  };

  const handleSaveMappings = async () => {
    setSaving(true);
    try {
      // Delete existing mappings
      await supabase.from("api_transaction_mapping" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert all mappings
      const rows = mappings.map((m, i) => ({
        target_field: m.target_field,
        source_table: m.source_table,
        source_field: m.source_field,
        is_active: m.is_active,
        display_order: i,
      }));

      const { error } = await supabase.from("api_transaction_mapping" as any).insert(rows);

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم حفظ خريطة الحقول بنجاح" : "Field mappings saved successfully",
      });

      fetchMappings();
    } catch (err: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const settingsToSave = [
        { setting_key: "trigger_mode", setting_value: settings.trigger_mode },
        { setting_key: "schedule_interval_minutes", setting_value: String(settings.schedule_interval_minutes) },
        { setting_key: "is_enabled", setting_value: String(settings.is_enabled) },
        { setting_key: "start_date", setting_value: settings.start_date },
      ];

      for (const s of settingsToSave) {
        await supabase
          .from("api_integration_settings")
          .upsert(
            { setting_key: s.setting_key, setting_value: s.setting_value, updated_at: new Date().toISOString() },
            { onConflict: "setting_key" }
          );
      }

      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم حفظ إعدادات التكامل" : "Integration settings saved",
      });
    } catch (err: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setSavingSettings(false);
  };

  const addMapping = () => {
    setMappings(prev => [
      ...prev,
      {
        target_field: "",
        source_table: "fixed",
        source_field: "",
        is_active: true,
        display_order: prev.length,
      },
    ]);
  };

  const removeMapping = (index: number) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };

  const targetFieldOptions = useMemo(() => {
    return [...TARGET_FIELDS].sort((a, b) => a.localeCompare(b));
  }, []);

  if (accessLoading) return null;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <h1 className="text-2xl font-bold text-foreground">
        {language === "ar" ? "إعداد خريطة حقول المعاملات" : "Transaction Field Mapping"}
      </h1>

      {/* Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {language === "ar" ? "إعدادات التكامل" : "Integration Settings"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label>{language === "ar" ? "وضع التشغيل" : "Trigger Mode"}</Label>
              <Select
                value={settings.trigger_mode}
                onValueChange={(v) => setSettings(prev => ({ ...prev, trigger_mode: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_transaction">
                    {language === "ar" ? "لكل معاملة" : "Per Transaction"}
                  </SelectItem>
                  <SelectItem value="scheduled">
                    {language === "ar" ? "مجدول" : "Scheduled"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.trigger_mode === "scheduled" && (
              <div>
                <Label>{language === "ar" ? "الفاصل الزمني (دقائق)" : "Interval (minutes)"}</Label>
                <Input
                  type="number"
                  min={5}
                  value={settings.schedule_interval_minutes}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      schedule_interval_minutes: parseInt(e.target.value) || 60,
                    }))
                  }
                />
              </div>
            )}

            <div>
              <Label>{language === "ar" ? "تاريخ البدء" : "Start Date"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {settings.start_date}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={settings.start_date ? new Date(settings.start_date) : undefined}
                    onSelect={(d) => d && setSettings(prev => ({ ...prev, start_date: format(d, "yyyy-MM-dd") }))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.is_enabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, is_enabled: v }))}
                />
                <Label>{language === "ar" ? "مفعل" : "Enabled"}</Label>
              </div>
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="mr-1">{language === "ar" ? "حفظ" : "Save"}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {language === "ar" ? "خريطة الحقول" : "Field Mappings"}
              <Badge variant="secondary">{mappings.length}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addMapping}>
                <Plus className="h-4 w-4 mr-1" />
                {language === "ar" ? "إضافة" : "Add"}
              </Button>
              <Button onClick={handleSaveMappings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {language === "ar" ? "حفظ الكل" : "Save All"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>{language === "ar" ? "الحقل المستهدف (purpletransaction)" : "Target Field (purpletransaction)"}</TableHead>
                    <TableHead>{language === "ar" ? "جدول المصدر" : "Source Table"}</TableHead>
                    <TableHead>{language === "ar" ? "حقل المصدر" : "Source Field"}</TableHead>
                    <TableHead className="w-[80px]">{language === "ar" ? "مفعل" : "Active"}</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping, index) => (
                    <TableRow key={index} className={!mapping.is_active ? "opacity-50" : ""}>
                      <TableCell className="text-muted-foreground text-sm">{index + 1}</TableCell>
                      <TableCell>
                        {mapping.target_field ? (
                          <span className="font-mono text-sm">{mapping.target_field}</span>
                        ) : (
                          <Select
                            value={mapping.target_field}
                            onValueChange={(v) => handleMappingChange(index, "target_field", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder={language === "ar" ? "اختر الحقل" : "Select field"} />
                            </SelectTrigger>
                            <SelectContent>
                              {targetFieldOptions.map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.source_table}
                          onValueChange={(v) => handleMappingChange(index, "source_table", v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SOURCE_TABLE_LABELS).map(([key, labels]) => (
                              <SelectItem key={key} value={key}>
                                {language === "ar" ? labels.ar : labels.en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {mapping.source_table === "fixed" ? (
                          <Input
                            className="h-8"
                            value={mapping.source_field}
                            onChange={(e) => handleMappingChange(index, "source_field", e.target.value)}
                            placeholder={language === "ar" ? "قيمة ثابتة" : "Fixed value"}
                          />
                        ) : (
                          <Select
                            value={mapping.source_field}
                            onValueChange={(v) => handleMappingChange(index, "source_field", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder={language === "ar" ? "اختر" : "Select"} />
                            </SelectTrigger>
                            <SelectContent>
                              {(SOURCE_COLUMNS[mapping.source_table] || []).map(col => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={mapping.is_active}
                          onCheckedChange={(v) => handleMappingChange(index, "is_active", v)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeMapping(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiTransactionMapping;
