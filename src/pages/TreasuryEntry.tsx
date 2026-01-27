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
import { Plus, Vault, Save, Check, Send, ArrowRightLeft, Filter, LayoutList, BookOpen, CalendarIcon, Printer } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getPrintLogoUrl } from "@/lib/printLogo";
import { 
  convertFromBaseCurrency, 
  convertToBaseCurrency, 
  type CurrencyRate as CurrencyRateImport,
  type Currency as CurrencyImport 
} from "@/lib/currencyConversion";

interface TreasuryEntryType {
  id: string;
  entry_number: string;
  treasury_id: string;
  entry_date: string;
  entry_type: string;
  amount: number;
  balance_before: number | null;
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
  cost_center_id: string | null;
}

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
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

type Currency = CurrencyImport;

type CurrencyRate = CurrencyRateImport;

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
  { value: "void_reversal", labelEn: "Void Reversal", labelAr: "إلغاء" },
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
  voided: "bg-purple-100 text-purple-800",
};

const TreasuryEntry = () => {
  const { language } = useLanguage();
  const [entries, setEntries] = useState<TreasuryEntryType[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenseRequests, setExpenseRequests] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedTreasuryFilter, setSelectedTreasuryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"standard" | "ledger">("ledger");
  const [dateFrom, setDateFrom] = useState<Date>(new Date("2000-01-01"));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [openingBalance, setOpeningBalance] = useState<number>(0);
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
  }, [selectedTreasuryFilter, dateFrom, dateTo]);

  useEffect(() => {
    // Auto-calculate converted amount using proper currency conversion
    if (!formData.treasury_id || formData.amount === 0) {
      setFormData(prev => ({ ...prev, converted_amount: 0 }));
      return;
    }

    const treasury = treasuries.find(t => t.id === formData.treasury_id);
    const baseCurrency = currencies.find(c => c.is_base);
    
    if (!treasury || !baseCurrency) {
      setFormData(prev => ({ ...prev, converted_amount: formData.amount }));
      return;
    }

    // First convert from source currency to base currency
    const amountInBase = convertToBaseCurrency(
      formData.amount,
      formData.from_currency_id || null,
      currencyRates,
      baseCurrency
    );

    // Then convert from base currency to treasury currency
    const amountInTreasuryCurrency = convertFromBaseCurrency(
      amountInBase,
      treasury.currency_id,
      currencyRates,
      baseCurrency
    );

    setFormData(prev => ({ ...prev, converted_amount: amountInTreasuryCurrency }));
  }, [formData.amount, formData.from_currency_id, formData.treasury_id, treasuries, currencies, currencyRates]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build entries query with optional treasury filter and date range
      const fromDateStr = format(dateFrom, "yyyy-MM-dd");
      const toDateStr = format(dateTo, "yyyy-MM-dd");
      
      let entriesQuery = supabase
        .from("treasury_entries")
        .select("*")
        .gte("entry_date", fromDateStr)
        .lte("entry_date", toDateStr)
        .order("entry_date", { ascending: true })
        .limit(1000);
      
      if (selectedTreasuryFilter !== "all") {
        entriesQuery = entriesQuery.eq("treasury_id", selectedTreasuryFilter);
      }

      // Query for opening balance (sum of all entries before dateFrom for selected treasury)
      let openingBalanceQuery = supabase
        .from("treasury_entries")
        .select("entry_type, converted_amount, amount")
        .lt("entry_date", fromDateStr)
        .eq("status", "posted");
      
      if (selectedTreasuryFilter !== "all") {
        openingBalanceQuery = openingBalanceQuery.eq("treasury_id", selectedTreasuryFilter);
      }

      const [entriesRes, treasuriesRes, banksRes, currenciesRes, ratesRes, requestsRes, costCentersRes, openingBalanceRes] = await Promise.all([
        entriesQuery,
        supabase.from("treasuries").select("id, treasury_code, treasury_name, treasury_name_ar, current_balance, currency_id, opening_balance").eq("is_active", true),
        supabase.from("banks").select("id, bank_code, bank_name, bank_name_ar, current_balance, currency_id").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code, currency_name, currency_name_ar, symbol, is_base, is_active").eq("is_active", true),
        supabase.from("currency_rates").select("id, currency_id, rate_to_base, conversion_operator, effective_date, created_at, updated_at").order("effective_date", { ascending: false }),
        supabase.from("expense_requests").select("id, request_number, description, amount")
          .eq("payment_method", "treasury")
          .eq("status", "approved"),
        supabase.from("cost_centers").select("id, cost_center_code, cost_center_name, cost_center_name_ar").eq("is_active", true),
        openingBalanceQuery,
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (ratesRes.error) throw ratesRes.error;
      if (requestsRes.error) throw requestsRes.error;
      if (costCentersRes.error) throw costCentersRes.error;

      // Calculate opening balance from entries before date range
      let calcOpeningBalance = 0;
      
      // Get treasury opening_balance if a specific treasury is selected
      if (selectedTreasuryFilter !== "all") {
        const selectedTreasury = treasuriesRes.data?.find(t => t.id === selectedTreasuryFilter);
        calcOpeningBalance = selectedTreasury?.opening_balance || 0;
      } else {
        // Sum all treasuries' opening balances
        calcOpeningBalance = (treasuriesRes.data || []).reduce((sum, t) => sum + (t.opening_balance || 0), 0);
      }
      
      // Add transactions before the date range
      if (openingBalanceRes.data) {
        for (const entry of openingBalanceRes.data) {
          const amount = entry.converted_amount || entry.amount || 0;
          if (entry.entry_type === "receipt" || entry.entry_type === "void_reversal") {
            calcOpeningBalance += amount;
          } else if (entry.entry_type === "payment" || entry.entry_type === "transfer") {
            calcOpeningBalance -= amount;
          }
        }
      }
      
      setOpeningBalance(calcOpeningBalance);
      setEntries(entriesRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setBanks(banksRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setCurrencyRates((ratesRes.data || []) as CurrencyRate[]);
      setExpenseRequests(requestsRes.data || []);
      setCostCenters(costCentersRes.data || []);
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
            // Get base currency
            const baseCurrency = currencies.find(c => c.is_base);
            
            // Convert entry amount to treasury's currency if needed
            let amountInTreasuryCurrency = entry.amount;
            if (entry.from_currency_id && entry.from_currency_id !== treasury.currency_id) {
              // First convert entry amount to base currency
              const amountInBase = convertToBaseCurrency(
                entry.amount,
                entry.from_currency_id,
                currencyRates,
                baseCurrency
              );
              // Then convert from base to treasury currency
              amountInTreasuryCurrency = convertFromBaseCurrency(
                amountInBase,
                treasury.currency_id || null,
                currencyRates,
                baseCurrency
              );
            }
            
            const totalDeduction = (entry.bank_charges || 0) + (entry.other_charges || 0);
            const newBalance = entry.entry_type === "receipt" 
              ? treasury.current_balance + amountInTreasuryCurrency
              : treasury.current_balance - amountInTreasuryCurrency - totalDeduction;
            
            // Validate sufficient balance for payments
            if (entry.entry_type === "payment" && newBalance < 0) {
              toast.error(
                language === "ar"
                  ? `رصيد الخزينة غير كافٍ. المطلوب: ${(amountInTreasuryCurrency + totalDeduction).toFixed(2)}, المتاح: ${treasury.current_balance.toFixed(2)}`
                  : `Insufficient treasury balance. Required: ${(amountInTreasuryCurrency + totalDeduction).toFixed(2)}, Available: ${treasury.current_balance.toFixed(2)}`
              );
              return;
            }
            
            // Treasury balance is automatically recalculated by database trigger
            // Just record the balance_before/after for audit trail
            updateData.balance_before = treasury.current_balance;
            updateData.balance_after = newBalance;

            // Handle transfer to bank (bank balance still needs manual update)
            if (entry.entry_type === "transfer" && entry.transfer_type === "treasury_to_bank" && entry.to_bank_id) {
              const toBank = banks.find(b => b.id === entry.to_bank_id);
              if (toBank) {
                const creditAmount = entry.converted_amount || entry.amount;
                await supabase.from("banks").update({ 
                  current_balance: toBank.current_balance + creditAmount 
                }).eq("id", entry.to_bank_id);
              }
            }
            // Note: treasury_to_treasury transfers are handled by the database trigger
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

  const getCostCenterName = (costCenterId: string | null) => {
    if (!costCenterId) return "-";
    const cc = costCenters.find((c) => c.id === costCenterId);
    return cc ? (language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name) : "-";
  };

  const getCurrencyCode = (currencyId: string | null) => {
    if (!currencyId) return "-";
    const currency = currencies.find((c) => c.id === currencyId);
    return currency?.currency_code || "-";
  };

  // Get the treasury's currency code
  const getTreasuryCurrencyCode = (treasuryId: string) => {
    const treasury = treasuries.find(t => t.id === treasuryId);
    if (!treasury?.currency_id) return "-";
    return getCurrencyCode(treasury.currency_id);
  };

  // Calculate amount in treasury's base currency
  const getAmountInTreasuryCurrency = (entry: TreasuryEntryType) => {
    const treasury = treasuries.find(t => t.id === entry.treasury_id);
    if (!treasury?.currency_id) return entry.amount;
    
    // If no from_currency specified, assume entry amount is already in treasury currency
    if (!entry.from_currency_id) return entry.amount;
    
    // If entry currency is same as treasury currency
    if (entry.from_currency_id === treasury.currency_id) return entry.amount;
    
    // Get base currency for conversion
    const baseCurrency = currencies.find(c => c.is_base);
    
    // First convert entry amount to base currency (SAR)
    const amountInBase = convertToBaseCurrency(
      entry.amount,
      entry.from_currency_id,
      currencyRates,
      baseCurrency
    );
    
    // Then convert from base to treasury currency
    const amountInTreasury = convertFromBaseCurrency(
      amountInBase,
      treasury.currency_id,
      currencyRates,
      baseCurrency
    );
    
    return amountInTreasury;
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
      voided: { en: "Voided", ar: "ملغى" },
    };
    return labels[status] ? (language === "ar" ? labels[status].ar : labels[status].en) : status;
  };

  // Ledger view Dr./Cr. logic
  const getDebitAmount = (entry: TreasuryEntryType) => {
    // Dr. = money coming IN to treasury (receipts, void reversals of payments)
    if (entry.entry_type === "receipt" || entry.entry_type === "void_reversal") {
      return entry.converted_amount || entry.amount;
    }
    return 0;
  };

  const getCreditAmount = (entry: TreasuryEntryType) => {
    // Cr. = money going OUT of treasury (payments, transfers)
    if (entry.entry_type === "payment" || entry.entry_type === "transfer") {
      return entry.converted_amount || entry.amount;
    }
    return 0;
  };

  // Print individual treasury entry
  const handlePrintEntry = (entry: TreasuryEntryType) => {
    const isRtl = language === "ar";
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      toast.error(isRtl ? "فشل فتح نافذة الطباعة" : "Failed to open print window");
      return;
    }

    const logoUrl = getPrintLogoUrl();
    const treasuryName = getTreasuryName(entry.treasury_id);
    const entryTypeLabel = getEntryTypeLabel(entry.entry_type);
    const statusLabel = getStatusLabel(entry.status);
    const debit = getDebitAmount(entry);
    const credit = getCreditAmount(entry);
    const currencyCode = getTreasuryCurrencyCode(entry.treasury_id);

    // Status ribbon colors
    const getStatusColor = (status: string) => {
      switch(status) {
        case "draft": return "#ef4444";
        case "pending_approval": return "#f59e0b";
        case "approved": return "#3b82f6";
        case "posted": return "#22c55e";
        case "voided": return "#6b7280";
        case "rejected": return "#dc2626";
        default: return "#6b7280";
      }
    };

    const html = `
      <!DOCTYPE html>
      <html dir="${isRtl ? "rtl" : "ltr"}">
      <head>
        <meta charset="UTF-8">
        <title>${isRtl ? "سند خزينة" : "Treasury Voucher"} - ${entry.entry_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { 
            height: 100%;
            font-family: Arial, sans-serif; 
            padding: 40px;
            color: #000;
            background: white;
          }
          .voucher-container {
            position: relative;
            max-width: 700px;
            margin: 0 auto;
            height: auto;
          }
          .ribbon-container {
            position: absolute;
            top: 0;
            ${isRtl ? "left: 0;" : "right: 0;"}
            width: 150px;
            height: 150px;
            overflow: hidden;
            pointer-events: none;
          }
          .ribbon {
            position: absolute;
            top: 30px;
            ${isRtl ? "left: -40px;" : "right: -40px;"}
            width: 180px;
            text-align: center;
            transform: rotate(${isRtl ? "-45deg" : "45deg"});
            color: white;
            padding: 8px 0;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            letter-spacing: 1px;
            background-color: ${getStatusColor(entry.status)};
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header img {
            width: 100px;
            height: auto;
            margin-bottom: 15px;
          }
          .header h1 {
            font-size: 26px;
            margin-bottom: 5px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .info-box {
            border: 1px solid #000;
            padding: 12px;
          }
          .info-box label {
            font-size: 12px;
            color: #666;
            display: block;
            margin-bottom: 5px;
          }
          .info-box span {
            font-size: 15px;
            font-weight: bold;
          }
          .amount-section {
            border: 3px solid #000;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
          }
          .amount-section .label {
            font-size: 16px;
            margin-bottom: 15px;
          }
          .amount-section .value {
            font-size: 36px;
            font-weight: bold;
            font-family: monospace;
          }
          .amount-section .currency {
            font-size: 18px;
            color: #666;
            margin-top: 10px;
          }
          .voided { color: #dc2626; }
          .description-box {
            border: 1px solid #000;
            padding: 20px;
            margin-bottom: 30px;
            min-height: 80px;
          }
          .description-box label {
            font-size: 12px;
            color: #666;
            display: block;
            margin-bottom: 10px;
          }
          .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 40px;
            margin-top: 60px;
          }
          .signature-box {
            text-align: center;
          }
          .signature-box .line {
            border-bottom: 1px solid #000;
            height: 60px;
            margin-bottom: 10px;
          }
          .signature-box label {
            font-size: 13px;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 15px;
          }
          @media print {
            html, body { 
              padding: 20px;
              height: auto;
            }
            @page { 
              size: A4; 
              margin: 15mm; 
            }
            .voucher-container {
              max-width: 100%;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="voucher-container">
          <div class="ribbon-container">
            <div class="ribbon">${statusLabel}</div>
          </div>

          <div class="header">
            <img src="${logoUrl}" alt="Logo" />
            <h1>${entry.entry_type === "receipt" ? (isRtl ? "سند قبض" : "Receipt Voucher") : (isRtl ? "سند صرف" : "Payment Voucher")}</h1>
          </div>

          <div class="info-grid">
            <div class="info-box">
              <label>${isRtl ? "رقم السند" : "Voucher No."}</label>
              <span>${entry.entry_number}</span>
            </div>
            <div class="info-box">
              <label>${isRtl ? "التاريخ" : "Date"}</label>
              <span>${format(new Date(entry.entry_date), "yyyy-MM-dd")}</span>
            </div>
            <div class="info-box">
              <label>${isRtl ? "الخزينة" : "Treasury"}</label>
              <span>${treasuryName}</span>
            </div>
            <div class="info-box">
              <label>${isRtl ? "النوع" : "Type"}</label>
              <span>${entryTypeLabel}</span>
            </div>
            <div class="info-box">
              <label>${isRtl ? "الحالة" : "Status"}</label>
              <span>${statusLabel}</span>
            </div>
            <div class="info-box">
              <label>${isRtl ? "العملة" : "Currency"}</label>
              <span>${currencyCode}</span>
            </div>
          </div>

          <div class="amount-section">
            <div class="label">${isRtl ? "المبلغ" : "Amount"}</div>
            <div class="value ${entry.status === "voided" ? "voided" : ""}">
              ${(entry.converted_amount || entry.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div class="currency">${currencyCode}</div>
          </div>


          <div class="description-box">
            <label>${isRtl ? "الوصف / البيان" : "Description"}</label>
            <div>${entry.description || "-"}</div>
          </div>

          <div class="signatures">
            <div class="signature-box">
              <div class="line"></div>
              <label>${isRtl ? "المحضر" : "Prepared By"}</label>
            </div>
            <div class="signature-box">
              <div class="line"></div>
              <label>${isRtl ? "المراجع" : "Reviewed By"}</label>
            </div>
            <div class="signature-box">
              <div class="line"></div>
              <label>${isRtl ? "المعتمد" : "Approved By"}</label>
            </div>
          </div>

          <div class="footer">
            ${isRtl ? "تم الطباعة بتاريخ:" : "Printed on:"} ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handlePrintLedger = () => {
    const selectedTreasury = selectedTreasuryFilter !== "all" 
      ? treasuries.find(t => t.id === selectedTreasuryFilter)
      : null;
    const treasuryName = selectedTreasury 
      ? (language === "ar" && selectedTreasury.treasury_name_ar 
          ? selectedTreasury.treasury_name_ar 
          : selectedTreasury.treasury_name)
      : (language === "ar" ? "جميع الخزائن" : "All Treasuries");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error(language === "ar" ? "فشل فتح نافذة الطباعة" : "Failed to open print window");
      return;
    }

    // Build entry rows
    let runningBalance = openingBalance;
    let totalDebit = openingBalance > 0 ? openingBalance : 0;
    let totalCredit = openingBalance < 0 ? Math.abs(openingBalance) : 0;
    const statusLabels: Record<string, { en: string; ar: string }> = {
      draft: { en: "Draft", ar: "مسودة" },
      pending_approval: { en: "Pending", ar: "معلق" },
      approved: { en: "Approved", ar: "معتمد" },
      posted: { en: "Posted", ar: "مرحل" },
      rejected: { en: "Rejected", ar: "مرفوض" },
      voided: { en: "Voided", ar: "ملغى" },
    };

    const entryRows = entries.map(entry => {
      const debit = getDebitAmount(entry);
      const credit = getCreditAmount(entry);
      totalDebit += debit;
      totalCredit += credit;
      if (entry.status === "posted") {
        runningBalance += debit - credit;
      }
      const statusLabel = statusLabels[entry.status] 
        ? (language === "ar" ? statusLabels[entry.status].ar : statusLabels[entry.status].en) 
        : entry.status;
      const voidedClass = entry.status === "voided" ? "opacity-60" : "";
      const debitStr = debit > 0 ? debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
      const creditStr = credit > 0 ? credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
      const balanceStr = entry.status === "posted" ? runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
      
      return '<tr class="' + voidedClass + '">' +
        '<td class="font-mono">' + entry.entry_number + '</td>' +
        '<td>' + format(new Date(entry.entry_date), "yyyy-MM-dd") + '</td>' +
        '<td>' + getEntryTypeLabel(entry.entry_type) + '</td>' +
        '<td>' + (entry.description || "-") + '</td>' +
        '<td class="text-end">' + debitStr + '</td>' +
        '<td class="text-end">' + creditStr + '</td>' +
        '<td class="text-end font-semibold">' + balanceStr + '</td>' +
        '<td class="text-center">' + statusLabel + '</td>' +
        '</tr>';
    }).join("");

    const totalsRow = '<tr class="bg-gray font-bold">' +
      '<td colspan="4" class="text-end">' + (language === "ar" ? "الإجمالي" : "Total") + '</td>' +
      '<td class="text-end">' + totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '<td class="text-end">' + totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '<td class="text-end">' + runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</td>' +
      '<td></td>' +
      '</tr>';

    const obDebit = openingBalance > 0 ? openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
    const obCredit = openingBalance < 0 ? Math.abs(openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
    const obBalance = openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const printContent = '<!DOCTYPE html>' +
      '<html dir="' + (language === "ar" ? "rtl" : "ltr") + '">' +
      '<head>' +
        '<title>' + (language === "ar" ? "دفتر الخزينة" : "Treasury Ledger") + '</title>' +
        '<style>' +
          '* { margin: 0; padding: 0; box-sizing: border-box; }' +
          'body { font-family: Arial, sans-serif; padding: 20px; background: white; color: black; }' +
          'table { width: 100%; border-collapse: collapse; font-size: 11px; }' +
          'th, td { border: 1px solid #ccc; padding: 6px 8px; }' +
          'th { background: #f3f4f6; font-weight: bold; }' +
          '.text-end { text-align: ' + (language === "ar" ? "left" : "right") + '; }' +
          '.text-center { text-align: center; }' +
          '.text-start { text-align: ' + (language === "ar" ? "right" : "left") + '; }' +
          '.font-mono { font-family: monospace; }' +
          '.font-bold { font-weight: bold; }' +
          '.font-semibold { font-weight: 600; }' +
          '.bg-blue { background: #eff6ff; }' +
          '.bg-gray { background: #f3f4f6; }' +
          '.opacity-60 { opacity: 0.6; }' +
          'h1 { font-size: 24px; margin-bottom: 8px; }' +
          '.header { text-align: center; margin-bottom: 20px; }' +
          '.header p { margin: 4px 0; }' +
          '.footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 11px; color: #666; }' +
          '@media print { body { padding: 10px; } @page { margin: 10mm; } }' +
        '</style>' +
      '</head>' +
      '<body>' +
        '<div class="header">' +
          '<img src="' + getPrintLogoUrl() + '" alt="ASUS Card" style="width: 120px; height: auto; margin: 0 auto 10px; display: block;" />' +
          '<h1>' + (language === "ar" ? "دفتر الخزينة" : "Treasury Ledger") + '</h1>' +
          '<p style="font-size: 16px; font-weight: 600;">' + treasuryName + '</p>' +
          '<p style="font-size: 12px; color: #666;">' +
            (language === "ar" ? "الفترة من" : "Period from") + ' ' +
            format(dateFrom, "yyyy-MM-dd") + ' ' +
            (language === "ar" ? "إلى" : "to") + ' ' +
            format(dateTo, "yyyy-MM-dd") +
          '</p>' +
          '<p style="font-size: 10px; color: #999;">' +
            (language === "ar" ? "تاريخ الطباعة:" : "Print Date:") + ' ' +
            format(new Date(), "yyyy-MM-dd HH:mm") +
          '</p>' +
        '</div>' +
        '<table>' +
          '<thead>' +
            '<tr>' +
              '<th class="text-start">' + (language === "ar" ? "رقم القيد" : "Entry No.") + '</th>' +
              '<th class="text-start">' + (language === "ar" ? "التاريخ" : "Date") + '</th>' +
              '<th class="text-start">' + (language === "ar" ? "النوع" : "Type") + '</th>' +
              '<th class="text-start">' + (language === "ar" ? "الوصف" : "Description") + '</th>' +
              '<th class="text-end">' + (language === "ar" ? "مدين" : "Dr.") + '</th>' +
              '<th class="text-end">' + (language === "ar" ? "دائن" : "Cr.") + '</th>' +
              '<th class="text-end">' + (language === "ar" ? "الرصيد" : "Balance") + '</th>' +
              '<th class="text-center">' + (language === "ar" ? "الحالة" : "Status") + '</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            '<tr class="bg-blue font-semibold">' +
              '<td class="font-mono">OB-' + format(dateFrom, "yyyyMMdd") + '</td>' +
              '<td>' + format(dateFrom, "yyyy-MM-dd") + '</td>' +
              '<td>' + (language === "ar" ? "رصيد افتتاحي" : "Opening Balance") + '</td>' +
              '<td>' + (language === "ar" ? "رصيد افتتاحي للفترة" : "Opening balance for period") + '</td>' +
              '<td class="text-end">' + obDebit + '</td>' +
              '<td class="text-end">' + obCredit + '</td>' +
              '<td class="text-end font-bold">' + obBalance + '</td>' +
              '<td class="text-center">' + (language === "ar" ? "افتتاحي" : "Opening") + '</td>' +
            '</tr>' +
            entryRows +
            totalsRow +
          '</tbody>' +
        '</table>' +
        '<div class="footer">' +
          '<span>' + (language === "ar" ? "عدد القيود:" : "Entries Count:") + ' ' + entries.length + '</span>' +
        '</div>' +
      '</body>' +
      '</html>';

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>{language === "ar" ? "قيود الخزينة" : "Treasury Entries"}</CardTitle>
          <div className="flex items-center gap-4">
            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "yyyy-MM-dd") : <span>{language === "ar" ? "من" : "From"}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground">-</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "yyyy-MM-dd") : <span>{language === "ar" ? "إلى" : "To"}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {/* Treasury Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedTreasuryFilter} onValueChange={setSelectedTreasuryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={language === "ar" ? "كل الخزائن" : "All Treasuries"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "كل الخزائن" : "All Treasuries"}</SelectItem>
                  {treasuries.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {language === "ar" && t.treasury_name_ar ? t.treasury_name_ar : t.treasury_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "standard" | "ledger")}>
              <TabsList>
                <TabsTrigger value="ledger" className="gap-1">
                  <BookOpen className="h-4 w-4" />
                  {language === "ar" ? "دفتر" : "Ledger"}
                </TabsTrigger>
                <TabsTrigger value="standard" className="gap-1">
                  <LayoutList className="h-4 w-4" />
                  {language === "ar" ? "قياسي" : "Standard"}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Print Button */}
            {viewMode === "ledger" && (
              <Button variant="outline" size="sm" onClick={handlePrintLedger} className="gap-1">
                <Printer className="h-4 w-4" />
                {language === "ar" ? "طباعة" : "Print"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "ledger" ? (
            /* Ledger View - Accounting Style */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "رقم القيد" : "Entry No."}</TableHead>
                  <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                  <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                  <TableHead className="text-right text-green-600">{language === "ar" ? "مدين" : "Dr."}</TableHead>
                  <TableHead className="text-right text-red-600">{language === "ar" ? "دائن" : "Cr."}</TableHead>
                  <TableHead className="text-right">{language === "ar" ? "الرصيد" : "Balance"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="w-[60px]">{language === "ar" ? "طباعة" : "Print"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening Balance Row */}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell className="font-mono text-xs">OB-{format(dateFrom, "yyyyMMdd")}</TableCell>
                  <TableCell className="text-xs">{format(dateFrom, "yyyy-MM-dd")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {language === "ar" ? "رصيد افتتاحي" : "Opening Balance"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {language === "ar" ? "رصيد افتتاحي للفترة" : "Opening balance for period"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600">
                    {openingBalance > 0 
                      ? openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {openingBalance < 0 
                      ? Math.abs(openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold text-blue-600">
                    {openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                      {language === "ar" ? "افتتاحي" : "Opening"}
                    </span>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {(() => {
                  let runningBalance = openingBalance;
                  return entries.map((entry) => {
                    const debit = getDebitAmount(entry);
                    const credit = getCreditAmount(entry);
                    // Update running balance based on entry type
                    if (entry.status === "posted") {
                      runningBalance += debit - credit;
                    }
                    return (
                      <TableRow key={entry.id} className={entry.status === "voided" ? "opacity-60" : ""}>
                        <TableCell className="font-mono text-xs">{entry.entry_number}</TableCell>
                        <TableCell className="text-xs">{format(new Date(entry.entry_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={entry.entry_type === "receipt" ? "default" : entry.entry_type === "void_reversal" ? "outline" : "secondary"} 
                            className="text-xs"
                          >
                            {getEntryTypeLabel(entry.entry_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {entry.description || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {debit > 0 ? debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {credit > 0 ? credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {entry.status === "posted" 
                            ? runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[entry.status] || ""}`}>
                            {getStatusLabel(entry.status)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handlePrintEntry(entry)}
                            title={language === "ar" ? "طباعة" : "Print"}
                          >
                            <Printer className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {language === "ar" ? "لا توجد قيود" : "No entries found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            /* Standard View */
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "رقم القيد" : "Entry No."}</TableHead>
                <TableHead>{language === "ar" ? "الخزينة" : "Treasury"}</TableHead>
                <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{language === "ar" ? "العملة" : "Currency"}</TableHead>
                <TableHead>{language === "ar" ? "السعر" : "Rate"}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ بالريال" : "Amount (SAR)"}</TableHead>
                <TableHead>{language === "ar" ? "مبلغ الخزينة" : "Treasury Amount"}</TableHead>
                <TableHead>{language === "ar" ? "الرصيد قبل" : "Bal. Before"}</TableHead>
                <TableHead>{language === "ar" ? "الرصيد بعد" : "Bal. After"}</TableHead>
                <TableHead>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.entry_number}</TableCell>
                  <TableCell className="text-xs">{getTreasuryName(entry.treasury_id)}</TableCell>
                  <TableCell className="text-xs">{format(new Date(entry.entry_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={entry.entry_type === "receipt" ? "default" : "secondary"} className="text-xs">
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
                  <TableCell className="text-xs">{getCurrencyCode(entry.from_currency_id)}</TableCell>
                  <TableCell className="text-xs">{entry.exchange_rate?.toFixed(4) || "-"}</TableCell>
                  <TableCell className="font-semibold">
                    <span className={entry.entry_type === "receipt" ? "text-green-600" : "text-red-600"}>
                      {entry.entry_type === "receipt" ? "+" : "-"}{entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-amber-600">
                    {entry.converted_amount ? (
                      <span>
                        {entry.converted_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {getTreasuryCurrencyCode(entry.treasury_id)}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.balance_before?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {entry.balance_after?.toLocaleString() || "-"}
                  </TableCell>
                  <TableCell className="text-xs">{getCostCenterName(entry.cost_center_id)}</TableCell>
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
                  <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد قيود" : "No entries found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TreasuryEntry;