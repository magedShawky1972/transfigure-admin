import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Check, X, DollarSign, Building2, Vault, Package, Receipt, Plus, Printer, Edit, Undo2 } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ExpensePaymentPrint } from "@/components/ExpensePaymentPrint";
import { 
  convertFromBaseCurrency, 
  convertToBaseCurrency,
  type CurrencyRate as CurrencyRateImport 
} from "@/lib/currencyConversion";

interface ExpenseRequest {
  id: string;
  request_number: string;
  ticket_id: string | null;
  request_date: string;
  description: string;
  amount: number;
  currency_id: string | null;
  exchange_rate: number | null;
  base_currency_amount: number | null;
  expense_type_id: string | null;
  is_asset: boolean;
  payment_method: string | null;
  bank_id: string | null;
  treasury_id: string | null;
  cost_center_id: string | null;
  status: string;
  classified_by: string | null;
  classified_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  requester_id: string;
  notes: string | null;
}

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
  is_active: boolean;
}

interface ExpenseType {
  id: string;
  expense_name: string;
  expense_name_ar: string | null;
  is_asset: boolean;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
  current_balance: number;
}

interface Treasury {
  id: string;
  treasury_code: string;
  treasury_name: string;
  current_balance: number;
  currency_id: string | null;
}

interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_name_ar?: string | null;
  symbol?: string | null;
  is_base: boolean;
  is_active: boolean;
}

interface UOM {
  id: string;
  uom_code: string;
  uom_name: string;
  uom_name_ar: string | null;
}

interface PurchaseItem {
  id: string;
  item_name: string;
  item_name_ar: string | null;
}

