import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Globe, Smartphone } from "lucide-react";

interface UserLogin {
  id: string;
  website: string | null;
  application: string;
  description: string | null;
  user_name: string | null;
  password: string | null;
  needs_otp: boolean;
  otp_mobile_number: string | null;
  google_account: string | null;
  created_at: string;
}

const UserLogins = () => {
  const { t, language } = useLanguage();
  const [logins, setLogins] = useState<UserLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLogin, setEditingLogin] = useState<UserLogin | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Form state
  const [formData, setFormData] = useState({
    website: "",
    application: "",
    description: "",
    user_name: "",
    password: "",
    needs_otp: false,
    otp_mobile_number: "",
    google_account: "",
  });

  useEffect(() => {
    fetchLogins();
  }, []);

  const fetchLogins = async () => {
    try {
      const { data, error } = await supabase
        .from("user_logins")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogins(data || []);
    } catch (error: any) {
      console.error("Error fetching logins:", error);
      toast.error(language === "ar" ? "خطأ في تحميل البيانات" : "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (login?: UserLogin) => {
    if (login) {
      setEditingLogin(login);
      setFormData({
        website: login.website || "",
        application: login.application,
        description: login.description || "",
        user_name: login.user_name || "",
        password: login.password || "",
        needs_otp: login.needs_otp,
        otp_mobile_number: login.otp_mobile_number || "",
        google_account: login.google_account || "",
      });
    } else {
      setEditingLogin(null);
      setFormData({
        website: "",
        application: "",
        description: "",
        user_name: "",
        password: "",
        needs_otp: false,
        otp_mobile_number: "",
        google_account: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.application.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال اسم التطبيق" : "Please enter application name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingLogin) {
        const { error } = await supabase
          .from("user_logins")
          .update({
            website: formData.website || null,
            application: formData.application,
            description: formData.description || null,
            user_name: formData.user_name || null,
            password: formData.password || null,
            needs_otp: formData.needs_otp,
            otp_mobile_number: formData.otp_mobile_number || null,
            google_account: formData.google_account || null,
          })
          .eq("id", editingLogin.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث البيانات بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase
          .from("user_logins")
          .insert({
            website: formData.website || null,
            application: formData.application,
            description: formData.description || null,
            user_name: formData.user_name || null,
            password: formData.password || null,
            needs_otp: formData.needs_otp,
            otp_mobile_number: formData.otp_mobile_number || null,
            google_account: formData.google_account || null,
            created_by: user?.id,
          });

        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setIsDialogOpen(false);
      fetchLogins();
    } catch (error: any) {
      console.error("Error saving login:", error);
      toast.error(language === "ar" ? "خطأ في حفظ البيانات" : "Error saving data");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) {
      return;
    }

    try {
      const { error } = await supabase.from("user_logins").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      fetchLogins();
    } catch (error: any) {
      console.error("Error deleting login:", error);
      toast.error(language === "ar" ? "خطأ في الحذف" : "Error deleting");
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredLogins = logins.filter((login) => {
    const query = searchQuery.toLowerCase();
    return (
      login.application?.toLowerCase().includes(query) ||
      login.website?.toLowerCase().includes(query) ||
      login.description?.toLowerCase().includes(query) ||
      login.user_name?.toLowerCase().includes(query) ||
      login.google_account?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {language === "ar" ? "بيانات تسجيل الدخول" : "Users Logins"}
            </CardTitle>
            <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة جديد" : "Add New"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute top-3 h-4 w-4 text-muted-foreground start-3" />
              <Input
                placeholder={language === "ar" ? "بحث..." : "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-10"
              />
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "الموقع" : "Website"}</TableHead>
                    <TableHead>{language === "ar" ? "التطبيق" : "Application"}</TableHead>
                    <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                    <TableHead>{language === "ar" ? "اسم المستخدم" : "User Name"}</TableHead>
                    <TableHead>{language === "ar" ? "كلمة المرور" : "Password"}</TableHead>
                    <TableHead>{language === "ar" ? "يحتاج OTP" : "Needs OTP"}</TableHead>
                    <TableHead>{language === "ar" ? "رقم الجوال للـ OTP" : "OTP Mobile"}</TableHead>
                    <TableHead>{language === "ar" ? "حساب جوجل" : "Google Account"}</TableHead>
                    <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        {language === "ar" ? "جاري التحميل..." : "Loading..."}
                      </TableCell>
                    </TableRow>
                  ) : filteredLogins.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد بيانات" : "No data found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogins.map((login) => (
                      <TableRow key={login.id}>
                        <TableCell>
                          {login.website ? (
                            <a
                              href={login.website.startsWith("http") ? login.website : `https://${login.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {login.website}
                            </a>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{login.application}</TableCell>
                        <TableCell>{login.description || "-"}</TableCell>
                        <TableCell>{login.user_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">
                              {showPasswords[login.id] ? login.password : "••••••••"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => togglePasswordVisibility(login.id)}
                            >
                              {showPasswords[login.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {login.needs_otp ? (
                            <span className="text-green-600 font-medium">
                              {language === "ar" ? "نعم" : "Yes"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {language === "ar" ? "لا" : "No"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {login.otp_mobile_number ? (
                            <div className="flex items-center gap-1">
                              <Smartphone className="h-3 w-3" />
                              {login.otp_mobile_number}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{login.google_account || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(login)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(login.id)}
                              className="text-destructive hover:text-destructive"
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl" dir={language === "ar" ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>
                {editingLogin
                  ? language === "ar"
                    ? "تعديل بيانات الدخول"
                    : "Edit Login"
                  : language === "ar"
                  ? "إضافة بيانات دخول جديدة"
                  : "Add New Login"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الموقع" : "Website"}</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "التطبيق *" : "Application *"}</Label>
                <Input
                  value={formData.application}
                  onChange={(e) => setFormData({ ...formData, application: e.target.value })}
                  placeholder={language === "ar" ? "اسم التطبيق" : "Application name"}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={language === "ar" ? "وصف اختياري" : "Optional description"}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم المستخدم" : "User Name"}</Label>
                <Input
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "كلمة المرور" : "Password"}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-2 flex items-center gap-3 pt-6">
                <Checkbox
                  id="needs_otp"
                  checked={formData.needs_otp}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, needs_otp: checked as boolean })
                  }
                />
                <Label htmlFor="needs_otp" className="cursor-pointer">
                  {language === "ar" ? "يحتاج رمز OTP" : "Needs OTP"}
                </Label>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "رقم الجوال للـ OTP" : "OTP Mobile Number"}</Label>
                <Input
                  value={formData.otp_mobile_number}
                  onChange={(e) => setFormData({ ...formData, otp_mobile_number: e.target.value })}
                  placeholder="+966xxxxxxxxx"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>{language === "ar" ? "حساب جوجل" : "Google Account"}</Label>
                <Input
                  type="email"
                  value={formData.google_account}
                  onChange={(e) => setFormData({ ...formData, google_account: e.target.value })}
                  placeholder="user@gmail.com"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleSave}>
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default UserLogins;
