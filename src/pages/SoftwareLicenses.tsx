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
import { Plus, Search, Pencil, Trash2, AlertCircle, ArrowUpDown, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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
}

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

  // Dashboard stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    expiringSoon: 0,
    monthlyCost: 0,
    annualCost: 0,
  });

  useEffect(() => {
    fetchLicenses();
  }, []);

  useEffect(() => {
    filterAndSortLicenses();
  }, [licenses, searchQuery, statusFilter, categoryFilter, sortBy, sortOrder]);

  useEffect(() => {
    calculateStats();
  }, [licenses]);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      await supabase.rpc("update_software_license_status");

      const { data, error } = await supabase
        .from("software_licenses")
        .select("*")
        .order("expiry_date", { ascending: true });

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

  const filterAndSortLicenses = () => {
    let filtered = [...licenses];

    if (searchQuery) {
      filtered = filtered.filter(
        (license) =>
          license.software_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.vendor_provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
          license.license_key?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((license) => license.status === statusFilter);
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
    const total = licenses.length;
    const active = licenses.filter((l) => l.status === "active").length;
    const expired = licenses.filter((l) => l.status === "expired").length;
    const expiringSoon = licenses.filter((l) => l.status === "expiring_soon").length;

    const monthlyCost = licenses
      .filter((l) => l.renewal_cycle === "monthly")
      .reduce((sum, l) => sum + Number(l.cost), 0);

    const annualCost = licenses.reduce((sum, l) => {
      if (l.renewal_cycle === "monthly") return sum + Number(l.cost) * 12;
      if (l.renewal_cycle === "yearly") return sum + Number(l.cost);
      return sum;
    }, 0);

    setStats({ total, active, expired, expiringSoon, monthlyCost, annualCost });
  };

  const getStatusBadge = (status: string) => {
    if (status === "expired") {
      return <Badge variant="destructive">{language === "ar" ? "منتهي" : "Expired"}</Badge>;
    }
    if (status === "expiring_soon") {
      return <Badge className="bg-orange-500">{language === "ar" ? "ينتهي قريباً" : "Expiring Soon"}</Badge>;
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyCost.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "التكلفة السنوية" : "Annual Cost"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.annualCost.toFixed(2)}</div>
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
                  {getStatusBadge(license.status)}
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
                    <span className="text-lg font-bold">${Number(license.cost).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
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
                    className="flex-1"
                    onClick={() => navigate(`/software-license-setup?id=${license.id}`)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {language === "ar" ? "تعديل" : "Edit"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SoftwareLicenses;
