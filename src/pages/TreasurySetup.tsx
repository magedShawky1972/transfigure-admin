import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Vault, Save } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface Treasury {
  id: string;
  treasury_code: string;
  treasury_name: string;
  treasury_name_ar: string | null;
  responsible_user_id: string | null;
  department_id: string | null;
  currency_id: string | null;
  opening_balance: number;
  current_balance: number;
  max_balance: number | null;
  is_active: boolean;
  notes: string | null;
}

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
}

interface Department {
  id: string;
  department_name: string;
  department_name_ar: string | null;
}

interface User {
  user_id: string;
  user_name: string;
}

const TreasurySetup = () => {
  const { language } = useLanguage();
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreasury, setEditingTreasury] = useState<Treasury | null>(null);
  const [formData, setFormData] = useState({
    treasury_code: "",
    treasury_name: "",
    treasury_name_ar: "",
    responsible_user_id: "",
    department_id: "",
    currency_id: "",
    opening_balance: 0,
    max_balance: 0,
    is_active: true,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treasuriesRes, currenciesRes, departmentsRes, usersRes] = await Promise.all([
        supabase.from("treasuries").select("*").order("treasury_name"),
        supabase.from("currencies").select("id, currency_code, currency_name").eq("is_active", true),
        supabase.from("departments").select("id, department_name, department_name_ar").eq("is_active", true),
        supabase.from("profiles").select("user_id, user_name").eq("is_active", true),
      ]);

      if (treasuriesRes.error) throw treasuriesRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (usersRes.error) throw usersRes.error;

      setTreasuries(treasuriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.treasury_code || !formData.treasury_name) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        treasury_code: formData.treasury_code,
        treasury_name: formData.treasury_name,
        treasury_name_ar: formData.treasury_name_ar || null,
        responsible_user_id: formData.responsible_user_id || null,
        department_id: formData.department_id || null,
        currency_id: formData.currency_id || null,
        opening_balance: formData.opening_balance,
        current_balance: editingTreasury ? editingTreasury.current_balance : formData.opening_balance,
        max_balance: formData.max_balance || null,
        is_active: formData.is_active,
        notes: formData.notes || null,
      };

      if (editingTreasury) {
        const { error } = await supabase.from("treasuries").update(payload).eq("id", editingTreasury.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث الخزينة بنجاح" : "Treasury updated successfully");
      } else {
        const { error } = await supabase.from("treasuries").insert([payload]);
        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة الخزينة بنجاح" : "Treasury added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving treasury:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حفظ الخزينة" : "Error saving treasury"));
    }
  };

  const handleEdit = (treasury: Treasury) => {
    setEditingTreasury(treasury);
    setFormData({
      treasury_code: treasury.treasury_code,
      treasury_name: treasury.treasury_name,
      treasury_name_ar: treasury.treasury_name_ar || "",
      responsible_user_id: treasury.responsible_user_id || "",
      department_id: treasury.department_id || "",
      currency_id: treasury.currency_id || "",
      opening_balance: treasury.opening_balance,
      max_balance: treasury.max_balance || 0,
      is_active: treasury.is_active,
      notes: treasury.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    
    try {
      const { error } = await supabase.from("treasuries").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف الخزينة بنجاح" : "Treasury deleted successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting treasury:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حذف الخزينة" : "Error deleting treasury"));
    }
  };

  const resetForm = () => {
    setEditingTreasury(null);
    setFormData({
      treasury_code: "",
      treasury_name: "",
      treasury_name_ar: "",
      responsible_user_id: "",
      department_id: "",
      currency_id: "",
      opening_balance: 0,
      max_balance: 0,
      is_active: true,
      notes: "",
    });
  };

  const getCurrencyName = (currencyId: string | null) => {
    if (!currencyId) return "-";
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.currency_code : "-";
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return "-";
    const dept = departments.find((d) => d.id === deptId);
    return dept ? (language === "ar" && dept.department_name_ar ? dept.department_name_ar : dept.department_name) : "-";
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "-";
    const user = users.find((u) => u.user_id === userId);
    return user ? user.user_name : "-";
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Vault className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "إعداد الخزائن" : "Treasury Setup"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة خزينة" : "Add Treasury"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTreasury 
                  ? (language === "ar" ? "تعديل الخزينة" : "Edit Treasury")
                  : (language === "ar" ? "إضافة خزينة جديدة" : "Add New Treasury")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "كود الخزينة *" : "Treasury Code *"}</Label>
                  <Input
                    value={formData.treasury_code}
                    onChange={(e) => setFormData({ ...formData, treasury_code: e.target.value })}
                    placeholder="TRE001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم الخزينة *" : "Treasury Name *"}</Label>
                  <Input
                    value={formData.treasury_name}
                    onChange={(e) => setFormData({ ...formData, treasury_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم الخزينة (عربي)" : "Treasury Name (Arabic)"}</Label>
                  <Input
                    value={formData.treasury_name_ar}
                    onChange={(e) => setFormData({ ...formData, treasury_name_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "المسؤول" : "Responsible User"}</Label>
                  <Select value={formData.responsible_user_id} onValueChange={(v) => setFormData({ ...formData, responsible_user_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر المسؤول" : "Select User"} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.user_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "القسم" : "Department"}</Label>
                  <Select value={formData.department_id} onValueChange={(v) => setFormData({ ...formData, department_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر القسم" : "Select Department"} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {language === "ar" && d.department_name_ar ? d.department_name_ar : d.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "العملة" : "Currency"}</Label>
                  <Select value={formData.currency_id} onValueChange={(v) => setFormData({ ...formData, currency_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select Currency"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.currency_code} - {c.currency_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الحد الأقصى للرصيد" : "Max Balance"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.max_balance}
                    onChange={(e) => setFormData({ ...formData, max_balance: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>{language === "ar" ? "نشط" : "Active"}</Label>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {editingTreasury 
                  ? (language === "ar" ? "تحديث" : "Update")
                  : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة الخزائن" : "Treasuries List"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الكود" : "Code"}</TableHead>
                <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                <TableHead>{language === "ar" ? "المسؤول" : "Responsible"}</TableHead>
                <TableHead>{language === "ar" ? "القسم" : "Department"}</TableHead>
                <TableHead>{language === "ar" ? "العملة" : "Currency"}</TableHead>
                <TableHead>{language === "ar" ? "الرصيد الحالي" : "Current Balance"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treasuries.map((treasury) => (
                <TableRow key={treasury.id}>
                  <TableCell className="font-mono">{treasury.treasury_code}</TableCell>
                  <TableCell>{language === "ar" && treasury.treasury_name_ar ? treasury.treasury_name_ar : treasury.treasury_name}</TableCell>
                  <TableCell>{getUserName(treasury.responsible_user_id)}</TableCell>
                  <TableCell>{getDepartmentName(treasury.department_id)}</TableCell>
                  <TableCell>{getCurrencyName(treasury.currency_id)}</TableCell>
                  <TableCell className="font-semibold">{treasury.current_balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${treasury.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {treasury.is_active ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(treasury)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDelete(treasury.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {treasuries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد خزائن" : "No treasuries found"}
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

export default TreasurySetup;
