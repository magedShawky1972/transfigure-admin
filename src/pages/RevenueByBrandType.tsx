import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Download, Play, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReportResult {
  brand_type_name: string;
  total_revenue: number;
  transaction_count: number;
}

const RevenueByBrandType = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedBrandType, setSelectedBrandType] = useState<string>("all");
  const [reportResults, setReportResults] = useState<ReportResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dateRun, setDateRun] = useState<string>("");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roles) {
        setHasAccess(true);
        return;
      }

      // Check specific permission
      const { data: permission } = await supabase
        .from('user_permissions')
        .select('has_access')
        .eq('user_id', user.id)
        .eq('menu_item', 'revenue-by-brand-type')
        .eq('parent_menu', 'Reports')
        .single();

      if (permission?.has_access) {
        setHasAccess(true);
      } else {
        toast.error(t('common.accessDenied') || 'Access denied to this report');
        navigate('/reports');
      }
    } catch (error) {
      console.error('Error checking access:', error);
      navigate('/reports');
    }
  };

  const { data: brandTypes = [] } = useQuery({
    queryKey: ["brand-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_type")
        .select("*")
        .eq("status", "active")
        .order("type_name");
      
      if (error) throw error;
      return data;
    },
    enabled: hasAccess === true,
  });

  if (hasAccess === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!hasAccess) {
    return null;
  }

  const runReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Please select date range");
      return;
    }

    const formattedDateFrom = format(dateFrom, "yyyy-MM-dd");
    const formattedDateTo = format(dateTo, "yyyy-MM-dd");

    setIsRunning(true);
    try {
      // Use backend function to get complete data without row limits
      const { data, error } = await supabase.rpc('revenue_by_brand_type', {
        date_from: formattedDateFrom,
        date_to: formattedDateTo,
        p_brand_type: selectedBrandType === 'all' ? null : selectedBrandType
      });

      if (error) throw error;

      const results: ReportResult[] = (data || []).map((row: any) => ({
        brand_type_name: row.brand_type_name,
        total_revenue: Number(row.total_revenue),
        transaction_count: Number(row.transaction_count),
      }));

      setReportResults(results);
      setDateRun(new Date().toLocaleString());
      toast.success("Report generated successfully");
    } catch (error: any) {
      console.error("Error running report:", error);
      toast.error(error.message || "Failed to run report");
    } finally {
      setIsRunning(false);
    }
  };

  const exportToCSV = () => {
    if (reportResults.length === 0 || !dateFrom || !dateTo) {
      toast.error("No data to export");
      return;
    }

    const formattedDateFrom = format(dateFrom, "yyyy-MM-dd");
    const formattedDateTo = format(dateTo, "yyyy-MM-dd");

    const headers = ["Brand Type", "Total Revenue", "Transaction Count"];
    const rows = reportResults.map((row) => [
      row.brand_type_name,
      row.total_revenue.toFixed(2),
      row.transaction_count,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-by-brand-type-${formattedDateFrom}-to-${formattedDateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalRevenue = reportResults.reduce((sum, row) => sum + row.total_revenue, 0);
  const totalTransactions = reportResults.reduce((sum, row) => sum + row.transaction_count, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 print:hidden">
        <Button variant="outline" size="icon" onClick={() => navigate("/reports")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold mb-2">{t("revenueReport.title")}</h1>
          <p className="text-muted-foreground">
            {t("reports.revenueByBrandType.description")}
          </p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("revenueReport.parameters")}</CardTitle>
          <CardDescription>
            {t("reports.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("revenueReport.dateFrom")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t("revenueReport.dateTo")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brandType">{t("revenueReport.brandType")}</Label>
              <Select value={selectedBrandType} onValueChange={setSelectedBrandType}>
                <SelectTrigger id="brandType">
                  <SelectValue placeholder={t("revenueReport.selectBrandType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("revenueReport.allBrandTypes")}</SelectItem>
                  {brandTypes.map((type) => (
                    <SelectItem key={type.id} value={type.type_name}>
                      {type.type_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={runReport} disabled={isRunning}>
              <Play className="mr-2 h-4 w-4" />
              {isRunning ? "Running..." : t("revenueReport.runReport")}
            </Button>
            {reportResults.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("revenueReport.exportCSV")}
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  {t("revenueReport.print")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportResults.length > 0 && (
        <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0">
          {/* Report Document Header */}
          <div className="mb-8 pb-6 border-b-2 border-border print:border-black">
            <h1 className="text-2xl font-bold mb-4 print:text-black">{t("revenueReport.title")}</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.reportDetails")}</p>
                <p className="font-medium print:text-black">{t("reports.revenueByBrandType.name")}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.generatedOn")}</p>
                <p className="font-medium print:text-black">{dateRun}</p>
              </div>
            </div>
          </div>

          {/* Selection Criteria */}
          <div className="mb-8 pb-6 border-b border-border print:border-gray-600">
            <h2 className="text-lg font-semibold mb-4 print:text-black">{t("revenueReport.selectionCriteria")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.dateFrom")}</p>
                <p className="font-medium print:text-black">{dateFrom ? format(dateFrom, "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.dateTo")}</p>
                <p className="font-medium print:text-black">{dateTo ? format(dateTo, "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground print:text-gray-700">{t("revenueReport.brandType")}</p>
                <p className="font-medium print:text-black">{selectedBrandType === "all" ? t("revenueReport.allBrandTypes") : selectedBrandType}</p>
              </div>
            </div>
          </div>

          {/* Report Data Table */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border print:border-black">
                  <th className="text-left py-3 px-4 font-semibold print:text-black">Brand Type</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Amount</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Transaction Count</th>
                  <th className="text-right py-3 px-4 font-semibold print:text-black">Average</th>
                </tr>
              </thead>
              <tbody>
                {reportResults.map((row, index) => (
                  <tr key={index} className="border-b border-border print:border-gray-400 hover:bg-muted/50">
                    <td className="py-3 px-4 print:text-black">{row.brand_type_name}</td>
                    <td className="text-right py-3 px-4 print:text-black">
                      {row.total_revenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right py-3 px-4 print:text-black">{row.transaction_count}</td>
                    <td className="text-right py-3 px-4 print:text-black">
                      {(row.total_revenue / row.transaction_count).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border print:border-black font-bold bg-muted/30 print:bg-gray-200">
                  <td className="py-3 px-4 print:text-black">Total</td>
                  <td className="text-right py-3 px-4 print:text-black">
                    {totalRevenue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right py-3 px-4 print:text-black">{totalTransactions}</td>
                  <td className="text-right py-3 px-4 print:text-black">
                    {(totalRevenue / totalTransactions).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Report Footer */}
          <div className="text-xs text-muted-foreground print:text-gray-600 text-right mt-8 pt-4 border-t border-border print:border-gray-600">
            <p>Generated on {dateRun}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueByBrandType;
