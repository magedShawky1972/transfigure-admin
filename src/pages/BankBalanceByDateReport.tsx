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
  bank_name: string;
  bank_name_ar: string | null;
  opening_balance: number | null;
}

interface PaymentMethod {
  id: string;
  payment_method: string;
  gateway_fee: number | null;
  fixed_value: number | null;
}

interface TransactionGroup {
  type: string;
  typeLabel: string;
  transactions: TransactionRow[];
  subtotal: number;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  charges: number;
  netAmount: number;
  type: 'income' | 'expense';
}

const BankBalanceByDateReport = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transactionGroups, setTransactionGroups] = useState<TransactionGroup[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [grandTotalIncome, setGrandTotalIncome] = useState(0);
  const [grandTotalExpense, setGrandTotalExpense] = useState(0);
  const [grandTotalCharges, setGrandTotalCharges] = useState(0);

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    const { data, error } = await supabase
      .from('banks')
      .select('id, bank_name, bank_name_ar, opening_balance')
      .eq('is_active', true)
      .order('bank_name');

    if (error) {
      toast.error(language === 'ar' ? 'خطأ في جلب البنوك' : 'Error fetching banks');
      return;
    }
    setBanks(data || []);
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

      // Fetch payment methods linked to this bank
      const { data: paymentMethods } = await supabase
        .from('payment_methods')
        .select('id, payment_method, gateway_fee, fixed_value')
        .eq('bank_id', selectedBankId);

      const paymentMethodNames = paymentMethods?.map(pm => pm.payment_method) || [];
      const paymentMethodMap = new Map<string, PaymentMethod>(
        paymentMethods?.map(pm => [pm.payment_method, pm]) || []
      );

      // Fetch order totals for sales income using payment_method text field
      let salesTransactions: TransactionRow[] = [];
      if (paymentMethodNames.length > 0) {
        const { data: orderTotals } = await supabase
          .from('ordertotals')
          .select('id, order_number, order_date, payment_method, total, bank_fee')
          .in('payment_method', paymentMethodNames)
          .gte('order_date', fromDate)
          .lte('order_date', toDate + 'T23:59:59')
          .order('order_date');

        salesTransactions = (orderTotals || []).map(ot => {
          const pm = paymentMethodMap.get(ot.payment_method || '');
          const charges = ot.bank_fee || 0;
          return {
            id: ot.id,
            date: ot.order_date ? new Date(ot.order_date).toISOString().split('T')[0] : '',
            description: language === 'ar' 
              ? `مبيعات - ${ot.payment_method || ''}` 
              : `Sales - ${ot.payment_method || ''}`,
            reference: ot.order_number || '',
            amount: Number(ot.total) || 0,
            charges: Number(charges),
            netAmount: (Number(ot.total) || 0) - Number(charges),
            type: 'income' as const,
          };
        });
      }

      // Fetch expense payments from this bank
      const { data: expensePayments } = await supabase
        .from('expense_requests')
        .select('id, request_number, paid_at, description, amount, expense_types(expense_name, expense_name_ar)')
        .eq('bank_id', selectedBankId)
        .eq('status', 'paid')
        .gte('paid_at', fromDate)
        .lte('paid_at', toDate + 'T23:59:59')
        .order('paid_at');

      const expenseTransactions: TransactionRow[] = (expensePayments || []).map(ep => ({
        id: ep.id,
        date: ep.paid_at?.split('T')[0] || '',
        description: language === 'ar' 
          ? `مصروفات - ${(ep.expense_types as any)?.expense_name_ar || (ep.expense_types as any)?.expense_name || ep.description}` 
          : `Expense - ${(ep.expense_types as any)?.expense_name || ep.description}`,
        reference: ep.request_number,
        amount: ep.amount,
        charges: 0,
        netAmount: ep.amount,
        type: 'expense' as const,
      }));

      // Fetch bank entries (transfers, charges, etc.)
      const { data: bankEntries } = await supabase
        .from('bank_entries')
        .select('id, entry_number, entry_date, entry_type, description, amount, bank_charges, other_charges')
        .eq('bank_id', selectedBankId)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date');

      const bankEntryTransactions: TransactionRow[] = (bankEntries || []).map(be => {
        const totalCharges = (be.bank_charges || 0) + (be.other_charges || 0);
        const isExpense = ['withdrawal', 'transfer_out', 'expense'].includes(be.entry_type);
        return {
          id: be.id,
          date: be.entry_date || '',
          description: language === 'ar' 
            ? `قيد بنكي - ${be.description || be.entry_type}` 
            : `Bank Entry - ${be.description || be.entry_type}`,
          reference: be.entry_number,
          amount: be.amount,
          charges: totalCharges,
          netAmount: isExpense ? be.amount + totalCharges : be.amount - totalCharges,
          type: isExpense ? 'expense' as const : 'income' as const,
        };
      });

      // Group transactions by type
      const groups: TransactionGroup[] = [];

      if (salesTransactions.length > 0) {
        groups.push({
          type: 'sales',
          typeLabel: language === 'ar' ? 'مبيعات عبر وسائل الدفع' : 'Sales via Payment Methods',
          transactions: salesTransactions,
          subtotal: salesTransactions.reduce((sum, t) => sum + t.netAmount, 0),
        });
      }

      if (expenseTransactions.length > 0) {
        groups.push({
          type: 'expenses',
          typeLabel: language === 'ar' ? 'مصروفات مدفوعة' : 'Paid Expenses',
          transactions: expenseTransactions,
          subtotal: expenseTransactions.reduce((sum, t) => sum + t.amount, 0),
        });
      }

      // Group bank entries by entry_type
      const depositEntries = bankEntryTransactions.filter(t => t.type === 'income');
      const withdrawalEntries = bankEntryTransactions.filter(t => t.type === 'expense');

      if (depositEntries.length > 0) {
        groups.push({
          type: 'deposits',
          typeLabel: language === 'ar' ? 'إيداعات بنكية' : 'Bank Deposits',
          transactions: depositEntries,
          subtotal: depositEntries.reduce((sum, t) => sum + t.netAmount, 0),
        });
      }

      if (withdrawalEntries.length > 0) {
        groups.push({
          type: 'withdrawals',
          typeLabel: language === 'ar' ? 'سحوبات بنكية' : 'Bank Withdrawals',
          transactions: withdrawalEntries,
          subtotal: withdrawalEntries.reduce((sum, t) => sum + t.netAmount, 0),
        });
      }

      setTransactionGroups(groups);

      // Calculate grand totals
      const totalIncome = groups
        .filter(g => g.type === 'sales' || g.type === 'deposits')
        .reduce((sum, g) => sum + g.subtotal, 0);
      
      const totalExpense = groups
        .filter(g => g.type === 'expenses' || g.type === 'withdrawals')
        .reduce((sum, g) => sum + g.subtotal, 0);

      const totalCharges = [...salesTransactions, ...bankEntryTransactions]
        .reduce((sum, t) => sum + t.charges, 0);

      setGrandTotalIncome(totalIncome);
      setGrandTotalExpense(totalExpense);
      setGrandTotalCharges(totalCharges);

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

    transactionGroups.forEach(group => {
      csv += `\n${group.typeLabel}\n`;
      csv += `${language === 'ar' ? 'التاريخ' : 'Date'},${language === 'ar' ? 'الوصف' : 'Description'},${language === 'ar' ? 'المرجع' : 'Reference'},${language === 'ar' ? 'المبلغ' : 'Amount'},${language === 'ar' ? 'الرسوم' : 'Charges'},${language === 'ar' ? 'الصافي' : 'Net Amount'}\n`;
      group.transactions.forEach(t => {
        csv += `${t.date},${t.description},${t.reference},${t.amount},${t.charges},${t.netAmount}\n`;
      });
      csv += `${language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'},,,,,${group.subtotal}\n`;
    });

    csv += `\n${language === 'ar' ? 'الملخص' : 'Summary'}\n`;
    csv += `${language === 'ar' ? 'الرصيد الافتتاحي' : 'Opening Balance'},${openingBalance}\n`;
    csv += `${language === 'ar' ? 'إجمالي الإيرادات' : 'Total Income'},${grandTotalIncome}\n`;
    csv += `${language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'},${grandTotalExpense}\n`;
    csv += `${language === 'ar' ? 'إجمالي الرسوم' : 'Total Charges'},${grandTotalCharges}\n`;
    csv += `${language === 'ar' ? 'الرصيد الختامي' : 'Closing Balance'},${openingBalance + grandTotalIncome - grandTotalExpense}\n`;

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bank_balance_${fromDate}_${toDate}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const closingBalance = openingBalance + grandTotalIncome - grandTotalExpense;

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
              ? 'عرض جميع المعاملات حسب النوع مع الرسوم والإجماليات' 
              : 'View all transactions by type with charges and totals'}
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
                  {banks.map(bank => (
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
              <Button variant="outline" onClick={exportToExcel} disabled={transactionGroups.length === 0}>
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={transactionGroups.length === 0}>
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {transactionGroups.length > 0 && (
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
                {language === 'ar' ? 'إجمالي الإيرادات' : 'Total Income'}
              </div>
              <div className="text-2xl font-bold text-green-600 mt-1">{formatNumber(grandTotalIncome)}</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <ArrowDownCircle className="h-4 w-4" />
                {language === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}
              </div>
              <div className="text-2xl font-bold text-red-600 mt-1">{formatNumber(grandTotalExpense)}</div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-600 text-sm">
                <Percent className="h-4 w-4" />
                {language === 'ar' ? 'إجمالي الرسوم' : 'Total Charges'}
              </div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{formatNumber(grandTotalCharges)}</div>
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

      {/* Transaction Groups */}
      {transactionGroups.map((group) => (
        <Card key={group.type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{group.typeLabel}</span>
              <span className={`text-lg ${group.type === 'sales' || group.type === 'deposits' ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(group.subtotal)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                  <TableHead>{language === 'ar' ? 'المرجع' : 'Reference'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'المبلغ' : 'Amount'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'الرسوم' : 'Charges'}</TableHead>
                  <TableHead className="text-right">{language === 'ar' ? 'الصافي' : 'Net Amount'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.date}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell className="font-mono text-sm">{t.reference}</TableCell>
                    <TableCell className="text-right">{formatNumber(t.amount)}</TableCell>
                    <TableCell className="text-right text-orange-600">{t.charges > 0 ? formatNumber(t.charges) : '-'}</TableCell>
                    <TableCell className={`text-right font-medium ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatNumber(t.netAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5} className="text-right">
                    {language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}
                  </TableCell>
                  <TableCell className={`text-right ${group.type === 'sales' || group.type === 'deposits' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(group.subtotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Empty State */}
      {transactionGroups.length === 0 && !loading && (
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
