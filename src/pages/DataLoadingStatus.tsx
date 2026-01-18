import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, FileSpreadsheet, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, eachDayOfInterval, parseISO } from "date-fns";

interface DateStatus {
  date: string;
  loaded: boolean;
}

interface ProgressState {
  current: number;
  total: number;
  message: string;
}

const DataLoadingStatus = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0, message: '' });
  const [dataSource, setDataSource] = useState<"riyadbank" | "hyberpay" | "purpletransaction" | "orderpayment">("hyberpay");
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateStatuses, setDateStatuses] = useState<DateStatus[]>([]);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const fetchDateStatuses = async () => {
    setLoading(true);
    setProgress({ current: 0, total: 0, message: isRTL ? 'جاري التهيئة...' : 'Initializing...' });
    
    try {
      // Generate all dates in range
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const allDates = eachDayOfInterval({ start, end });

      const loadedDates = new Set<string>();

      const PAGE_SIZE = 1000;
      let totalRecordsFetched = 0;
      
      const fetchDateValuesPaged = async (opts: {
        table: "hyberpaystatement" | "riyadbankstatement" | "purpletransaction" | "order_payment";
        column: "request_date" | "txn_date_only" | "created_at_date" | "order_date";
      }) => {
        let from = 0;
        let pageNum = 1;
        
        // First, get estimated count
        setProgress({ 
          current: 0, 
          total: 100, 
          message: isRTL ? 'جاري حساب عدد السجلات...' : 'Counting records...' 
        });
        
        while (true) {
          setProgress(prev => ({ 
            ...prev, 
            current: Math.min(90, pageNum * 10), 
            message: isRTL 
              ? `جاري جلب الصفحة ${pageNum} (${totalRecordsFetched.toLocaleString()} سجل)...` 
              : `Fetching page ${pageNum} (${totalRecordsFetched.toLocaleString()} records)...`
          }));
          
          const { data, error } = await supabase
            .from(opts.table)
            .select(opts.column)
            .gte(opts.column, startDate)
            .lte(opts.column, endDate)
            .order(opts.column, { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;

          data?.forEach((row) => {
            const value = (row as any)[opts.column];
            if (!value) return;
            loadedDates.add(String(value).slice(0, 10));
          });

          totalRecordsFetched += data?.length || 0;

          if (!data || data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
          pageNum++;
        }
      };

      if (dataSource === "hyberpay") {
        await fetchDateValuesPaged({ table: "hyberpaystatement", column: "request_date" });
      } else if (dataSource === "riyadbank") {
        await fetchDateValuesPaged({ table: "riyadbankstatement", column: "txn_date_only" });
      } else if (dataSource === "purpletransaction") {
        await fetchDateValuesPaged({ table: "purpletransaction", column: "created_at_date" });
      } else if (dataSource === "orderpayment") {
        await fetchDateValuesPaged({ table: "order_payment", column: "order_date" });
      }

      setProgress({ 
        current: 95, 
        total: 100, 
        message: isRTL ? 'جاري معالجة النتائج...' : 'Processing results...' 
      });

      // Build status array
      const statuses: DateStatus[] = allDates.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return {
          date: dateStr,
          loaded: loadedDates.has(dateStr),
        };
      });

      setDateStatuses(statuses);

      const missingCount = statuses.filter((s) => !s.loaded).length;
      const loadedCount = statuses.filter((s) => s.loaded).length;

      setProgress({ 
        current: 100, 
        total: 100, 
        message: isRTL ? 'اكتمل!' : 'Complete!' 
      });

      toast.success(
        isRTL
          ? `تم العثور على ${loadedCount} تاريخ محمل و ${missingCount} تاريخ مفقود`
          : `Found ${loadedCount} loaded dates and ${missingCount} missing dates`
      );
    } catch (error) {
      console.error("Error fetching date statuses:", error);
      toast.error(isRTL ? "خطأ في جلب البيانات" : "Error fetching data");
      setProgress({ current: 0, total: 0, message: '' });
    } finally {
      setLoading(false);
    }
  };

  const filteredStatuses = useMemo(() => {
    if (showOnlyMissing) {
      return dateStatuses.filter(s => !s.loaded);
    }
    return dateStatuses;
  }, [dateStatuses, showOnlyMissing]);

  const summary = useMemo(() => {
    const total = dateStatuses.length;
    const loaded = dateStatuses.filter(s => s.loaded).length;
    const missing = dateStatuses.filter(s => !s.loaded).length;
    return { total, loaded, missing };
  }, [dateStatuses]);

  const handleExportExcel = () => {
    if (dateStatuses.length === 0) {
      toast.error(isRTL ? 'لا توجد بيانات للتصدير' : 'No data to export');
      return;
    }

    const headers = ['Date', 'Status'];
    const rows = filteredStatuses.map(s => [s.date, s.loaded ? 'Loaded' : 'Missing']);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-loading-status-${dataSource}-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDataSourceLabel = (source: string) => {
    switch (source) {
      case 'hyberpay':
        return isRTL ? 'هايبرباي' : 'Hyberpay';
      case 'riyadbank':
        return isRTL ? 'بنك الرياض' : 'Riyad Bank';
      case 'purpletransaction':
        return isRTL ? 'المعاملات' : 'Transactions';
      case 'orderpayment':
        return isRTL ? 'مدفوعات الطلبات' : 'Order Payment';
      default:
        return source;
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isRTL ? "حالة تحميل البيانات" : "Data Loading Status"}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? "التحقق من التواريخ المحملة في النظام" : "Check which dates have data loaded in the system"}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportExcel} disabled={dateStatuses.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {isRTL ? "تصدير Excel" : "Export Excel"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>{isRTL ? "مصدر البيانات" : "Data Source"}</Label>
              <Select value={dataSource} onValueChange={(value: "riyadbank" | "hyberpay" | "purpletransaction" | "orderpayment") => setDataSource(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hyberpay">{isRTL ? "هايبرباي" : "Hyberpay"}</SelectItem>
                  <SelectItem value="riyadbank">{isRTL ? "بنك الرياض" : "Riyad Bank"}</SelectItem>
                  <SelectItem value="purpletransaction">{isRTL ? "المعاملات" : "Transactions"}</SelectItem>
                  <SelectItem value="orderpayment">{isRTL ? "مدفوعات الطلبات" : "Order Payment"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchDateStatuses} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {loading ? (isRTL ? "جاري البحث..." : "Searching...") : (isRTL ? "بحث" : "Search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {loading && (
        <Card className="border-primary/50">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress.message || (isRTL ? 'جاري التحميل...' : 'Loading...')}
                </span>
                <span className="font-medium">{Math.round((progress.current / Math.max(progress.total, 1)) * 100)}%</span>
              </div>
              <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {dateStatuses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الأيام" : "Total Days"}</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "الأيام المحملة" : "Loaded Days"}</p>
                  <p className="text-2xl font-bold text-green-600">{summary.loaded}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{isRTL ? "الأيام المفقودة" : "Missing Days"}</p>
                  <p className="text-2xl font-bold text-red-600">{summary.missing}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {isRTL 
              ? `النتائج - ${getDataSourceLabel(dataSource)} (${filteredStatuses.length})` 
              : `Results - ${getDataSourceLabel(dataSource)} (${filteredStatuses.length})`}
          </CardTitle>
          {dateStatuses.length > 0 && (
            <Button
              variant={showOnlyMissing ? "default" : "outline"}
              size="sm"
              onClick={() => setShowOnlyMissing(!showOnlyMissing)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {isRTL ? "عرض المفقود فقط" : "Show Missing Only"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "اليوم" : "Day"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredStatuses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      {isRTL ? "لا توجد بيانات - اضغط بحث للبدء" : "No data - Click Search to start"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStatuses.map((status, index) => {
                    const dateObj = parseISO(status.date);
                    const dayName = format(dateObj, 'EEEE');
                    return (
                      <TableRow key={status.date} className={!status.loaded ? 'bg-red-500/5' : ''}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{status.date}</TableCell>
                        <TableCell>{dayName}</TableCell>
                        <TableCell>
                          {status.loaded ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {isRTL ? "محمل" : "Loaded"}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              {isRTL ? "مفقود" : "Missing"}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataLoadingStatus;