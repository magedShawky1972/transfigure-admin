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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronsUpDown, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

const PAYMENT_METHODS = [
  { value: "visa", label: "Visa", labelAr: "فيزا" },
  { value: "master", label: "Master", labelAr: "ماستر" },
  { value: "safi", label: "Safi", labelAr: "صافي" },
  { value: "cash", label: "Cash", labelAr: "نقدي" }
];

interface Department {
  id: string;
  department_name: string;
  department_code: string;
}

interface User {
  id: string;
  user_name: string;
  email: string;
}

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [renewalCycleFilter, setRenewalCycleFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<keyof SoftwareLicense | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(PAYMENT_METHODS.map(pm => pm.value));
  const [openPaymentCombo, setOpenPaymentCombo] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState("");

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
    status: "active",
  });

  useEffect(() => {
    fetchLicenses();
    fetchDepartments();
    fetchUsers();
  }, []);

  useEffect(() => {
    filterAndSortLicenses();
  }, [licenses, searchQuery, statusFilter, categoryFilter, renewalCycleFilter, sortColumn, sortDirection]);

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

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name, department_code")
        .eq("is_active", true)
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_name, email")
        .eq("is_active", true)
        .order("user_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  // Get unique categories from licenses for filter
  const uniqueCategories = Array.from(new Set(licenses.map(l => l.category).filter(Boolean)));

  const filterAndSortLicenses = () => {
    let filtered = [...licenses];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (license) =>
          license.software_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.vendor_provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((license) => license.status === statusFilter);
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((license) => license.category === categoryFilter);
    }

    // Apply renewal cycle filter
    if (renewalCycleFilter !== "all") {
      filtered = filtered.filter((license) => license.renewal_cycle === renewalCycleFilter);
    }

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;

        let comparison = 0;
        if (typeof aValue === "string" && typeof bValue === "string") {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    setFilteredLicenses(filtered);
  };

  const handleSort = (column: keyof SoftwareLicense) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column with ascending direction
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: keyof SoftwareLicense) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 inline" />
    );
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
        status: formData.status,
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
          status: data.status || "active",
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
      status: "active",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      active: "bg-green-500",
      expired: "bg-red-500",
      expiring_soon: "bg-orange-500",
      cancelled: "bg-gray-500",
    };

    const statusLabels: Record<string, { en: string; ar: string }> = {
      active: { en: "Active", ar: "نشط" },
      expired: { en: "Expired", ar: "منتهي" },
      expiring_soon: { en: "Expiring Soon", ar: "ينتهي قريباً" },
      cancelled: { en: "Cancelled", ar: "ملغي" },
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

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "جميع الحالات" : "All Statuses"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
              <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
              <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
              <SelectItem value="expiring_soon">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</SelectItem>
              <SelectItem value="cancelled">{language === "ar" ? "ملغي" : "Cancelled"}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{language === "ar" ? "الفئة" : "Category"}</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "جميع الفئات" : "All Categories"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
              {uniqueCategories.length > 0 ? (
                uniqueCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))
              ) : (
                CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{language === "ar" ? "دورة التجديد" : "Renewal Cycle"}</Label>
          <Select value={renewalCycleFilter} onValueChange={setRenewalCycleFilter}>
            <SelectTrigger>
              <SelectValue placeholder={language === "ar" ? "جميع الدورات" : "All Cycles"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
              {RENEWAL_CYCLES.map((cycle) => (
                <SelectItem key={cycle.value} value={cycle.value}>
                  {language === "ar" ? cycle.labelAr : cycle.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("software_name")}
                  >
                    {language === "ar" ? "اسم البرنامج" : "Software Name"}
                    {getSortIcon("software_name")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("vendor_provider")}
                  >
                    {language === "ar" ? "المورد" : "Vendor"}
                    {getSortIcon("vendor_provider")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("category")}
                  >
                    {language === "ar" ? "الفئة" : "Category"}
                    {getSortIcon("category")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("purchase_date")}
                  >
                    {language === "ar" ? "تاريخ الشراء" : "Purchase Date"}
                    {getSortIcon("purchase_date")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("expiry_date")}
                  >
                    {language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}
                    {getSortIcon("expiry_date")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("renewal_cycle")}
                  >
                    {language === "ar" ? "دورة التجديد" : "Renewal Cycle"}
                    {getSortIcon("renewal_cycle")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("cost")}
                  >
                    {language === "ar" ? "التكلفة" : "Cost"}
                    {getSortIcon("cost")}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("status")}
                  >
                    {language === "ar" ? "الحالة" : "Status"}
                    {getSortIcon("status")}
                  </TableHead>
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

                <div className="space-y-2">
                  <Label htmlFor="status">{language === "ar" ? "الحالة" : "Status"}</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                      <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
                      <SelectItem value="expiring_soon">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</SelectItem>
                      <SelectItem value="cancelled">{language === "ar" ? "ملغي" : "Cancelled"}</SelectItem>
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
                    <Popover open={openPaymentCombo} onOpenChange={setOpenPaymentCombo}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openPaymentCombo}
                          className="w-full justify-between"
                        >
                          {formData.payment_method
                            ? PAYMENT_METHODS.find((pm) => pm.value === formData.payment_method)?.[language === "ar" ? "labelAr" : "label"] || formData.payment_method
                            : language === "ar" ? "اختر طريقة الدفع" : "Select payment method"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-background z-50">
                        <Command>
                          <CommandInput 
                            placeholder={language === "ar" ? "ابحث عن طريقة الدفع..." : "Search payment method..."} 
                            value={newPaymentMethod}
                            onValueChange={setNewPaymentMethod}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <Button
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  if (newPaymentMethod.trim()) {
                                    setPaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                                    setFormData({ ...formData, payment_method: newPaymentMethod.trim() });
                                    setNewPaymentMethod("");
                                    setOpenPaymentCombo(false);
                                  }
                                }}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                {language === "ar" ? `إضافة "${newPaymentMethod}"` : `Add "${newPaymentMethod}"`}
                              </Button>
                            </CommandEmpty>
                            <CommandGroup>
                              {PAYMENT_METHODS.map((pm) => (
                                <CommandItem
                                  key={pm.value}
                                  value={pm.value}
                                  onSelect={(currentValue) => {
                                    setFormData({ ...formData, payment_method: currentValue });
                                    setOpenPaymentCombo(false);
                                    setNewPaymentMethod("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.payment_method === pm.value ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {language === "ar" ? pm.labelAr : pm.label}
                                </CommandItem>
                              ))}
                              {paymentMethods
                                .filter(pm => !PAYMENT_METHODS.some(p => p.value === pm))
                                .map((pm) => (
                                  <CommandItem
                                    key={pm}
                                    value={pm}
                                    onSelect={(currentValue) => {
                                      setFormData({ ...formData, payment_method: currentValue });
                                      setOpenPaymentCombo(false);
                                      setNewPaymentMethod("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        formData.payment_method === pm ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {pm}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned_department">{language === "ar" ? "القسم المعين" : "Assigned Department"}</Label>
                    <Select 
                      value={formData.assigned_department} 
                      onValueChange={(value) => setFormData({ ...formData, assigned_department: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.department_name}>
                            {dept.department_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_to">{language === "ar" ? "معين إلى" : "Assigned To"}</Label>
                  <Select 
                    value={formData.assigned_to} 
                    onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر المستخدم" : "Select user"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.user_name}>
                          {user.user_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {language === "ar" ? "تم رفع الفاتورة" : "Invoice uploaded"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const filePathOrUrl = formData.invoice_file_path;
                            if (!filePathOrUrl) return;

                            // Extract bucket name and file path from URL
                            const match = filePathOrUrl.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
                            
                            if (match) {
                              const [, bucketName, filePath] = match;
                              
                              // Download the file
                              const { data, error } = await supabase.storage
                                .from(bucketName)
                                .download(filePath);

                              if (error) throw error;

                              // Create a blob URL and trigger download
                              const url = URL.createObjectURL(data);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = filePath.split('/').pop() || 'invoice.pdf';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            } else {
                              // Fallback: try to open URL directly
                              window.open(filePathOrUrl, '_blank');
                            }
                          } catch (error: any) {
                            console.error('Error downloading invoice:', error);
                            toast({
                              title: t("common.error"),
                              description: language === "ar" ? "فشل تحميل الفاتورة" : "Failed to download invoice",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {language === "ar" ? "تحميل الفاتورة" : "Download Invoice"}
                      </Button>
                    </div>
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