type CurrencyRate = CurrencyRateImport;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  classified: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const ExpenseRequests = () => {
  const { language } = useLanguage();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [uomList, setUomList] = useState<UOM[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExpenseRequest | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("pending");

  const [classifyData, setClassifyData] = useState({
    expense_type_id: "",
    is_asset: false,
    payment_method: "treasury",
    bank_id: "",
    treasury_id: "",
  });

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExpenseRequest | null>(null);
  const [editData, setEditData] = useState({
    description: "",
    amount: "",
    currency_id: "",
    exchange_rate: "",
    expense_type_id: "",
    is_asset: false,
    payment_method: "",
    bank_id: "",
    treasury_id: "",
    cost_center_id: "",
    notes: "",
  });
  const [newRequest, setNewRequest] = useState({
    expense_type_id: "",
    is_asset: false,
    purchase_item_id: "",
    description: "",
    quantity: "1",
    uom_id: "",
    unit_price: "",
    tax_percent: "0",
    currency_id: "",
    cost_center_id: "",
    notes: "",
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
      const [requestsRes, typesRes, banksRes, treasuriesRes, currenciesRes, ratesRes, uomRes, itemsRes, costCentersRes] = await Promise.all([
        supabase.from("expense_requests").select("*").order("request_date", { ascending: false }),
        supabase.from("expense_types").select("id, expense_name, expense_name_ar, is_asset").eq("is_active", true),
        supabase.from("banks").select("id, bank_code, bank_name, current_balance").eq("is_active", true),
        supabase.from("treasuries").select("id, treasury_code, treasury_name, current_balance, currency_id").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code, currency_name, currency_name_ar, symbol, is_base, is_active").eq("is_active", true),
        supabase.from("currency_rates").select("id, currency_id, rate_to_base, conversion_operator, effective_date, created_at, updated_at").order("effective_date", { ascending: false }),
        supabase.from("uom").select("id, uom_code, uom_name, uom_name_ar").eq("is_active", true),
        supabase.from("purchase_items").select("id, item_name, item_name_ar").eq("is_active", true),
        supabase.from("cost_centers").select("id, cost_center_code, cost_center_name, cost_center_name_ar, is_active"),
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (typesRes.error) throw typesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (ratesRes.error) throw ratesRes.error;
      if (uomRes.error) throw uomRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (costCentersRes.error) throw costCentersRes.error;

      setRequests(requestsRes.data || []);
      setExpenseTypes(typesRes.data || []);
      setBanks(banksRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setCurrencyRates((ratesRes.data || []) as CurrencyRate[]);
      setUomList(uomRes.data || []);
      setPurchaseItems(itemsRes.data || []);
      setCostCenters(costCentersRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleClassify = async () => {
    if (!selectedRequest) return;
    if (!classifyData.expense_type_id) {
      toast.error(language === "ar" ? "يرجى اختيار نوع المصروف" : "Please select expense type");
      return;
    }
    if (classifyData.payment_method === "bank" && !classifyData.bank_id) {
      toast.error(language === "ar" ? "يرجى اختيار البنك" : "Please select bank");
      return;
    }
    if (classifyData.payment_method === "treasury" && !classifyData.treasury_id) {
      toast.error(language === "ar" ? "يرجى اختيار الخزينة" : "Please select treasury");
      return;
    }

    try {
      const { error } = await supabase.from("expense_requests").update({
        expense_type_id: classifyData.expense_type_id,
        is_asset: classifyData.is_asset,
        payment_method: classifyData.payment_method,
        bank_id: classifyData.payment_method === "bank" ? classifyData.bank_id : null,
        treasury_id: classifyData.payment_method === "treasury" ? classifyData.treasury_id : null,
        status: "classified",
        classified_by: currentUserId,
        classified_at: new Date().toISOString(),
      }).eq("id", selectedRequest.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم تصنيف الطلب بنجاح" : "Request classified successfully");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error classifying:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التصنيف" : "Error classifying"));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      // Get the expense request details first
      const request = requests.find(r => r.id === id);
      if (!request) throw new Error("Request not found");

      const updateData: any = { status: newStatus };
      
      if (newStatus === "approved") {
        updateData.approved_by = currentUserId;
        updateData.approved_at = new Date().toISOString();
        
        // AUTO-CREATE EXPENSE ENTRY when approved
        const date = new Date();
        const expenseEntryNumber = `EXE${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}${date.getHours().toString().padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}${date.getSeconds().toString().padStart(2, "0")}`;
        
        // Get cost_center_id from ticket if this expense is linked to a ticket and doesn't have its own
        let costCenterId = request.cost_center_id;
        if (!costCenterId && request.ticket_id) {
          const { data: ticketData } = await supabase
            .from("tickets")
            .select("cost_center_id")
            .eq("id", request.ticket_id)
            .maybeSingle();
          costCenterId = ticketData?.cost_center_id || null;
        }
        
        const { data: expenseEntryData, error: expenseEntryError } = await supabase.from("expense_entries").insert({
          entry_number: expenseEntryNumber,
          entry_date: new Date().toISOString().split("T")[0],
          expense_reference: request.request_number,
          payment_method: request.payment_method || null,
          bank_id: request.bank_id || null,
          treasury_id: request.treasury_id || null,
          currency_id: request.currency_id || null,
          exchange_rate: request.exchange_rate || 1,
          subtotal: request.amount,
          total_vat: 0,
          grand_total: request.base_currency_amount || request.amount,
          cost_center_id: costCenterId,
          status: "approved",
          notes: request.description,
          created_by: currentUserId,
        }).select("id").single();

        if (expenseEntryError) {
          console.error("Error creating expense entry:", expenseEntryError);
          toast.error(language === "ar" ? "خطأ في إنشاء قيد المصروفات" : "Error creating expense entry");
        } else if (expenseEntryData) {
          // Create expense entry line
          const { error: lineError } = await supabase.from("expense_entry_lines").insert({
            expense_entry_id: expenseEntryData.id,
            line_number: 1,
            expense_type_id: request.expense_type_id || null,
            description: request.description,
            quantity: 1,
            unit_price: request.amount,
            total: request.amount,
            vat_percent: 0,
            vat_amount: 0,
            line_total: request.amount,
          });

          if (lineError) {
            console.error("Error creating expense entry line:", lineError);
          }
          
          toast.success(language === "ar" ? "تم إنشاء قيد المصروفات" : "Expense entry created");
        }
      } else if (newStatus === "paid") {
        // VALIDATE BALANCE BEFORE PAYMENT
        if (request.payment_method === "bank" && request.bank_id) {
          const bank = banks.find(b => b.id === request.bank_id);
          if (bank && (bank.current_balance || 0) < request.amount) {
            toast.error(
              language === "ar" 
                ? `رصيد البنك غير كافي! الرصيد الحالي: ${(bank.current_balance || 0).toLocaleString()} - المطلوب: ${request.amount.toLocaleString()}`
                : `Insufficient bank balance! Current: ${(bank.current_balance || 0).toLocaleString()} - Required: ${request.amount.toLocaleString()}`
            );
            return;
          }
        } else if (request.payment_method === "treasury" && request.treasury_id) {
          const treasury = treasuries.find(t => t.id === request.treasury_id);
          if (treasury && (treasury.current_balance || 0) < request.amount) {
            toast.error(
              language === "ar" 
                ? `رصيد الخزينة غير كافي! الرصيد الحالي: ${(treasury.current_balance || 0).toLocaleString()} - المطلوب: ${request.amount.toLocaleString()}`
                : `Insufficient treasury balance! Current: ${(treasury.current_balance || 0).toLocaleString()} - Required: ${request.amount.toLocaleString()}`
            );
            return;
          }
        }

        updateData.paid_by = currentUserId;
        updateData.paid_at = new Date().toISOString();

        // AUTO-CREATE BANK or TREASURY ENTRY
        if (request.payment_method === "bank" && request.bank_id) {
          const bank = banks.find(b => b.id === request.bank_id);
          const date = new Date();
          const entryNumber = `BNK${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}${date.getHours().toString().padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}${date.getSeconds().toString().padStart(2, "0")}`;
          
          const { error: bankError } = await supabase.from("bank_entries").insert({
            entry_number: entryNumber,
            bank_id: request.bank_id,
            entry_type: "withdrawal",
            amount: request.amount,
            description: `${language === "ar" ? "مصروف: " : "Expense: "}${request.description}`,
            entry_date: new Date().toISOString().split("T")[0],
            created_by: currentUserId,
            expense_request_id: request.id,
            status: "approved",
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          });

          if (bankError) {
            console.error("Error creating bank entry:", bankError);
            toast.error(language === "ar" ? "خطأ في إنشاء قيد البنك" : "Error creating bank entry");
            return;
          }

          // Update bank balance
          const newBalance = (bank?.current_balance || 0) - request.amount;
          await supabase.from("banks").update({ current_balance: newBalance }).eq("id", request.bank_id);
          
          toast.success(language === "ar" ? "تم إنشاء قيد البنك وخصم الرصيد" : "Bank entry created and balance deducted");
        } else if (request.payment_method === "treasury" && request.treasury_id) {
          const treasury = treasuries.find(t => t.id === request.treasury_id);
          
          // Convert expense amount (in base currency SAR) to treasury's currency
          const expenseInTreasuryCurrency = convertFromBaseCurrency(
            request.base_currency_amount || request.amount,
            treasury?.currency_id || null,
            currencyRates,
            currencies.find(c => c.is_base) || null
          );
          
          // Validate treasury has sufficient balance in its own currency
          const treasuryBalance = treasury?.current_balance || 0;
          if (expenseInTreasuryCurrency > treasuryBalance) {
            toast.error(
              language === "ar" 
                ? `رصيد الخزينة غير كافٍ. المطلوب: ${expenseInTreasuryCurrency.toFixed(2)}, المتاح: ${treasuryBalance.toFixed(2)} (${getCurrencyCode(treasury?.currency_id || null)})` 
                : `Insufficient treasury balance. Required: ${expenseInTreasuryCurrency.toFixed(2)}, Available: ${treasuryBalance.toFixed(2)} (${getCurrencyCode(treasury?.currency_id || null)})`
            );
            return;
          }
          
          const date = new Date();
          const entryNumber = `TRS${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}${date.getHours().toString().padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}${date.getSeconds().toString().padStart(2, "0")}`;
          
          // Get cost_center_id from ticket if this expense is linked to a ticket
          let costCenterId: string | null = null;
          if (request.ticket_id) {
            const { data: ticketData } = await supabase
              .from("tickets")
              .select("cost_center_id")
              .eq("id", request.ticket_id)
              .maybeSingle();
            costCenterId = ticketData?.cost_center_id || null;
          }
          
          // Calculate balances in treasury's currency
          const balanceBefore = treasuryBalance;
          const newBalance = balanceBefore - expenseInTreasuryCurrency;
          
          const { error: treasuryError } = await supabase.from("treasury_entries").insert({
            entry_number: entryNumber,
            treasury_id: request.treasury_id,
            entry_type: "payment",
            amount: request.amount,
            description: `${language === "ar" ? "مصروف: " : "Expense: "}${request.description}`,
            entry_date: new Date().toISOString().split("T")[0],
            created_by: currentUserId,
            expense_request_id: request.id,
            status: "posted",
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
            posted_by: currentUserId,
            posted_at: new Date().toISOString(),
            // New fields
            from_currency_id: request.currency_id,
            exchange_rate: request.exchange_rate || 1,
            converted_amount: expenseInTreasuryCurrency,
            balance_before: balanceBefore,
            balance_after: newBalance,
            cost_center_id: costCenterId,
          });

          if (treasuryError) {
            console.error("Error creating treasury entry:", treasuryError);
            toast.error(language === "ar" ? "خطأ في إنشاء قيد الخزينة" : "Error creating treasury entry");
            return;
          }

          // Treasury balance is automatically recalculated by database trigger
          toast.success(language === "ar" ? "تم إنشاء قيد الخزينة وخصم الرصيد" : "Treasury entry created and balance deducted");
        }
        
        // Update the linked expense_entry status to "posted"
        const { error: expenseEntryUpdateError } = await supabase
          .from("expense_entries")
          .update({ 
            status: "posted",
            paid_by: currentUserId,
            paid_at: new Date().toISOString()
          })
          .eq("expense_reference", request.request_number);
        
        if (expenseEntryUpdateError) {
          console.error("Error updating expense entry status:", expenseEntryUpdateError);
        }
      }

      const { error } = await supabase.from("expense_requests").update(updateData).eq("id", id);
      if (error) throw error;
      
      toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
      fetchData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التحديث" : "Error updating"));
    }
  };

  const openClassifyDialog = (request: ExpenseRequest) => {
    setSelectedRequest(request);
    setClassifyData({
      expense_type_id: request.expense_type_id || "",
      is_asset: request.is_asset,
      payment_method: request.payment_method || "treasury",
      bank_id: request.bank_id || "",
      treasury_id: request.treasury_id || "",
    });
    setDialogOpen(true);
  };

  const handleExpenseTypeChange = (typeId: string) => {
    const type = expenseTypes.find(t => t.id === typeId);
    setClassifyData({
      ...classifyData,
      expense_type_id: typeId,
      is_asset: type?.is_asset || false,
    });
  };

  const generateRequestNumber = () => {
    const date = new Date();
    const prefix = "EXP";
    const timestamp = date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, "0") +
      date.getDate().toString().padStart(2, "0") +
      date.getHours().toString().padStart(2, "0") +
      date.getMinutes().toString().padStart(2, "0") +
      date.getSeconds().toString().padStart(2, "0");
    return `${prefix}${timestamp}`;
  };

  const handleAddRequest = async () => {
    if (!newRequest.expense_type_id) {
      toast.error(language === "ar" ? "يرجى اختيار نوع المصروف" : "Please select expense type");
      return;
    }
    if (!newRequest.description.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال الوصف" : "Please enter description");
      return;
    }
    if (!newRequest.unit_price || parseFloat(newRequest.unit_price) <= 0) {
      toast.error(language === "ar" ? "يرجى إدخال سعر الوحدة" : "Please enter valid unit price");
      return;
    }

    const qty = parseFloat(newRequest.quantity) || 1;
    const unitPrice = parseFloat(newRequest.unit_price) || 0;
    const taxPercent = parseFloat(newRequest.tax_percent) || 0;
    const total = qty * unitPrice;
    const netTotal = total + (total * taxPercent / 100);

    try {
      const { error } = await supabase.from("expense_requests").insert({
        request_number: generateRequestNumber(),
        expense_type_id: newRequest.expense_type_id,
        is_asset: newRequest.is_asset,
        purchase_item_id: newRequest.purchase_item_id || null,
        description: newRequest.description.trim(),
        quantity: qty,
        uom_id: newRequest.uom_id || null,
        unit_price: unitPrice,
        amount: total,
        tax_percent: taxPercent,
        net_total: netTotal,
        currency_id: newRequest.currency_id || null,
        cost_center_id: newRequest.cost_center_id || null,
        notes: newRequest.notes.trim() || null,
        requester_id: currentUserId,
        request_date: new Date().toISOString().split("T")[0],
        status: "pending",
      });

      if (error) throw error;
      toast.success(language === "ar" ? "تم إضافة الطلب بنجاح" : "Request added successfully");
      setAddDialogOpen(false);
      setNewRequest({ 
        expense_type_id: "", is_asset: false, purchase_item_id: "", description: "",
        quantity: "1", uom_id: "", unit_price: "", tax_percent: "0", currency_id: "", cost_center_id: "", notes: "" 
      });
      fetchData();
    } catch (error: any) {
      console.error("Error adding request:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الإضافة" : "Error adding request"));
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: "Pending", ar: "في الانتظار" },
      classified: { en: "Classified", ar: "مصنف" },
      approved: { en: "Approved", ar: "معتمد" },
      paid: { en: "Paid", ar: "مدفوع" },
      rejected: { en: "Rejected", ar: "مرفوض" },
      cancelled: { en: "Cancelled", ar: "ملغي" },
    };
    return labels[status] ? (language === "ar" ? labels[status].ar : labels[status].en) : status;
  };

  const getExpenseTypeName = (typeId: string | null) => {
    if (!typeId) return "-";
    const type = expenseTypes.find(t => t.id === typeId);
    return type ? (language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name) : "-";
  };

  const getCurrencyCode = (currencyId: string | null) => {
    if (!currencyId) return "-";
    const currency = currencies.find(c => c.id === currencyId);
    return currency?.currency_code || "-";
  };

  const getBaseCurrency = () => {
    return currencies.find(c => c.is_base);
  };

  const getCurrencyRate = (currencyId: string | null) => {
    if (!currencyId) return null;
    return currencyRates.find(r => r.currency_id === currencyId);
  };

  const getTreasuryName = (treasuryId: string | null) => {
    if (!treasuryId) return "-";
    const treasury = treasuries.find(t => t.id === treasuryId);
    return treasury?.treasury_name || "-";
  };

  const getTreasuryCurrencyCode = (treasuryId: string | null) => {
    if (!treasuryId) return "";
    const treasury = treasuries.find(t => t.id === treasuryId);
    return getCurrencyCode(treasury?.currency_id || null);
  };

  const getTreasuryBalance = (treasuryId: string | null) => {
    if (!treasuryId) return 0;
    const treasury = treasuries.find(t => t.id === treasuryId);
    return treasury?.current_balance || 0;
  };

  // Calculate how much will be deducted from treasury in treasury's currency
  const getTreasuryAmount = (request: ExpenseRequest) => {
    if (request.payment_method !== "treasury" || !request.treasury_id) return null;
    
    const treasury = treasuries.find(t => t.id === request.treasury_id);
    if (!treasury) return null;
    
    const baseCurrency = currencies.find(c => c.is_base);
    const expenseInBase = request.base_currency_amount || request.amount;
    
    // Convert from base currency to treasury's currency
    const amountInTreasuryCurrency = convertFromBaseCurrency(
      expenseInBase,
      treasury.currency_id || null,
      currencyRates,
      baseCurrency || null
    );
    
    return {
      amount: amountInTreasuryCurrency,
      currencyCode: getCurrencyCode(treasury.currency_id || null),
      balance: treasury.current_balance,
      sufficient: amountInTreasuryCurrency <= treasury.current_balance
    };
  };

  const getBankName = (bankId: string | null) => {
    if (!bankId) return "-";
    const bank = banks.find(b => b.id === bankId);
    return bank?.bank_name || "-";
  };

  const getCostCenterName = (costCenterId: string | null) => {
    if (!costCenterId) return "-";
    const cc = costCenters.find(c => c.id === costCenterId);
    return cc ? (language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name) : "-";
  };

  const openEditDialog = (request: ExpenseRequest) => {
    setEditingRequest(request);
    const rate = getCurrencyRate(request.currency_id);
    setEditData({
      description: request.description,
      amount: request.amount.toString(),
      currency_id: request.currency_id || "",
      exchange_rate: request.exchange_rate?.toString() || rate?.rate_to_base?.toString() || "1",
      expense_type_id: request.expense_type_id || "",
      is_asset: request.is_asset,
      payment_method: request.payment_method || "",
      bank_id: request.bank_id || "",
      treasury_id: request.treasury_id || "",
      cost_center_id: request.cost_center_id || "",
      notes: request.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingRequest) return;

    const amount = parseFloat(editData.amount) || 0;
    const exchangeRate = parseFloat(editData.exchange_rate) || 1;
    
    // Calculate base currency amount
    let baseCurrencyAmount: number | null = null;
    if (editData.currency_id) {
      const rate = getCurrencyRate(editData.currency_id);
      if (rate) {
        if (rate.conversion_operator === 'multiply') {
          baseCurrencyAmount = amount * exchangeRate;
        } else {
          baseCurrencyAmount = amount / exchangeRate;
        }
      }
    }

    try {
      const { error } = await supabase.from("expense_requests").update({
        description: editData.description,
        amount,
        currency_id: editData.currency_id || null,
        exchange_rate: exchangeRate,
        base_currency_amount: baseCurrencyAmount,
        expense_type_id: editData.expense_type_id || null,
        is_asset: editData.is_asset,
        payment_method: editData.payment_method || null,
        bank_id: editData.payment_method === "bank" ? editData.bank_id : null,
        treasury_id: editData.payment_method === "treasury" ? editData.treasury_id : null,
        cost_center_id: editData.cost_center_id || null,
        notes: editData.notes || null,
      }).eq("id", editingRequest.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم التحديث بنجاح" : "Updated successfully");
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error updating:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التحديث" : "Error updating"));
    }
  };

  const handleRollback = async (requestId: string, targetStatus: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) {
        toast.error(language === "ar" ? "الطلب غير موجود" : "Request not found");
        return;
      }

      // Get current user for audit trail
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(language === "ar" ? "يجب تسجيل الدخول" : "You must be logged in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const updateData: any = { status: targetStatus };
      
      // Clear the relevant approval fields based on rollback target
      if (targetStatus === "pending") {
        updateData.classified_by = null;
        updateData.classified_at = null;
        updateData.expense_type_id = null;
        updateData.payment_method = null;
        updateData.bank_id = null;
        updateData.treasury_id = null;
      } else if (targetStatus === "classified") {
        updateData.approved_by = null;
        updateData.approved_at = null;
        
        // Delete associated expense_entry when rolling back from approved to classified
        const { error: deleteExpenseEntryError } = await supabase
          .from("expense_entries")
          .delete()
          .eq("expense_reference", request.request_number);
        
        if (deleteExpenseEntryError) {
          console.error("Error deleting expense entry:", deleteExpenseEntryError);
        }
      } else if (targetStatus === "approved") {
        updateData.paid_by = null;
        updateData.paid_at = null;
        
        // When rolling back from paid to approved (same as Void Payment workflow):
        // 1. Create void payment history record
        // 2. Delete the treasury_entry (triggers balance recalculation)
        // 3. Revert expense_entry status to approved
        // 4. Log the void action in audit_logs
        
        // Find treasury entry details
        const { data: treasuryEntry, error: treasuryFetchError } = await supabase
          .from("treasury_entries")
          .select("id, treasury_id, entry_number, converted_amount")
          .eq("expense_request_id", requestId)
          .maybeSingle();
        
        if (treasuryFetchError) {
          console.error("Error fetching treasury entry:", treasuryFetchError);
        }
        
        // Get treasury details for history
        const treasury = treasuries.find(t => t.id === request.treasury_id);
        const treasuryCurrency = currencies.find(c => c.id === treasury?.currency_id);
        const requestCurrency = currencies.find(c => c.id === request.currency_id);
        const baseCurrency = currencies.find(c => c.is_base);
        
        // Calculate treasury amount
        const treasuryAmount = treasury && treasury.currency_id && request.base_currency_amount
          ? (treasuryCurrency?.is_base 
              ? request.base_currency_amount 
              : convertFromBaseCurrency(request.base_currency_amount, treasury.currency_id, currencyRates, baseCurrency))
          : request.amount;

        // 1. Create void payment history record BEFORE deleting treasury entry
        const { error: historyError } = await supabase.from("void_payment_history").insert({
          expense_request_id: request.id,
          request_number: request.request_number,
          description: request.description,
          original_amount: request.amount,
          treasury_amount: treasuryAmount,
          currency_code: requestCurrency?.currency_code || null,
          treasury_currency_code: treasuryCurrency?.currency_code || null,
          treasury_id: request.treasury_id,
          treasury_name: treasury?.treasury_name || null,
          treasury_entry_number: treasuryEntry?.entry_number || null,
          original_paid_at: request.paid_at,
          voided_by: user.id,
          voided_by_name: profile?.user_name || user.email,
          reason: "Rollback from Expense Requests",
        } as any);

        if (historyError) {
          console.error("Error creating void history:", historyError);
          toast.error(language === "ar" ? "خطأ في تسجيل سجل الإلغاء" : "Error creating void history");
          return;
        }
        
        // 2. Delete treasury entry (triggers balance recalculation via database trigger)
        if (treasuryEntry) {
          const { error: deleteTreasuryError } = await supabase
            .from("treasury_entries")
            .delete()
            .eq("id", treasuryEntry.id);
          
          if (deleteTreasuryError) {
            console.error("Error deleting treasury entry:", deleteTreasuryError);
            toast.error(language === "ar" ? "خطأ في حذف قيد الخزينة" : "Error deleting treasury entry");
            return;
          }
        }
        
        // 3. Update expense_entry status back to approved
        const { error: updateExpenseEntryError } = await supabase
          .from("expense_entries")
          .update({ 
            status: "approved",
            paid_by: null,
            paid_at: null
          })
          .eq("expense_reference", request.request_number);
        
        if (updateExpenseEntryError) {
          console.error("Error updating expense entry status:", updateExpenseEntryError);
        }

        // 4. Log the void action in audit_logs (use UPDATE action as per constraint)
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "UPDATE",
          table_name: "expense_requests",
          record_id: request.id,
          old_data: {
            status: "paid",
            treasury_entry_id: treasuryEntry?.id || null,
            treasury_entry_number: treasuryEntry?.entry_number || null,
            void_action: "VOID_PAYMENT",
          },
          new_data: {
            status: "approved",
            voided_at: new Date().toISOString(),
            void_reason: "Rollback from Expense Requests",
          },
        });
      }

      const { error } = await supabase.from("expense_requests").update(updateData).eq("id", requestId);
      if (error) throw error;
      
      toast.success(language === "ar" ? "تم الترجيع بنجاح" : "Rollback successful");
      fetchData();
    } catch (error: any) {
      console.error("Error rolling back:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الترجيع" : "Error rolling back"));
    }
  };

  const handleCurrencyChange = (currencyId: string) => {
    const rate = getCurrencyRate(currencyId);
    setEditData({
      ...editData,
      currency_id: currencyId,
      exchange_rate: rate?.rate_to_base?.toString() || "1",
    });
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "classified") return r.status === "classified";
    if (activeTab === "approved") return r.status === "approved";
    if (activeTab === "paid") return r.status === "paid";
    return true;
  });

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{language === "ar" ? "طلبات المصروفات" : "Expense Requests"}</h1>
            <p className="text-muted-foreground">{language === "ar" ? "قائمة انتظار المحاسبة" : "Accounting Queue"}</p>
          </div>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "إضافة طلب" : "Add Request"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "في الانتظار" : "Pending"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "pending").length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "مصنف" : "Classified"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "classified").length}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "معتمد" : "Approved"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "approved").length}</p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "مدفوع" : "Paid"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "paid").length}</p>
              </div>
              <Package className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">{language === "ar" ? "في الانتظار" : "Pending"}</TabsTrigger>
              <TabsTrigger value="classified">{language === "ar" ? "مصنف" : "Classified"}</TabsTrigger>
              <TabsTrigger value="approved">{language === "ar" ? "معتمد" : "Approved"}</TabsTrigger>
              <TabsTrigger value="paid">{language === "ar" ? "مدفوع" : "Paid"}</TabsTrigger>
              <TabsTrigger value="all">{language === "ar" ? "الكل" : "All"}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "رقم الطلب" : "Request No."}</TableHead>
                <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                <TableHead>{language === "ar" ? "العملة" : "Currency"}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                <TableHead>{language === "ar" ? "سعر الصرف" : "Rate"}</TableHead>
                <TableHead>{language === "ar" ? `المبلغ بـ${getBaseCurrency()?.currency_code || "Base"}` : `Amount (${getBaseCurrency()?.currency_code || "Base"})`}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</TableHead>
                <TableHead>{language === "ar" ? "أصل/مصروف" : "Asset/Expense"}</TableHead>
                <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment"}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ بعملة الخزينة" : "Treasury Amount"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-mono">{request.request_number}</TableCell>
                  <TableCell>{format(new Date(request.request_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell className="max-w-xs truncate">{request.description}</TableCell>
                  <TableCell>{getCurrencyCode(request.currency_id)}</TableCell>
                  <TableCell className="font-semibold">{request.amount.toLocaleString()}</TableCell>
                  <TableCell>{request.exchange_rate ? request.exchange_rate.toFixed(4) : "-"}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {request.base_currency_amount ? request.base_currency_amount.toLocaleString() : "-"}
                  </TableCell>
                  <TableCell>{getExpenseTypeName(request.expense_type_id)}</TableCell>
                  <TableCell className="text-xs">{getCostCenterName(request.cost_center_id)}</TableCell>
                  <TableCell>
                    {request.expense_type_id && (
                      <Badge variant={request.is_asset ? "default" : "secondary"}>
                        {request.is_asset 
                          ? (language === "ar" ? "أصل" : "Asset")
                          : (language === "ar" ? "مصروف" : "Expense")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {request.payment_method && (
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          {request.payment_method === "bank" ? (
                            <Building2 className="h-4 w-4" />
                          ) : (
                            <Vault className="h-4 w-4" />
                          )}
                          <span className="text-xs font-medium">
                            {request.payment_method === "bank" 
                              ? getBankName(request.bank_id)
                              : getTreasuryName(request.treasury_id)}
                          </span>
                        </div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const treasuryInfo = getTreasuryAmount(request);
                      if (!treasuryInfo) return "-";
                      return (
                        <div className="flex flex-col">
                          <span className={`font-semibold ${treasuryInfo.sufficient ? "text-green-600" : "text-red-600"}`}>
                            {treasuryInfo.amount.toFixed(2)} {treasuryInfo.currencyCode}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {language === "ar" ? "الرصيد:" : "Bal:"} {treasuryInfo.balance.toLocaleString()} {treasuryInfo.currencyCode}
                          </span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[request.status] || ""}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {/* Edit button - always available except for paid */}
                      {request.status !== "paid" && (
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(request)} title={language === "ar" ? "تعديل" : "Edit"}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {request.status === "pending" && (
                        <Button variant="outline" size="sm" onClick={() => openClassifyDialog(request)}>
                          {language === "ar" ? "تصنيف" : "Classify"}
                        </Button>
                      )}
                      {request.status === "classified" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(request.id, "approved")} title={language === "ar" ? "موافقة" : "Approve"}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(request.id, "rejected")} title={language === "ar" ? "رفض" : "Reject"}>
                            <X className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRollback(request.id, "pending")} title={language === "ar" ? "ترجيع لانتظار" : "Rollback to Pending"}>
                            <Undo2 className="h-4 w-4 text-orange-500" />
                          </Button>
                        </>
                      )}
                      {request.status === "approved" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(request.id, "paid")}>
                            {language === "ar" ? "دفع" : "Pay"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRollback(request.id, "classified")} title={language === "ar" ? "ترجيع لمصنف" : "Rollback to Classified"}>
                            <Undo2 className="h-4 w-4 text-orange-500" />
                          </Button>
                        </>
                      )}
                      {request.status === "paid" && (
                        <>
                          {request.paid_at && (
                            <ExpensePaymentPrint
                              request={{
                                request_number: request.request_number,
                                request_date: request.request_date,
                                description: request.description,
                                amount: request.amount,
                                payment_method: request.payment_method,
                                paid_at: request.paid_at,
                                notes: request.notes,
                              }}
                              paymentDetails={{
                                entryNumber: request.payment_method === "bank" 
                                  ? `BNK${format(new Date(request.paid_at), "yyMMddHHmmss")}`
                                  : `TRS${format(new Date(request.paid_at), "yyMMddHHmmss")}`,
                                sourceType: request.payment_method === "bank" 
                                  ? (language === "ar" ? "بنك" : "Bank")
                                  : (language === "ar" ? "خزينة" : "Treasury"),
                                sourceName: request.payment_method === "bank"
                                  ? (banks.find(b => b.id === request.bank_id)?.bank_name || "-")
                                  : (treasuries.find(t => t.id === request.treasury_id)?.treasury_name || "-"),
                                paymentDate: request.paid_at,
                                treasuryAmount: (() => {
                                  const treasury = treasuries.find(t => t.id === request.treasury_id);
                                  if (!treasury || !treasury.currency_id || !request.base_currency_amount) {
                                    return request.amount;
                                  }
                                  const treasuryCurrency = currencies.find(c => c.id === treasury.currency_id);
                                  if (!treasuryCurrency || treasuryCurrency.is_base) {
                                    return request.base_currency_amount;
                                  }
                                  const baseCurrency = currencies.find(c => c.is_base);
                                  return convertFromBaseCurrency(request.base_currency_amount, treasury.currency_id, currencyRates, baseCurrency);
                                })(),
                                treasuryCurrencyCode: (() => {
                                  const treasury = treasuries.find(t => t.id === request.treasury_id);
                                  if (!treasury || !treasury.currency_id) {
                                    return currencies.find(c => c.id === request.currency_id)?.currency_code;
                                  }
                                  return currencies.find(c => c.id === treasury.currency_id)?.currency_code;
                                })(),
                              }}
                              language={language}
                            />
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleRollback(request.id, "approved")} title={language === "ar" ? "ترجيع لمعتمد" : "Rollback to Approved"}>
                            <Undo2 className="h-4 w-4 text-orange-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد طلبات" : "No requests found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Classify Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تصنيف طلب المصروف" : "Classify Expense Request"}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-mono text-sm">{selectedRequest.request_number}</p>
                <p className="text-lg font-semibold">{selectedRequest.amount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع المصروف *" : "Expense Type *"}</Label>
                <Select value={classifyData.expense_type_id} onValueChange={handleExpenseTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {language === "ar" && t.expense_name_ar ? t.expense_name_ar : t.expense_name}
                        {t.is_asset && <span className="text-xs text-muted-foreground ml-2">({language === "ar" ? "أصل" : "Asset"})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={classifyData.is_asset}
                  onCheckedChange={(v) => setClassifyData({ ...classifyData, is_asset: v })}
                />
                <Label>{language === "ar" ? "أصل ثابت" : "Fixed Asset"}</Label>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "طريقة الدفع *" : "Payment Method *"}</Label>
                <Select value={classifyData.payment_method} onValueChange={(v) => setClassifyData({ ...classifyData, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treasury">
                      <div className="flex items-center gap-2">
                        <Vault className="h-4 w-4" />
                        {language === "ar" ? "خزينة" : "Treasury"}
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {language === "ar" ? "بنك" : "Bank"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {classifyData.payment_method === "bank" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "البنك *" : "Bank *"}</Label>
                  <Select value={classifyData.bank_id} onValueChange={(v) => setClassifyData({ ...classifyData, bank_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر البنك" : "Select Bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_code} - {b.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {classifyData.payment_method === "treasury" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الخزينة *" : "Treasury *"}</Label>
                  <Select value={classifyData.treasury_id} onValueChange={(v) => setClassifyData({ ...classifyData, treasury_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} />
                    </SelectTrigger>
                    <SelectContent>
                      {treasuries.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.treasury_code} - {t.treasury_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleClassify} className="w-full">
                {language === "ar" ? "تصنيف الطلب" : "Classify Request"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add New Request Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إضافة طلب مصروف جديد" : "Add New Expense Request"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Expense Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع المصروف *" : "Expense Type *"}</Label>
                <Select 
                  value={newRequest.expense_type_id} 
                  onValueChange={(v) => {
                    const type = expenseTypes.find(t => t.id === v);
                    setNewRequest({ ...newRequest, expense_type_id: v, is_asset: type?.is_asset || false });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {language === "ar" && t.expense_name_ar ? t.expense_name_ar : t.expense_name}
                        {t.is_asset && <span className="text-xs text-muted-foreground ml-2">({language === "ar" ? "أصل" : "Asset"})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "الصنف" : "Item"}</Label>
                <Select value={newRequest.purchase_item_id} onValueChange={(v) => setNewRequest({ ...newRequest, purchase_item_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الصنف" : "Select Item"} />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {language === "ar" && item.item_name_ar ? item.item_name_ar : item.item_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Asset indicator */}
            <div className="flex items-center gap-3">
              <Switch
                checked={newRequest.is_asset}
                onCheckedChange={(v) => setNewRequest({ ...newRequest, is_asset: v })}
              />
              <Label>{language === "ar" ? "أصل ثابت" : "Fixed Asset"}</Label>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "الوصف *" : "Description *"}</Label>
              <Textarea
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                placeholder={language === "ar" ? "وصف المصروف" : "Expense description"}
                rows={2}
              />
            </div>

            {/* Quantity, UOM, Unit Price */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الكمية" : "Quantity"}</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={newRequest.quantity}
                  onChange={(e) => setNewRequest({ ...newRequest, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "وحدة القياس" : "UOM"}</Label>
                <Select value={newRequest.uom_id} onValueChange={(v) => setNewRequest({ ...newRequest, uom_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الوحدة" : "Select UOM"} />
                  </SelectTrigger>
                  <SelectContent>
                    {uomList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.uom_code} - {language === "ar" && u.uom_name_ar ? u.uom_name_ar : u.uom_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "سعر الوحدة *" : "Unit Price *"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newRequest.unit_price}
                  onChange={(e) => setNewRequest({ ...newRequest, unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Tax, Currency, Cost Center */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "نسبة الضريبة %" : "Tax %"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={newRequest.tax_percent}
                  onChange={(e) => setNewRequest({ ...newRequest, tax_percent: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "العملة" : "Currency"}</Label>
                <Select value={newRequest.currency_id} onValueChange={(v) => setNewRequest({ ...newRequest, currency_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select Currency"} />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</Label>
                <Select value={newRequest.cost_center_id} onValueChange={(v) => setNewRequest({ ...newRequest, cost_center_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر المركز" : "Select Center"} />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.cost_center_code} - {language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Calculated Totals */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>{language === "ar" ? "الإجمالي:" : "Total:"}</span>
                <span className="font-semibold">
                  {((parseFloat(newRequest.quantity) || 1) * (parseFloat(newRequest.unit_price) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{language === "ar" ? "الضريبة:" : "Tax:"}</span>
                <span>
                  {(((parseFloat(newRequest.quantity) || 1) * (parseFloat(newRequest.unit_price) || 0)) * (parseFloat(newRequest.tax_percent) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{language === "ar" ? "صافي الإجمالي بعد الضريبة:" : "Net Total After Tax:"}</span>
                <span className="text-primary">
                  {(((parseFloat(newRequest.quantity) || 1) * (parseFloat(newRequest.unit_price) || 0)) * (1 + (parseFloat(newRequest.tax_percent) || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                value={newRequest.notes}
                onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
                placeholder={language === "ar" ? "ملاحظات إضافية" : "Additional notes"}
                rows={2}
              />
            </div>

            <Button onClick={handleAddRequest} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              {language === "ar" ? "إضافة الطلب" : "Add Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل طلب المصروف" : "Edit Expense Request"}</DialogTitle>
          </DialogHeader>
          {editingRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-mono text-sm">{editingRequest.request_number}</p>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "الوصف" : "Description"}</Label>
                <Textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "المبلغ" : "Amount"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editData.amount}
                    onChange={(e) => setEditData({ ...editData, amount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "العملة" : "Currency"}</Label>
                  <Select value={editData.currency_id} onValueChange={handleCurrencyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر العملة" : "Select Currency"} />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.currency_code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "سعر الصرف" : "Exchange Rate"}</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={editData.exchange_rate}
                    onChange={(e) => setEditData({ ...editData, exchange_rate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? `المبلغ بـ${getBaseCurrency()?.currency_code || "Base"}` : `Amount (${getBaseCurrency()?.currency_code || "Base"})`}</Label>
                  <div className="p-2 bg-muted rounded text-lg font-semibold text-primary">
                    {(() => {
                      const amount = parseFloat(editData.amount) || 0;
                      const rate = parseFloat(editData.exchange_rate) || 1;
                      const currencyRate = getCurrencyRate(editData.currency_id);
                      if (currencyRate?.conversion_operator === 'divide') {
                        return (amount / rate).toLocaleString();
                      }
                      return (amount * rate).toLocaleString();
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع المصروف" : "Expense Type"}</Label>
                <Select 
                  value={editData.expense_type_id} 
                  onValueChange={(v) => {
                    const type = expenseTypes.find(t => t.id === v);
                    setEditData({ ...editData, expense_type_id: v, is_asset: type?.is_asset || false });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {language === "ar" && t.expense_name_ar ? t.expense_name_ar : t.expense_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={editData.is_asset}
                  onCheckedChange={(v) => setEditData({ ...editData, is_asset: v })}
                />
                <Label>{language === "ar" ? "أصل ثابت" : "Fixed Asset"}</Label>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                <Select value={editData.payment_method} onValueChange={(v) => setEditData({ ...editData, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الطريقة" : "Select Method"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treasury">
                      <div className="flex items-center gap-2">
                        <Vault className="h-4 w-4" />
                        {language === "ar" ? "خزينة" : "Treasury"}
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {language === "ar" ? "بنك" : "Bank"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editData.payment_method === "bank" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "البنك" : "Bank"}</Label>
                  <Select value={editData.bank_id} onValueChange={(v) => setEditData({ ...editData, bank_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر البنك" : "Select Bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_code} - {b.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {editData.payment_method === "treasury" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الخزينة" : "Treasury"}</Label>
                  <Select value={editData.treasury_id} onValueChange={(v) => setEditData({ ...editData, treasury_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} />
                    </SelectTrigger>
                    <SelectContent>
                      {treasuries.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.treasury_code} - {t.treasury_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</Label>
                <Select 
                  value={editData.cost_center_id || "__none__"} 
                  onValueChange={(v) => setEditData({ ...editData, cost_center_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر المركز" : "Select Center"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{language === "ar" ? "بدون" : "None"}</SelectItem>
                    {costCenters.filter(cc => cc.is_active).map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.cost_center_code} - {language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={2}
                />
              </div>

              <Button onClick={handleEditSave} className="w-full">
                {language === "ar" ? "حفظ التعديلات" : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseRequests;
