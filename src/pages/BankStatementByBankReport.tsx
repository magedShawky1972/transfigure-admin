import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface Bank {
  id: string;
  bank_name: string;
  bank_name_ar: string | null;
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  description: string | null;
  in_amount: number | null;
  out_amount: number | null;
  balance_after: number | null;
  reference_number: string | null;
  runningBalance?: number;
}

const BankStatementByBankReport = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    checkAccess();
    fetchBanks();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roles) {
        setHasAccess(true);
        setCheckingAccess(false);
        return;
      }

      const { data: permissions } = await supabase
        .from('user_permissions')
        .select('menu_item')
        .eq('user_id', user.id)
        .eq('parent_menu', 'Reports')
        .eq('menu_item', 'bank-statement-by-bank')
        .eq('has_access', true)
        .maybeSingle();

      setHasAccess(!!permissions);
    } catch (error) {
      console.error('Error checking access:', error);
    } finally {
      setCheckingAccess(false);
    }
  };

  const fetchBanks = async () => {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('id, bank_name, bank_name_ar')
        .eq('is_active', true)
        .order('bank_name');

      if (error) throw error;
      setBanks(data || []);
    } catch (error) {
      console.error('Error fetching banks:', error);
      toast.error(language === 'ar' ? 'خطأ في جلب البنوك' : 'Error fetching banks');
    }
  };

  const runReport = async () => {
    if (!selectedBank) {
      toast.error(language === 'ar' ? 'يرجى اختيار البنك' : 'Please select a bank');
      return;
    }
    if (!fromDate || !toDate) {
      toast.error(language === 'ar' ? 'يرجى تحديد نطاق التاريخ' : 'Please select date range');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_ledger')
        .select('id, entry_date, description, in_amount, out_amount, balance_after, reference_number')
        .eq('bank_id', selectedBank)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: true })
        .order('reference_number', { ascending: true });

      if (error) throw error;
      
      // Sort to put "Sales In" before "Bank Fee" for same reference
      const sortedData = (data || []).sort((a, b) => {
        // First by date
        const dateCompare = a.entry_date.localeCompare(b.entry_date);
        if (dateCompare !== 0) return dateCompare;
        
        // Then by reference number
        const refCompare = (a.reference_number || '').localeCompare(b.reference_number || '');
        if (refCompare !== 0) return refCompare;
        
        // Then "Sales In" before "Bank Fee"
        const aIsSales = a.description?.toLowerCase().includes('sales in') ? 0 : 1;
        const bIsSales = b.description?.toLowerCase().includes('sales in') ? 0 : 1;
        return aIsSales - bIsSales;
      });
      
      // Calculate running balance
      let runningBalance = 0;
      const dataWithBalance = sortedData.map(entry => {
        runningBalance += (entry.in_amount || 0) - (entry.out_amount || 0);
        return { ...entry, runningBalance };
      });
      
      setLedgerData(dataWithBalance);
      toast.success(language === 'ar' ? `تم جلب ${dataWithBalance.length} سجل` : `Fetched ${dataWithBalance.length} records`);
    } catch (error) {
      console.error('Error running report:', error);
      toast.error(language === 'ar' ? 'خطأ في تشغيل التقرير' : 'Error running report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (ledgerData.length === 0) {
      toast.error(language === 'ar' ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    const selectedBankName = banks.find(b => b.id === selectedBank)?.bank_name || 'Bank';
    const headers = ['Date', 'Description', 'Reference', 'Dr. (In)', 'Cr. (Out)', 'Balance'];
    const csvRows = [headers.join(',')];

    let runningBal = 0;
    ledgerData.forEach(entry => {
      runningBal += (entry.in_amount || 0) - (entry.out_amount || 0);
      const row = [
        entry.entry_date,
        `"${(entry.description || '').replace(/"/g, '""')}"`,
        entry.reference_number || '',
        entry.in_amount?.toFixed(2) || '0.00',
        entry.out_amount?.toFixed(2) || '0.00',
        runningBal.toFixed(2),
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedBankName}_Statement_${fromDate}_to_${toDate}.csv`;
    link.click();
    toast.success(language === 'ar' ? 'تم تصدير التقرير' : 'Report exported');
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === 0) return '-';
    return amount.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const totals = ledgerData.reduce(
    (acc, entry) => ({
      totalIn: acc.totalIn + (entry.in_amount || 0),
      totalOut: acc.totalOut + (entry.out_amount || 0),
    }),
    { totalIn: 0, totalOut: 0 }
  );

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">
          {language === 'ar' ? 'ليس لديك صلاحية للوصول لهذا التقرير' : 'You do not have access to this report'}
        </p>
        <Button onClick={() => navigate('/reports')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {language === 'ar' ? 'العودة للتقارير' : 'Back to Reports'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {language === 'ar' ? 'كشف حساب البنك' : 'Bank Statement'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'عرض كشف حساب البنك حسب نطاق التاريخ' : 'View bank statement by date range'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'ar' ? 'فلاتر التقرير' : 'Report Filters'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'البنك' : 'Bank'}</Label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر البنك' : 'Select Bank'} />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((bank) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {language === 'ar' ? bank.bank_name_ar || bank.bank_name : bank.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={runReport} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {language === 'ar' ? 'تشغيل التقرير' : 'Run Report'}
              </Button>
              <Button variant="outline" onClick={exportToCSV} disabled={ledgerData.length === 0}>
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{language === 'ar' ? 'نتائج التقرير' : 'Report Results'}</span>
            {ledgerData.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {ledgerData.length} {language === 'ar' ? 'سجل' : 'records'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ledgerData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === 'ar' ? 'لا توجد نتائج. اختر البنك ونطاق التاريخ ثم اضغط تشغيل التقرير' : 'No results. Select bank and date range, then click Run Report'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الوصف' : 'Description'}</TableHead>
                    <TableHead>{language === 'ar' ? 'المرجع' : 'Reference'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'مدين (داخل)' : 'Dr. (In)'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'دائن (خارج)' : 'Cr. (Out)'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الرصيد' : 'Balance'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerData.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.entry_date), 'yyyy-MM-dd')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={entry.description || ''}>
                        {entry.description || '-'}
                      </TableCell>
                      <TableCell>{entry.reference_number || '-'}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatCurrency(entry.in_amount)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        {formatCurrency(entry.out_amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.runningBalance ?? null)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3} className="text-right">
                      {language === 'ar' ? 'الإجمالي' : 'Total'}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(totals.totalIn)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(totals.totalOut)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.totalIn - totals.totalOut)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BankStatementByBankReport;
