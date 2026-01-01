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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, Ban, FileKey, Download, AlertTriangle, CheckCircle, XCircle, Clock, Monitor } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";

interface Certificate {
  id: string;
  user_id: string;
  certificate_hash: string;
  issued_at: string;
  expires_at: string;
  is_active: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_by: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

interface Profile {
  user_id: string;
  user_name: string;
  email: string;
}

interface DeviceActivation {
  id: string;
  device_name: string;
  device_fingerprint: string;
  device_info: unknown;
  is_active: boolean;
  activated_at: string;
}

const CertificateManagement = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [devicesDialogOpen, setDevicesDialogOpen] = useState(false);
  const [selectedCertDevices, setSelectedCertDevices] = useState<DeviceActivation[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [selectedCertForDevices, setSelectedCertForDevices] = useState<Certificate | null>(null);

  useEffect(() => {
    fetchCertificates();
    fetchProfiles();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_certificates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error("Error fetching certificates:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في جلب الشهادات" : "Failed to fetch certificates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, user_name, email");

      if (error) throw error;
      
      const profileMap: Record<string, Profile> = {};
      (data || []).forEach((p) => {
        profileMap[p.user_id] = p;
      });
      setProfiles(profileMap);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleRevoke = async () => {
    if (!selectedCertificate) return;

    try {
      const { error } = await supabase
        .from("user_certificates")
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_reason: revokeReason || "Terminated",
        })
        .eq("id", selectedCertificate.id);

      if (error) throw error;

      toast({
        title: language === "ar" ? "تم الإلغاء" : "Revoked",
        description: language === "ar" ? "تم إلغاء الشهادة بنجاح" : "Certificate revoked successfully",
      });

      setRevokeDialogOpen(false);
      setRevokeReason("");
      setSelectedCertificate(null);
      fetchCertificates();
    } catch (error) {
      console.error("Error revoking certificate:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في إلغاء الشهادة" : "Failed to revoke certificate",
        variant: "destructive",
      });
    }
  };

