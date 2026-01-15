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
import { Plus, Vault, Save, Check, Send, ArrowRightLeft } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface TreasuryEntryType {
  id: string;
  entry_number: string;
  treasury_id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  balance_after: number | null;
  expense_request_id: string | null;
  description: string | null;
  status: string;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  posted_by: string | null;
  posted_at: string | null;
  transfer_type: string | null;
  to_treasury_id: string | null;
  to_bank_id: string | null;
  from_currency_id: string | null;
  to_currency_id: string | null;
  exchange_rate: number | null;
  converted_amount: number | null;
  bank_charges: number | null;
  other_charges: number | null;
}

interface Treasury {
  id: string;
  treasury_code: string;
  treasury_name: string;
  treasury_name_ar: string | null;
  current_balance: number;
  currency_id: string | null;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_name_ar: string | null;
  current_balance: number;
  currency_id: string | null;
}

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_name_ar: string | null;
  is_base: boolean;
}

interface CurrencyRate {
  id: string;
  currency_id: string;
  rate_to_base: number;
  effective_date: string;
}

interface ExpenseRequest {
  id: string;
  request_number: string;
  description: string;
  amount: number;
}

const ENTRY_TYPES = [
  { value: "receipt", labelEn: "Receipt", labelAr: "إيصال" },
  { value: "payment", labelEn: "Payment", labelAr: "صرف" },
  { value: "transfer", labelEn: "Transfer", labelAr: "تحويل" },
];

