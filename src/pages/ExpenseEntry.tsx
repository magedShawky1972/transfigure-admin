import { useState, useEffect, useCallback } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Plus, Trash2, Save, Check, X, DollarSign, FileText, Receipt } from "lucide-react";

interface ExpenseType {
  id: string;
  expense_name: string;
  expense_name_ar: string | null;
}

interface Bank {
  id: string;
  bank_name: string;
  bank_name_ar: string | null;
  currency_id: string | null;
}

interface Treasury {
  id: string;
  treasury_name: string;
  treasury_name_ar: string | null;
  currency_id: string | null;
}

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
}

interface CurrencyRate {
  id: string;
  currency_id: string;
  rate_to_base: number;
  effective_date: string;
}

interface ExpenseEntryLine {
  id?: string;
  line_number: number;
  expense_type_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_percent: number;
  vat_amount: number;
  line_total: number;
}

interface ExpenseEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  expense_reference: string | null;
  payment_method: string;
  bank_id: string | null;
  treasury_id: string | null;
  currency_id: string | null;
  exchange_rate: number;
  subtotal: number;
  total_vat: number;
  grand_total: number;
  status: string;
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const ExpenseEntry = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Master data
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Entries list
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // New entry form
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expenseReference, setExpenseReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "treasury">("treasury");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ExpenseEntryLine[]>([]);

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [selectedMonth, selectedYear]);

  // Auto-load currency and rate when bank/treasury changes
  useEffect(() => {
    if (paymentMethod === "bank" && selectedBankId) {
      const bank = banks.find(b => b.id === selectedBankId);
      if (bank?.currency_id) {
        setSelectedCurrencyId(bank.currency_id);
        loadExchangeRate(bank.currency_id);
      }
    } else if (paymentMethod === "treasury" && selectedTreasuryId) {
      const treasury = treasuries.find(t => t.id === selectedTreasuryId);
      if (treasury?.currency_id) {
        setSelectedCurrencyId(treasury.currency_id);
        loadExchangeRate(treasury.currency_id);
      }
    }
  }, [paymentMethod, selectedBankId, selectedTreasuryId, banks, treasuries]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const loadExchangeRate = useCallback((currencyId: string) => {
    const rate = currencyRates.find(r => r.currency_id === currencyId);
    setExchangeRate(rate?.rate_to_base || 1);
  }, [currencyRates]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, banksRes, treasuriesRes, currenciesRes, ratesRes] = await Promise.all([
        supabase.from("expense_types").select("id, expense_name, expense_name_ar").eq("is_active", true),
        supabase.from("banks").select("id, bank_name, bank_name_ar, currency_id").eq("is_active", true),
        supabase.from("treasuries").select("id, treasury_name, treasury_name_ar, currency_id").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code, currency_name").eq("is_active", true),
        supabase.from("currency_rates").select("id, currency_id, rate_to_base, effective_date").order("effective_date", { ascending: false }),
      ]);

      if (typesRes.error) throw typesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (ratesRes.error) throw ratesRes.error;

      setExpenseTypes(typesRes.data || []);
      setBanks(banksRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setCurrencyRates(ratesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("expense_entries")
        .select("*")
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error fetching entries:", error);
    }
  };

  const generateEntryNumber = () => {
    const date = new Date();
    return `EXE${date.getFullYear().toString().slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
  };

  const addLine = () => {
    const newLine: ExpenseEntryLine = {
      line_number: lines.length + 1,
      expense_type_id: "",
      description: "",
      quantity: 1,
      unit_price: 0,
      total: 0,
      vat_percent: 0,
      vat_amount: 0,
      line_total: 0,
    };
    setLines([...lines, newLine]);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index).map((line, i) => ({
      ...line,
      line_number: i + 1,
    }));
    setLines(newLines);
  };

  const updateLine = (index: number, field: keyof ExpenseEntryLine, value: any) => {
    const newLines = [...lines];
    const line = { ...newLines[index], [field]: value };
    
    // Recalculate totals
    const quantity = field === "quantity" ? Number(value) : line.quantity;
    const unitPrice = field === "unit_price" ? Number(value) : line.unit_price;
    const vatPercent = field === "vat_percent" ? Number(value) : line.vat_percent;
    
    line.total = quantity * unitPrice;
    line.vat_amount = line.total * (vatPercent / 100);
    line.line_total = line.total + line.vat_amount;
    
    newLines[index] = line;
    setLines(newLines);
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const totalVat = lines.reduce((sum, line) => sum + line.vat_amount, 0);
    const grandTotal = lines.reduce((sum, line) => sum + line.line_total, 0);
    return { subtotal, totalVat, grandTotal };
  };

  const handleSave = async (status: "draft" | "pending" = "draft") => {
    // Validation
    if (paymentMethod === "bank" && !selectedBankId) {
      toast.error(language === "ar" ? "يرجى اختيار البنك" : "Please select a bank");
      return;
    }
    if (paymentMethod === "treasury" && !selectedTreasuryId) {
      toast.error(language === "ar" ? "يرجى اختيار الخزينة" : "Please select a treasury");
      return;
    }
    if (lines.length === 0) {
      toast.error(language === "ar" ? "يرجى إضافة بند واحد على الأقل" : "Please add at least one line");
      return;
    }
    for (const line of lines) {
      if (!line.expense_type_id) {
        toast.error(language === "ar" ? "يرجى اختيار نوع المصروف لجميع البنود" : "Please select expense type for all lines");
        return;
      }
    }

    setSaving(true);
    try {
      const { subtotal, totalVat, grandTotal } = calculateTotals();

      // Insert header
      const { data: entryData, error: entryError } = await supabase
        .from("expense_entries")
        .insert({
          entry_number: generateEntryNumber(),
          entry_date: entryDate,
          expense_reference: expenseReference || null,
          payment_method: paymentMethod,
          bank_id: paymentMethod === "bank" ? selectedBankId : null,
          treasury_id: paymentMethod === "treasury" ? selectedTreasuryId : null,
          currency_id: selectedCurrencyId || null,
          exchange_rate: exchangeRate,
          subtotal,
          total_vat: totalVat,
          grand_total: grandTotal,
          status,
          notes: notes || null,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Insert lines
      const lineInserts = lines.map(line => ({
        expense_entry_id: entryData.id,
        line_number: line.line_number,
        expense_type_id: line.expense_type_id,
        description: line.description || null,
        quantity: line.quantity,
        unit_price: line.unit_price,
        total: line.total,
        vat_percent: line.vat_percent,
        vat_amount: line.vat_amount,
        line_total: line.line_total,
      }));

      const { error: linesError } = await supabase.from("expense_entry_lines").insert(lineInserts);
      if (linesError) throw linesError;

      toast.success(language === "ar" ? "تم حفظ القيد بنجاح" : "Entry saved successfully");
      resetForm();
      setDialogOpen(false);
      fetchEntries();
    } catch (error: any) {
      console.error("Error saving entry:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحفظ" : "Error saving"));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "approved") {
        updateData.approved_by = currentUserId;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === "paid") {
        const entry = entries.find(e => e.id === entryId);
        if (!entry) throw new Error("Entry not found");

        updateData.paid_by = currentUserId;
        updateData.paid_at = new Date().toISOString();

        // Create bank or treasury entry
        if (entry.payment_method === "bank" && entry.bank_id) {
          const entryNumber = `BNK${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}${String(new Date().getSeconds()).padStart(2, "0")}`;
          
          await supabase.from("bank_entries").insert({
            entry_number: entryNumber,
            bank_id: entry.bank_id,
            entry_type: "withdrawal",
            amount: entry.grand_total,
            description: `${language === "ar" ? "مصروفات: " : "Expense Entry: "}${entry.entry_number}`,
            entry_date: new Date().toISOString().split("T")[0],
            created_by: currentUserId,
            status: "approved",
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          });

          // Update bank balance
          const bank = banks.find(b => b.id === entry.bank_id);
          if (bank) {
            const { data: bankData } = await supabase.from("banks").select("current_balance").eq("id", entry.bank_id).single();
            const newBalance = (bankData?.current_balance || 0) - entry.grand_total;
            await supabase.from("banks").update({ current_balance: newBalance }).eq("id", entry.bank_id);
          }
        } else if (entry.payment_method === "treasury" && entry.treasury_id) {
          const entryNumber = `TRS${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}${String(new Date().getSeconds()).padStart(2, "0")}`;
          
          await supabase.from("treasury_entries").insert({
            entry_number: entryNumber,
            treasury_id: entry.treasury_id,
            entry_type: "withdrawal",
            amount: entry.grand_total,
            description: `${language === "ar" ? "مصروفات: " : "Expense Entry: "}${entry.entry_number}`,
            entry_date: new Date().toISOString().split("T")[0],
            created_by: currentUserId,
            status: "approved",
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          });

          // Update treasury balance
          const treasury = treasuries.find(t => t.id === entry.treasury_id);
          if (treasury) {
            const { data: treasuryData } = await supabase.from("treasuries").select("current_balance").eq("id", entry.treasury_id).single();
            const newBalance = (treasuryData?.current_balance || 0) - entry.grand_total;
            await supabase.from("treasuries").update({ current_balance: newBalance }).eq("id", entry.treasury_id);
          }
        }
      }

      const { error } = await supabase.from("expense_entries").update(updateData).eq("id", entryId);
      if (error) throw error;

      toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
      fetchEntries();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التحديث" : "Error updating"));
    }
  };

  const resetForm = () => {
    setEntryDate(format(new Date(), "yyyy-MM-dd"));
    setExpenseReference("");
    setPaymentMethod("treasury");
    setSelectedBankId("");
    setSelectedTreasuryId("");
    setSelectedCurrencyId("");
    setExchangeRate(1);
    setNotes("");
    setLines([]);
  };

  const formatNumber = (num: number) => num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      draft: { en: "Draft", ar: "مسودة" },
      pending: { en: "Pending", ar: "في الانتظار" },
      approved: { en: "Approved", ar: "معتمد" },
      paid: { en: "Paid", ar: "مدفوع" },
      rejected: { en: "Rejected", ar: "مرفوض" },
      cancelled: { en: "Cancelled", ar: "ملغي" },
    };
    return labels[status] ? (language === "ar" ? labels[status].ar : labels[status].en) : status;
  };

  const getExpenseTypeName = (typeId: string) => {
    const type = expenseTypes.find(t => t.id === typeId);
    if (!type) return "-";
    return language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name;
  };

  const getBankName = (bankId: string | null) => {
    if (!bankId) return "-";
    const bank = banks.find(b => b.id === bankId);
    return bank ? (language === "ar" && bank.bank_name_ar ? bank.bank_name_ar : bank.bank_name) : "-";
  };

  const getTreasuryName = (treasuryId: string | null) => {
    if (!treasuryId) return "-";
    const treasury = treasuries.find(t => t.id === treasuryId);
    return treasury ? (language === "ar" && treasury.treasury_name_ar ? treasury.treasury_name_ar : treasury.treasury_name) : "-";
  };

  const getCurrencyCode = (currencyId: string | null) => {
    if (!currencyId) return "-";
    const currency = currencies.find(c => c.id === currencyId);
    return currency?.currency_code || "-";
  };

  const { subtotal, totalVat, grandTotal } = calculateTotals();

  if (loading) return <LoadingOverlay />;

  return (
    <div className="container mx-auto p-4 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {language === "ar" ? "قيد المصروفات" : "Expense Entry"}
          </CardTitle>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {language === "ar" ? "قيد جديد" : "New Entry"}
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="w-32">
              <Label>{language === "ar" ? "الشهر" : "Month"}</Label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(2000, i).toLocaleString(language === "ar" ? "ar-SA" : "en-US", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label>{language === "ar" ? "السنة" : "Year"}</Label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => (
                    <SelectItem key={i} value={String(new Date().getFullYear() - 2 + i)}>
                      {new Date().getFullYear() - 2 + i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Entries Grid */}
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "رقم القيد" : "Entry #"}</TableHead>
                  <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{language === "ar" ? "المرجع" : "Reference"}</TableHead>
                  <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment"}</TableHead>
                  <TableHead>{language === "ar" ? "البنك/الخزينة" : "Bank/Treasury"}</TableHead>
                  <TableHead>{language === "ar" ? "العملة" : "Currency"}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الإجمالي" : "Grand Total"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد قيود" : "No entries found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.entry_number}</TableCell>
                      <TableCell>{format(new Date(entry.entry_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{entry.expense_reference || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entry.payment_method === "bank" 
                            ? (language === "ar" ? "بنك" : "Bank") 
                            : (language === "ar" ? "خزينة" : "Treasury")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.payment_method === "bank" 
                          ? getBankName(entry.bank_id) 
                          : getTreasuryName(entry.treasury_id)}
                      </TableCell>
                      <TableCell>{getCurrencyCode(entry.currency_id)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatNumber(entry.grand_total)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[entry.status]}>{getStatusLabel(entry.status)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {entry.status === "draft" && (
                            <Button size="sm" variant="outline" onClick={() => handleStatusChange(entry.id, "pending")}>
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                          {entry.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusChange(entry.id, "approved")}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleStatusChange(entry.id, "rejected")}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {entry.status === "approved" && (
                            <Button size="sm" variant="default" onClick={() => handleStatusChange(entry.id, "paid")}>
                              <DollarSign className="h-3 w-3" />
                            </Button>
                          )}
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

      {/* New Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir={language === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {language === "ar" ? "قيد مصروفات جديد" : "New Expense Entry"}
            </DialogTitle>
          </DialogHeader>

          {/* Header Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4">
            <div>
              <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div>
              <Label>{language === "ar" ? "المرجع" : "Reference"}</Label>
              <Input value={expenseReference} onChange={(e) => setExpenseReference(e.target.value)} placeholder={language === "ar" ? "رقم مرجعي" : "Reference #"} />
            </div>
            <div>
              <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
              <Select value={paymentMethod} onValueChange={(v: "bank" | "treasury") => {
                setPaymentMethod(v);
                setSelectedBankId("");
                setSelectedTreasuryId("");
                setSelectedCurrencyId("");
                setExchangeRate(1);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="treasury">{language === "ar" ? "خزينة" : "Treasury"}</SelectItem>
                  <SelectItem value="bank">{language === "ar" ? "بنك" : "Bank"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{paymentMethod === "bank" ? (language === "ar" ? "البنك" : "Bank") : (language === "ar" ? "الخزينة" : "Treasury")}</Label>
              {paymentMethod === "bank" ? (
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger><SelectValue placeholder={language === "ar" ? "اختر البنك" : "Select Bank"} /></SelectTrigger>
                  <SelectContent>
                    {banks.map(bank => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {language === "ar" && bank.bank_name_ar ? bank.bank_name_ar : bank.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={selectedTreasuryId} onValueChange={setSelectedTreasuryId}>
                  <SelectTrigger><SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} /></SelectTrigger>
                  <SelectContent>
                    {treasuries.map(treasury => (
                      <SelectItem key={treasury.id} value={treasury.id}>
                        {language === "ar" && treasury.treasury_name_ar ? treasury.treasury_name_ar : treasury.treasury_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>{language === "ar" ? "العملة" : "Currency"}</Label>
              <Select value={selectedCurrencyId} onValueChange={(v) => {
                setSelectedCurrencyId(v);
                loadExchangeRate(v);
              }}>
                <SelectTrigger><SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select Currency"} /></SelectTrigger>
                <SelectContent>
                  {currencies.map(currency => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.currency_code} - {currency.currency_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "سعر الصرف" : "Exchange Rate"}</Label>
              <Input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} step="0.0001" />
            </div>
          </div>

          {/* Lines Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">{language === "ar" ? "بنود المصروفات" : "Expense Lines"}</Label>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                {language === "ar" ? "إضافة بند" : "Add Line"}
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="min-w-40">{language === "ar" ? "نوع المصروف" : "Expense Type"}</TableHead>
                    <TableHead className="min-w-40">{language === "ar" ? "الوصف" : "Description"}</TableHead>
                    <TableHead className="w-24">{language === "ar" ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="w-28">{language === "ar" ? "سعر الوحدة" : "Unit Price"}</TableHead>
                    <TableHead className="w-28">{language === "ar" ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead className="w-20">{language === "ar" ? "الضريبة %" : "VAT %"}</TableHead>
                    <TableHead className="w-28">{language === "ar" ? "قيمة الضريبة" : "VAT Amount"}</TableHead>
                    <TableHead className="w-32">{language === "ar" ? "إجمالي البند" : "Line Total"}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "اضغط 'إضافة بند' لإضافة مصروف" : "Click 'Add Line' to add an expense"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{line.line_number}</TableCell>
                        <TableCell>
                          <Select value={line.expense_type_id} onValueChange={(v) => updateLine(index, "expense_type_id", v)}>
                            <SelectTrigger className="min-w-36"><SelectValue placeholder={language === "ar" ? "اختر" : "Select"} /></SelectTrigger>
                            <SelectContent>
                              {expenseTypes.map(type => (
                                <SelectItem key={type.id} value={type.id}>
                                  {language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} placeholder={language === "ar" ? "وصف" : "Description"} />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.quantity} onChange={(e) => updateLine(index, "quantity", e.target.value)} min="0" step="0.001" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={line.unit_price} onChange={(e) => updateLine(index, "unit_price", e.target.value)} min="0" step="0.01" />
                        </TableCell>
                        <TableCell className="font-mono text-right">{formatNumber(line.total)}</TableCell>
                        <TableCell>
                          <Input type="number" value={line.vat_percent} onChange={(e) => updateLine(index, "vat_percent", e.target.value)} min="0" max="100" step="0.01" />
                        </TableCell>
                        <TableCell className="font-mono text-right">{formatNumber(line.vat_amount)}</TableCell>
                        <TableCell className="font-mono text-right font-semibold">{formatNumber(line.line_total)}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="text-red-600" onClick={() => removeLine(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end">
            <div className="w-72 space-y-2 border rounded-lg p-4 bg-muted/50">
              <div className="flex justify-between">
                <span>{language === "ar" ? "المجموع الفرعي:" : "Subtotal:"}</span>
                <span className="font-mono">{formatNumber(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === "ar" ? "إجمالي الضريبة:" : "Total VAT:"}</span>
                <span className="font-mono">{formatNumber(totalVat)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{language === "ar" ? "الإجمالي الكلي:" : "Grand Total:"}</span>
                <span className="font-mono text-primary">{formatNumber(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button variant="secondary" onClick={() => handleSave("draft")} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {language === "ar" ? "حفظ كمسودة" : "Save Draft"}
            </Button>
            <Button onClick={() => handleSave("pending")} disabled={saving}>
              <FileText className="h-4 w-4 mr-1" />
              {language === "ar" ? "حفظ وإرسال" : "Save & Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseEntry;
