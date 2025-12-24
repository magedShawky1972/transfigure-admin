import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Search, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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

// Format number with commas and 2 decimal places
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const BankStatementReport = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BankStatementRow[]>([]);
  
  // Filters
  const [txnDateFrom, setTxnDateFrom] = useState("");
  const [txnDateTo, setTxnDateTo] = useState("");
  const [postDateFrom, setPostDateFrom] = useState("");
  const [postDateTo, setPostDateTo] = useState("");
  
  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });

  const fetchData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("riyadbankstatement")
        .select("id, txn_date_only, posting_date, net_amount, txn_amount, fee, vat, card_type, merchant_name, terminal_id, auth_code")
        .order("txn_date_only", { ascending: false });

      // Apply txn_date_only filters
      if (txnDateFrom) {
        query = query.gte("txn_date_only", txnDateFrom);
      }
      if (txnDateTo) {
        query = query.lte("txn_date_only", txnDateTo);
      }
      
      // Apply posting_date filters - posting_date is a datetime, so we need full timestamp range
      if (postDateFrom) {
        query = query.gte("posting_date", postDateFrom + "T00:00:00");
      }
      if (postDateTo) {
        query = query.lte("posting_date", postDateTo + "T23:59:59");
      }

      const { data: result, error } = await query;

      if (error) {
        console.error("Error fetching bank statement:", error);
        toast.error(isRTL ? "خطأ في جلب البيانات" : "Error fetching data");
        return;
      }

      setData(result || []);
      toast.success(
        isRTL 
          ? `تم جلب ${result?.length || 0} سجل` 
          : `Fetched ${result?.length || 0} records`
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
    
    // Handle numeric columns
    if (sortConfig.column === "net_amount" || sortConfig.column === "txn_amount" || sortConfig.column === "fee" || sortConfig.column === "vat") {
      const aNum = parseFloat(String(aVal).replace(/,/g, "")) || 0;
      const bNum = parseFloat(String(bVal).replace(/,/g, "")) || 0;
      return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
    }
    
    // Handle string columns
    const comparison = String(aVal).localeCompare(String(bVal));
    return sortConfig.direction === "asc" ? comparison : -comparison;
  });

  // Calculate totals
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

    // Add totals row
    rows.push([
      isRTL ? "الإجمالي" : "Total",
      "",
      formatNumber(totals.txnAmount),
      formatNumber(totals.fee),
      formatNumber(totals.vat),
      formatNumber(totals.netAmount),
      "",
      "",
      "",
      "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bank_statement_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(isRTL ? "تم تصدير البيانات بنجاح" : "Data exported successfully");
  };

  const clearFilters = () => {
    setTxnDateFrom("");
    setTxnDateTo("");
    setPostDateFrom("");
    setPostDateTo("");
  };

  return (
    <div className={`container mx-auto p-6 space-y-6 ${isRTL ? "rtl" : "ltr"}`} dir={isRTL ? "rtl" : "ltr"}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            {isRTL ? "تقرير كشف حساب البنك" : "Bank Statement Report"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? "تاريخ المعاملة من" : "Transaction Date From"}</Label>
              <Input
                type="date"
                value={txnDateFrom}
                onChange={(e) => setTxnDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "تاريخ المعاملة إلى" : "Transaction Date To"}</Label>
              <Input
                type="date"
                value={txnDateTo}
                onChange={(e) => setTxnDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "تاريخ الترحيل من" : "Posting Date From"}</Label>
              <Input
                type="date"
                value={postDateFrom}
                onChange={(e) => setPostDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "تاريخ الترحيل إلى" : "Posting Date To"}</Label>
              <Input
                type="date"
                value={postDateTo}
                onChange={(e) => setPostDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchData} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? (isRTL ? "جاري البحث..." : "Searching...") : (isRTL ? "بحث" : "Search")}
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              {isRTL ? "مسح الفلاتر" : "Clear Filters"}
            </Button>
            <Button variant="secondary" onClick={exportToExcel} disabled={data.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {isRTL ? "تصدير Excel" : "Export Excel"}
            </Button>
          </div>

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
                      {isRTL ? "لا توجد بيانات. استخدم الفلاتر ثم اضغط بحث" : "No data. Use filters and click Search"}
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
                      <TableCell className="text-right font-mono font-medium">
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
                  <TableRow className="bg-muted/50 font-bold">
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
  );
};

export default BankStatementReport;
