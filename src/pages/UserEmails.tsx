import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Copy } from "lucide-react";

interface UserEmail {
  id: string;
  user_name: string;
  email: string;
  password: string | null;
  host: string;
  created_at: string;
  updated_at: string;
}

const UserEmails = () => {
  const { language } = useLanguage();
  const [userEmails, setUserEmails] = useState<UserEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<UserEmail | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [pendingPasswordId, setPendingPasswordId] = useState<string | null>(null);
  const [verificationPassword, setVerificationPassword] = useState("");

  const [formData, setFormData] = useState({
    user_name: "",
    email: "",
    password: "",
    host: "Hostinger",
  });

  useEffect(() => {
    fetchUserEmails();
  }, []);

  const fetchUserEmails = async () => {
    try {
      const { data, error } = await supabase
        .from("user_emails")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUserEmails(data || []);
    } catch (error) {
      console.error("Error fetching user emails:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingEmail(null);
    setFormData({
      user_name: "",
      email: "",
      password: "",
      host: "Hostinger",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (userEmail: UserEmail) => {
    setEditingEmail(userEmail);
    setFormData({
      user_name: userEmail.user_name,
      email: userEmail.email,
      password: userEmail.password || "",
      host: userEmail.host,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (!formData.user_name || !formData.email) {
        toast.error(language === "ar" ? "الاسم والبريد مطلوبان" : "Name and email are required");
        return;
      }

      if (editingEmail) {
        const { error } = await supabase
          .from("user_emails")
          .update({
            user_name: formData.user_name,
            email: formData.email,
            password: formData.password || null,
            host: formData.host,
          })
          .eq("id", editingEmail.id);

        if (error) throw error;
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("user_emails").insert({
          user_name: formData.user_name,
          email: formData.email,
          password: formData.password || null,
          host: formData.host,
        });

        if (error) throw error;
        toast.success(language === "ar" ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      setIsDialogOpen(false);
      fetchUserEmails();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(language === "ar" ? "خطأ في الحفظ" : "Error saving");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) {
      return;
    }

    try {
      const { error } = await supabase.from("user_emails").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Deleted successfully");
      fetchUserEmails();
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error(language === "ar" ? "خطأ في الحذف" : "Error deleting");
    }
  };

  const handleShowPassword = (id: string) => {
    if (showPasswords[id]) {
      setShowPasswords((prev) => ({ ...prev, [id]: false }));
    } else {
      setPendingPasswordId(id);
      setVerificationPassword("");
      setIsPasswordDialogOpen(true);
    }
  };

  const handleVerifyPassword = () => {
    if (verificationPassword === "159753") {
      if (pendingPasswordId) {
        setShowPasswords((prev) => ({ ...prev, [pendingPasswordId]: true }));
      }
      setIsPasswordDialogOpen(false);
      setPendingPasswordId(null);
      setVerificationPassword("");
    } else {
      toast.error(language === "ar" ? "كلمة المرور غير صحيحة" : "Incorrect password");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === "ar" ? "تم نسخ كلمة المرور" : "Password copied");
  };

  const filteredEmails = userEmails.filter(
    (item) =>
      item.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "المستخدمين والبريد" : "Users & Mails"}
        </h1>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة" : "Add"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={language === "ar" ? "بحث..." : "Search..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "اسم المستخدم" : "User Name"}</TableHead>
                <TableHead>{language === "ar" ? "البريد الإلكتروني" : "Email"}</TableHead>
                <TableHead>{language === "ar" ? "كلمة المرور" : "Password"}</TableHead>
                <TableHead>{language === "ar" ? "الاستضافة" : "Host"}</TableHead>
                <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmails.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.user_name}</TableCell>
                  <TableCell>{item.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm">
                        {showPasswords[item.id] ? item.password || "-" : "••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleShowPassword(item.id)}
                      >
                        {showPasswords[item.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      {showPasswords[item.id] && item.password && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(item.password!)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.host}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEmails.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingEmail
                ? language === "ar"
                  ? "تعديل"
                  : "Edit"
                : language === "ar"
                ? "إضافة جديد"
                : "Add New"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "اسم المستخدم" : "User Name"}</Label>
              <Input
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "كلمة المرور" : "Password"}</Label>
              <Input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "الاستضافة" : "Host"}</Label>
              <Select
                value={formData.host}
                onValueChange={(value) => setFormData({ ...formData, host: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Hostinger">Hostinger</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave}>{language === "ar" ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Verification Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-sm" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "أدخل كلمة المرور للعرض" : "Enter Password to View"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={verificationPassword}
              onChange={(e) => setVerificationPassword(e.target.value)}
              placeholder={language === "ar" ? "كلمة المرور" : "Password"}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleVerifyPassword}>
              {language === "ar" ? "تأكيد" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserEmails;
