import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { FileText, Download, TrendingUp, Building2 } from "lucide-react";
import * as XLSX from "xlsx";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";

interface CostCenter {
  id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
}

interface CostCenterSummary {
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  cost_center_name_ar: string | null;
  license_cost: number;
  expense_cost: number;
  total_cost: number;
  license_count: number;
  expense_count: number;
}

interface DetailRecord {
  id: string;
  type: "license" | "expense";
  date: string;
  description: string;
  amount: number;
  cost_center_id: string;
}

const CostCenterReport = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("cost-center-report");
  const [loading, setLoading] = useState(true);
  
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [summaryData, setSummaryData] = useState<CostCenterSummary[]>([]);
  const [detailData, setDetailData] = useState<DetailRecord[]>([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("__all__");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"summary" | "detail">("summary");

  useEffect(() => {
    fetchCostCenters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, selectedCostCenterId]);

  const fetchCostCenters = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, cost_center_code, cost_center_name, cost_center_name_ar")
        .eq("is_active", true)
        .order("cost_center_code");
      
      if (error) throw error;
      setCostCenters(data || []);
    } catch (error) {
      console.error("Error fetching cost centers:", error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split("T")[0];

      // Fetch license invoices with cost center info
      const { data: licenseData, error: licenseError } = await supabase
        .from("software_license_invoices")
        .select(`
          id,
          invoice_date,
          cost_sar,
          file_name,
          license_id,
          software_licenses!inner(
            id,
            software_name,
            cost_center_id
          )
        `)
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate);

      if (licenseError) throw licenseError;

      // Fetch expense entries with cost center
      const { data: expenseData, error: expenseError } = await supabase
        .from("expense_entries")
        .select("id, entry_number, entry_date, grand_total, cost_center_id, status")
        .gte("entry_date", startDate)
        .lte("entry_date", endDate)
        .in("status", ["approved", "paid"]);

      if (expenseError) throw expenseError;

      // Process data into summaries
      const summaryMap = new Map<string, CostCenterSummary>();

      // Initialize with all cost centers
      costCenters.forEach(cc => {
        summaryMap.set(cc.id, {
          cost_center_id: cc.id,
          cost_center_code: cc.cost_center_code,
          cost_center_name: cc.cost_center_name,
          cost_center_name_ar: cc.cost_center_name_ar,
          license_cost: 0,
          expense_cost: 0,
          total_cost: 0,
          license_count: 0,
          expense_count: 0,
        });
      });

      // Add "Unassigned" category
      summaryMap.set("__unassigned__", {
        cost_center_id: "__unassigned__",
        cost_center_code: "N/A",
        cost_center_name: "Unassigned",
        cost_center_name_ar: "غير محدد",
        license_cost: 0,
        expense_cost: 0,
        total_cost: 0,
        license_count: 0,
        expense_count: 0,
      });

      const details: DetailRecord[] = [];

      // Process license data
      (licenseData || []).forEach((inv: any) => {
        const costCenterId = inv.software_licenses?.cost_center_id || "__unassigned__";
        const costSar = inv.cost_sar || 0;

        if (summaryMap.has(costCenterId)) {
          const summary = summaryMap.get(costCenterId)!;
          summary.license_cost += costSar;
          summary.total_cost += costSar;
          summary.license_count += 1;
        } else {
          const unassigned = summaryMap.get("__unassigned__")!;
          unassigned.license_cost += costSar;
          unassigned.total_cost += costSar;
          unassigned.license_count += 1;
        }

        details.push({
          id: inv.id,
          type: "license",
          date: inv.invoice_date,
          description: inv.software_licenses?.software_name || inv.file_name || "License Invoice",
          amount: costSar,
          cost_center_id: costCenterId,
        });
      });

      // Process expense data
      (expenseData || []).forEach((exp: any) => {
        const costCenterId = exp.cost_center_id || "__unassigned__";
        const amount = exp.grand_total || 0;

        if (summaryMap.has(costCenterId)) {
          const summary = summaryMap.get(costCenterId)!;
          summary.expense_cost += amount;
          summary.total_cost += amount;
          summary.expense_count += 1;
        } else {
          const unassigned = summaryMap.get("__unassigned__")!;
          unassigned.expense_cost += amount;
          unassigned.total_cost += amount;
          unassigned.expense_count += 1;
        }

        details.push({
          id: exp.id,
          type: "expense",
          date: exp.entry_date,
          description: `Expense Entry: ${exp.entry_number}`,
          amount,
          cost_center_id: costCenterId,
        });
      });

      // Convert to array and filter
      let summaryArray = Array.from(summaryMap.values());
      
      // Filter by cost center if selected
      if (selectedCostCenterId !== "__all__") {
        summaryArray = summaryArray.filter(s => s.cost_center_id === selectedCostCenterId);
      }

      // Sort by total cost descending
      summaryArray.sort((a, b) => b.total_cost - a.total_cost);

      // Filter out zeros if not specifically selected
      if (selectedCostCenterId === "__all__") {
        summaryArray = summaryArray.filter(s => s.total_cost > 0);
      }

      setSummaryData(summaryArray);

      // Filter details
      let filteredDetails = details;
      if (selectedCostCenterId !== "__all__") {
        filteredDetails = details.filter(d => d.cost_center_id === selectedCostCenterId);
      }
      filteredDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setDetailData(filteredDetails);

    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => 
    num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getCostCenterDisplayName = (summary: CostCenterSummary) => {
    if (language === "ar" && summary.cost_center_name_ar) {
      return `${summary.cost_center_code} - ${summary.cost_center_name_ar}`;
    }
    return `${summary.cost_center_code} - ${summary.cost_center_name}`;
  };

  const exportToExcel = () => {
    const headers = language === "ar" 
      ? ["الكود", "مركز التكلفة", "تكلفة التراخيص", "عدد التراخيص", "تكلفة المصروفات", "عدد المصروفات", "إجمالي التكلفة"]
      : ["Code", "Cost Center", "License Cost", "License Count", "Expense Cost", "Expense Count", "Total Cost"];

    const rows = summaryData.map(s => [
      s.cost_center_code,
      language === "ar" && s.cost_center_name_ar ? s.cost_center_name_ar : s.cost_center_name,
      s.license_cost,
      s.license_count,
      s.expense_cost,
      s.expense_count,
      s.total_cost,
    ]);

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    if (language === "ar") ws["!dir"] = "rtl";
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, language === "ar" ? "تقرير مراكز التكلفة" : "Cost Center Report");
    XLSX.writeFile(wb, `cost_center_report_${selectedYear}_${String(selectedMonth).padStart(2, "0")}.xlsx`);
  };

  const totalLicenseCost = summaryData.reduce((sum, s) => sum + s.license_cost, 0);
  const totalExpenseCost = summaryData.reduce((sum, s) => sum + s.expense_cost, 0);
  const grandTotal = summaryData.reduce((sum, s) => sum + s.total_cost, 0);

  if (accessLoading) return <LoadingOverlay />;
  if (!hasAccess) return <AccessDenied />;
  if (loading) return <LoadingOverlay />;

  return (
    <div className="container mx-auto p-4 space-y-4" dir={language === "ar" ? "rtl" : "ltr"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {language === "ar" ? "تقرير تكلفة مراكز التكلفة" : "Cost Center Cost Report"}
          </CardTitle>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-1" />
            {language === "ar" ? "تصدير Excel" : "Export Excel"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="w-48">
              <Label>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</Label>
              <Select value={selectedCostCenterId} onValueChange={setSelectedCostCenterId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{language === "ar" ? "جميع المراكز" : "All Cost Centers"}</SelectItem>
                  {costCenters.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.cost_center_code} - {language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label>{language === "ar" ? "الشهر" : "Month"}</Label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(2000, i).toLocaleString(language === "ar" ? "ar-SA" : "en-US", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <Label>{language === "ar" ? "السنة" : "Year"}</Label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => (
                    <SelectItem key={i} value={String(new Date().getFullYear() - 2 + i)}>
                      {new Date().getFullYear() - 2 + i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label>{language === "ar" ? "العرض" : "View"}</Label>
              <Select value={viewMode} onValueChange={(v: "summary" | "detail") => setViewMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">{language === "ar" ? "ملخص" : "Summary"}</SelectItem>
                  <SelectItem value="detail">{language === "ar" ? "تفاصيل" : "Details"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === "ar" ? "تكلفة التراخيص" : "License Costs"}</p>
                    <p className="text-2xl font-bold text-blue-600">{formatNumber(totalLicenseCost)}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === "ar" ? "تكلفة المصروفات" : "Expense Costs"}</p>
                    <p className="text-2xl font-bold text-orange-600">{formatNumber(totalExpenseCost)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{language === "ar" ? "إجمالي التكلفة" : "Total Cost"}</p>
                    <p className="text-2xl font-bold text-primary">{formatNumber(grandTotal)}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Table */}
          {viewMode === "summary" ? (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "تكلفة التراخيص" : "License Cost"}</TableHead>
                    <TableHead className="text-center">{language === "ar" ? "عدد" : "Count"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "تكلفة المصروفات" : "Expense Cost"}</TableHead>
                    <TableHead className="text-center">{language === "ar" ? "عدد" : "Count"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "إجمالي التكلفة" : "Total Cost"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد بيانات" : "No data found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    summaryData.map((summary) => (
                      <TableRow key={summary.cost_center_id}>
                        <TableCell className="font-medium">{getCostCenterDisplayName(summary)}</TableCell>
                        <TableCell className="text-right text-blue-600">{formatNumber(summary.license_cost)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{summary.license_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-orange-600">{formatNumber(summary.expense_cost)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{summary.expense_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatNumber(summary.total_cost)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {summaryData.length > 0 && (
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>{language === "ar" ? "الإجمالي" : "Total"}</TableCell>
                      <TableCell className="text-right text-blue-600">{formatNumber(totalLicenseCost)}</TableCell>
                      <TableCell className="text-center">
                        <Badge>{summaryData.reduce((sum, s) => sum + s.license_count, 0)}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-orange-600">{formatNumber(totalExpenseCost)}</TableCell>
                      <TableCell className="text-center">
                        <Badge>{summaryData.reduce((sum, s) => sum + s.expense_count, 0)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(grandTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                    <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                    <TableHead>{language === "ar" ? "مركز التكلفة" : "Cost Center"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد بيانات" : "No data found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    detailData.map((record) => {
                      const cc = costCenters.find(c => c.id === record.cost_center_id);
                      return (
                        <TableRow key={`${record.type}-${record.id}`}>
                          <TableCell>{format(new Date(record.date), "yyyy-MM-dd")}</TableCell>
                          <TableCell>
                            <Badge variant={record.type === "license" ? "default" : "secondary"}>
                              {record.type === "license" 
                                ? (language === "ar" ? "ترخيص" : "License")
                                : (language === "ar" ? "مصروف" : "Expense")}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.description}</TableCell>
                          <TableCell>
                            {cc 
                              ? `${cc.cost_center_code} - ${language === "ar" && cc.cost_center_name_ar ? cc.cost_center_name_ar : cc.cost_center_name}`
                              : (language === "ar" ? "غير محدد" : "Unassigned")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatNumber(record.amount)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CostCenterReport;
