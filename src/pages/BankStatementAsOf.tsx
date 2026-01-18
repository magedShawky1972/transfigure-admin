import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Search, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Printer, Loader2, Wallet, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type SortDirection = "asc" | "desc" | null;
type SortConfig = {
  column: keyof BankLedgerRow | null;
  direction: SortDirection;
};

interface BankLedgerRow {
  id: string;
  entry_date: string;
  entry_date_int: number | null;
  reference_number: string | null;
  reference_type: string;
  description: string | null;
  in_amount: number | null;
  out_amount: number | null;
  transactionid: string | null;
  transaction_receipt: string | null;
  result: string | null;
  paymentrefrence: string | null;
  bank_id: string;
  bank_name?: string;
}

interface Bank {
  id: string;
  bank_name: string;
  bank_name_ar: string | null;
}

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const BankStatementAsOf = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [data, setData] = useState<BankLedgerRow[]>([]);
  const [asOfDate, setAsOfDate] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    const { data: banksData, error } = await supabase
      .from('banks')
      .select('id, bank_name, bank_name_ar')
      .eq('is_active', true)
      .order('bank_name');
    
    if (error) {
      console.error('Error fetching banks:', error);
      return;
    }
    
    setBanks(banksData || []);
  };

  const fetchData = async () => {
    if (!asOfDate) {
      toast.error(isRTL ? "يرجى تحديد التاريخ" : "Please select a date");
      return;
    }

    if (!selectedBankId) {
      toast.error(isRTL ? "يرجى اختيار البنك" : "Please select a bank");
      return;
    }

    setLoading(true);
    setLoadingMessage(isRTL ? "جاري تحميل البيانات..." : "Loading data...");
    
    try {
      // Convert asOfDate to integer format YYYYMMDD for comparison
      const asOfDateInt = parseInt(asOfDate.replace(/-/g, ''));
      
      const pageSize = 1000;
      const allRows: BankLedgerRow[] = [];
      let hasMore = true;
      let from = 0;
      let pageNum = 1;

      // Fetch all records for the selected bank
      while (hasMore) {
        setLoadingMessage(
          isRTL 
            ? `جاري تحميل الصفحة ${pageNum}... (${allRows.length} سجل)` 
            : `Loading page ${pageNum}... (${allRows.length} records)`
        );

        const query = supabase
          .from("bank_ledger")
          .select(`
            id, 
            entry_date, 
            entry_date_int,
            reference_number, 
            reference_type, 
            description, 
            in_amount, 
            out_amount, 
            transactionid,
            transaction_receipt,
            result,
            paymentrefrence,
            bank_id
          `)
          .eq('bank_id', selectedBankId)
          .order("entry_date", { ascending: false })
          .range(from, from + pageSize - 1);

        const { data: page, error } = await query;

        if (error) {
          console.error("Error fetching bank ledger:", error);
          toast.error(isRTL ? "خطأ في جلب البيانات" : "Error fetching data");
          return;
        }

        const pageRows = (page || []) as BankLedgerRow[];
        allRows.push(...pageRows);

        if (pageRows.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
          pageNum++;
        }
      }

      // Calculate opening balance: sum of (in_amount - out_amount) for all transactions BEFORE the selected date
      let openingSum = 0;
      const transactionsOnDate: BankLedgerRow[] = [];

      allRows.forEach((row) => {
        const entryDateInt = row.entry_date_int || parseInt(row.entry_date.replace(/-/g, ''));
        const inAmount = row.in_amount || 0;
        const outAmount = row.out_amount || 0;
        const netAmount = inAmount - outAmount;

        // Before selected date - add to opening balance
        if (entryDateInt < asOfDateInt) {
          openingSum += netAmount;
        }
        // On selected date - include in transactions list
        else if (entryDateInt === asOfDateInt) {
          transactionsOnDate.push(row);
        }
      });

      // Calculate total net amount for transactions on the selected date
      const dayTotal = transactionsOnDate.reduce((sum, row) => {
        return sum + ((row.in_amount || 0) - (row.out_amount || 0));
      }, 0);

      setOpeningBalance(openingSum);
      setClosingBalance(openingSum + dayTotal);
      setData(transactionsOnDate);

      toast.success(
        isRTL ? `تم جلب ${transactionsOnDate.length} سجل` : `Fetched ${transactionsOnDate.length} records`
      );
    } catch (error) {
      console.error("Error:", error);
      toast.error(isRTL ? "خطأ غير متوقع" : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: keyof BankLedgerRow) => {
    let direction: SortDirection = "asc";
    if (sortConfig.column === column) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }
    setSortConfig({ column: direction ? column : null, direction });
  };

  const getSortIcon = (column: keyof BankLedgerRow) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="h-4 w-4 opacity-50" />;
    }
    if (sortConfig.direction === "asc") {
      return <ArrowUp className="h-4 w-4" />;
    }
    return <ArrowDown className="h-4 w-4" />;
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.column || !sortConfig.direction) return 0;
    
    const aVal = a[sortConfig.column];
    const bVal = b[sortConfig.column];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    if (sortConfig.column === "in_amount" || sortConfig.column === "out_amount") {
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
    }
    
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  const totals = sortedData.reduce(
    (acc, row) => {
      acc.inAmount += row.in_amount || 0;
      acc.outAmount += row.out_amount || 0;
      return acc;
    },
    { inAmount: 0, outAmount: 0 }
  );

  const exportToExcel = () => {
    if (sortedData.length === 0) {
      toast.error(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const selectedBank = banks.find(b => b.id === selectedBankId);
    const bankName = isRTL ? (selectedBank?.bank_name_ar || selectedBank?.bank_name) : selectedBank?.bank_name;

    const headers = [
      isRTL ? "التاريخ" : "Date",
      isRTL ? "رقم المرجع" : "Reference Number",
      isRTL ? "نوع المرجع" : "Reference Type",
      isRTL ? "الوصف" : "Description",
      isRTL ? "وارد" : "In Amount",
      isRTL ? "صادر" : "Out Amount",
      isRTL ? "رقم المعاملة" : "Transaction ID",
      isRTL ? "إيصال المعاملة" : "Transaction Receipt",
      isRTL ? "النتيجة" : "Result",
    ];

    const rows = sortedData.map(row => [
      row.entry_date || "",
      row.reference_number || "",
      row.reference_type || "",
      row.description || "",
      formatNumber(row.in_amount || 0),
      formatNumber(row.out_amount || 0),
      row.transactionid || "",
      row.transaction_receipt || "",
      row.result || "",
    ]);

    // Add summary rows
    rows.unshift([
      isRTL ? "الرصيد الافتتاحي" : "Opening Balance", 
      "", "", "", 
      formatNumber(openingBalance), 
      "", "", "", ""
    ]);
    rows.push([
      isRTL ? "الإجمالي" : "Total", 
      "", "", "", 
      formatNumber(totals.inAmount), 
      formatNumber(totals.outAmount), 
      "", "", ""
    ]);
    rows.push([
      isRTL ? "الرصيد الختامي" : "Closing Balance", 
      "", "", "", 
      formatNumber(closingBalance), 
      "", "", "", ""
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank_ledger_${bankName}_${asOfDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(isRTL ? "تم تصدير البيانات بنجاح" : "Data exported successfully");
  };

  const handlePrint = () => {
    window.print();
  };

  const getSelectedBankName = () => {
    const bank = banks.find(b => b.id === selectedBankId);
    if (!bank) return "";
    return isRTL ? (bank.bank_name_ar || bank.bank_name) : bank.bank_name;
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className={`container mx-auto p-6 space-y-6 print-area ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
        {loading && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card p-6 rounded-lg shadow-lg flex flex-col items-center gap-4 border">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-lg font-medium">{loadingMessage}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              {isRTL ? "كشف حساب البنك كما في تاريخ" : "Bank Statement As Of"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filter */}
            <div className="flex flex-wrap gap-4 items-end no-print">
              <div className="space-y-2">
                <Label>{isRTL ? "البنك" : "Bank"}</Label>
                <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder={isRTL ? "اختر البنك" : "Select Bank"} />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {isRTL ? (bank.bank_name_ar || bank.bank_name) : bank.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "كما في تاريخ" : "As Of Date"}</Label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <Button onClick={fetchData} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? (isRTL ? "جاري البحث..." : "Searching...") : (isRTL ? "بحث" : "Search")}
              </Button>
              <Button variant="secondary" onClick={exportToExcel} disabled={data.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={data.length === 0}>
                <Printer className="h-4 w-4 mr-2" />
                {isRTL ? "طباعة" : "Print"}
              </Button>
            </div>

            {/* Bank Name Header for Print */}
            {data.length > 0 && selectedBankId && (
              <div className="text-lg font-semibold text-center border-b pb-2">
                {getSelectedBankName()} - {asOfDate}
              </div>
            )}

            {/* Balance Cards */}
            {data.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {isRTL ? "الرصيد الافتتاحي" : "Opening Balance"}
                        </p>
                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                          {formatNumber(openingBalance)} <span className="text-sm">{isRTL ? "ر.س" : "SAR"}</span>
                        </p>
                      </div>
                      <Wallet className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          {isRTL ? "الرصيد الختامي" : "Closing Balance"}
                        </p>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {formatNumber(closingBalance)} <span className="text-sm">{isRTL ? "ر.س" : "SAR"}</span>
                        </p>
                      </div>
                      <TrendingUp className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Results Count */}
            {data.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {isRTL ? `عدد السجلات: ${data.length}` : `Records: ${data.length}`}
              </div>
            )}

            {/* Data Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("entry_date")}
                    >
                      <div className="flex items-center gap-1">
                        {isRTL ? "التاريخ" : "Date"}
                        {getSortIcon("entry_date")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("reference_number")}
                    >
                      <div className="flex items-center gap-1">
                        {isRTL ? "رقم المرجع" : "Reference #"}
                        {getSortIcon("reference_number")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("reference_type")}
                    >
                      <div className="flex items-center gap-1">
                        {isRTL ? "النوع" : "Type"}
                        {getSortIcon("reference_type")}
                      </div>
                    </TableHead>
                    <TableHead>{isRTL ? "الوصف" : "Description"}</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("in_amount")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {isRTL ? "وارد" : "In"}
                        {getSortIcon("in_amount")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("out_amount")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {isRTL ? "صادر" : "Out"}
                        {getSortIcon("out_amount")}
                      </div>
                    </TableHead>
                    <TableHead>{isRTL ? "رقم المعاملة" : "Txn ID"}</TableHead>
                    <TableHead>{isRTL ? "الإيصال" : "Receipt"}</TableHead>
                    <TableHead>{isRTL ? "النتيجة" : "Result"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد بيانات" : "No data available"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.entry_date}</TableCell>
                        <TableCell className="font-mono text-sm">{row.reference_number}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            row.reference_type === 'sales_in' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            row.reference_type === 'bank_fee' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            row.reference_type === 'transfer_in' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                            row.reference_type === 'transfer_out' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {row.reference_type}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={row.description || ""}>
                          {row.description}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                          {row.in_amount ? formatNumber(row.in_amount) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                          {row.out_amount ? formatNumber(row.out_amount) : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate" title={row.transactionid || ""}>
                          {row.transactionid}
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate" title={row.transaction_receipt || ""}>
                          {row.transaction_receipt}
                        </TableCell>
                        <TableCell>
                          {row.result && (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              row.result === 'ACK' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                              {row.result}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {sortedData.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={4} className="text-right">
                        {isRTL ? "الإجمالي" : "Total"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 dark:text-green-400">
                        {formatNumber(totals.inAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                        {formatNumber(totals.outAmount)}
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default BankStatementAsOf;
