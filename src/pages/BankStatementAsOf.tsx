import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Search, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Printer, Loader2, Wallet, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

type SortDirection = "asc" | "desc" | null;
type SortConfig = {
  column: keyof BankStatementRow | null;
  direction: SortDirection;
};

interface BankStatementRow {
  id: string;
  txn_date_only: string | null;
  posting_date: string | null;
  net_amount: string | null;
  txn_amount: string | null;
  fee: string | null;
  vat: string | null;
  card_type: string | null;
  merchant_name: string | null;
  terminal_id: string | null;
  auth_code: string | null;
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
  const [data, setData] = useState<BankStatementRow[]>([]);
  const [asOfDate, setAsOfDate] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });

  // Parse posting_date from DD/MM/YYYY format to Date object
  const parsePostingDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  };

  // Convert YYYY-MM-DD to Date for comparison
  const parseFilterDate = (dateStr: string): Date => {
    return new Date(dateStr + "T00:00:00");
  };

  const fetchData = async () => {
    if (!asOfDate) {
      toast.error(isRTL ? "يرجى تحديد التاريخ" : "Please select a date");
      return;
    }

    setLoading(true);
    setLoadingMessage(isRTL ? "جاري تحميل البيانات..." : "Loading data...");
    
    try {
      const pageSize = 1000;
      const allRows: BankStatementRow[] = [];
      let hasMore = true;
      let from = 0;
      let pageNum = 1;

      while (hasMore) {
        setLoadingMessage(
          isRTL 
            ? `جاري تحميل الصفحة ${pageNum}... (${allRows.length} سجل)` 
            : `Loading page ${pageNum}... (${allRows.length} records)`
        );

        const query = supabase
          .from("riyadbankstatement")
          .select(
            "id, txn_date_only, posting_date, net_amount, txn_amount, fee, vat, card_type, merchant_name, terminal_id, auth_code"
          )
          .order("txn_date_only", { ascending: false })
          .range(from, from + pageSize - 1);

        const { data: page, error } = await query;

        if (error) {
          console.error("Error fetching bank statement:", error);
          toast.error(isRTL ? "خطأ في جلب البيانات" : "Error fetching data");
          return;
        }

        const pageRows = (page || []) as BankStatementRow[];
        allRows.push(...pageRows);

        if (pageRows.length < pageSize) {
          hasMore = false;
        } else {
          from += pageSize;
          pageNum++;
        }
      }

      const filterDate = parseFilterDate(asOfDate);
      filterDate.setHours(23, 59, 59, 999);

      // Calculate opening balance: sum of net_amount for all transactions BEFORE the selected date
      let openingSum = 0;
      const transactionsOnDate: BankStatementRow[] = [];

      allRows.forEach((row) => {
        const postDate = parsePostingDate(row.posting_date);
        if (!postDate) return;

        const netAmount = parseFloat(String(row.net_amount || "0").replace(/,/g, "")) || 0;

        // Before selected date - add to opening balance
        if (postDate < parseFilterDate(asOfDate)) {
          openingSum += netAmount;
        }
        // On selected date - include in transactions list
        else if (
          postDate.getFullYear() === filterDate.getFullYear() &&
          postDate.getMonth() === filterDate.getMonth() &&
          postDate.getDate() === filterDate.getDate()
        ) {
          transactionsOnDate.push(row);
        }
      });

      // Calculate total net amount for transactions on the selected date
      const dayTotal = transactionsOnDate.reduce((sum, row) => {
        return sum + (parseFloat(String(row.net_amount || "0").replace(/,/g, "")) || 0);
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

  const handleSort = (column: keyof BankStatementRow) => {
    let direction: SortDirection = "asc";
    if (sortConfig.column === column) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }
    setSortConfig({ column: direction ? column : null, direction });
  };

  const getSortIcon = (column: keyof BankStatementRow) => {
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
    
    if (sortConfig.column === "net_amount" || sortConfig.column === "txn_amount" || sortConfig.column === "fee" || sortConfig.column === "vat") {
      const aNum = parseFloat(String(aVal).replace(/,/g, "")) || 0;
      const bNum = parseFloat(String(bVal).replace(/,/g, "")) || 0;
      return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
    }
    
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  const totals = sortedData.reduce(
    (acc, row) => {
      acc.netAmount += parseFloat(String(row.net_amount || "0").replace(/,/g, "")) || 0;
      acc.txnAmount += parseFloat(String(row.txn_amount || "0").replace(/,/g, "")) || 0;
      acc.fee += parseFloat(String(row.fee || "0").replace(/,/g, "")) || 0;
      acc.vat += parseFloat(String(row.vat || "0").replace(/,/g, "")) || 0;
      return acc;
    },
    { netAmount: 0, txnAmount: 0, fee: 0, vat: 0 }
  );

  const exportToExcel = () => {
    if (sortedData.length === 0) {
      toast.error(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const headers = [
      isRTL ? "تاريخ المعاملة" : "Transaction Date",
      isRTL ? "تاريخ الترحيل" : "Posting Date",
      isRTL ? "مبلغ المعاملة" : "Transaction Amount",
      isRTL ? "الرسوم" : "Fee",
      isRTL ? "الضريبة" : "VAT",
      isRTL ? "صافي المبلغ" : "Net Amount",
      isRTL ? "نوع البطاقة" : "Card Type",
      isRTL ? "اسم التاجر" : "Merchant Name",
      isRTL ? "رقم الجهاز" : "Terminal ID",
      isRTL ? "كود التفويض" : "Auth Code",
    ];

    const rows = sortedData.map(row => [
      row.txn_date_only || "",
      row.posting_date ? row.posting_date.split("T")[0] : "",
      row.txn_amount || "",
      row.fee || "",
      row.vat || "",
      row.net_amount || "",
      row.card_type || "",
      row.merchant_name || "",
      row.terminal_id || "",
      row.auth_code || "",
    ]);

    // Add summary rows
    rows.unshift([isRTL ? "الرصيد الافتتاحي" : "Opening Balance", "", "", "", "", formatNumber(openingBalance), "", "", "", ""]);
    rows.push([isRTL ? "الإجمالي" : "Total", "", formatNumber(totals.txnAmount), formatNumber(totals.fee), formatNumber(totals.vat), formatNumber(totals.netAmount), "", "", "", ""]);
    rows.push([isRTL ? "الرصيد الختامي" : "Closing Balance", "", "", "", "", formatNumber(closingBalance), "", "", "", ""]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank_statement_as_of_${asOfDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(isRTL ? "تم تصدير البيانات بنجاح" : "Data exported successfully");
  };

  const handlePrint = () => {
    window.print();
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
                      onClick={() => handleSort("txn_date_only")}
                    >
                      <div className="flex items-center gap-1">
                        {isRTL ? "تاريخ المعاملة" : "Txn Date"}
                        {getSortIcon("txn_date_only")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("posting_date")}
                    >
                      <div className="flex items-center gap-1">
                        {isRTL ? "تاريخ الترحيل" : "Posting Date"}
                        {getSortIcon("posting_date")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("txn_amount")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {isRTL ? "مبلغ المعاملة" : "Txn Amount"}
                        {getSortIcon("txn_amount")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("fee")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {isRTL ? "الرسوم" : "Fee"}
                        {getSortIcon("fee")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("vat")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {isRTL ? "الضريبة" : "VAT"}
                        {getSortIcon("vat")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 text-right"
                      onClick={() => handleSort("net_amount")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {isRTL ? "صافي المبلغ" : "Net Amount"}
                        {getSortIcon("net_amount")}
                      </div>
                    </TableHead>
                    <TableHead>{isRTL ? "نوع البطاقة" : "Card Type"}</TableHead>
                    <TableHead>{isRTL ? "اسم التاجر" : "Merchant"}</TableHead>
                    <TableHead>{isRTL ? "رقم الجهاز" : "Terminal"}</TableHead>
                    <TableHead>{isRTL ? "كود التفويض" : "Auth Code"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد بيانات. حدد التاريخ ثم اضغط بحث" : "No data. Select date and click Search"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.txn_date_only || "-"}</TableCell>
                        <TableCell>{row.posting_date ? row.posting_date.split("T")[0] : "-"}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.txn_amount ? formatNumber(parseFloat(String(row.txn_amount).replace(/,/g, ""))) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.fee ? formatNumber(parseFloat(String(row.fee).replace(/,/g, ""))) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.vat ? formatNumber(parseFloat(String(row.vat).replace(/,/g, ""))) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.net_amount ? formatNumber(parseFloat(String(row.net_amount).replace(/,/g, ""))) : "-"}
                        </TableCell>
                        <TableCell>{row.card_type || "-"}</TableCell>
                        <TableCell>{row.merchant_name || "-"}</TableCell>
                        <TableCell>{row.terminal_id || "-"}</TableCell>
                        <TableCell>{row.auth_code || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {sortedData.length > 0 && (
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                      <TableCell colSpan={2}>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(totals.txnAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(totals.fee)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(totals.vat)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(totals.netAmount)}</TableCell>
                      <TableCell colSpan={4}></TableCell>
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
