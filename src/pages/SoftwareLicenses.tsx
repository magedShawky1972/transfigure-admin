import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, differenceInDays } from "date-fns";

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
}

const SoftwareLicenses = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [filteredLicenses, setFilteredLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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
    filterLicenses();
  }, [licenses, searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    calculateStats();
  }, [licenses]);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      // Update statuses first
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

  const filterLicenses = () => {
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

  const getStatusBadge = (status: string, expiryDate: string | null) => {
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

  const categories = Array.from(new Set(licenses.map((l) => l.category)));

  return (
    <div className="container mx-auto p-6 space-y-6">
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

      {/* Alert Banner for Urgent Renewals */}
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

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-end">
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
        <Button onClick={() => window.location.href = "/software-license-setup"}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة ترخيص" : "Add License"}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{language === "ar" ? "اسم البرنامج" : "Software Name"}</TableHead>
              <TableHead>{language === "ar" ? "مفتاح الترخيص" : "License Key"}</TableHead>
              <TableHead>{language === "ar" ? "المورد" : "Vendor"}</TableHead>
              <TableHead>{language === "ar" ? "الفئة" : "Category"}</TableHead>
              <TableHead>{language === "ar" ? "تاريخ الشراء" : "Purchase Date"}</TableHead>
              <TableHead>{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</TableHead>
              <TableHead>{language === "ar" ? "دورة التجديد" : "Renewal"}</TableHead>
              <TableHead>{language === "ar" ? "المخصص لـ" : "Assigned To"}</TableHead>
              <TableHead>{language === "ar" ? "التكلفة" : "Cost"}</TableHead>
              <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
              <TableHead className="text-right">{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  {language === "ar" ? "جاري التحميل..." : "Loading..."}
                </TableCell>
              </TableRow>
            ) : filteredLicenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  {language === "ar" ? "لا توجد تراخيص" : "No licenses found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredLicenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-medium">{license.software_name}</TableCell>
                  <TableCell className="font-mono text-sm">{license.license_key || "-"}</TableCell>
                  <TableCell>{license.vendor_provider}</TableCell>
                  <TableCell>{license.category}</TableCell>
                  <TableCell>{format(new Date(license.purchase_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell>{license.expiry_date ? format(new Date(license.expiry_date), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell>{license.renewal_cycle}</TableCell>
                  <TableCell>{license.assigned_to || license.assigned_department || "-"}</TableCell>
                  <TableCell>${Number(license.cost).toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(license.status, license.expiry_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = `/software-license-setup?id=${license.id}`}
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
    </div>
  );
};

export default SoftwareLicenses;
