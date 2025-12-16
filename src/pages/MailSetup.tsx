import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Save, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface MailType {
  id: string;
  type_name: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  is_active: boolean;
}

const MailSetup = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [mailTypes, setMailTypes] = useState<MailType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<MailType>>({
    type_name: "",
    imap_host: "",
    imap_port: 993,
    imap_secure: true,
    smtp_host: "",
    smtp_port: 465,
    smtp_secure: true,
    is_active: true,
  });

  useEffect(() => {
    fetchMailTypes();
  }, []);

  const fetchMailTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("mail_types")
        .select("*")
        .order("type_name");

      if (error) throw error;
      setMailTypes(data || []);
    } catch (error: any) {
      toast.error(isArabic ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type_name: "",
      imap_host: "",
      imap_port: 993,
      imap_secure: true,
      smtp_host: "",
      smtp_port: 465,
      smtp_secure: true,
      is_active: true,
    });
    setEditingId(null);
  };

  const handleEdit = (mailType: MailType) => {
    setFormData(mailType);
    setEditingId(mailType.id);
  };

  const handleSubmit = async () => {
    if (!formData.type_name || !formData.imap_host || !formData.smtp_host) {
      toast.error(isArabic ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from("mail_types")
          .update({
            type_name: formData.type_name,
            imap_host: formData.imap_host,
            imap_port: formData.imap_port,
            imap_secure: formData.imap_secure,
            smtp_host: formData.smtp_host,
            smtp_port: formData.smtp_port,
            smtp_secure: formData.smtp_secure,
            is_active: formData.is_active,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success(isArabic ? "تم التحديث بنجاح" : "Updated successfully");
      } else {
        const { error } = await supabase.from("mail_types").insert({
          type_name: formData.type_name,
          imap_host: formData.imap_host,
          imap_port: formData.imap_port,
          imap_secure: formData.imap_secure,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_secure: formData.smtp_secure,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success(isArabic ? "تمت الإضافة بنجاح" : "Added successfully");
      }

      resetForm();
      fetchMailTypes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("mail_types").delete().eq("id", id);
      if (error) throw error;
      toast.success(isArabic ? "تم الحذف بنجاح" : "Deleted successfully");
      fetchMailTypes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <Mail className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">{isArabic ? "إعداد البريد" : "Mail Setup"}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? (isArabic ? "تعديل نوع البريد" : "Edit Mail Type") : (isArabic ? "إضافة نوع بريد جديد" : "Add New Mail Type")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isArabic ? "اسم النوع" : "Type Name"} *</Label>
              <Input
                value={formData.type_name || ""}
                onChange={(e) => setFormData({ ...formData, type_name: e.target.value })}
                placeholder={isArabic ? "مثال: Hostinger" : "e.g., Hostinger"}
              />
            </div>

            <div className="space-y-2">
              <Label>{isArabic ? "خادم IMAP" : "IMAP Host"} *</Label>
              <Input
                value={formData.imap_host || ""}
                onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                placeholder="imap.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>{isArabic ? "منفذ IMAP" : "IMAP Port"}</Label>
              <Input
                type="number"
                value={formData.imap_port || 993}
                onChange={(e) => setFormData({ ...formData, imap_port: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.imap_secure ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, imap_secure: checked })}
              />
              <Label>{isArabic ? "IMAP آمن (SSL)" : "IMAP Secure (SSL)"}</Label>
            </div>

            <div className="space-y-2">
              <Label>{isArabic ? "خادم SMTP" : "SMTP Host"} *</Label>
              <Input
                value={formData.smtp_host || ""}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>{isArabic ? "منفذ SMTP" : "SMTP Port"}</Label>
              <Input
                type="number"
                value={formData.smtp_port || 465}
                onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.smtp_secure ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, smtp_secure: checked })}
              />
              <Label>{isArabic ? "SMTP آمن (SSL)" : "SMTP Secure (SSL)"}</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label>{isArabic ? "نشط" : "Active"}</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit}>
              {editingId ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {editingId ? (isArabic ? "حفظ" : "Save") : (isArabic ? "إضافة" : "Add")}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-2" />
                {isArabic ? "إلغاء" : "Cancel"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "أنواع البريد" : "Mail Types"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isArabic ? "اسم النوع" : "Type Name"}</TableHead>
                <TableHead>{isArabic ? "خادم IMAP" : "IMAP Host"}</TableHead>
                <TableHead>{isArabic ? "منفذ IMAP" : "IMAP Port"}</TableHead>
                <TableHead>{isArabic ? "خادم SMTP" : "SMTP Host"}</TableHead>
                <TableHead>{isArabic ? "منفذ SMTP" : "SMTP Port"}</TableHead>
                <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                <TableHead>{isArabic ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailTypes.map((mailType) => (
                <TableRow key={mailType.id}>
                  <TableCell className="font-medium">{mailType.type_name}</TableCell>
                  <TableCell>{mailType.imap_host}</TableCell>
                  <TableCell>{mailType.imap_port}</TableCell>
                  <TableCell>{mailType.smtp_host}</TableCell>
                  <TableCell>{mailType.smtp_port}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${mailType.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {mailType.is_active ? (isArabic ? "نشط" : "Active") : (isArabic ? "غير نشط" : "Inactive")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(mailType)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{isArabic ? "تأكيد الحذف" : "Confirm Delete"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {isArabic ? "هل أنت متأكد من حذف هذا النوع؟" : "Are you sure you want to delete this mail type?"}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(mailType.id)}>
                              {isArabic ? "حذف" : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {mailTypes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {loading ? (isArabic ? "جاري التحميل..." : "Loading...") : (isArabic ? "لا توجد أنواع بريد" : "No mail types found")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default MailSetup;
