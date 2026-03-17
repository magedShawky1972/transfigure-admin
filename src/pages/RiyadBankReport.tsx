import { useState, useMemo, useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableHead, TableHeader, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { Search, FileSpreadsheet, ArrowUp, ArrowDown, ArrowUpDown, Printer, Loader2, X, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface RiyadBankRow {
  id: string;
  txn_date: string | null;
  txn_date_only: string | null;
  txn_number: string | null;
  txn_type: string | null;
  txn_amount: string | null;
  fee: string | null;
  vat: string | null;
  vat_2: string | null;
  net_amount: string | null;
  agg_fee: string | null;
  agg_vat: string | null;
  rb_fee: string | null;
  rb_vat: string | null;
  card_number: string | null;
  card_type: string | null;
  auth_code: string | null;
  terminal_id: string | null;
  merchant_name: string | null;
  merchant_account: string | null;
  payment_date: string | null;
  posting_date: string | null;
  payment_number: string | null;
  payment_reference: string | null;
  txn_certificate: string | null;
  acquirer_private_data: string | null;
}

type SortDirection = "asc" | "desc" | null;
type SortConfig = { column: keyof RiyadBankRow | null; direction: SortDirection };

interface Totals {
  txnAmount: number;
  fee: number;
  vat: number;
  netAmount: number;
  aggFee: number;
  aggVat: number;
  rbFee: number;
  rbVat: number;
}

const numericColumns: (keyof RiyadBankRow)[] = ["txn_amount", "fee", "vat", "net_amount", "agg_fee", "agg_vat", "rb_fee", "rb_vat"];

const formatNumber = (num: number): string =>
  num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseNum = (val: string | null): number =>
  val ? parseFloat(String(val).replace(/,/g, "")) || 0 : 0;

const ROW_HEIGHT = 35;
const MAX_ROWS = 50000;

const columnDefs: { key: keyof RiyadBankRow; label: string; labelAr: string; numeric?: boolean }[] = [
  { key: "txn_date_only", label: "Txn Date", labelAr: "تاريخ المعاملة" },
  { key: "txn_number", label: "Txn Number", labelAr: "رقم المعاملة" },
  { key: "txn_type", label: "Type", labelAr: "النوع" },
  { key: "txn_amount", label: "Txn Amount", labelAr: "مبلغ المعاملة", numeric: true },
  { key: "fee", label: "Fee", labelAr: "الرسوم", numeric: true },
  { key: "vat", label: "VAT", labelAr: "الضريبة", numeric: true },
  { key: "vat_2", label: "VAT %", labelAr: "نسبة الضريبة" },
  { key: "net_amount", label: "Net Amount", labelAr: "صافي المبلغ", numeric: true },
  { key: "agg_fee", label: "Agg Fee", labelAr: "رسوم التجميع", numeric: true },
  { key: "agg_vat", label: "Agg VAT", labelAr: "ضريبة التجميع", numeric: true },
  { key: "rb_fee", label: "RB Fee", labelAr: "رسوم الرياض", numeric: true },
  { key: "rb_vat", label: "RB VAT", labelAr: "ضريبة الرياض", numeric: true },
  { key: "card_number", label: "Card #", labelAr: "رقم البطاقة" },
  { key: "card_type", label: "Card Type", labelAr: "نوع البطاقة" },
  { key: "auth_code", label: "Auth Code", labelAr: "كود التفويض" },
  { key: "terminal_id", label: "Terminal", labelAr: "الجهاز" },
  { key: "merchant_name", label: "Merchant", labelAr: "التاجر" },
  { key: "merchant_account", label: "Merchant Acc", labelAr: "حساب التاجر" },
  { key: "payment_date", label: "Payment Date", labelAr: "تاريخ الدفع" },
  { key: "posting_date", label: "Posting Date", labelAr: "تاريخ الترحيل" },
  { key: "payment_number", label: "Payment #", labelAr: "رقم الدفع" },
  { key: "payment_reference", label: "Payment Ref", labelAr: "مرجع الدفع" },
];

const RiyadBankReport = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [data, setData] = useState<RiyadBankRow[]>([]);
  const [totals, setTotals] = useState<Totals>({ txnAmount: 0, fee: 0, vat: 0, netAmount: 0, aggFee: 0, aggVat: 0, rbFee: 0, rbVat: 0 });

  // Filters
  const [txnDateFrom, setTxnDateFrom] = useState<Date | undefined>();
  const [txnDateTo, setTxnDateTo] = useState<Date | undefined>();
  const [postDateFrom, setPostDateFrom] = useState<Date | undefined>();
  const [postDateTo, setPostDateTo] = useState<Date | undefined>();
  const [cardTypeFilter, setCardTypeFilter] = useState("all");
  const [txnTypeFilter, setTxnTypeFilter] = useState("all");

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null });

  // Virtualization ref
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const parsePostingDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  };

  const fetchData = useCallback(async () => {
    // Validate: require txn date range
    if (!txnDateFrom || !txnDateTo) {
      toast.error(isRTL ? "يرجى تحديد نطاق تاريخ المعاملة (من - إلى)" : "Please select Transaction Date range (From - To)");
      return;
    }

    setLoading(true);
    setLoadingMessage(isRTL ? "جاري تحميل البيانات..." : "Loading data...");
    try {
      const pageSize = 1000;
      const allRows: RiyadBankRow[] = [];
      let hasMore = true;
      let from = 0;
      let pageNum = 1;
      // Incremental totals
      const runningTotals: Totals = { txnAmount: 0, fee: 0, vat: 0, netAmount: 0, aggFee: 0, aggVat: 0, rbFee: 0, rbVat: 0 };

      while (hasMore) {
        setLoadingMessage(
          isRTL
            ? `جاري تحميل الصفحة ${pageNum}... (${allRows.length} سجل)`
            : `Loading page ${pageNum}... (${allRows.length} records)`
        );

        let query = supabase
          .from("riyadbankstatement")
          .select("*")
          .order("txn_date_only", { ascending: false })
          .range(from, from + pageSize - 1);

        query = query.gte("txn_date_only", format(txnDateFrom, "yyyy-MM-dd"));
        query = query.lte("txn_date_only", format(txnDateTo, "yyyy-MM-dd"));

        const { data: page, error } = await query;
        if (error) {
          toast.error(isRTL ? "خطأ في جلب البيانات" : "Error fetching data");
          return;
        }

        let pageRows = (page || []) as RiyadBankRow[];

        // Client-side filters
        if (postDateFrom || postDateTo) {
          const fromDate = postDateFrom || null;
          const toDate = postDateTo ? new Date(postDateTo) : null;
          if (toDate) toDate.setHours(23, 59, 59, 999);
          pageRows = pageRows.filter((row) => {
            const postDate = parsePostingDate(row.posting_date);
            if (!postDate) return false;
            if (fromDate && postDate < fromDate) return false;
            if (toDate && postDate > toDate) return false;
            return true;
          });
        }
        if (cardTypeFilter !== "all") {
          pageRows = pageRows.filter((r) => r.card_type === cardTypeFilter);
        }
        if (txnTypeFilter !== "all") {
          pageRows = pageRows.filter((r) => r.txn_type === txnTypeFilter);
        }

        // Accumulate totals incrementally
        for (const row of pageRows) {
          runningTotals.txnAmount += parseNum(row.txn_amount);
          runningTotals.fee += parseNum(row.fee);
          runningTotals.vat += parseNum(row.vat);
          runningTotals.netAmount += parseNum(row.net_amount);
          runningTotals.aggFee += parseNum(row.agg_fee);
          runningTotals.aggVat += parseNum(row.agg_vat);
          runningTotals.rbFee += parseNum(row.rb_fee);
          runningTotals.rbVat += parseNum(row.rb_vat);
        }

        allRows.push(...pageRows);

        if ((page || []).length < pageSize) {
          hasMore = false;
        } else if (allRows.length >= MAX_ROWS) {
          toast.warning(isRTL ? `تم الوصول للحد الأقصى ${MAX_ROWS.toLocaleString()} سجل` : `Reached maximum limit of ${MAX_ROWS.toLocaleString()} records`);
          hasMore = false;
        } else {
          from += pageSize;
          pageNum++;
        }
      }

      setData(allRows);
      setTotals(runningTotals);
      toast.success(isRTL ? `تم جلب ${allRows.length} سجل` : `Fetched ${allRows.length} records`);
    } catch {
      toast.error(isRTL ? "خطأ غير متوقع" : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [txnDateFrom, txnDateTo, postDateFrom, postDateTo, cardTypeFilter, txnTypeFilter, isRTL]);

  const handleSort = (column: keyof RiyadBankRow) => {
    let direction: SortDirection = "asc";
    if (sortConfig.column === column) {
      if (sortConfig.direction === "asc") direction = "desc";
      else if (sortConfig.direction === "desc") direction = null;
    }
    setSortConfig({ column: direction ? column : null, direction });
  };

  const getSortIcon = (column: keyof RiyadBankRow) => {
    if (sortConfig.column !== column) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    if (sortConfig.direction === "asc") return <ArrowUp className="h-3 w-3" />;
    return <ArrowDown className="h-3 w-3" />;
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return data;
    const col = sortConfig.column;
    const dir = sortConfig.direction;
    return [...data].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (numericColumns.includes(col)) {
        return dir === "asc" ? parseNum(aVal) - parseNum(bVal) : parseNum(bVal) - parseNum(aVal);
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return dir === "asc" ? cmp : -cmp;
    });
  }, [data, sortConfig]);

  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const exportToExcel = () => {
    if (sortedData.length === 0) {
      toast.error(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    const headers = [
      isRTL ? "تاريخ المعاملة" : "Txn Date",
      isRTL ? "رقم المعاملة" : "Txn Number",
      isRTL ? "نوع المعاملة" : "Txn Type",
      isRTL ? "مبلغ المعاملة" : "Txn Amount",
      isRTL ? "الرسوم" : "Fee",
      isRTL ? "الضريبة" : "VAT",
      isRTL ? "نسبة الضريبة" : "VAT %",
      isRTL ? "صافي المبلغ" : "Net Amount",
      isRTL ? "رسوم التجميع" : "Agg Fee",
      isRTL ? "ضريبة التجميع" : "Agg VAT",
      isRTL ? "رسوم الرياض" : "RB Fee",
      isRTL ? "ضريبة الرياض" : "RB VAT",
      isRTL ? "رقم البطاقة" : "Card Number",
      isRTL ? "نوع البطاقة" : "Card Type",
      isRTL ? "كود التفويض" : "Auth Code",
      isRTL ? "رقم الجهاز" : "Terminal ID",
      isRTL ? "اسم التاجر" : "Merchant",
      isRTL ? "حساب التاجر" : "Merchant Account",
      isRTL ? "تاريخ الدفع" : "Payment Date",
      isRTL ? "تاريخ الترحيل" : "Posting Date",
      isRTL ? "رقم الدفع" : "Payment Number",
      isRTL ? "مرجع الدفع" : "Payment Ref",
    ];

    const rows = sortedData.map((r) => [
      r.txn_date_only || "", r.txn_number || "", r.txn_type || "",
      r.txn_amount || "", r.fee || "", r.vat || "", r.vat_2 || "",
      r.net_amount || "", r.agg_fee || "", r.agg_vat || "",
      r.rb_fee || "", r.rb_vat || "",
      r.card_number || "", r.card_type || "", r.auth_code || "",
      r.terminal_id || "", r.merchant_name || "", r.merchant_account || "",
      r.payment_date || "", r.posting_date || "",
      r.payment_number || "", r.payment_reference || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `riyad_bank_report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(isRTL ? "تم تصدير البيانات بنجاح" : "Data exported successfully");
  };

  const clearFilters = () => {
    setTxnDateFrom(undefined);
    setTxnDateTo(undefined);
    setPostDateFrom(undefined);
    setPostDateTo(undefined);
    setCardTypeFilter("all");
    setTxnTypeFilter("all");
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
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
              {isRTL ? "تقرير بنك الرياض" : "Riyad Bank Report"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 no-print">
              <div className="space-y-2">
                <Label>{isRTL ? "تاريخ المعاملة من *" : "Txn Date From *"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !txnDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {txnDateFrom ? format(txnDateFrom, "dd/MM/yyyy") : (isRTL ? "اختر تاريخ" : "Pick date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={txnDateFrom} onSelect={setTxnDateFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "تاريخ المعاملة إلى *" : "Txn Date To *"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !txnDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {txnDateTo ? format(txnDateTo, "dd/MM/yyyy") : (isRTL ? "اختر تاريخ" : "Pick date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={txnDateTo} onSelect={setTxnDateTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "تاريخ الترحيل من" : "Posting Date From"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !postDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {postDateFrom ? format(postDateFrom, "dd/MM/yyyy") : (isRTL ? "اختر تاريخ" : "Pick date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={postDateFrom} onSelect={setPostDateFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "تاريخ الترحيل إلى" : "Posting Date To"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !postDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {postDateTo ? format(postDateTo, "dd/MM/yyyy") : (isRTL ? "اختر تاريخ" : "Pick date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={postDateTo} onSelect={setPostDateTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "نوع البطاقة" : "Card Type"}</Label>
                <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="VISA">VISA</SelectItem>
                    <SelectItem value="MASTER">MASTER</SelectItem>
                    <SelectItem value="MADA">MADA</SelectItem>
                    <SelectItem value="AMEX">AMEX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "نوع المعاملة" : "Txn Type"}</Label>
                <Select value={txnTypeFilter} onValueChange={setTxnTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="PURCHASE">PURCHASE</SelectItem>
                    <SelectItem value="REFUND">REFUND</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 no-print">
              <Button onClick={fetchData} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? (isRTL ? "جاري البحث..." : "Searching...") : (isRTL ? "بحث" : "Search")}
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                {isRTL ? "مسح الفلاتر" : "Clear Filters"}
              </Button>
              <Button variant="secondary" onClick={exportToExcel} disabled={data.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
              <Button variant="outline" onClick={() => window.print()} disabled={data.length === 0}>
                <Printer className="h-4 w-4 mr-2" />
                {isRTL ? "طباعة" : "Print"}
              </Button>
            </div>

            {data.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {isRTL ? `عدد السجلات: ${data.length.toLocaleString()}` : `Records: ${data.length.toLocaleString()}`}
              </div>
            )}

            {/* Virtualized Table */}
            <div className="rounded-md border overflow-hidden">
              {/* Sticky header */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columnDefs.map((col) => (
                        <TableHead
                          key={col.key}
                          className={`cursor-pointer hover:bg-muted/50 whitespace-nowrap text-xs ${col.numeric ? "text-right" : ""}`}
                          style={{ minWidth: col.numeric ? 100 : 90 }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className={`flex items-center gap-1 ${col.numeric ? "justify-end" : ""}`}>
                            {isRTL ? col.labelAr : col.label}
                            {getSortIcon(col.key)}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              {/* Scrollable virtualized body */}
              <div
                ref={tableContainerRef}
                className="overflow-auto"
                style={{ maxHeight: "600px" }}
              >
                {sortedData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isRTL ? "لا توجد بيانات. حدد نطاق تاريخ المعاملة ثم اضغط بحث" : "No data. Select Transaction Date range and click Search"}
                  </div>
                ) : (
                  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                    <Table>
                      <tbody>
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                          const row = sortedData[virtualRow.index];
                          return (
                            <tr
                              key={row.id}
                              className="border-b transition-colors hover:bg-muted/50"
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                display: "table-row",
                              }}
                            >
                              {columnDefs.map((col) => (
                                <td
                                  key={col.key}
                                  className={`px-4 py-2 whitespace-nowrap text-xs align-middle ${col.numeric ? "text-right font-mono" : ""}`}
                                  style={{ minWidth: col.numeric ? 100 : 90 }}
                                >
                                  {col.numeric
                                    ? row[col.key] ? formatNumber(parseNum(row[col.key])) : "-"
                                    : row[col.key] || "-"}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Footer totals */}
              {sortedData.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableFooter>
                      <TableRow className="bg-muted/50 font-bold text-xs">
                        <TableCell colSpan={3}>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.txnAmount)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.fee)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.vat)}</TableCell>
                        <TableCell></TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.netAmount)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.aggFee)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.aggVat)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.rbFee)}</TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(totals.rbVat)}</TableCell>
                        <TableCell colSpan={10}></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default RiyadBankReport;
