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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Building2, Save } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_name_ar: string | null;
  account_number: string | null;
  iban: string | null;
  swift_code: string | null;
  branch_name: string | null;
  currency_id: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  allow_negative_balance: boolean;
  notes: string | null;
}

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
}

const BankSetup = () => {
  const { language } = useLanguage();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [formData, setFormData] = useState({
    bank_code: "",
    bank_name: "",
    bank_name_ar: "",
    account_number: "",
    iban: "",
    swift_code: "",
    branch_name: "",
    currency_id: "",
    opening_balance: 0,
    is_active: true,
    allow_negative_balance: false,
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [banksRes, currenciesRes] = await Promise.all([
        supabase.from("banks").select("*").order("bank_name"),
        supabase.from("currencies").select("id, currency_code, currency_name").eq("is_active", true),
      ]);

      if (banksRes.error) throw banksRes.error;
      if (currenciesRes.error) throw currenciesRes.error;

      setBanks(banksRes.data || []);
      setCurrencies(currenciesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.bank_code || !formData.bank_name) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const payload = {
        bank_code: formData.bank_code,
        bank_name: formData.bank_name,
        bank_name_ar: formData.bank_name_ar || null,
        account_number: formData.account_number || null,
        iban: formData.iban || null,
        swift_code: formData.swift_code || null,
        branch_name: formData.branch_name || null,
        currency_id: formData.currency_id || null,
        opening_balance: formData.opening_balance,
        current_balance: editingBank ? editingBank.current_balance : formData.opening_balance,
        is_active: formData.is_active,
        allow_negative_balance: formData.allow_negative_balance,
        notes: formData.notes || null,
      };

      if (editingBank) {
        const { error } = await supabase.from("banks").update(payload).eq("id", editingBank.id);
        if (error) throw error;
        toast.success(language === "ar" ? "تم تحديث البنك بنجاح" : "Bank updated successfully");
      } else {
        const { error } = await supabase.from("banks").insert([payload]);
        if (error) throw error;
        toast.success(language === "ar" ? "تم إضافة البنك بنجاح" : "Bank added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving bank:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حفظ البنك" : "Error saving bank"));
    }
  };

  const handleEdit = (bank: Bank) => {
    setEditingBank(bank);
    setFormData({
      bank_code: bank.bank_code,
      bank_name: bank.bank_name,
      bank_name_ar: bank.bank_name_ar || "",
      account_number: bank.account_number || "",
      iban: bank.iban || "",
      swift_code: bank.swift_code || "",
      branch_name: bank.branch_name || "",
      currency_id: bank.currency_id || "",
      opening_balance: bank.opening_balance,
      is_active: bank.is_active,
      allow_negative_balance: bank.allow_negative_balance || false,
      notes: bank.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    
    try {
      const { error } = await supabase.from("banks").delete().eq("id", id);
      if (error) throw error;
      toast.success(language === "ar" ? "تم حذف البنك بنجاح" : "Bank deleted successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting bank:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حذف البنك" : "Error deleting bank"));
    }
  };

  const resetForm = () => {
    setEditingBank(null);
    setFormData({
      bank_code: "",
      bank_name: "",
      bank_name_ar: "",
      account_number: "",
      iban: "",
      swift_code: "",
      branch_name: "",
      currency_id: "",
      opening_balance: 0,
      is_active: true,
      allow_negative_balance: false,
      notes: "",
    });
  };

  const getCurrencyName = (currencyId: string | null) => {
    if (!currencyId) return "-";
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.currency_code : "-";
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "إعداد البنوك" : "Bank Setup"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة بنك" : "Add Bank"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBank 
                  ? (language === "ar" ? "تعديل البنك" : "Edit Bank")
                  : (language === "ar" ? "إضافة بنك جديد" : "Add New Bank")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "كود البنك *" : "Bank Code *"}</Label>
                  <Input
                    value={formData.bank_code}
                    onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
                    placeholder="BNK001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم البنك *" : "Bank Name *"}</Label>
                  <Input
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم البنك (عربي)" : "Bank Name (Arabic)"}</Label>
                  <Input
                    value={formData.bank_name_ar}
                    onChange={(e) => setFormData({ ...formData, bank_name_ar: e.target.value })}
                    dir="rtl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم الحساب" : "Account Number"}</Label>
                  <Input
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم IBAN" : "IBAN"}</Label>
                  <Input
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "كود SWIFT" : "SWIFT Code"}</Label>
                  <Input
                    value={formData.swift_code}
                    onChange={(e) => setFormData({ ...formData, swift_code: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم الفرع" : "Branch Name"}</Label>
                  <Input
                    value={formData.branch_name}
                    onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  />
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
                <div className="flex items-center gap-3 pt-7">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>{language === "ar" ? "نشط" : "Active"}</Label>
                </div>
              </div>
              <div className="flex items-center gap-3 py-2">
                <Checkbox
                  id="allow_negative_balance"
                  checked={formData.allow_negative_balance}
                  onCheckedChange={(v) => setFormData({ ...formData, allow_negative_balance: v === true })}
                />
                <Label htmlFor="allow_negative_balance">
                  {language === "ar" ? "السماح بالسحب (رصيد سالب للبطاقات الائتمانية)" : "Allow Withdraw (Negative Balance for Credit Cards)"}
                </Label>
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
                {editingBank 
                  ? (language === "ar" ? "تحديث" : "Update")
                  : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة البنوك" : "Banks List"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الكود" : "Code"}</TableHead>
                <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                <TableHead>{language === "ar" ? "رقم الحساب" : "Account No."}</TableHead>
                <TableHead>{language === "ar" ? "IBAN" : "IBAN"}</TableHead>
                <TableHead>{language === "ar" ? "العملة" : "Currency"}</TableHead>
                <TableHead>{language === "ar" ? "الرصيد الحالي" : "Current Balance"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((bank) => (
                <TableRow key={bank.id}>
                  <TableCell className="font-mono">{bank.bank_code}</TableCell>
                  <TableCell>{language === "ar" && bank.bank_name_ar ? bank.bank_name_ar : bank.bank_name}</TableCell>
                  <TableCell>{bank.account_number || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{bank.iban || "-"}</TableCell>
                  <TableCell>{getCurrencyName(bank.currency_id)}</TableCell>
                  <TableCell className="font-semibold">{bank.current_balance.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${bank.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {bank.is_active ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleEdit(bank)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleDelete(bank.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {banks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد بنوك" : "No banks found"}
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

export default BankSetup;
