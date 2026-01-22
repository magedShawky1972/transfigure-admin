import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Printer, Download, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import * as XLSX from "xlsx";

interface DailySalesData {
  date: string;
  dateInt: number;
  totalSales: number;
  pointSales: number;
  transactionCount: number;
  pointTransactionCount: number;
}

const DailySalesReport = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportData, setReportData] = useState<DailySalesData[]>([]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatInteger = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const dateToInt = (dateStr: string): number => {
    const d = new Date(dateStr);
    return parseInt(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    );
  };

  const intToDateString = (dateInt: number): string => {
    const str = String(dateInt);
    const year = str.substring(0, 4);
    const month = str.substring(4, 6);
    const day = str.substring(6, 8);
    return `${year}-${month}-${day}`;
  };

  const fetchReport = async () => {
    if (!fromDate || !toDate) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "يرجى تحديد نطاق التاريخ" : "Please select date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const fromDateInt = dateToInt(fromDate);
      const toDateInt = dateToInt(toDate);

      // Fetch all transactions in batches
      let allTransactions: { total: number | null; created_at_date_int: number | null; payment_method: string | null }[] = [];
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabase
          .from("purpletransaction")
          .select("total, created_at_date_int, payment_method")
          .eq("is_deleted", false)
          .gte("created_at_date_int", fromDateInt)
          .lte("created_at_date_int", toDateInt)
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (batch && batch.length > 0) {
          allTransactions = [...allTransactions, ...batch];
          offset += batchSize;
          hasMore = batch.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Group by date
      const dailyData: { [key: number]: DailySalesData } = {};

      allTransactions.forEach((t) => {
        if (!t.created_at_date_int) return;

        const dateInt = t.created_at_date_int;
        if (!dailyData[dateInt]) {
          dailyData[dateInt] = {
            date: intToDateString(dateInt),
            dateInt: dateInt,
            totalSales: 0,
            pointSales: 0,
            transactionCount: 0,
            pointTransactionCount: 0,
          };
        }

        const total = Number(t.total) || 0;
        const isPoint = t.payment_method?.toLowerCase() === "point";

        if (isPoint) {
          dailyData[dateInt].pointSales += total;
          dailyData[dateInt].pointTransactionCount += 1;
        } else {
          dailyData[dateInt].totalSales += total;
          dailyData[dateInt].transactionCount += 1;
        }
      });

      // Sort by date
      const sortedData = Object.values(dailyData).sort((a, b) => a.dateInt - b.dateInt);
      setReportData(sortedData);

      toast({
        title: language === "ar" ? "تم" : "Success",
        description: language === "ar" 
          ? `تم تحميل ${sortedData.length} يوم` 
          : `Loaded ${sortedData.length} days`,
      });
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (reportData.length === 0) return;

    const exportData = reportData.map((row) => ({
      [language === "ar" ? "التاريخ" : "Date"]: row.date,
      [language === "ar" ? "إجمالي المبيعات" : "Total Sales"]: row.totalSales,
      [language === "ar" ? "عدد المعاملات" : "Transaction Count"]: row.transactionCount,
      [language === "ar" ? "مبيعات النقاط" : "Point Sales"]: row.pointSales,
      [language === "ar" ? "عدد معاملات النقاط" : "Point Txn Count"]: row.pointTransactionCount,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Sales");
    XLSX.writeFile(wb, `daily-sales-report-${fromDate}-to-${toDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals
  const totals = reportData.reduce(
    (acc, row) => ({
      totalSales: acc.totalSales + row.totalSales,
      pointSales: acc.pointSales + row.pointSales,
      transactionCount: acc.transactionCount + row.transactionCount,
      pointTransactionCount: acc.pointTransactionCount + row.pointTransactionCount,
    }),
    { totalSales: 0, pointSales: 0, transactionCount: 0, pointTransactionCount: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 15mm;
            size: A4 landscape;
          }
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
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 4px 8px;
            color: #000 !important;
          }
          th {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tfoot td {
            font-weight: bold;
            background-color: #e0e0e0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          [data-lovable-badge],
          [class*="lovable"],
          footer,
          .footer {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === "ar" ? "رجوع" : "Back"}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {language === "ar" ? "تقرير المبيعات اليومية" : "Daily Sales Report"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar"
                ? "المبيعات ومعاملات النقاط لكل يوم"
                : "Sales and point transactions per day"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={reportData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            {language === "ar" ? "تصدير Excel" : "Export Excel"}
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={reportData.length === 0}>
            <Printer className="h-4 w-4 mr-2" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {language === "ar" ? "نطاق التاريخ" : "Date Range"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchReport} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              {language === "ar" ? "تشغيل التقرير" : "Run Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Data */}
      <div className="print-area">
        <div className="hidden print:block mb-4">
          <h1 className="text-xl font-bold text-center">
            {language === "ar" ? "تقرير المبيعات اليومية" : "Daily Sales Report"}
          </h1>
          <p className="text-center text-sm">
            {fromDate} - {toDate}
          </p>
        </div>

        {reportData.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "إجمالي المبيعات" : "Total Sales"}</TableHead>
                    <TableHead className="text-center">{language === "ar" ? "عدد المعاملات" : "Txn Count"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "مبيعات النقاط" : "Point Sales"}</TableHead>
                    <TableHead className="text-center">{language === "ar" ? "عدد معاملات النقاط" : "Point Txn"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row) => (
                    <TableRow key={row.dateInt}>
                      <TableCell className="text-center font-mono">{row.date}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(row.totalSales)}</TableCell>
                      <TableCell className="text-center font-mono">{formatInteger(row.transactionCount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(row.pointSales)}</TableCell>
                      <TableCell className="text-center font-mono">{formatInteger(row.pointTransactionCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">{language === "ar" ? "الإجمالي" : "Total"}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatNumber(totals.totalSales)}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{formatInteger(totals.transactionCount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{formatNumber(totals.pointSales)}</TableCell>
                    <TableCell className="text-center font-mono font-bold">{formatInteger(totals.pointTransactionCount)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="no-print">
            <CardContent className="py-12 text-center text-muted-foreground">
              {language === "ar"
                ? "حدد نطاق التاريخ واضغط على تشغيل التقرير"
                : "Select date range and click Run Report"}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DailySalesReport;
