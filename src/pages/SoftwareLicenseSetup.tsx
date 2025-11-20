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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

interface SoftwareLicense {
  id: string;
  software_name: string;
  version: string | null;
  license_key: string | null;
  vendor_provider: string;
  category: string;
  purchase_date: string;
  expiry_date: string | null;
  renewal_cycle: string;
  cost: number;
  status: string;
  assigned_to: string | null;
  assigned_department: string | null;
}

const SoftwareLicenseSetup = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [filteredLicenses, setFilteredLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);

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
    fetchLicenses();
  }, []);

  useEffect(() => {
    filterLicenses();
  }, [licenses, searchQuery]);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("software_licenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
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

  const filterLicenses = () => {
    if (!searchQuery) {
      setFilteredLicenses(licenses);
      return;
    }

    const filtered = licenses.filter(
      (license) =>
        license.software_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        license.vendor_provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        license.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLicenses(filtered);
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

      const { data: { publicUrl } } = supabase.storage
        .from("ticket-attachments")
        .getPublicUrl(filePath);

      setFormData({ ...formData, invoice_file_path: publicUrl });

      toast({
        title: language === "ar" ? "تم الرفع بنجاح" : "Upload successful",
        description: language === "ar" ? "تم رفع الفاتورة بنجاح" : "Invoice uploaded successfully",
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
      if (!user) throw new Error("User not authenticated");

      const licenseData = {
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

      if (editingLicenseId) {
        const { error } = await supabase
          .from("software_licenses")
          .update(licenseData)
          .eq("id", editingLicenseId);

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم التحديث" : "Updated",
          description: language === "ar" ? "تم تحديث الترخيص بنجاح" : "License updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("software_licenses")
          .insert([{ ...licenseData, created_by: user.id }]);

        if (error) throw error;

        toast({
          title: language === "ar" ? "تم الحفظ" : "Saved",
          description: language === "ar" ? "تم إضافة الترخيص بنجاح" : "License added successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchLicenses();
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

  const handleEdit = async (licenseId: string) => {
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
        setEditingLicenseId(licenseId);
        setIsDialogOpen(true);
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (licenseId: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذا الترخيص؟" : "Are you sure you want to delete this license?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("software_licenses")
        .delete()
        .eq("id", licenseId);

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف الترخيص بنجاح" : "License deleted successfully",
      });

      fetchLicenses();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    resetForm();
    setEditingLicenseId(null);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
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
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: "bg-green-500",
      expired: "bg-red-500",
      expiring_soon: "bg-orange-500",
    };

    const statusLabels: Record<string, { en: string; ar: string }> = {
      active: { en: "Active", ar: "نشط" },
      expired: { en: "Expired", ar: "منتهي" },
      expiring_soon: { en: "Expiring Soon", ar: "ينتهي قريباً" },
    };

    return (
      <Badge className={statusColors[status]}>
        {language === "ar" ? statusLabels[status]?.ar : statusLabels[status]?.en}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {language === "ar" ? "إدخال الترخيص" : "License Entry"}
        </h1>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة ترخيص جديد" : "Add New License"}
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "ar" ? "بحث..." : "Search..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "اسم البرنامج" : "Software Name"}</TableHead>
                  <TableHead>{language === "ar" ? "المورد" : "Vendor"}</TableHead>
                  <TableHead>{language === "ar" ? "الفئة" : "Category"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ الشراء" : "Purchase Date"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</TableHead>
                  <TableHead>{language === "ar" ? "دورة التجديد" : "Renewal Cycle"}</TableHead>
                  <TableHead>{language === "ar" ? "التكلفة" : "Cost"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      {language === "ar" ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredLicenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      {language === "ar" ? "لا توجد تراخيص" : "No licenses found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLicenses.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell className="font-medium">{license.software_name}</TableCell>
                      <TableCell>{license.vendor_provider}</TableCell>
                      <TableCell>{license.category}</TableCell>
                      <TableCell>{format(new Date(license.purchase_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        {license.expiry_date ? format(new Date(license.expiry_date), "yyyy-MM-dd") : "-"}
                      </TableCell>
                      <TableCell>
                        {RENEWAL_CYCLES.find(rc => rc.value === license.renewal_cycle)?.[language === "ar" ? "labelAr" : "label"]}
                      </TableCell>
                      <TableCell>${license.cost.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(license.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(license.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(license.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLicenseId
                ? language === "ar" ? "تعديل الترخيص" : "Edit License"
                : language === "ar" ? "إضافة ترخيص جديد" : "Add New License"}
            </DialogTitle>
          </DialogHeader>

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
                <CardTitle>{language === "ar" ? "معلومات الترخيص" : "License Information"}</CardTitle>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment_method">{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                    <Input
                      id="payment_method"
                      value={formData.payment_method}
                      onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_department">{language === "ar" ? "القسم المعين" : "Assigned Department"}</Label>
                    <Input
                      id="assigned_department"
                      value={formData.assigned_department}
                      onChange={(e) => setFormData({ ...formData, assigned_department: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_to">{language === "ar" ? "معين إلى" : "Assigned To"}</Label>
                  <Input
                    id="assigned_to"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "معلومات إضافية" : "Additional Information"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_upload">{language === "ar" ? "رفع الفاتورة" : "Upload Invoice"}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="invoice_upload"
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    {uploading && <span className="text-sm">{language === "ar" ? "جاري الرفع..." : "Uploading..."}</span>}
                  </div>
                  {formData.invoice_file_path && (
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "تم رفع الفاتورة" : "Invoice uploaded"}
                    </p>
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

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? language === "ar" ? "جاري الحفظ..." : "Saving..."
                  : language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SoftwareLicenseSetup;
