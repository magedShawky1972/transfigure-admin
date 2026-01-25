import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, AlertCircle, ArrowUpDown, FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  assigned_to: string | null;
  assigned_department: string | null;
  cost: number;
  status: string;
  invoice_file_path: string | null;
  currency_id: string | null;
  notes: string | null;
  project_id: string | null;
  cost_center_id: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface CostCenter {
  id: string;
  cost_center_name: string;
}

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
  is_base: boolean;
}

interface CurrencyRate {
  currency_id: string;
  rate_to_base: number;
}

interface Department {
  id: string;
  department_name: string;
}

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SoftwareLicenses = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [filteredLicenses, setFilteredLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("expiry_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Currency | null>(null);

  // Dashboard stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    expiringSoon: 0,
    monthlyCost: 0,
    annualCost: 0,
    invoiceTotalSAR: 0,
  });

  // Additional data
  const [projects, setProjects] = useState<Project[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [invoiceTotals, setInvoiceTotals] = useState<Record<string, number>>({});

  // Renewal dialog state
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewStep, setRenewStep] = useState<1 | 2>(1);
  const [selectedLicense, setSelectedLicense] = useState<SoftwareLicense | null>(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [renewAmount, setRenewAmount] = useState(0);
  const [renewNotes, setRenewNotes] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);

  useEffect(() => {
    fetchLicenses();
    fetchCurrencies();
    fetchDepartments();
    fetchProjects();
    fetchCostCenters();
  }, []);

  useEffect(() => {
    filterAndSortLicenses();
  }, [licenses, searchQuery, statusFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    calculateStats();
  }, [licenses, currencies, currencyRates, baseCurrency, invoiceTotals]);

  const fetchLicenses = async (skipAutoUpdate = false) => {
    setLoading(true);
    try {
      if (!skipAutoUpdate) {
        await supabase.rpc("update_software_license_status");
      }

      const { data, error } = await supabase
        .from("software_licenses")
        .select("*")
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      setLicenses(data || []);
      
      // Fetch invoice totals for all licenses
      if (data && data.length > 0) {
        const licenseIds = data.map(l => l.id);
        const { data: invoices, error: invoiceError } = await supabase
          .from("software_license_invoices")
          .select("license_id, cost_sar")
          .in("license_id", licenseIds)
          .eq("ai_extraction_status", "completed");

        if (!invoiceError && invoices) {
          const totalsMap: Record<string, number> = {};
          invoices.forEach(inv => {
            if (inv.license_id && inv.cost_sar) {
              totalsMap[inv.license_id] = (totalsMap[inv.license_id] || 0) + Number(inv.cost_sar);
            }
          });
          setInvoiceTotals(totalsMap);
        }
      }
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

  const fetchCurrencies = async () => {
    try {
      const { data: currenciesData, error: currenciesError } = await supabase
        .from("currencies")
        .select("id, currency_code, currency_name, is_base")
        .eq("is_active", true);

      if (currenciesError) throw currenciesError;
      setCurrencies(currenciesData || []);

      const base = currenciesData?.find(c => c.is_base);
      setBaseCurrency(base || null);

      const { data: ratesData, error: ratesError } = await supabase
        .from("currency_rates")
        .select("currency_id, rate_to_base")
        .order("effective_date", { ascending: false });

      if (ratesError) throw ratesError;

      // Get latest rate for each currency
      const latestRates: CurrencyRate[] = [];
      const seen = new Set<string>();
      for (const rate of ratesData || []) {
        if (!seen.has(rate.currency_id)) {
          latestRates.push(rate);
          seen.add(rate.currency_id);
        }
      }
      setCurrencyRates(latestRates);
    } catch (error: any) {
      console.error("Error fetching currencies:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id, department_name")
        .eq("is_active", true)
        .order("department_name");

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
    }
  };

  const fetchCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, cost_center_name")
        .eq("is_active", true)
        .order("cost_center_name");

      if (error) throw error;
      setCostCenters(data || []);
    } catch (error: any) {
      console.error("Error fetching cost centers:", error);
    }
  };

  const openRenewDialog = (license: SoftwareLicense) => {
    setSelectedLicense(license);
    setRenewStep(1);
    setRenewMonths(1);
    const monthlyCost = license.renewal_cycle === "monthly" ? license.cost : license.cost / 12;
    setRenewAmount(monthlyCost);
    setRenewNotes("");
    setSelectedDepartment("");
    setRenewDialogOpen(true);
  };

  const calculateRenewalAmount = (months: number) => {
    if (!selectedLicense) return 0;
    const monthlyCost = selectedLicense.renewal_cycle === "monthly" 
      ? selectedLicense.cost 
      : selectedLicense.cost / 12;
    return monthlyCost * months;
  };

  const handleMonthsChange = (months: number) => {
    setRenewMonths(months);
    setRenewAmount(calculateRenewalAmount(months));
  };

  const handleRenewSubmit = async () => {
    if (!selectedLicense || !selectedDepartment) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(language === "ar" ? "غير مصرح" : "Not authenticated");

      const currencyCode = currencies.find(c => c.id === selectedLicense.currency_id)?.currency_code || "";
      
      const subject = language === "ar"
        ? `طلب تجديد ${selectedLicense.software_name}`
        : `Renewal Request for ${selectedLicense.software_name}`;
      
      const description = language === "ar"
        ? `طلب تجديد الاشتراك/الترخيص:

البرنامج: ${selectedLicense.software_name}
المورد: ${selectedLicense.vendor_provider}
عدد الأشهر: ${renewMonths}
المبلغ المطلوب: ${formatNumber(renewAmount)} ${currencyCode}

${renewNotes ? `ملاحظات إضافية:\n${renewNotes}` : ""}`
        : `Subscription/License renewal request:

Software: ${selectedLicense.software_name}
Vendor: ${selectedLicense.vendor_provider}
Months: ${renewMonths}
Amount Required: ${formatNumber(renewAmount)} ${currencyCode}

${renewNotes ? `Additional Notes:\n${renewNotes}` : ""}`;

      // Create purchase ticket
      const { data: ticketData, error } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          department_id: selectedDepartment,
          subject,
          description,
          priority: "Medium",
          is_purchase_ticket: true,
          ticket_number: "",
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification to first level regular admins (not purchase admins)
      if (ticketData) {
        await supabase.functions.invoke("send-ticket-notification", {
          body: {
            type: "ticket_created",
            ticketId: ticketData.id,
            adminOrder: 1,
            isPurchasePhase: false,
          },
        });
      }

      toast({
        title: language === "ar" ? "نجح" : "Success",
        description: language === "ar" ? "تم إنشاء طلب التجديد بنجاح" : "Renewal request created successfully",
      });

      setRenewDialogOpen(false);
      setSelectedLicense(null);
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertToBaseCurrency = (cost: number, currencyId: string | null): number => {
    if (!currencyId || !baseCurrency) return cost;
    if (currencyId === baseCurrency.id) return cost;

    const rate = currencyRates.find(r => r.currency_id === currencyId);
    if (rate && rate.rate_to_base > 0) {
      // Use conversion_operator to determine operation
      const operator = (rate as any).conversion_operator || 'multiply';
      if (operator === 'multiply') {
        return cost * rate.rate_to_base;
      } else {
        return cost / rate.rate_to_base;
      }
    }
    return cost;
  };

  const filterAndSortLicenses = () => {
    let filtered = [...licenses];

    // By default (when "all" is selected), exclude canceled licenses
    // Only show canceled when explicitly filtered by "canceled"
    if (statusFilter === "all") {
      filtered = filtered.filter((license) => license.status !== "canceled");
    } else if (statusFilter !== "all") {
      filtered = filtered.filter((license) => license.status === statusFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (license) =>
          license.software_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.vendor_provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.license_key?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((license) => license.category === categoryFilter);
    }

    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof SoftwareLicense];
      let bValue: any = b[sortBy as keyof SoftwareLicense];

      if (sortBy === "cost") {
        aValue = Number(aValue);
        bValue = Number(bValue);
      }

      if (aValue === null) return 1;
      if (bValue === null) return -1;

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredLicenses(filtered);
  };

  const calculateStats = () => {
    // Exclude canceled licenses from all stats
    const nonCanceledLicenses = licenses.filter((l) => l.status !== "canceled");
    const total = nonCanceledLicenses.length;
    const active = nonCanceledLicenses.filter((l) => l.status === "active").length;
    const expired = nonCanceledLicenses.filter((l) => l.status === "expired").length;
    const expiringSoon = nonCanceledLicenses.filter((l) => l.status === "expiring_soon").length;

    const monthlyCost = nonCanceledLicenses
      .filter((l) => l.renewal_cycle === "monthly")
      .reduce((sum, l) => sum + convertToBaseCurrency(Number(l.cost), l.currency_id), 0);

    const annualCost = nonCanceledLicenses.reduce((sum, l) => {
      const baseCost = convertToBaseCurrency(Number(l.cost), l.currency_id);
      if (l.renewal_cycle === "monthly") return sum + baseCost * 12;
      if (l.renewal_cycle === "yearly") return sum + baseCost;
      return sum;
    }, 0);

    // Only sum invoice totals for non-canceled licenses
    const nonCanceledIds = new Set(nonCanceledLicenses.map(l => l.id));
    const invoiceTotalSAR = Object.entries(invoiceTotals)
      .filter(([id]) => nonCanceledIds.has(id))
      .reduce((sum, [, val]) => sum + val, 0);

    setStats({ total, active, expired, expiringSoon, monthlyCost, annualCost, invoiceTotalSAR });
  };

  const getStatusBadge = (status: string) => {
    if (status === "expired") {
      return <Badge variant="destructive">{language === "ar" ? "منتهي" : "Expired"}</Badge>;
    }
    if (status === "expiring_soon") {
      return <Badge className="bg-orange-500">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</Badge>;
    }
    if (status === "canceled") {
      return <Badge variant="destructive" className="bg-gray-500">{language === "ar" ? "ملغي" : "Canceled"}</Badge>;
    }
    return <Badge className="bg-green-500">{language === "ar" ? "نشط" : "Active"}</Badge>;
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من حذف هذا الترخيص؟" : "Are you sure you want to delete this license?")) return;

    try {
      const { error } = await supabase
        .from("software_licenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: t("common.success"),
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

  const handleStatusChange = async (licenseId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("software_licenses")
        .update({ status: newStatus })
        .eq("id", licenseId);

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم التحديث" : "Updated",
        description: language === "ar" ? "تم تغيير الحالة بنجاح" : "Status changed successfully",
      });
      
      setEditingStatusId(null);
      fetchLicenses(true); // Skip auto-update to preserve manual status change
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewInvoice = async (filePathOrUrl: string) => {
    try {
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
  };

  const categories = Array.from(new Set(licenses.map((l) => l.category).filter(cat => cat && cat.trim() !== '')));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center">
        <h1 className="text-3xl font-bold text-foreground">
          {language === "ar" ? "لوحة البرامج والاشتراكات" : "Software & Subscription Dashboard"}
        </h1>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "إجمالي البرامج" : "Total Software"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "نشط" : "Active"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "منتهي" : "Expired"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "التكلفة الشهرية" : "Monthly Cost"}
              {baseCurrency && <span className="text-xs ml-1">({baseCurrency.currency_code})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.monthlyCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "التكلفة السنوية" : "Annual Cost"}
              {baseCurrency && <span className="text-xs ml-1">({baseCurrency.currency_code})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.annualCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "إجمالي الفواتير" : "Invoice Total"}
              <span className="text-xs ml-1">(SAR)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatNumber(stats.invoiceTotalSAR)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Banner */}
      {stats.expiringSoon > 0 && (
        <Card className="border-orange-500 bg-orange-50">
          <CardContent className="flex items-center gap-2 p-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <p className="text-sm font-medium text-orange-800">
              {language === "ar" 
                ? `تحذير: ${stats.expiringSoon} ترخيص سينتهي خلال 30 يوماً`
                : `Alert: ${stats.expiringSoon} license(s) expiring within 30 days`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "ar" ? "بحث..." : "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={language === "ar" ? "الحالة" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
            <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
            <SelectItem value="expiring_soon">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</SelectItem>
            <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
            <SelectItem value="canceled">{language === "ar" ? "ملغي" : "Canceled"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={language === "ar" ? "الفئة" : "Category"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="software_name">{language === "ar" ? "الاسم" : "Name"}</SelectItem>
            <SelectItem value="expiry_date">{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</SelectItem>
            <SelectItem value="cost">{language === "ar" ? "التكلفة" : "Cost"}</SelectItem>
            <SelectItem value="vendor_provider">{language === "ar" ? "المورد" : "Vendor"}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
          <ArrowUpDown className="h-4 w-4 mr-2" />
          {sortOrder === "asc" ? (language === "ar" ? "تصاعدي" : "Asc") : (language === "ar" ? "تنازلي" : "Desc")}
        </Button>
      </div>

      {/* Grid View */}
      {loading ? (
        <div className="text-center py-12">
          {language === "ar" ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : filteredLicenses.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {language === "ar" ? "لا توجد تراخيص" : "No licenses found"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLicenses.map((license) => (
            <Card key={license.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{license.software_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{license.vendor_provider}</p>
                  </div>
                  {editingStatusId === license.id ? (
                    <Select
                      value={license.status}
                      onValueChange={(value) => handleStatusChange(license.id, value)}
                      onOpenChange={(open) => {
                        if (!open) setEditingStatusId(null);
                      }}
                      defaultOpen
                    >
                      <SelectTrigger className="w-[140px] h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="active">
                          {language === "ar" ? "نشط" : "Active"}
                        </SelectItem>
                        <SelectItem value="expired">
                          {language === "ar" ? "منتهي" : "Expired"}
                        </SelectItem>
                        <SelectItem value="expiring_soon">
                          {language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}
                        </SelectItem>
                        <SelectItem value="canceled">
                          {language === "ar" ? "ملغي" : "Canceled"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div onClick={() => setEditingStatusId(license.id)} className="cursor-pointer">
                      {getStatusBadge(license.status)}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "الفئة:" : "Category:"}</span>
                    <span className="font-medium">{license.category}</span>
                  </div>
                  {license.license_key && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "المفتاح:" : "Key:"}</span>
                      <span className="font-mono text-xs truncate max-w-[150px]" title={license.license_key}>
                        {license.license_key}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "الشراء:" : "Purchase:"}</span>
                    <span>{format(new Date(license.purchase_date), "yyyy-MM-dd")}</span>
                  </div>
                  {license.expiry_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "الانتهاء:" : "Expiry:"}</span>
                      <span>{format(new Date(license.expiry_date), "yyyy-MM-dd")}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "التجديد:" : "Renewal:"}</span>
                    <span className="capitalize">{license.renewal_cycle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "العملة:" : "Currency:"}</span>
                    <span className="font-medium">{currencies.find(c => c.id === license.currency_id)?.currency_code || (language === "ar" ? "غير محدد" : "Not set")}</span>
                  </div>
                  {license.project_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "المشروع:" : "Project:"}</span>
                      <span className="truncate max-w-[150px] font-medium" title={projects.find(p => p.id === license.project_id)?.name || ""}>
                        {projects.find(p => p.id === license.project_id)?.name || "-"}
                      </span>
                    </div>
                  )}
                  {license.cost_center_id && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "مركز التكلفة:" : "Cost Center:"}</span>
                      <span className="truncate max-w-[150px] font-medium" title={costCenters.find(c => c.id === license.cost_center_id)?.cost_center_name || ""}>
                        {costCenters.find(c => c.id === license.cost_center_id)?.cost_center_name || "-"}
                      </span>
                    </div>
                  )}
                  {(license.assigned_to || license.assigned_department) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === "ar" ? "مخصص لـ:" : "Assigned:"}</span>
                      <span className="truncate max-w-[150px]" title={license.assigned_to || license.assigned_department || ""}>
                        {license.assigned_to || license.assigned_department}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground">{language === "ar" ? "التكلفة:" : "Cost:"}</span>
                    <span className="text-lg font-bold">
                      {formatNumber(Number(license.cost))} {currencies.find(c => c.id === license.currency_id)?.currency_code || ''}
                    </span>
                  </div>
                  {license.currency_id && baseCurrency && license.currency_id !== baseCurrency.id && (
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{language === "ar" ? "بالعملة الأساسية:" : "In base currency:"}</span>
                      <span>{formatNumber(convertToBaseCurrency(Number(license.cost), license.currency_id))} {baseCurrency.currency_code}</span>
                    </div>
                  )}
                  {invoiceTotals[license.id] > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{language === "ar" ? "إجمالي الفواتير:" : "Invoice Total:"}</span>
                      <span className="font-bold text-blue-600">{formatNumber(invoiceTotals[license.id])} SAR</span>
                    </div>
                  )}
                  {license.notes && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground text-xs">{language === "ar" ? "ملاحظات:" : "Notes:"}</span>
                      <p className="text-sm mt-1 text-foreground/80 line-clamp-2" title={license.notes}>
                        {license.notes}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2">
                  {license.invoice_file_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewInvoice(license.invoice_file_path!)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {language === "ar" ? "تحميل الفاتورة" : "Download Invoice"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/software-license-setup?id=${license.id}`)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {language === "ar" ? "تعديل" : "Edit"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => openRenewDialog(license)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {language === "ar" ? "طلب تجديد" : "Request Renew"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Renewal Request Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "طلب تجديد الاشتراك" : "Subscription Renewal Request"}
            </DialogTitle>
          </DialogHeader>
          
          {renewStep === 1 && selectedLicense && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedLicense.software_name}</p>
                <p className="text-sm text-muted-foreground">{selectedLicense.vendor_provider}</p>
              </div>
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "عدد الأشهر" : "Number of Months"}</Label>
                <Select value={String(renewMonths)} onValueChange={(v) => handleMonthsChange(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 6, 12].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} {language === "ar" ? (m === 1 ? "شهر" : "أشهر") : (m === 1 ? "month" : "months")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "المبلغ المطلوب" : "Amount Required"}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="flex items-center text-sm text-muted-foreground">
                    {currencies.find(c => c.id === selectedLicense.currency_id)?.currency_code || ""}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" 
                    ? "يمكنك تعديل المبلغ إذا تغير السعر من المورد"
                    : "You can modify the amount if the vendor changed the price"}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات إضافية (اختياري)" : "Additional Notes (Optional)"}</Label>
                <Textarea
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  placeholder={language === "ar" ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={() => setRenewStep(2)}>
                  {language === "ar" ? "التالي" : "Next"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {renewStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "اختر القسم" : "Select Department"}</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select department"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.department_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>{language === "ar" ? "البرنامج:" : "Software:"}</strong> {selectedLicense?.software_name}</p>
                <p><strong>{language === "ar" ? "الأشهر:" : "Months:"}</strong> {renewMonths}</p>
                <p><strong>{language === "ar" ? "المبلغ:" : "Amount:"}</strong> {formatNumber(renewAmount)} {currencies.find(c => c.id === selectedLicense?.currency_id)?.currency_code || ""}</p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setRenewStep(1)}>
                  {language === "ar" ? "السابق" : "Back"}
                </Button>
                <Button 
                  onClick={handleRenewSubmit} 
                  disabled={!selectedDepartment || isSubmitting}
                >
                  {isSubmitting 
                    ? (language === "ar" ? "جاري الإرسال..." : "Submitting...") 
                    : (language === "ar" ? "إرسال الطلب" : "Submit Request")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SoftwareLicenses;
