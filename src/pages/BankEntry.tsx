import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Save, Check, Send } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface BankEntryType {
  id: string;
  entry_number: string;
  bank_id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  balance_after: number | null;
  expense_request_id: string | null;
  check_number: string | null;
  description: string | null;
  status: string;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_name_ar: string | null;
  current_balance: number;
}

interface ExpenseRequest {
  id: string;
  request_number: string;
  description: string;
  amount: number;
}

const ENTRY_TYPES = [
  { value: "deposit", labelEn: "Deposit", labelAr: "إيداع" },
  { value: "withdrawal", labelEn: "Withdrawal", labelAr: "سحب" },
  { value: "transfer", labelEn: "Transfer", labelAr: "تحويل" },
  { value: "fee", labelEn: "Bank Fee", labelAr: "عمولة بنكية" },
  { value: "interest", labelEn: "Interest", labelAr: "فوائد" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  posted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const BankEntry = () => {
  const { language } = useLanguage();
  const [entries, setEntries] = useState<BankEntryType[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [expenseRequests, setExpenseRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [formData, setFormData] = useState({
    bank_id: "",
    entry_date: format(new Date(), "yyyy-MM-dd"),
    entry_type: "withdrawal",
    amount: 0,
    expense_request_id: "",
    check_number: "",
    description: "",
  });

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entriesRes, banksRes, requestsRes] = await Promise.all([
        supabase.from("bank_entries").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("banks").select("id, bank_code, bank_name, bank_name_ar, current_balance").eq("is_active", true),
        supabase.from("expense_requests").select("id, request_number, description, amount")
          .eq("payment_method", "bank")
          .eq("status", "approved"),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (requestsRes.error) throw requestsRes.error;

      setEntries(entriesRes.data || []);
      setBanks(banksRes.data || []);
      setExpenseRequests(requestsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.bank_id || !formData.amount || !formData.entry_type) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const { error } = await supabase.from("bank_entries").insert([{
        bank_id: formData.bank_id,
        entry_date: formData.entry_date,
        entry_type: formData.entry_type,
        entry_number: "TEMP", // Will be replaced by trigger
        amount: formData.amount,
        expense_request_id: formData.expense_request_id || null,
        check_number: formData.check_number || null,
        description: formData.description || null,
        status: "draft",
        created_by: currentUserId,
      }]);

      if (error) throw error;
      toast.success(language === "ar" ? "تم إنشاء القيد بنجاح" : "Entry created successfully");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحفظ" : "Error saving"));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "approved") {
        updateData.approved_by = currentUserId;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === "posted") {
        updateData.posted_by = currentUserId;
        updateData.posted_at = new Date().toISOString();
        
        const entry = entries.find(e => e.id === id);
        if (entry) {
          const bank = banks.find(b => b.id === entry.bank_id);
          if (bank) {
            const isCredit = ["deposit", "interest"].includes(entry.entry_type);
            const newBalance = isCredit 
              ? bank.current_balance + entry.amount
              : bank.current_balance - entry.amount;
            
            await supabase.from("banks").update({ current_balance: newBalance }).eq("id", entry.bank_id);
            updateData.balance_after = newBalance;
          }
        }
      }

      const { error } = await supabase.from("bank_entries").update(updateData).eq("id", id);
      if (error) throw error;
      
      toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
      fetchData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التحديث" : "Error updating"));
    }
  };

  const resetForm = () => {
    setFormData({
      bank_id: "",
      entry_date: format(new Date(), "yyyy-MM-dd"),
      entry_type: "withdrawal",
      amount: 0,
      expense_request_id: "",
      check_number: "",
      description: "",
    });
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank ? (language === "ar" && bank.bank_name_ar ? bank.bank_name_ar : bank.bank_name) : "-";
  };

  const getEntryTypeLabel = (type: string) => {
    const found = ENTRY_TYPES.find(t => t.value === type);
    return found ? (language === "ar" ? found.labelAr : found.labelEn) : type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      draft: { en: "Draft", ar: "مسودة" },
      pending_approval: { en: "Pending Approval", ar: "في انتظار الاعتماد" },
      approved: { en: "Approved", ar: "معتمد" },
      posted: { en: "Posted", ar: "مرحل" },
      rejected: { en: "Rejected", ar: "مرفوض" },
    };
    return labels[status] ? (language === "ar" ? labels[status].ar : labels[status].en) : status;
  };

  const handleExpenseRequestSelect = (requestId: string) => {
    const request = expenseRequests.find(r => r.id === requestId);
    if (request) {
      setFormData({
        ...formData,
        expense_request_id: requestId,
        amount: request.amount,
        description: request.description,
      });
    } else {
      setFormData({ ...formData, expense_request_id: "" });
    }
  };

  const isCredit = (type: string) => ["deposit", "interest"].includes(type);

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "قيود البنك" : "Bank Entries"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة قيد" : "Add Entry"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إضافة قيد بنك جديد" : "Add New Bank Entry"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "البنك *" : "Bank *"}</Label>
                <Select value={formData.bank_id} onValueChange={(v) => setFormData({ ...formData, bank_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر البنك" : "Select Bank"} />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bank_code} - {language === "ar" && b.bank_name_ar ? b.bank_name_ar : b.bank_name}
                        <span className="text-muted-foreground text-xs ml-2">
                          ({language === "ar" ? "الرصيد:" : "Balance:"} {b.current_balance.toLocaleString()})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نوع القيد *" : "Entry Type *"}</Label>
                  <Select value={formData.entry_type} onValueChange={(v) => setFormData({ ...formData, entry_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTRY_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {language === "ar" ? t.labelAr : t.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
                  <Input
                    type="date"
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                  />
                </div>
              </div>
              {expenseRequests.length > 0 && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "طلب مصروف (اختياري)" : "Expense Request (Optional)"}</Label>
                  <Select value={formData.expense_request_id} onValueChange={handleExpenseRequestSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر طلب مصروف" : "Select Expense Request"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{language === "ar" ? "بدون طلب" : "No Request"}</SelectItem>
                      {expenseRequests.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.request_number} - {r.amount.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "المبلغ *" : "Amount *"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم الشيك" : "Check Number"}</Label>
                  <Input
                    value={formData.check_number}
                    onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قيود البنك" : "Bank Entries"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "رقم القيد" : "Entry No."}</TableHead>
                <TableHead>{language === "ar" ? "البنك" : "Bank"}</TableHead>
                <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{language === "ar" ? "رقم الشيك" : "Check No."}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.entry_number}</TableCell>
                  <TableCell>{getBankName(entry.bank_id)}</TableCell>
                  <TableCell>{format(new Date(entry.entry_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell>
                    <Badge variant={isCredit(entry.entry_type) ? "default" : "secondary"}>
                      {getEntryTypeLabel(entry.entry_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">{entry.check_number || "-"}</TableCell>
                  <TableCell className="font-semibold">
                    <span className={isCredit(entry.entry_type) ? "text-green-600" : "text-red-600"}>
                      {isCredit(entry.entry_type) ? "+" : "-"}{entry.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[entry.status] || ""}`}>
                      {getStatusLabel(entry.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {entry.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(entry.id, "pending_approval")}>
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {entry.status === "pending_approval" && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(entry.id, "approved")}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      {entry.status === "approved" && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(entry.id, "posted")}>
                          {language === "ar" ? "ترحيل" : "Post"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد قيود" : "No entries found"}
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

export default BankEntry;
