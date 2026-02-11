import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Download, Calendar, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";

interface ComparisonRow {
  order_number: string;
  purple_lines: number;
  purple_total: number;
  api_lines: number;
  api_total: number;
  line_diff: number;
  total_diff: number;
  status: "match" | "missing_api" | "missing_purple" | "mismatch";
}

const DataComparisonReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState<ComparisonRow[]>([]);
  const [summary, setSummary] = useState({
    purpleTotal: 0,
    apiTotal: 0,
    diff: 0,
    purpleLines: 0,
    apiLines: 0,
    matchedOrders: 0,
    missingApi: 0,
    missingPurple: 0,
    mismatchOrders: 0,
  });
  const [activeTab, setActiveTab] = useState("all");

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  const convertDateToInt = (dateStr: string): number => {
    return parseInt(dateStr.replace(/-/g, ""), 10);
  };

  const getKSADayBoundaries = (dateStr: string) => ({
    start: dateStr + "T00:00:00Z",
    end: dateStr + "T23:59:59.999Z",
  });

  const fetchReport = async () => {
    if (!fromDate || !toDate) {
      toast({ title: language === "ar" ? "يرجى تحديد التاريخ" : "Please select dates", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fromInt = convertDateToInt(fromDate);
      const toInt = convertDateToInt(toDate);
      const fromBounds = getKSADayBoundaries(fromDate);
      const toBounds = getKSADayBoundaries(toDate);

      // Fetch purple transaction data in batches (excluding 'point' payment method)
      let allPurpleData: { order_number: string; total: number }[] = [];
      let purpleOffset = 0;
      const fetchLimit = 1000;
      while (true) {
        const { data: batch, error: purpleError } = await supabase
          .from("purpletransaction")
          .select("order_number, total")
          .gte("created_at_date_int", fromInt)
          .lte("created_at_date_int", toInt)
          .neq("payment_method", "point")
          .range(purpleOffset, purpleOffset + fetchLimit - 1);
        if (purpleError) throw purpleError;
        allPurpleData = allPurpleData.concat(batch || []);
        if (!batch || batch.length < fetchLimit) break;
        purpleOffset += fetchLimit;
      }

      // Fetch API sales headers in batches
      let allApiHeaders: { order_number: string }[] = [];
      let headerOffset = 0;
      while (true) {
        const { data: batch, error: headerError } = await supabase
          .from("sales_order_header")
          .select("order_number")
          .gte("created_at", fromBounds.start)
          .lte("created_at", toBounds.end)
          .range(headerOffset, headerOffset + fetchLimit - 1);
        if (headerError) throw headerError;
        allApiHeaders = allApiHeaders.concat(batch || []);
        if (!batch || batch.length < fetchLimit) break;
        headerOffset += fetchLimit;
      }

      const apiOrderNumbers = allApiHeaders.map((h) => h.order_number);

      // Fetch API sales lines in batches by order number chunks
      let allApiLines: { order_number: string; total: number }[] = [];
      const batchSize = 500;
      for (let i = 0; i < apiOrderNumbers.length; i += batchSize) {
        const chunk = apiOrderNumbers.slice(i, i + batchSize);
        let lineOffset = 0;
        while (true) {
          const { data: lines, error: lineError } = await supabase
            .from("sales_order_line")
            .select("order_number, total")
            .in("order_number", chunk)
            .range(lineOffset, lineOffset + fetchLimit - 1);
          if (lineError) throw lineError;
          allApiLines = allApiLines.concat(lines || []);
          if (!lines || lines.length < fetchLimit) break;
          lineOffset += fetchLimit;
        }
      }

      // Aggregate purple by order
      const purpleByOrder = new Map<string, { lines: number; total: number }>();
      allPurpleData.forEach((row) => {
        const existing = purpleByOrder.get(row.order_number) || { lines: 0, total: 0 };
        existing.lines += 1;
        existing.total += row.total || 0;
        purpleByOrder.set(row.order_number, existing);
      });

      // Aggregate API by order
      const apiByOrder = new Map<string, { lines: number; total: number }>();
      allApiLines.forEach((row) => {
        const existing = apiByOrder.get(row.order_number) || { lines: 0, total: 0 };
        existing.lines += 1;
        existing.total += row.total || 0;
        apiByOrder.set(row.order_number, existing);
      });

      // Build comparison
      const allOrders = new Set([...purpleByOrder.keys(), ...apiByOrder.keys()]);
      const rows: ComparisonRow[] = [];
      let matchCount = 0, missingApiCount = 0, missingPurpleCount = 0, mismatchCount = 0;
      let totalPurple = 0, totalApi = 0, totalPurpleLines = 0, totalApiLines = 0;

      allOrders.forEach((orderNum) => {
        const purple = purpleByOrder.get(orderNum);
        const api = apiByOrder.get(orderNum);
        const pLines = purple?.lines || 0;
        const pTotal = purple?.total || 0;
        const aLines = api?.lines || 0;
        const aTotal = api?.total || 0;
        const diff = Math.round((pTotal - aTotal) * 100) / 100;

        totalPurple += pTotal;
        totalApi += aTotal;
        totalPurpleLines += pLines;
        totalApiLines += aLines;

        let status: ComparisonRow["status"] = "match";
        if (!api) { status = "missing_api"; missingApiCount++; }
        else if (!purple) { status = "missing_purple"; missingPurpleCount++; }
        else if (Math.abs(diff) > 0.01) { status = "mismatch"; mismatchCount++; }
        else { matchCount++; }

        rows.push({
          order_number: orderNum,
          purple_lines: pLines,
          purple_total: pTotal,
          api_lines: aLines,
          api_total: aTotal,
          line_diff: pLines - aLines,
          total_diff: diff,
          status,
        });
      });

      // Sort by absolute diff descending
      rows.sort((a, b) => Math.abs(b.total_diff) - Math.abs(a.total_diff));
      setData(rows);
      setSummary({
        purpleTotal: totalPurple,
        apiTotal: totalApi,
        diff: Math.round((totalPurple - totalApi) * 100) / 100,
        purpleLines: totalPurpleLines,
        apiLines: totalApiLines,
        matchedOrders: matchCount,
        missingApi: missingApiCount,
        missingPurple: missingPurpleCount,
        mismatchOrders: mismatchCount,
      });

      toast({ title: language === "ar" ? "تم تحميل التقرير" : "Report loaded" });
    } catch (error: any) {
      console.error("Error:", error);
      toast({ title: language === "ar" ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((row) => {
    if (activeTab === "all") return true;
    if (activeTab === "missing_api") return row.status === "missing_api";
    if (activeTab === "missing_purple") return row.status === "missing_purple";
    if (activeTab === "mismatch") return row.status === "mismatch";
    if (activeTab === "match") return row.status === "match";
    return true;
  });

  const exportToExcel = () => {
    const exportData = filteredData.map((row) => ({
      [language === "ar" ? "رقم الطلب" : "Order Number"]: row.order_number,
      [language === "ar" ? "أسطر بوربل" : "Purple Lines"]: row.purple_lines,
      [language === "ar" ? "إجمالي بوربل" : "Purple Total"]: row.purple_total,
      [language === "ar" ? "أسطر API" : "API Lines"]: row.api_lines,
      [language === "ar" ? "إجمالي API" : "API Total"]: row.api_total,
      [language === "ar" ? "فرق الأسطر" : "Line Diff"]: row.line_diff,
      [language === "ar" ? "فرق المبلغ" : "Total Diff"]: row.total_diff,
      [language === "ar" ? "الحالة" : "Status"]: row.status,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparison");
    XLSX.writeFile(wb, `data-comparison-${fromDate}-to-${toDate}.xlsx`);
  };

  const getStatusBadge = (status: ComparisonRow["status"]) => {
    switch (status) {
      case "match":
        return <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />{language === "ar" ? "متطابق" : "Match"}</Badge>;
      case "missing_api":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{language === "ar" ? "غير موجود في API" : "Missing from API"}</Badge>;
      case "missing_purple":
        return <Badge className="bg-orange-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />{language === "ar" ? "غير موجود في بوربل" : "Missing from Purple"}</Badge>;
      case "mismatch":
        return <Badge className="bg-yellow-500 text-black"><AlertTriangle className="h-3 w-3 mr-1" />{language === "ar" ? "فرق في المبلغ" : "Amount Mismatch"}</Badge>;
    }
  };

  return (
    <div className="p-4 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {language === "ar" ? "مقارنة البيانات - API مقابل Excel" : "Data Comparison - API vs Excel"}
        </h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label><Calendar className="h-4 w-4 inline mr-1" />{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label><Calendar className="h-4 w-4 inline mr-1" />{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-44" />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {language === "ar" ? "تحميل" : "Load"}
            </Button>
            {data.length > 0 && (
              <Button variant="outline" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                {language === "ar" ? "تصدير Excel" : "Export Excel"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{language === "ar" ? "إجمالي بوربل (Excel)" : "Purple Total (Excel)"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-lg font-bold text-blue-600">{formatNumber(summary.purpleTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.purpleLines} {language === "ar" ? "سطر" : "lines"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{language === "ar" ? "إجمالي API" : "API Total"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-lg font-bold text-green-600">{formatNumber(summary.apiTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.apiLines} {language === "ar" ? "سطر" : "lines"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{language === "ar" ? "الفرق" : "Difference"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className={`text-lg font-bold ${summary.diff > 0 ? "text-red-600" : summary.diff < 0 ? "text-orange-600" : "text-green-600"}`}>
                {formatNumber(summary.diff)}
              </p>
              <p className="text-xs text-muted-foreground">{summary.purpleLines - summary.apiLines} {language === "ar" ? "سطر" : "lines"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{language === "ar" ? "متطابق" : "Matched"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-lg font-bold text-green-600">{summary.matchedOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{language === "ar" ? "ناقص من API" : "Missing API"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-lg font-bold text-red-600">{summary.missingApi}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs text-muted-foreground">{language === "ar" ? "فرق المبلغ" : "Amt Mismatch"}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-lg font-bold text-yellow-600">{summary.mismatchOrders}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs + Table */}
      {data.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">
                  {language === "ar" ? "الكل" : "All"} ({data.length})
                </TabsTrigger>
                <TabsTrigger value="missing_api">
                  {language === "ar" ? "ناقص من API" : "Missing API"} ({data.filter(r => r.status === "missing_api").length})
                </TabsTrigger>
                <TabsTrigger value="mismatch">
                  {language === "ar" ? "فرق المبلغ" : "Mismatch"} ({data.filter(r => r.status === "mismatch").length})
                </TabsTrigger>
                <TabsTrigger value="missing_purple">
                  {language === "ar" ? "ناقص من بوربل" : "Missing Purple"} ({data.filter(r => r.status === "missing_purple").length})
                </TabsTrigger>
                <TabsTrigger value="match">
                  {language === "ar" ? "متطابق" : "Matched"} ({data.filter(r => r.status === "match").length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{language === "ar" ? "رقم الطلب" : "Order #"}</TableHead>
                        <TableHead className="text-center">{language === "ar" ? "أسطر بوربل" : "Purple Lines"}</TableHead>
                        <TableHead className="text-right">{language === "ar" ? "إجمالي بوربل" : "Purple Total"}</TableHead>
                        <TableHead className="text-center">{language === "ar" ? "أسطر API" : "API Lines"}</TableHead>
                        <TableHead className="text-right">{language === "ar" ? "إجمالي API" : "API Total"}</TableHead>
                        <TableHead className="text-right">{language === "ar" ? "الفرق" : "Difference"}</TableHead>
                        <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((row, idx) => (
                        <TableRow key={row.order_number} className={row.status === "missing_api" ? "bg-red-50 dark:bg-red-950/20" : row.status === "mismatch" ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono font-medium">{row.order_number}</TableCell>
                          <TableCell className="text-center">{row.purple_lines || "-"}</TableCell>
                          <TableCell className="text-right font-medium">{row.purple_total ? formatNumber(row.purple_total) : "-"}</TableCell>
                          <TableCell className="text-center">{row.api_lines || "-"}</TableCell>
                          <TableCell className="text-right font-medium">{row.api_total ? formatNumber(row.api_total) : "-"}</TableCell>
                          <TableCell className={`text-right font-bold ${row.total_diff > 0 ? "text-red-600" : row.total_diff < 0 ? "text-orange-600" : "text-green-600"}`}>
                            {formatNumber(row.total_diff)}
                          </TableCell>
                          <TableCell>{getStatusBadge(row.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Tab Footer Totals */}
                <div className="flex justify-between items-center pt-3 mt-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    {filteredData.length} {language === "ar" ? "طلب" : "orders"}
                  </span>
                  <div className="flex gap-6 text-sm">
                    <span>{language === "ar" ? "بوربل:" : "Purple:"} <strong className="text-blue-600">{formatNumber(filteredData.reduce((s, r) => s + r.purple_total, 0))}</strong></span>
                    <span>API: <strong className="text-green-600">{formatNumber(filteredData.reduce((s, r) => s + r.api_total, 0))}</strong></span>
                    <span>{language === "ar" ? "الفرق:" : "Diff:"} <strong className="text-red-600">{formatNumber(filteredData.reduce((s, r) => s + r.total_diff, 0))}</strong></span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DataComparisonReport;