  const handleShowDevices = async (cert: Certificate) => {
    setSelectedCertForDevices(cert);
    setDevicesDialogOpen(true);
    setLoadingDevices(true);
    try {
      const { data, error } = await supabase
        .from("user_device_activations")
        .select("*")
        .eq("certificate_id", cert.id)
        .order("activated_at", { ascending: false });

      if (error) throw error;
      setSelectedCertDevices(data || []);
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في جلب الأجهزة" : "Failed to fetch devices",
        variant: "destructive",
      });
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleGenerateCertificate = async (userId: string) => {
    setGenerating(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("generate-user-certificate", {
        body: { user_id: userId, created_by_id: user?.id },
      });

      if (error) throw error;

      if (data?.certificate) {
        // Download the certificate file
        const blob = new Blob([data.certificate], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `certificate_${data.user_email || userId}_${format(new Date(), "yyyy-MM-dd")}.cert`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: language === "ar" ? "تم إنشاء الشهادة" : "Certificate Generated",
          description: language === "ar" 
            ? `تنتهي الصلاحية في ${format(new Date(data.expires_at), "yyyy-MM-dd")}` 
            : `Expires on ${format(new Date(data.expires_at), "yyyy-MM-dd")}`,
        });

        fetchCertificates();
      }
    } catch (error) {
      console.error("Error generating certificate:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في إنشاء الشهادة" : "Failed to generate certificate",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const getCertificateStatus = (cert: Certificate): { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: typeof XCircle } => {
    if (!cert.is_active) {
      return { label: language === "ar" ? "ملغاة" : "Revoked", variant: "destructive", icon: XCircle };
    }
    const expiresAt = new Date(cert.expires_at);
    if (isPast(expiresAt)) {
      return { label: language === "ar" ? "منتهية" : "Expired", variant: "secondary", icon: Clock };
    }
    const daysUntilExpiry = differenceInDays(expiresAt, new Date());
    if (daysUntilExpiry <= 7) {
      return { label: language === "ar" ? "تنتهي قريباً" : "Expiring Soon", variant: "outline", icon: AlertTriangle };
    }
    return { label: language === "ar" ? "نشطة" : "Active", variant: "default", icon: CheckCircle };
  };

  const filteredCertificates = certificates.filter((cert) => {
    const profile = profiles[cert.user_id];
    const matchesSearch = 
      (profile?.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       cert.certificate_hash.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === "all") return matchesSearch;
    
    const status = getCertificateStatus(cert);
    if (statusFilter === "active") return matchesSearch && cert.is_active && !isPast(new Date(cert.expires_at));
    if (statusFilter === "expired") return matchesSearch && isPast(new Date(cert.expires_at));
    if (statusFilter === "revoked") return matchesSearch && !cert.is_active;
    if (statusFilter === "expiring") {
      const daysUntilExpiry = differenceInDays(new Date(cert.expires_at), new Date());
      return matchesSearch && cert.is_active && daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
    }
    
    return matchesSearch;
  });

  // Get unique users who don't have active certificates
  const usersWithoutCertificate = Object.values(profiles).filter(
    (profile) => !certificates.some(
      (cert) => cert.user_id === profile.user_id && cert.is_active && !isPast(new Date(cert.expires_at))
    )
  );

  const stats = {
    total: certificates.length,
    active: certificates.filter((c) => c.is_active && !isPast(new Date(c.expires_at))).length,
    expired: certificates.filter((c) => isPast(new Date(c.expires_at))).length,
    revoked: certificates.filter((c) => !c.is_active).length,
    expiringSoon: certificates.filter((c) => {
      if (!c.is_active) return false;
      const days = differenceInDays(new Date(c.expires_at), new Date());
      return days <= 7 && days >= 0;
    }).length,
  };

  return (
    <div className="container mx-auto py-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "إدارة الشهادات" : "Certificate Management"}
        </h1>
        <Button onClick={fetchCertificates} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "الإجمالي" : "Total"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">
              {language === "ar" ? "نشطة" : "Active"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">
              {language === "ar" ? "تنتهي قريباً" : "Expiring Soon"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {language === "ar" ? "منتهية" : "Expired"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.expired}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              {language === "ar" ? "ملغاة" : "Revoked"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.revoked}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "ar" ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={language === "ar" ? "الحالة" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
            <SelectItem value="active">{language === "ar" ? "نشطة" : "Active"}</SelectItem>
            <SelectItem value="expiring">{language === "ar" ? "تنتهي قريباً" : "Expiring Soon"}</SelectItem>
            <SelectItem value="expired">{language === "ar" ? "منتهية" : "Expired"}</SelectItem>
            <SelectItem value="revoked">{language === "ar" ? "ملغاة" : "Revoked"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Certificates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                <TableHead>{language === "ar" ? "البريد" : "Email"}</TableHead>
                <TableHead>{language === "ar" ? "تاريخ الإصدار" : "Issue Date"}</TableHead>
                <TableHead>{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    {language === "ar" ? "جاري التحميل..." : "Loading..."}
                  </TableCell>
                </TableRow>
              ) : filteredCertificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد شهادات" : "No certificates found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCertificates.map((cert) => {
                  const profile = profiles[cert.user_id];
                  const status = getCertificateStatus(cert);
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">
                        {profile?.user_name || cert.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{profile?.email || "-"}</TableCell>
                      <TableCell>{format(new Date(cert.issued_at), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{format(new Date(cert.expires_at), "yyyy-MM-dd")}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {cert.revoked_reason && (
                          <span className="text-xs text-muted-foreground block mt-1">
                            {cert.revoked_reason}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowDevices(cert)}
                            title={language === "ar" ? "عرض الأجهزة" : "Show Devices"}
                          >
                            <Monitor className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateCertificate(cert.user_id)}
                            disabled={generating === cert.user_id}
                          >
                            <FileKey className="h-4 w-4 mr-1" />
                            {language === "ar" ? "جديدة" : "New"}
                          </Button>
                          {cert.is_active && !isPast(new Date(cert.expires_at)) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedCertificate(cert);
                                setRevokeDialogOpen(true);
                              }}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              {language === "ar" ? "إلغاء" : "Revoke"}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users without certificates */}
      {usersWithoutCertificate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {language === "ar" ? "مستخدمون بدون شهادة نشطة" : "Users Without Active Certificate"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usersWithoutCertificate.slice(0, 12).map((profile) => (
                <div
                  key={profile.user_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{profile.user_name}</div>
                    <div className="text-sm text-muted-foreground">{profile.email}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateCertificate(profile.user_id)}
                    disabled={generating === profile.user_id}
                  >
                    <FileKey className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Devices Dialog */}
      <Dialog open={devicesDialogOpen} onOpenChange={setDevicesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              {language === "ar" ? "الأجهزة المفعّلة" : "Activated Devices"}
            </DialogTitle>
            <DialogDescription>
              {selectedCertForDevices && profiles[selectedCertForDevices.user_id] && (
                <span>
                  {language === "ar" ? "المستخدم: " : "User: "}
                  {profiles[selectedCertForDevices.user_id].user_name} ({profiles[selectedCertForDevices.user_id].email})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {loadingDevices ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : selectedCertDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا توجد أجهزة مفعّلة" : "No activated devices"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "اسم الجهاز" : "Device Name"}</TableHead>
                    <TableHead>{language === "ar" ? "نظام التشغيل" : "OS Type"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ التفعيل" : "Activated At"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedCertDevices.map((device) => {
                    const deviceInfo = device.device_info as Record<string, unknown> | null;
                    const platform = deviceInfo?.platform as string || '';
                    const userAgent = deviceInfo?.userAgent as string || '';
                    
                    // Detect OS type from platform or userAgent
                    let osType = 'Unknown';
                    if (platform.includes('Win') || userAgent.includes('Windows')) osType = 'Windows';
                    else if (platform.includes('Mac') || userAgent.includes('Mac')) osType = 'macOS';
                    else if (platform.includes('Linux') || userAgent.includes('Linux')) osType = 'Linux';
                    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) osType = 'iOS';
                    else if (userAgent.includes('Android')) osType = 'Android';
                    
                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                            {device.device_name || device.device_fingerprint.slice(0, 12)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{osType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={device.is_active ? "default" : "secondary"}>
                            {device.is_active 
                              ? (language === "ar" ? "نشط" : "Active") 
                              : (language === "ar" ? "غير نشط" : "Inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(device.activated_at), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "إلغاء الشهادة" : "Revoke Certificate"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "هذا الإجراء لا يمكن التراجع عنه. سيُطلب من المستخدم رفع شهادة جديدة."
                : "This action cannot be undone. The user will be required to upload a new certificate."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "سبب الإلغاء" : "Revocation Reason"}</Label>
              <Textarea
                placeholder={language === "ar" ? "مثال: انتهاء الخدمة" : "e.g., Termination"}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleRevoke}>
              {language === "ar" ? "تأكيد الإلغاء" : "Confirm Revoke"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CertificateManagement;