const TRANSFER_TYPES = [
  { value: "treasury_to_treasury", labelEn: "Treasury to Treasury", labelAr: "من خزينة إلى خزينة" },
  { value: "treasury_to_bank", labelEn: "Treasury to Bank", labelAr: "من الخزينة إلى البنك" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  posted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const TreasuryEntry = () => {
  const { language } = useLanguage();
  const [entries, setEntries] = useState<TreasuryEntryType[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [expenseRequests, setExpenseRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [formData, setFormData] = useState({
    treasury_id: "",
    entry_date: format(new Date(), "yyyy-MM-dd"),
    entry_type: "payment",
    amount: 0,
    expense_request_id: "",
    description: "",
    transfer_type: "",
    to_treasury_id: "",
    to_bank_id: "",
    from_currency_id: "",
    to_currency_id: "",
    exchange_rate: 1,
    converted_amount: 0,
    bank_charges: 0,
    other_charges: 0,
  });

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  useEffect(() => {
    // Auto-calculate converted amount
    const netAmount = formData.amount - formData.bank_charges - formData.other_charges;
    const converted = netAmount * formData.exchange_rate;
    setFormData(prev => ({ ...prev, converted_amount: converted }));
  }, [formData.amount, formData.exchange_rate, formData.bank_charges, formData.other_charges]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [entriesRes, treasuriesRes, banksRes, currenciesRes, ratesRes, requestsRes] = await Promise.all([
        supabase.from("treasury_entries").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("treasuries").select("id, treasury_code, treasury_name, treasury_name_ar, current_balance, currency_id").eq("is_active", true),
        supabase.from("banks").select("id, bank_code, bank_name, bank_name_ar, current_balance, currency_id").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code, currency_name, currency_name_ar, is_base").eq("is_active", true),
        supabase.from("currency_rates").select("*").order("effective_date", { ascending: false }),
        supabase.from("expense_requests").select("id, request_number, description, amount")
          .eq("payment_method", "treasury")
          .eq("status", "approved"),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (ratesRes.error) throw ratesRes.error;
      if (requestsRes.error) throw requestsRes.error;

      setEntries(entriesRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setBanks(banksRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setCurrencyRates(ratesRes.data || []);
      setExpenseRequests(requestsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.treasury_id || !formData.amount || !formData.entry_type) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    if (formData.entry_type === "transfer") {
      if (!formData.transfer_type) {
        toast.error(language === "ar" ? "يرجى اختيار نوع التحويل" : "Please select transfer type");
        return;
      }
      if (formData.transfer_type === "treasury_to_treasury" && !formData.to_treasury_id) {
        toast.error(language === "ar" ? "يرجى اختيار الخزينة المحولة إليها" : "Please select destination treasury");
        return;
      }
      if (formData.transfer_type === "treasury_to_bank" && !formData.to_bank_id) {
        toast.error(language === "ar" ? "يرجى اختيار البنك المحول إليه" : "Please select destination bank");
        return;
      }
    }

    try {
      const { error } = await supabase.from("treasury_entries").insert([{
        treasury_id: formData.treasury_id,
        entry_date: formData.entry_date,
        entry_type: formData.entry_type,
        entry_number: "TEMP",
        amount: formData.amount,
        expense_request_id: formData.expense_request_id || null,
        description: formData.description || null,
        status: "draft",
        created_by: currentUserId,
        transfer_type: formData.entry_type === "transfer" ? formData.transfer_type : null,
        to_treasury_id: formData.transfer_type === "treasury_to_treasury" ? formData.to_treasury_id : null,
        to_bank_id: formData.transfer_type === "treasury_to_bank" ? formData.to_bank_id : null,
        from_currency_id: formData.from_currency_id || null,
        to_currency_id: formData.to_currency_id || null,
        exchange_rate: formData.exchange_rate,
        converted_amount: formData.converted_amount,
        bank_charges: formData.bank_charges,
        other_charges: formData.other_charges,
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
          const treasury = treasuries.find(t => t.id === entry.treasury_id);
          if (treasury) {
            const totalDeduction = (entry.bank_charges || 0) + (entry.other_charges || 0);
            const newBalance = entry.entry_type === "receipt" 
              ? treasury.current_balance + entry.amount
              : treasury.current_balance - entry.amount - totalDeduction;
            
            await supabase.from("treasuries").update({ current_balance: newBalance }).eq("id", entry.treasury_id);
            updateData.balance_after = newBalance;

            // Handle transfer destination
            if (entry.entry_type === "transfer" && entry.transfer_type) {
              if (entry.transfer_type === "treasury_to_treasury" && entry.to_treasury_id) {
                const toTreasury = treasuries.find(t => t.id === entry.to_treasury_id);
                if (toTreasury) {
                  const creditAmount = entry.converted_amount || entry.amount;
                  await supabase.from("treasuries").update({ 
                    current_balance: toTreasury.current_balance + creditAmount 
                  }).eq("id", entry.to_treasury_id);
                }
              } else if (entry.transfer_type === "treasury_to_bank" && entry.to_bank_id) {
                const toBank = banks.find(b => b.id === entry.to_bank_id);
                if (toBank) {
                  const creditAmount = entry.converted_amount || entry.amount;
                  await supabase.from("banks").update({ 
                    current_balance: toBank.current_balance + creditAmount 
                  }).eq("id", entry.to_bank_id);
                }
              }
            }
          }
        }
      }

      const { error } = await supabase.from("treasury_entries").update(updateData).eq("id", id);
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
      treasury_id: "",
      entry_date: format(new Date(), "yyyy-MM-dd"),
      entry_type: "payment",
      amount: 0,
      expense_request_id: "",
      description: "",
      transfer_type: "",
      to_treasury_id: "",
      to_bank_id: "",
      from_currency_id: "",
      to_currency_id: "",
      exchange_rate: 1,
      converted_amount: 0,
      bank_charges: 0,
      other_charges: 0,
    });
  };

  const getTreasuryName = (treasuryId: string) => {
    const treasury = treasuries.find((t) => t.id === treasuryId);
    return treasury 
      ? (language === "ar" && treasury.treasury_name_ar ? treasury.treasury_name_ar : treasury.treasury_name)
      : "-";
  };

  const getBankName = (bankId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    return bank ? (language === "ar" && bank.bank_name_ar ? bank.bank_name_ar : bank.bank_name) : "-";
  };

  const getEntryTypeLabel = (type: string) => {
    const found = ENTRY_TYPES.find(t => t.value === type);
    return found ? (language === "ar" ? found.labelAr : found.labelEn) : type;
  };

  const getTransferTypeLabel = (type: string) => {
    const found = TRANSFER_TYPES.find(t => t.value === type);
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

  // Get the latest rate for a currency (rate_to_base)
  // Base currency always has rate 1, other currencies use their stored rate
  const getLatestRate = (currencyId: string): number => {
    // Check if this is the base currency
    const currency = currencies.find(c => c.id === currencyId);
    if (currency?.is_base) return 1;
    
    // Find the rate from currency_rates table
    const rate = currencyRates.find(r => r.currency_id === currencyId);
    return rate?.rate_to_base || 1;
  };

  // Calculate exchange rate between two currencies
  // rate_to_base means: 1 SAR = X units of this currency (e.g., USD rate = 0.2667 means 1 SAR = 0.2667 USD)
  const calculateExchangeRate = (fromCurrencyId: string, toCurrencyId: string): number => {
    if (!fromCurrencyId || !toCurrencyId || fromCurrencyId === toCurrencyId) return 1;
    const fromRate = getLatestRate(fromCurrencyId);
    const toRate = getLatestRate(toCurrencyId);
    // Formula: toRate / fromRate
    return toRate / fromRate;
  };

  const handleTreasurySelect = (treasuryId: string) => {
    const treasury = treasuries.find(t => t.id === treasuryId);
    const newFromCurrencyId = treasury?.currency_id || "";
    const newRate = calculateExchangeRate(newFromCurrencyId, formData.to_currency_id);
    setFormData({
      ...formData,
      treasury_id: treasuryId,
      from_currency_id: newFromCurrencyId,
      exchange_rate: newRate,
    });
  };

  const handleToTreasurySelect = (treasuryId: string) => {
    const treasury = treasuries.find(t => t.id === treasuryId);
    const newToCurrencyId = treasury?.currency_id || "";
    const newRate = calculateExchangeRate(formData.from_currency_id, newToCurrencyId);
    setFormData({
      ...formData,
      to_treasury_id: treasuryId,
      to_currency_id: newToCurrencyId,
      exchange_rate: newRate,
    });
  };

  const handleToBankSelect = (bankId: string) => {
    const bank = banks.find(b => b.id === bankId);
    const newToCurrencyId = bank?.currency_id || "";
    const newRate = calculateExchangeRate(formData.from_currency_id, newToCurrencyId);
    setFormData({
      ...formData,
      to_bank_id: bankId,
      to_currency_id: newToCurrencyId,
      exchange_rate: newRate,
    });
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Vault className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "قيود الخزينة" : "Treasury Entries"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة قيد" : "Add Entry"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إضافة قيد خزينة جديد" : "Add New Treasury Entry"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الخزينة المصدر *" : "Source Treasury *"}</Label>
                <Select value={formData.treasury_id} onValueChange={handleTreasurySelect}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} />
                  </SelectTrigger>
                  <SelectContent>
                    {treasuries.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.treasury_code} - {language === "ar" && t.treasury_name_ar ? t.treasury_name_ar : t.treasury_name}
                        <span className="text-muted-foreground text-xs ml-2">
                          ({language === "ar" ? "الرصيد:" : "Balance:"} {t.current_balance.toLocaleString()})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نوع القيد *" : "Entry Type *"}</Label>
                  <Select value={formData.entry_type} onValueChange={(v) => setFormData({ ...formData, entry_type: v, transfer_type: "" })}>
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

              {formData.entry_type === "transfer" && (
                <>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "نوع التحويل *" : "Transfer Type *"}</Label>
                    <Select value={formData.transfer_type} onValueChange={(v) => setFormData({ ...formData, transfer_type: v, to_treasury_id: "", to_bank_id: "" })}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر نوع التحويل" : "Select Transfer Type"} />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSFER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {language === "ar" ? t.labelAr : t.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.transfer_type === "treasury_to_treasury" && (
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "الخزينة المحولة إليها *" : "Destination Treasury *"}</Label>
                      <Select value={formData.to_treasury_id} onValueChange={handleToTreasurySelect}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} />
                        </SelectTrigger>
                        <SelectContent>
                          {treasuries.filter(t => t.id !== formData.treasury_id).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.treasury_code} - {language === "ar" && t.treasury_name_ar ? t.treasury_name_ar : t.treasury_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.transfer_type === "treasury_to_bank" && (
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "البنك المحول إليه *" : "Destination Bank *"}</Label>
                      <Select value={formData.to_bank_id} onValueChange={handleToBankSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر البنك" : "Select Bank"} />
                        </SelectTrigger>
                        <SelectContent>
                          {banks.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.bank_code} - {language === "ar" && b.bank_name_ar ? b.bank_name_ar : b.bank_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "عملة المصدر" : "Source Currency"}</Label>
                      <Select value={formData.from_currency_id} onValueChange={(v) => {
                        const newRate = calculateExchangeRate(v, formData.to_currency_id);
                        setFormData({ ...formData, from_currency_id: v, exchange_rate: newRate });
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select Currency"} />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.currency_code} - {language === "ar" && c.currency_name_ar ? c.currency_name_ar : c.currency_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "عملة الوجهة" : "Destination Currency"}</Label>
                      <Select value={formData.to_currency_id} onValueChange={(v) => {
                        const newRate = calculateExchangeRate(formData.from_currency_id, v);
                        setFormData({ ...formData, to_currency_id: v, exchange_rate: newRate });
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select Currency"} />
                        </SelectTrigger>
                        <SelectContent>
                          {currencies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.currency_code} - {language === "ar" && c.currency_name_ar ? c.currency_name_ar : c.currency_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "سعر الصرف" : "Exchange Rate"}</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={formData.exchange_rate}
                        onChange={(e) => setFormData({ ...formData, exchange_rate: parseFloat(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "عمولة البنك" : "Bank Charges"}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.bank_charges}
                        onChange={(e) => setFormData({ ...formData, bank_charges: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "مصاريف أخرى" : "Other Charges"}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.other_charges}
                        onChange={(e) => setFormData({ ...formData, other_charges: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{language === "ar" ? "المبلغ المحول" : "Converted Amount"}</span>
                      <span className="text-lg font-bold text-primary">{formData.converted_amount.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}

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
          <CardTitle>{language === "ar" ? "قيود الخزينة" : "Treasury Entries"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "رقم القيد" : "Entry No."}</TableHead>
                <TableHead>{language === "ar" ? "الخزينة" : "Treasury"}</TableHead>
                <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{language === "ar" ? "التحويل إلى" : "Transfer To"}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.entry_number}</TableCell>
                  <TableCell>{getTreasuryName(entry.treasury_id)}</TableCell>
                  <TableCell>{format(new Date(entry.entry_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={entry.entry_type === "receipt" ? "default" : "secondary"}>
                        {getEntryTypeLabel(entry.entry_type)}
                      </Badge>
                      {entry.transfer_type && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ArrowRightLeft className="h-3 w-3" />
                          {getTransferTypeLabel(entry.transfer_type)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.to_treasury_id && getTreasuryName(entry.to_treasury_id)}
                    {entry.to_bank_id && getBankName(entry.to_bank_id)}
                    {!entry.to_treasury_id && !entry.to_bank_id && "-"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    <span className={entry.entry_type === "receipt" ? "text-green-600" : "text-red-600"}>
                      {entry.entry_type === "receipt" ? "+" : "-"}{entry.amount.toLocaleString()}
                    </span>
                    {entry.converted_amount && entry.converted_amount !== entry.amount && (
                      <div className="text-xs text-muted-foreground">
                        → {entry.converted_amount.toLocaleString()}
                      </div>
                    )}
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

export default TreasuryEntry;