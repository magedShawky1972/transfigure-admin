import { useState, useEffect, useCallback, useRef } from "react";
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
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Plus, Trash2, Save, FileText, Receipt, ArrowLeft, Printer, Upload, Lock } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ExpenseEntryPrint } from "@/components/ExpenseEntryPrint";
import * as XLSX from "xlsx";

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

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
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

const ExpenseEntryForm = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isViewOnly = searchParams.get('view') === 'true';
  const shouldPrint = searchParams.get('print') === 'true';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  
  // Master data
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  
  // Form data
  const [entryNumber, setEntryNumber] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expenseReference, setExpenseReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "treasury">("treasury");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");
  const [selectedCurrencyId, setSelectedCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ExpenseEntryLine[]>([]);
  const [status, setStatus] = useState("draft");
  const [existingEntryId, setExistingEntryId] = useState<string | null>(null);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState("");

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (id && expenseTypes.length > 0) {
      loadEntry(id);
    }
  }, [id, expenseTypes]);

  // Auto-trigger print if print param is passed
  useEffect(() => {
    if (shouldPrint && existingEntryId && !loading && lines.length > 0) {
      handlePrint();
    }
  }, [shouldPrint, existingEntryId, loading, lines.length]);

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
    if (user) {
      setCurrentUserId(user.id);
      // Get user name from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("id", user.id)
        .single();
      if (profile) {
        setCurrentUserName(profile.user_name || user.email || "");
      } else {
        setCurrentUserName(user.email || "");
      }
    }
  };

  const loadExchangeRate = useCallback((currencyId: string) => {
    const rate = currencyRates.find(r => r.currency_id === currencyId);
    // For expense entry, we store the rate_to_base value
    // The operator will be used during conversion calculations
    setExchangeRate(rate?.rate_to_base || 1);
  }, [currencyRates]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [typesRes, banksRes, treasuriesRes, currenciesRes, ratesRes, costCentersRes] = await Promise.all([
        supabase.from("expense_types").select("id, expense_name, expense_name_ar").eq("is_active", true),
        supabase.from("banks").select("id, bank_name, bank_name_ar, currency_id").eq("is_active", true),
        supabase.from("treasuries").select("id, treasury_name, treasury_name_ar, currency_id").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code, currency_name").eq("is_active", true),
        supabase.from("currency_rates").select("id, currency_id, rate_to_base, effective_date").order("effective_date", { ascending: false }),
        supabase.from("cost_centers").select("id, cost_center_code, cost_center_name, cost_center_name_ar").eq("is_active", true),
      ]);

      if (typesRes.error) throw typesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (ratesRes.error) throw ratesRes.error;
      if (costCentersRes.error) throw costCentersRes.error;

      setExpenseTypes(typesRes.data || []);
      setBanks(banksRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setCurrencyRates(ratesRes.data || []);
      setCostCenters(costCentersRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const loadEntry = async (entryId: string) => {
    try {
      const { data: entry, error: entryError } = await supabase
        .from("expense_entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (entryError) throw entryError;

      const { data: entryLines, error: linesError } = await supabase
        .from("expense_entry_lines")
        .select("*")
        .eq("expense_entry_id", entryId)
        .order("line_number");

      if (linesError) throw linesError;

      setExistingEntryId(entry.id);
      setEntryNumber(entry.entry_number);
      setEntryDate(entry.entry_date);
      setExpenseReference(entry.expense_reference || "");
      setPaymentMethod(entry.payment_method as "bank" | "treasury");
      setSelectedBankId(entry.bank_id || "");
      setSelectedTreasuryId(entry.treasury_id || "");
      setSelectedCurrencyId(entry.currency_id || "");
      setExchangeRate(entry.exchange_rate || 1);
      setNotes(entry.notes || "");
      setStatus(entry.status);
      setSelectedCostCenterId((entry as any).cost_center_id || "");
      setLines(entryLines.map(line => ({
        id: line.id,
        line_number: line.line_number,
        expense_type_id: line.expense_type_id || "",
        description: line.description || "",
        quantity: line.quantity || 1,
        unit_price: line.unit_price || 0,
        total: line.total || 0,
        vat_percent: line.vat_percent || 0,
        vat_amount: line.vat_amount || 0,
        line_total: line.line_total || 0,
      })));
    } catch (error) {
      console.error("Error loading entry:", error);
      toast.error(language === "ar" ? "خطأ في تحميل القيد" : "Error loading entry");
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

  const handleSave = async (saveStatus: "draft" | "pending" = "draft") => {
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
      const newEntryNumber = existingEntryId ? entryNumber : generateEntryNumber();

      if (existingEntryId) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from("expense_entries")
          .update({
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
            status: saveStatus,
            notes: notes || null,
            cost_center_id: selectedCostCenterId || null,
          })
          .eq("id", existingEntryId);

        if (updateError) throw updateError;

        // Delete existing lines and re-insert
        await supabase.from("expense_entry_lines").delete().eq("expense_entry_id", existingEntryId);

        const lineInserts = lines.map(line => ({
          expense_entry_id: existingEntryId,
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
      } else {
        // Insert new entry
        const { data: entryData, error: entryError } = await supabase
          .from("expense_entries")
          .insert({
            entry_number: newEntryNumber,
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
            status: saveStatus,
            notes: notes || null,
            created_by: currentUserId,
            cost_center_id: selectedCostCenterId || null,
          })
          .select()
          .single();

        if (entryError) throw entryError;

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

        setExistingEntryId(entryData.id);
        setEntryNumber(newEntryNumber);
      }

      toast.success(language === "ar" ? "تم حفظ القيد بنجاح" : "Entry saved successfully");
      setStatus(saveStatus);
    } catch (error: any) {
      console.error("Error saving entry:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحفظ" : "Error saving"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!showPrint) return;
    const handleAfterPrint = () => setShowPrint(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [showPrint]);

  const handlePrint = () => {
    setShowPrint(true);
    // Give React time to render the print layout before opening the print dialog
    setTimeout(() => window.print(), 400);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        const importedLines: ExpenseEntryLine[] = jsonData.map((row: any, index: number) => {
          const expenseTypeName = row["Expense Type"] || row["نوع المصروف"] || "";
          const expenseType = expenseTypes.find(t => 
            t.expense_name.toLowerCase() === expenseTypeName.toLowerCase() || 
            t.expense_name_ar === expenseTypeName
          );

          const quantity = Number(row["Quantity"] || row["الكمية"] || 1);
          const unitPrice = Number(row["Unit Price"] || row["سعر الوحدة"] || 0);
          const vatPercent = Number(row["VAT %"] || row["الضريبة %"] || 0);
          const total = quantity * unitPrice;
          const vatAmount = total * (vatPercent / 100);

          return {
            line_number: index + 1,
            expense_type_id: expenseType?.id || "",
            description: row["Description"] || row["الوصف"] || "",
            quantity,
            unit_price: unitPrice,
            total,
            vat_percent: vatPercent,
            vat_amount: vatAmount,
            line_total: total + vatAmount,
          };
        });

        setLines(importedLines);
        toast.success(language === "ar" ? `تم استيراد ${importedLines.length} بند` : `Imported ${importedLines.length} lines`);
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Error importing Excel:", error);
      toast.error(language === "ar" ? "خطأ في استيراد الملف" : "Error importing file");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatNumber = (num: number) => num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // Print view
  if (showPrint) {
    return (
      <ExpenseEntryPrint
        ref={printRef}
        language={language}
        entryNumber={entryNumber || generateEntryNumber()}
        entryDate={entryDate}
        expenseReference={expenseReference}
        paymentMethod={paymentMethod}
        bankName={getBankName(selectedBankId)}
        treasuryName={getTreasuryName(selectedTreasuryId)}
        currencyCode={getCurrencyCode(selectedCurrencyId)}
        exchangeRate={exchangeRate}
        lines={lines}
        expenseTypes={expenseTypes}
        subtotal={subtotal}
        totalVat={totalVat}
        grandTotal={grandTotal}
        notes={notes}
        createdBy={currentUserName}
        status={status}
      />
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/expense-entry")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {isViewOnly 
                ? (language === "ar" ? "عرض قيد المصروفات" : "View Expense Entry")
                : id 
                  ? (language === "ar" ? "تعديل قيد المصروفات" : "Edit Expense Entry") 
                  : (language === "ar" ? "قيد مصروفات جديد" : "New Expense Entry")}
              {isViewOnly && <Lock className="h-4 w-4 text-muted-foreground ml-2" />}
            </CardTitle>
          </div>
          <div className="flex gap-2">
            {!isViewOnly && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls"
                  onChange={handleExcelImport}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />
                  {language === "ar" ? "استيراد من Excel" : "Import Excel"}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handlePrint} disabled={lines.length === 0}>
              <Printer className="h-4 w-4 mr-1" />
              {language === "ar" ? "طباعة" : "Print"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4">
            <div>
              <Label>{language === "ar" ? "رقم القيد" : "Entry Number"}</Label>
              <Input value={entryNumber || (language === "ar" ? "سيتم التوليد تلقائياً" : "Auto-generated")} disabled className="bg-muted" />
            </div>
            <div>
              <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} disabled={isViewOnly} />
            </div>
            <div>
              <Label>{language === "ar" ? "المرجع" : "Reference"}</Label>
              <Input value={expenseReference} onChange={(e) => setExpenseReference(e.target.value)} placeholder={language === "ar" ? "رقم مرجعي" : "Reference #"} disabled={isViewOnly} />
            </div>
            <div>
              <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
              <Select value={paymentMethod} onValueChange={(v: "bank" | "treasury") => {
                setPaymentMethod(v);
                setSelectedBankId("");
                setSelectedTreasuryId("");
                setSelectedCurrencyId("");
                setExchangeRate(1);
              }} disabled={isViewOnly}>
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
                <Select value={selectedBankId} onValueChange={setSelectedBankId} disabled={isViewOnly}>
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
                <Select value={selectedTreasuryId} onValueChange={setSelectedTreasuryId} disabled={isViewOnly}>
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
              }} disabled={isViewOnly}>
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
              <Input type="number" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} step="0.0001" disabled={isViewOnly} />
            </div>
            <div>
              <Label>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</Label>
              <Select value={selectedCostCenterId || "__none__"} onValueChange={(v) => setSelectedCostCenterId(v === "__none__" ? "" : v)} disabled={isViewOnly}>
                <SelectTrigger><SelectValue placeholder={language === "ar" ? "اختر مركز التكلفة" : "Select Cost Center"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{language === "ar" ? "بدون" : "None"}</SelectItem>
                  {costCenters.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.cost_center_code} - {language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lines Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-lg font-semibold">{language === "ar" ? "بنود المصروفات" : "Expense Lines"}</Label>
              {!isViewOnly && (
                <Button size="sm" variant="outline" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  {language === "ar" ? "إضافة بند" : "Add Line"}
                </Button>
              )}
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
                    {!isViewOnly && <TableHead className="w-12"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isViewOnly ? 9 : 10} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد بنود" : "No lines"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{line.line_number}</TableCell>
                        <TableCell>
                          {isViewOnly ? (
                            <span>{getExpenseTypeName(line.expense_type_id)}</span>
                          ) : (
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
                          )}
                        </TableCell>
                        <TableCell>
                          {isViewOnly ? (
                            <span>{line.description || "-"}</span>
                          ) : (
                            <Input value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} placeholder={language === "ar" ? "وصف" : "Description"} />
                          )}
                        </TableCell>
                        <TableCell>
                          {isViewOnly ? (
                            <span className="font-mono">{line.quantity}</span>
                          ) : (
                            <Input type="number" value={String(line.quantity)} onChange={(e) => updateLine(index, "quantity", e.target.value)} min="0" step="0.001" className="w-20" />
                          )}
                        </TableCell>
                        <TableCell>
                          {isViewOnly ? (
                            <span className="font-mono">{formatNumber(line.unit_price)}</span>
                          ) : (
                            <Input type="number" value={String(line.unit_price)} onChange={(e) => updateLine(index, "unit_price", e.target.value)} min="0" step="0.01" className="w-24" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-right">{formatNumber(line.total)}</TableCell>
                        <TableCell>
                          {isViewOnly ? (
                            <span className="font-mono">{line.vat_percent}%</span>
                          ) : (
                            <Input type="number" value={String(line.vat_percent)} onChange={(e) => updateLine(index, "vat_percent", e.target.value)} min="0" max="100" step="0.01" className="w-16" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-right">{formatNumber(line.vat_amount)}</TableCell>
                        <TableCell className="font-mono text-right font-semibold">{formatNumber(line.line_total)}</TableCell>
                        {!isViewOnly && (
                          <TableCell>
                            <Button size="icon" variant="ghost" className="text-red-600" onClick={() => removeLine(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
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
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} disabled={isViewOnly} />
          </div>

          {/* Actions - only show if not view-only */}
          {!isViewOnly && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate("/expense-entry")}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
              <Button variant="secondary" onClick={() => handleSave("draft")} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {language === "ar" ? "حفظ كمسودة" : "Save Draft"}
              </Button>
              <Button onClick={() => handleSave("pending")} disabled={saving}>
                <FileText className="h-4 w-4 mr-1" />
                {language === "ar" ? "حفظ وإرسال" : "Save & Submit"}
              </Button>
            </div>
          )}
          
          {isViewOnly && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => navigate("/expense-entry")}>
                {language === "ar" ? "رجوع" : "Back"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseEntryForm;
