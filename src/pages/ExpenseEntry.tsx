import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Plus, Check, X, DollarSign, FileText, Eye, Receipt, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";

interface Bank {
  id: string;
  bank_name: string;
  bank_name_ar: string | null;
}

interface Treasury {
  id: string;
  treasury_name: string;
  treasury_name_ar: string | null;
}

interface Currency {
  id: string;
  currency_code: string;
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
  cost_center_id: string | null;
  grand_total: number;
  status: string;
}

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const ExpenseEntryPage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Master data
  const [banks, setBanks] = useState<Bank[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<{ id: string; expense_code: string; expense_name: string }[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  // Entries list
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [selectedMonth, selectedYear]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [banksRes, treasuriesRes, currenciesRes, expenseTypesRes, costCentersRes] = await Promise.all([
        supabase.from("banks").select("id, bank_name, bank_name_ar").eq("is_active", true),
        supabase.from("treasuries").select("id, treasury_name, treasury_name_ar").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code").eq("is_active", true),
        supabase.from("expense_types").select("id, expense_code, expense_name").eq("is_active", true),
        supabase.from("cost_centers").select("id, cost_center_code, cost_center_name, cost_center_name_ar").eq("is_active", true),
      ]);

      if (banksRes.error) throw banksRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (currenciesRes.error) throw currenciesRes.error;
      if (expenseTypesRes.error) throw expenseTypesRes.error;
      if (costCentersRes.error) throw costCentersRes.error;

      setBanks(banksRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setExpenseTypes(expenseTypesRes.data || []);
      setCostCenters(costCentersRes.data || []);
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
        .select("id, entry_number, entry_date, expense_reference, payment_method, bank_id, treasury_id, currency_id, cost_center_id, grand_total, status")
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries((data || []) as unknown as ExpenseEntry[]);
    } catch (error) {
      console.error("Error fetching entries:", error);
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

        // Fetch full entry to get grand_total and currency_id
        const { data: fullEntry } = await supabase
          .from("expense_entries")
          .select("grand_total, currency_id, exchange_rate")
          .eq("id", entryId)
          .single();

        const grandTotal = fullEntry?.grand_total || 0;

        // Create bank or treasury entry and post to ledger
        if (entry.payment_method === "bank" && entry.bank_id) {
          const entryNumber = `BNK${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}${String(new Date().getSeconds()).padStart(2, "0")}`;
          
          await supabase.from("bank_entries").insert({
            entry_number: entryNumber,
            bank_id: entry.bank_id,
            entry_type: "withdrawal",
            amount: grandTotal,
            description: `${language === "ar" ? "مصروفات: " : "Expense Entry: "}${entry.entry_number}`,
            entry_date: new Date().toISOString().split("T")[0],
            created_by: currentUserId,
            status: "approved",
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          });

          // Update bank balance
          const { data: bankData } = await supabase.from("banks").select("current_balance").eq("id", entry.bank_id).single();
          const newBalance = (bankData?.current_balance || 0) - grandTotal;
          await supabase.from("banks").update({ current_balance: newBalance }).eq("id", entry.bank_id);

          // Post to treasury ledger (bank)
          await supabase.from("treasury_ledger").insert({
            bank_id: entry.bank_id,
            entry_date: new Date().toISOString(),
            reference_type: "expense_entry",
            reference_id: entryId,
            reference_number: entry.entry_number,
            description: `${language === "ar" ? "مصروفات: " : "Expense Entry: "}${entry.entry_number}`,
            credit_amount: grandTotal,
            debit_amount: 0,
            balance_after: newBalance,
            currency_id: fullEntry?.currency_id,
            exchange_rate: fullEntry?.exchange_rate || 1,
            created_by: currentUserId,
          });
        } else if (entry.payment_method === "treasury" && entry.treasury_id) {
          const entryNumber = `TRS${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${String(new Date().getHours()).padStart(2, "0")}${String(new Date().getMinutes()).padStart(2, "0")}${String(new Date().getSeconds()).padStart(2, "0")}`;
          
          await supabase.from("treasury_entries").insert({
            entry_number: entryNumber,
            treasury_id: entry.treasury_id,
            entry_type: "withdrawal",
            amount: grandTotal,
            description: `${language === "ar" ? "مصروفات: " : "Expense Entry: "}${entry.entry_number}`,
            entry_date: new Date().toISOString().split("T")[0],
            created_by: currentUserId,
            status: "approved",
            approved_by: currentUserId,
            approved_at: new Date().toISOString(),
          });

          // Update treasury balance
          const { data: treasuryData } = await supabase.from("treasuries").select("current_balance").eq("id", entry.treasury_id).single();
          const newBalance = (treasuryData?.current_balance || 0) - grandTotal;
          await supabase.from("treasuries").update({ current_balance: newBalance }).eq("id", entry.treasury_id);

          // Post to treasury ledger
          await supabase.from("treasury_ledger").insert({
            treasury_id: entry.treasury_id,
            entry_date: new Date().toISOString(),
            reference_type: "expense_entry",
            reference_id: entryId,
            reference_number: entry.entry_number,
            description: `${language === "ar" ? "مصروفات: " : "Expense Entry: "}${entry.entry_number}`,
            credit_amount: grandTotal,
            debit_amount: 0,
            balance_after: newBalance,
            currency_id: fullEntry?.currency_id,
            exchange_rate: fullEntry?.exchange_rate || 1,
            created_by: currentUserId,
          });
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

  const handleDeleteEntry = async (entryId: string) => {
    try {
      // First delete treasury ledger entries
      const { error: ledgerError } = await supabase
        .from("treasury_ledger")
        .delete()
        .eq("reference_type", "expense_entry")
        .eq("reference_id", entryId);
      
      if (ledgerError) {
        console.error("Error deleting ledger entries:", ledgerError);
      }

      // Delete entry lines
      const { error: linesError } = await supabase
        .from("expense_entry_lines")
        .delete()
        .eq("expense_entry_id", entryId);
      
      if (linesError) throw linesError;

      // Then delete the entry
      const { error } = await supabase
        .from("expense_entries")
        .delete()
        .eq("id", entryId);
      
      if (error) throw error;

      toast.success(language === "ar" ? "تم حذف القيد بنجاح" : "Entry deleted successfully");
      fetchEntries();
    } catch (error: any) {
      console.error("Error deleting entry:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في حذف القيد" : "Error deleting entry"));
    }
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error(language === "ar" ? "الملف فارغ" : "File is empty");
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          // Parse row data - expected columns: entry_date, expense_reference, payment_method, bank_name/treasury_name, currency_code, expense_type, quantity, unit_price, vat_percent
          const entryDate = row.entry_date || row.التاريخ || new Date().toISOString().split("T")[0];
          const reference = row.expense_reference || row.المرجع || "";
          const paymentMethod = (row.payment_method || row.طريقة_الدفع || "treasury").toLowerCase();
          
          // Find bank or treasury
          let bankId = null;
          let treasuryId = null;
          if (paymentMethod === "bank") {
            const bankName = row.bank_name || row.البنك;
            const bank = banks.find(b => b.bank_name.toLowerCase() === bankName?.toLowerCase() || b.bank_name_ar === bankName);
            bankId = bank?.id || null;
          } else {
            const treasuryName = row.treasury_name || row.الخزينة;
            const treasury = treasuries.find(t => t.treasury_name.toLowerCase() === treasuryName?.toLowerCase() || t.treasury_name_ar === treasuryName);
            treasuryId = treasury?.id || treasuries[0]?.id;
          }

          // Find currency
          const currencyCode = row.currency_code || row.العملة || "SAR";
          const currency = currencies.find(c => c.currency_code.toLowerCase() === currencyCode.toLowerCase());
          const currencyId = currency?.id || currencies[0]?.id;

          // Find expense type
          const expenseCode = row.expense_type || row.expense_code || row.نوع_المصروف;
          const expenseType = expenseTypes.find(e => 
            e.expense_code.toLowerCase() === expenseCode?.toLowerCase() || 
            e.expense_name.toLowerCase() === expenseCode?.toLowerCase()
          );

          // Parse amounts
          const quantity = parseFloat(row.quantity || row.الكمية || 1) || 1;
          const unitPrice = parseFloat(row.unit_price || row.سعر_الوحدة || row.amount || row.المبلغ || 0) || 0;
          const vatPercent = parseFloat(row.vat_percent || row.نسبة_الضريبة || 0) || 0;
          const lineTotal = quantity * unitPrice;
          const vatAmount = lineTotal * (vatPercent / 100);
          const grandTotal = lineTotal + vatAmount;

          // Generate entry number
          const now = new Date();
          const entryNumber = `EXE${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}${String(successCount).padStart(3, "0")}`;

          // Create expense entry
          const { data: entryData, error: entryError } = await supabase
            .from("expense_entries")
            .insert({
              entry_number: entryNumber,
              entry_date: entryDate,
              expense_reference: reference,
              payment_method: paymentMethod,
              bank_id: bankId,
              treasury_id: treasuryId,
              currency_id: currencyId,
              exchange_rate: 1,
              subtotal: lineTotal,
              total_vat: vatAmount,
              grand_total: grandTotal,
              status: "draft",
              created_by: currentUserId,
            })
            .select("id")
            .single();

          if (entryError) throw entryError;

          // Create expense line
          await supabase.from("expense_entry_lines").insert({
            expense_entry_id: entryData.id,
            line_number: 1,
            expense_type_id: expenseType?.id || null,
            description: row.description || row.الوصف || "",
            quantity: quantity,
            unit_price: unitPrice,
            total: lineTotal,
            vat_percent: vatPercent,
            vat_amount: vatAmount,
            line_total: grandTotal,
          });

          successCount++;
        } catch (rowError) {
          console.error("Error importing row:", rowError);
          errorCount++;
        }
      }

      toast.success(
        language === "ar" 
          ? `تم استيراد ${successCount} قيد بنجاح${errorCount > 0 ? ` (${errorCount} فشل)` : ""}`
          : `Imported ${successCount} entries${errorCount > 0 ? ` (${errorCount} failed)` : ""}`
      );
      fetchEntries();
    } catch (error: any) {
      console.error("Error importing Excel:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في استيراد الملف" : "Error importing file"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
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

  const getCostCenterName = (costCenterId: string | null) => {
    if (!costCenterId) return "-";
    const cc = costCenters.find(c => c.id === costCenterId);
    if (!cc) return "-";
    return language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name;
  };

  if (loading || importing) return <LoadingOverlay />;

  return (
    <div className="container mx-auto p-4 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {language === "ar" ? "قيد المصروفات" : "Expense Entry"}
          </CardTitle>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              {language === "ar" ? "استيراد Excel" : "Import Excel"}
            </Button>
            <Button onClick={() => navigate("/expense-entry/new")}>
              <Plus className="h-4 w-4 mr-1" />
              {language === "ar" ? "قيد جديد" : "New Entry"}
            </Button>
          </div>
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
                  <TableHead>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</TableHead>
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
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد قيود" : "No entries found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono">{entry.entry_number}</TableCell>
                      <TableCell>{format(new Date(entry.entry_date), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{entry.expense_reference || "-"}</TableCell>
                      <TableCell>{getCostCenterName(entry.cost_center_id)}</TableCell>
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
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/expense-entry/${entry.id}`)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          {entry.status === "draft" && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleStatusChange(entry.id, "pending")}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {language === "ar" ? "تأكيد الحذف" : "Confirm Delete"}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {language === "ar" 
                                        ? `هل أنت متأكد من حذف القيد رقم ${entry.entry_number}؟ لا يمكن التراجع عن هذا الإجراء.`
                                        : `Are you sure you want to delete entry ${entry.entry_number}? This action cannot be undone.`}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      {language === "ar" ? "إلغاء" : "Cancel"}
                                    </AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteEntry(entry.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      {language === "ar" ? "حذف" : "Delete"}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
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
    </div>
  );
};

export default ExpenseEntryPage;
