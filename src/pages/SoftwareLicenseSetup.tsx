import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Upload } from "lucide-react";

const CATEGORIES = [
  "ERP",
  "Dev Tools",
  "Cloud Services",
  "Security",
  "Productivity",
  "Design",
  "Communication",
  "Analytics",
  "Other"
];

const RENEWAL_CYCLES = [
  { value: "monthly", label: "Monthly", labelAr: "شهرياً" },
  { value: "yearly", label: "Yearly", labelAr: "سنوياً" },
  { value: "one-time", label: "One-time", labelAr: "لمرة واحدة" }
];

const SoftwareLicenseSetup = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const licenseId = searchParams.get("id");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    software_name: "",
    version: "",
    license_key: "",
    vendor_provider: "",
    vendor_portal_url: "",
    category: "",
    purchase_date: "",
    expiry_date: "",
    renewal_cycle: "yearly",
    notification_days: [7, 30],
    cost: "",
    payment_method: "",
    assigned_to: "",
    assigned_department: "",
    invoice_file_path: "",
    notes: "",
  });

  useEffect(() => {
    if (licenseId) {
      fetchLicense();
    }
  }, [licenseId]);

  const fetchLicense = async () => {
    try {
      const { data, error } = await supabase
        .from("software_licenses")
        .select("*")
        .eq("id", licenseId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          software_name: data.software_name || "",
          version: data.version || "",
          license_key: data.license_key || "",
          vendor_provider: data.vendor_provider || "",
          vendor_portal_url: data.vendor_portal_url || "",
          category: data.category || "",
          purchase_date: data.purchase_date || "",
          expiry_date: data.expiry_date || "",
          renewal_cycle: data.renewal_cycle || "yearly",
          notification_days: data.notification_days || [7, 30],
          cost: data.cost?.toString() || "",
          payment_method: data.payment_method || "",
          assigned_to: data.assigned_to || "",
          assigned_department: data.assigned_department || "",
          invoice_file_path: data.invoice_file_path || "",
          notes: data.notes || "",
        });
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `license-invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setFormData({ ...formData, invoice_file_path: filePath });
      toast({
        title: t("common.success"),
        description: language === "ar" ? "تم رفع الملف بنجاح" : "File uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const dataToSubmit = {
        software_name: formData.software_name,
        version: formData.version || null,
        license_key: formData.license_key || null,
        vendor_provider: formData.vendor_provider,
        vendor_portal_url: formData.vendor_portal_url || null,
        category: formData.category,
        purchase_date: formData.purchase_date,
        expiry_date: formData.expiry_date || null,
        renewal_cycle: formData.renewal_cycle,
        notification_days: formData.notification_days,
        cost: parseFloat(formData.cost) || 0,
        payment_method: formData.payment_method || null,
        assigned_to: formData.assigned_to || null,
        assigned_department: formData.assigned_department || null,
        invoice_file_path: formData.invoice_file_path || null,
        notes: formData.notes || null,
        updated_by: user.id,
      };

      if (licenseId) {
        const { error } = await supabase
          .from("software_licenses")
          .update(dataToSubmit)
          .eq("id", licenseId);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: language === "ar" ? "تم تحديث الترخيص بنجاح" : "License updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("software_licenses")
          .insert({ ...dataToSubmit, created_by: user.id });

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: language === "ar" ? "تم إضافة الترخيص بنجاح" : "License added successfully",
        });
      }

      navigate("/software-licenses");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate("/software-licenses")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === "ar" ? "رجوع" : "Back"}
        </Button>
        <h1 className="text-3xl font-bold">
          {licenseId
            ? language === "ar" ? "تعديل الترخيص" : "Edit License"
            : language === "ar" ? "إضافة ترخيص جديد" : "Add New License"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "معلومات أساسية" : "Basic Information"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="software_name">{language === "ar" ? "اسم البرنامج" : "Software Name"} *</Label>
                <Input
                  id="software_name"
                  value={formData.software_name}
                  onChange={(e) => setFormData({ ...formData, software_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">{language === "ar" ? "الإصدار" : "Version"}</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="license_key">{language === "ar" ? "مفتاح الترخيص / معرف الاشتراك" : "License Key / Subscription ID"}</Label>
              <Input
                id="license_key"
                value={formData.license_key}
                onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vendor_provider">{language === "ar" ? "المورد / المزود" : "Vendor / Provider"} *</Label>
                <Input
                  id="vendor_provider"
                  value={formData.vendor_provider}
                  onChange={(e) => setFormData({ ...formData, vendor_provider: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor_portal_url">{language === "ar" ? "رابط بوابة المورد" : "Vendor Portal URL"}</Label>
                <Input
                  id="vendor_portal_url"
                  type="url"
                  value={formData.vendor_portal_url}
                  onChange={(e) => setFormData({ ...formData, vendor_portal_url: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{language === "ar" ? "الفئة" : "Category"} *</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر الفئة" : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "تواريخ ودورة التجديد" : "Dates & Renewal Cycle"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchase_date">{language === "ar" ? "تاريخ الشراء" : "Purchase Date"} *</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiry_date">{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="renewal_cycle">{language === "ar" ? "دورة التجديد" : "Renewal Cycle"} *</Label>
              <Select value={formData.renewal_cycle} onValueChange={(value) => setFormData({ ...formData, renewal_cycle: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENEWAL_CYCLES.map((cycle) => (
                    <SelectItem key={cycle.value} value={cycle.value}>
                      {language === "ar" ? cycle.labelAr : cycle.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "التكلفة والتخصيص" : "Cost & Assignment"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">{language === "ar" ? "التكلفة" : "Cost"} *</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment_method">{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                <Input
                  id="payment_method"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assigned_to">{language === "ar" ? "المخصص لـ (مستخدم)" : "Assigned To (User)"}</Label>
                <Input
                  id="assigned_to"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_department">{language === "ar" ? "المخصص لـ (قسم)" : "Assigned Department"}</Label>
                <Input
                  id="assigned_department"
                  value={formData.assigned_department}
                  onChange={(e) => setFormData({ ...formData, assigned_department: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "مرفقات وملاحظات" : "Attachments & Notes"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_file">{language === "ar" ? "رفع الفاتورة/العقد" : "Upload Invoice/Contract"}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="invoice_file"
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                {uploading && <span className="text-sm text-muted-foreground">{language === "ar" ? "جاري الرفع..." : "Uploading..."}</span>}
              </div>
              {formData.invoice_file_path && (
                <p className="text-sm text-muted-foreground">{language === "ar" ? "تم رفع الملف" : "File uploaded"}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{language === "ar" ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : (language === "ar" ? "حفظ" : "Save")}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/software-licenses")}>
            {language === "ar" ? "إلغاء" : "Cancel"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SoftwareLicenseSetup;
