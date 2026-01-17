import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Search, Download, Printer, Landmark, ArrowUpCircle, ArrowDownCircle, Percent, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_name_ar: string | null;
  opening_balance: number | null;
}

interface SalesRow {
  id: string;
  paymentMethod: string;
  grossAmount: number;
  charges: number;
  netAmount: number;
  transactionCount: number;
}

interface SummaryRow {
  id: string;
  category: string;
  description: string;
  totalAmount: number;
  type: 'income' | 'expense';
  transactionCount: number;
}

interface TransactionGroup {
  type: string;
  typeLabel: string;
  rows: SummaryRow[];
  subtotal: number;
}

const BankBalanceByDateReport = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [grandTotalIncome, setGrandTotalIncome] = useState(0);
  const [grandTotalExpense, setGrandTotalExpense] = useState(0);
  const [grandTotalCharges, setGrandTotalCharges] = useState(0);
  const [grandTotalNetSales, setGrandTotalNetSales] = useState(0);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, bank_code, bank_name, bank_name_ar, opening_balance')
        .eq('is_active', true)
        .order('bank_name');

      if (error) {
        console.error('Error fetching banks:', error);
        toast.error(language === 'ar' ? 'خطأ في جلب البنوك' : 'Error fetching banks');
        return;
      }
      console.log('Banks loaded:', data);
      setBanks(data || []);
    } catch (err) {
      console.error('Exception fetching banks:', err);
      toast.error(language === 'ar' ? 'خطأ في جلب البنوك' : 'Error fetching banks');
    }
  };

  const fetchReport = async () => {
    if (!selectedBankId || !fromDate || !toDate) {
      toast.error(language === 'ar' ? 'يرجى تحديد البنك والتواريخ' : 'Please select bank and dates');
      return;
    }

    setLoading(true);
    try {
      const selectedBank = banks.find(b => b.id === selectedBankId);
      setOpeningBalance(selectedBank?.opening_balance || 0);
      const selectedBankCode = selectedBank?.bank_code;

      if (!selectedBankCode) {
        toast.error(language === 'ar' ? 'رمز البنك غير موجود' : 'Bank code not found');
        setLoading(false);
        return;
      }

      // Convert dates to integer format YYYYMMDD for order_date_int filtering
      const fromDateInt = parseInt(fromDate.replace(/-/g, ''), 10);
      const toDateInt = parseInt(toDate.replace(/-/g, ''), 10);

      // Use the optimized database function for fast aggregation
      const { data: reportData, error: reportError } = await supabase
        .rpc('get_bank_balance_report', {
          p_bank_id: selectedBankId,
          p_from_date_int: fromDateInt,
          p_to_date_int: toDateInt
        });

      if (reportError) {
        console.error('Error fetching report data:', reportError);
        toast.error(language === 'ar' ? 'خطأ في جلب البيانات' : 'Error fetching data');
        setLoading(false);
        return;
      }

      console.log('Report data:', reportData);

      // Create sales rows from the database function result
      const newSalesRows: SalesRow[] = (reportData || []).map((row: any, idx: number) => ({
        id: `sales-${idx}`,
        paymentMethod: (row.payment_type || 'other').toUpperCase(),
        grossAmount: Number(row.total_amount) || 0,
        charges: Number(row.bank_charges) || 0,
        netAmount: (Number(row.total_amount) || 0) - (Number(row.bank_charges) || 0),
        transactionCount: Number(row.order_count) || 0,
      }));

      setSalesRows(newSalesRows);

      // Calculate sales totals
      const totalGrossSales = newSalesRows.reduce((sum, r) => sum + r.grossAmount, 0);
      const totalChargesSales = newSalesRows.reduce((sum, r) => sum + r.charges, 0);
      const totalNetSales = newSalesRows.reduce((sum, r) => sum + r.netAmount, 0);
      setGrandTotalNetSales(totalNetSales);

      // Fetch expense payments from this bank - grouped by expense type
      const { data: expensePayments } = await supabase
        .from('expense_requests')
        .select('id, request_number, paid_at, description, amount, expense_types(expense_name, expense_name_ar)')
        .eq('bank_id', selectedBankId)
        .eq('status', 'paid')
        .gte('paid_at', fromDate + 'T00:00:00')
        .lte('paid_at', toDate + 'T23:59:59');

      const expenseSummaryMap = new Map<string, { total: number; count: number; nameAr: string }>();
      (expensePayments || []).forEach(ep => {
        const expType = (ep.expense_types as any)?.expense_name || ep.description || 'Other';
        const expTypeAr = (ep.expense_types as any)?.expense_name_ar || expType;
        const existing = expenseSummaryMap.get(expType) || { total: 0, count: 0, nameAr: expTypeAr };
        existing.total += ep.amount;
        existing.count += 1;
        expenseSummaryMap.set(expType, existing);
      });

      const expenseRows: SummaryRow[] = Array.from(expenseSummaryMap.entries()).map(([expType, data], idx) => ({
        id: `expense-${idx}`,
        category: expType,
        description: language === 'ar' ? data.nameAr : expType,
        totalAmount: data.total,
        type: 'expense' as const,
        transactionCount: data.count,
      }));

      // Fetch bank entries - grouped by entry_type
      const { data: bankEntries } = await supabase
        .from('bank_entries')
        .select('id, entry_number, entry_date, entry_type, description, amount, bank_charges, other_charges')
        .eq('bank_id', selectedBankId)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate);

      const depositSummaryMap = new Map<string, { total: number; charges: number; count: number }>();
      const withdrawalSummaryMap = new Map<string, { total: number; charges: number; count: number }>();

      (bankEntries || []).forEach(be => {
        const totalCharges = (be.bank_charges || 0) + (be.other_charges || 0);
        const isExpense = ['withdrawal', 'transfer_out', 'expense'].includes(be.entry_type);
        const entryLabel = be.entry_type || 'other';
        
        if (isExpense) {
          const existing = withdrawalSummaryMap.get(entryLabel) || { total: 0, charges: 0, count: 0 };
          existing.total += be.amount;
          existing.charges += totalCharges;
          existing.count += 1;
          withdrawalSummaryMap.set(entryLabel, existing);
        } else {
          const existing = depositSummaryMap.get(entryLabel) || { total: 0, charges: 0, count: 0 };
          existing.total += be.amount;
          existing.charges += totalCharges;
          existing.count += 1;
          depositSummaryMap.set(entryLabel, existing);
        }
      });

      const depositRows: SummaryRow[] = Array.from(depositSummaryMap.entries()).map(([entryType, data], idx) => ({
        id: `deposit-${idx}`,
        category: entryType,
        description: language === 'ar' ? `إيداع - ${entryType}` : `Deposit - ${entryType}`,
        totalAmount: data.total,
        type: 'income' as const,
        transactionCount: data.count,
      }));

      const withdrawalRows: SummaryRow[] = Array.from(withdrawalSummaryMap.entries()).map(([entryType, data], idx) => ({
        id: `withdrawal-${idx}`,
        category: entryType,
        description: language === 'ar' ? `سحب - ${entryType}` : `Withdrawal - ${entryType}`,
        totalAmount: data.total,
        type: 'expense' as const,
        transactionCount: data.count,
      }));

      // Build groups (excluding sales which are now separate)
      const groups: TransactionGroup[] = [];

      if (expenseRows.length > 0) {
        const subtotal = expenseRows.reduce((sum, r) => sum + r.totalAmount, 0);
        groups.push({
          type: 'expenses',
          typeLabel: language === 'ar' ? 'مصروفات مدفوعة' : 'Paid Expenses',
          rows: expenseRows,
          subtotal,
        });
      }

      if (depositRows.length > 0) {
        const subtotal = depositRows.reduce((sum, r) => sum + r.totalAmount, 0);
        groups.push({
          type: 'deposits',
          typeLabel: language === 'ar' ? 'إيداعات بنكية' : 'Bank Deposits',
          rows: depositRows,
          subtotal,
        });
      }

      if (withdrawalRows.length > 0) {
        const subtotal = withdrawalRows.reduce((sum, r) => sum + r.totalAmount, 0);
        groups.push({
          type: 'withdrawals',
          typeLabel: language === 'ar' ? 'سحوبات بنكية' : 'Bank Withdrawals',
          rows: withdrawalRows,
          subtotal,
        });
      }

      setTransactionGroups(groups);

      // Calculate grand totals
      const totalIncome = totalNetSales + groups
        .filter(g => g.type === 'deposits')
        .reduce((sum, g) => sum + g.subtotal, 0);

      const totalExpense = groups
        .filter(g => g.type === 'expenses' || g.type === 'withdrawals')
        .reduce((sum, g) => sum + g.subtotal, 0);

      setGrandTotalIncome(totalIncome);
      setGrandTotalExpense(totalExpense);
      setGrandTotalCharges(totalChargesSales);

      toast.success(language === 'ar' ? 'تم تحميل التقرير' : 'Report loaded');
    } catch (error) {
      console.error('Error fetching report:', error);
      toast.error(language === 'ar' ? 'خطأ في تحميل التقرير' : 'Error loading report');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const exportToExcel = () => {
    const selectedBank = banks.find(b => b.id === selectedBankId);
    const bankName = language === 'ar' ? selectedBank?.bank_name_ar : selectedBank?.bank_name;
    
    let csv = `${language === 'ar' ? 'تقرير رصيد البنك' : 'Bank Balance Report'}\n`;
    csv += `${language === 'ar' ? 'البنك' : 'Bank'},${bankName}\n`;
    csv += `${language === 'ar' ? 'من تاريخ' : 'From Date'},${fromDate}\n`;
    csv += `${language === 'ar' ? 'إلى تاريخ' : 'To Date'},${toDate}\n\n`;

    // Sales section with Gross, Charges, Net
    if (salesRows.length > 0) {
      csv += `\n${language === 'ar' ? 'المبيعات' : 'Sales'}\n`;
      csv += `${language === 'ar' ? 'وسيلة الدفع' : 'Payment Method'},${language === 'ar' ? 'عدد المعاملات' : 'Count'},${language === 'ar' ? 'المبلغ الإجمالي' : 'Gross Amount'},${language === 'ar' ? 'الرسوم' : 'Charges'},${language === 'ar' ? 'صافي المبلغ' : 'Net Amount'}\n`;
      salesRows.forEach(r => {
        csv += `${r.paymentMethod},${r.transactionCount},${r.grossAmount},${r.charges},${r.netAmount}\n`;
      });
      csv += `${language === 'ar' ? 'المجموع' : 'Total'},${salesRows.reduce((s, r) => s + r.transactionCount, 0)},${salesRows.reduce((s, r) => s + r.grossAmount, 0)},${salesRows.reduce((s, r) => s + r.charges, 0)},${grandTotalNetSales}\n`;
    }

    // Other groups
    (transactionGroups || []).forEach(group => {
      csv += `\n${group.typeLabel}\n`;
      csv += `${language === 'ar' ? 'الوصف' : 'Description'},${language === 'ar' ? 'عدد المعاملات' : 'Count'},${language === 'ar' ? 'المبلغ' : 'Amount'}\n`;
      (group.rows || []).forEach(r => {
        csv += `${r.description},${r.transactionCount},${r.totalAmount}\n`;
      });
      csv += `${language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'},,${group.subtotal}\n`;
    });

    csv += `\n${language === 'ar' ? 'الملخص' : 'Summary'}\n`;
    csv += `${language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'},${openingBalance}\n`;
    csv += `${language === 'ar' ? 'صافي المبيعات' : 'Net Sales'},${grandTotalNetSales}\n`;
    csv += `${language === 'ar' ? 'إجمالي الرسوم البنكية' : 'Total Bank Charges'},${grandTotalCharges}\n`;
    csv += `${language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'},${grandTotalExpense}\n`;
    csv += `${language === 'ar' ? 'الرصيد الختامي' : 'Closing Balance'},${closingBalance}\n`;

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bank_balance_${fromDate}_${toDate}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const closingBalance = openingBalance + grandTotalIncome - grandTotalCharges - grandTotalExpense;

  const getGroupColor = (type: string) => {
    switch (type) {
      case 'sales':
      case 'deposits':
        return 'text-green-600';
      case 'charges':
        return 'text-orange-600';
      default:
        return 'text-red-600';
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-lg p-8 shadow-lg flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-3xl font-bold">
            {language === 'ar' ? 'تقرير رصيد البنك' : 'Bank Balance Report'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'ملخص المعاملات حسب وسيلة الدفع مع الرسوم والإجماليات' 
              : 'Transaction summary by payment method with charges and totals'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            {language === 'ar' ? 'فلاتر البحث' : 'Search Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'البنك' : 'Bank'}</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر البنك' : 'Select Bank'} />
                </SelectTrigger>
                <SelectContent>
                  {(banks || []).map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {language === 'ar' ? bank.bank_name_ar || bank.bank_name : bank.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchReport} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'بحث' : 'Search'}
              </Button>
              <Button variant="outline" onClick={exportToExcel} disabled={salesRows.length === 0 && (transactionGroups || []).length === 0}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={salesRows.length === 0 && (transactionGroups || []).length === 0}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {(salesRows.length > 0 || (transactionGroups || []).length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Landmark className="h-4 w-4" />
                {language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}
              </div>
              <div className="text-2xl font-bold mt-1">{formatNumber(openingBalance)}</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <ArrowUpCircle className="h-4 w-4" />
                {language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">{formatNumber(grandTotalIncome)}</div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-600 text-sm">
                <Percent className="h-4 w-4" />
                {language === 'ar' ? 'الرسوم البنكية' : 'Bank Charges'}
              </div>
              <div className="text-2xl font-bold text-orange-600 mt-1">-{formatNumber(grandTotalCharges)}</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <ArrowDownCircle className="h-4 w-4" />
                {language === 'ar' ? 'المصروفات' : 'Expenses'}
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">-{formatNumber(grandTotalExpense)}</div>
            </CardContent>
          </Card>
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-primary text-sm">
                <Landmark className="h-4 w-4" />
                {language === 'ar' ? 'الرصيد الختامي' : 'Closing Balance'}
              </div>
              <div className="text-2xl font-bold text-primary mt-1">{formatNumber(closingBalance)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Table */}
      {salesRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{language === 'ar' ? 'المبيعات' : 'Sales'}</span>
              <span className="text-lg text-green-600">
                {formatNumber(salesRows.reduce((sum, r) => sum + r.grossAmount, 0))}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'وسيلة الدفع' : 'Payment Method'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'عدد المعاملات' : 'Count'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.paymentMethod}</TableCell>
                    <TableCell className="text-center">{row.transactionCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600">{formatNumber(row.grossAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>{language === 'ar' ? 'المجموع' : 'Total'}</TableCell>
                  <TableCell className="text-center">
                    {salesRows.reduce((sum, r) => sum + r.transactionCount, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatNumber(salesRows.reduce((sum, r) => sum + r.grossAmount, 0))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bank Charges Table */}
      {grandTotalCharges > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{language === 'ar' ? 'رسوم البنك' : 'Bank Charges'}</span>
              <span className="text-lg text-orange-600">
                -{formatNumber(grandTotalCharges)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'وسيلة الدفع' : 'Payment Method'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'عدد المعاملات' : 'Count'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'الرسوم' : 'Charges'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesRows.filter(row => row.charges > 0).map((row) => (
                  <TableRow key={`charges-${row.id}`}>
                    <TableCell className="font-medium">{row.paymentMethod}</TableCell>
                    <TableCell className="text-center">{row.transactionCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-orange-600">-{formatNumber(row.charges)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>{language === 'ar' ? 'المجموع' : 'Total'}</TableCell>
                  <TableCell className="text-center">
                    {salesRows.filter(r => r.charges > 0).reduce((sum, r) => sum + r.transactionCount, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    -{formatNumber(grandTotalCharges)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Other Transaction Groups (Expenses, Deposits, Withdrawals) */}
      {(transactionGroups || []).map((group) => (
        <Card key={group.type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{group.typeLabel}</span>
              <span className={`text-lg ${getGroupColor(group.type)}`}>
                {group.type === 'expenses' || group.type === 'withdrawals' ? '-' : ''}
                {formatNumber(group.subtotal)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                  <TableHead className="text-center">{language === 'ar' ? 'عدد المعاملات' : 'Count'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(group.rows || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.description}</TableCell>
                    <TableCell className="text-center">{r.transactionCount.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-medium ${getGroupColor(group.type)}`}>
                      {group.type === 'expenses' || group.type === 'withdrawals' ? '-' : ''}
                      {formatNumber(r.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2} className="text-right">
                    {language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}
                  </TableCell>
                  <TableCell className={`text-right ${getGroupColor(group.type)}`}>
                    {group.type === 'expenses' || group.type === 'withdrawals' ? '-' : ''}
                    {formatNumber(group.subtotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Grand Total Card */}
      {(salesRows.length > 0 || (transactionGroups && transactionGroups.length > 0)) && (
        <Card className="border-2 border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">
              {language === 'ar' ? 'الإجمالي الكلي' : 'Grand Total'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'}</TableCell>
                  <TableCell className="text-right font-bold">{formatNumber(openingBalance)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-green-600">{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    +{formatNumber(salesRows.reduce((sum, r) => sum + r.grossAmount, 0))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-orange-600">{language === 'ar' ? 'إجمالي رسوم البنك' : 'Total Bank Charges'}</TableCell>
                  <TableCell className="text-right font-bold text-orange-600">
                    -{formatNumber(grandTotalCharges)}
                  </TableCell>
                </TableRow>
                {transactionGroups.filter(g => g.type === 'deposits').length > 0 && (
                  <TableRow>
                    <TableCell className="font-medium text-green-600">{language === 'ar' ? 'إجمالي الإيداعات' : 'Total Deposits'}</TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                      +{formatNumber(transactionGroups.filter(g => g.type === 'deposits').reduce((sum, g) => sum + g.subtotal, 0))}
                    </TableCell>
                  </TableRow>
                )}
                {transactionGroups.filter(g => g.type === 'expenses').length > 0 && (
                  <TableRow>
                    <TableCell className="font-medium text-red-600">{language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      -{formatNumber(transactionGroups.filter(g => g.type === 'expenses').reduce((sum, g) => sum + g.subtotal, 0))}
                    </TableCell>
                  </TableRow>
                )}
                {transactionGroups.filter(g => g.type === 'withdrawals').length > 0 && (
                  <TableRow>
                    <TableCell className="font-medium text-red-600">{language === 'ar' ? 'إجمالي السحوبات' : 'Total Withdrawals'}</TableCell>
                    <TableCell className="text-right font-bold text-red-600">
                      -{formatNumber(transactionGroups.filter(g => g.type === 'withdrawals').reduce((sum, g) => sum + g.subtotal, 0))}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-primary/10">
                  <TableCell className="font-bold text-lg">{language === 'ar' ? 'الرصيد الختامي' : 'Closing Balance'}</TableCell>
                  <TableCell className={`text-right font-bold text-lg ${closingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(closingBalance)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {salesRows.length === 0 && (!transactionGroups || transactionGroups.length === 0) && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{language === 'ar' ? 'اختر البنك والتواريخ لعرض التقرير' : 'Select bank and dates to view report'}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BankBalanceByDateReport;
