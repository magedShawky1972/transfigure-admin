import { useState } from "react";
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
  total_cost: number;
  transaction_count: number;
}

const CostByBrandType = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedBrandType, setSelectedBrandType] = useState<string>("all");
  const [reportResults, setReportResults] = useState<ReportResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [dateRun, setDateRun] = useState<string>("");

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
  });

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
      const { data, error } = await supabase.rpc('cost_by_brand_type', {
        date_from: formattedDateFrom,
        date_to: formattedDateTo,
        p_brand_type: selectedBrandType === 'all' ? null : selectedBrandType
      });

      if (error) throw error;

      const results: ReportResult[] = (data || []).map((row: any) => ({
        brand_type_name: row.brand_type_name,
        total_cost: Number(row.total_cost),
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

    const headers = ["Brand Type", "Total Cost", "Transaction Count"];
    const rows = reportResults.map((row) => [
      row.brand_type_name,
      row.total_cost.toFixed(2),
      row.transaction_count,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cost-by-brand-type-${formattedDateFrom}-to-${formattedDateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalCost = reportResults.reduce((sum, row) => sum + row.total_cost, 0);
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
          <h1 className="text-3xl font-bold mb-2">{t("costReport.title")}</h1>
          <p className="text-muted-foreground">
            {t("reports.costByBrandType.description")}
          </p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>{t("costReport.parameters")}</CardTitle>
          <CardDescription>
            {t("reports.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("costReport.dateFrom")}</Label>
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
              <Label>{t("costReport.dateTo")}</Label>
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
              <Label htmlFor="brandType">{t("costReport.brandType")}</Label>
              <Select value={selectedBrandType} onValueChange={setSelectedBrandType}>
                <SelectTrigger id="brandType">
                  <SelectValue placeholder={t("costReport.selectBrandType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("costReport.allBrandTypes")}</SelectItem>
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
              {isRunning ? "Running..." : t("costReport.runReport")}
            </Button>
            {reportResults.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("costReport.exportCSV")}
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  {t("costReport.print")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {reportResults.length > 0 && (
        <div className="bg-background border rounded-lg p-8 print:border-0 print:p-0">
          {/* Report Document Header */}
          <div className="mb-8 pb-6 border-b-2 border-border">
            <h1 className="text-2xl font-bold mb-4">{t("costReport.title")}</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">{t("costReport.reportDetails")}</p>
                <p className="font-medium">{t("reports.costByBrandType.name")}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">{t("costReport.generatedOn")}</p>
                <p className="font-medium">{dateRun}</p>
              </div>
            </div>
          </div>

          {/* Selection Criteria */}
          <div className="mb-8 pb-6 border-b border-border">
            <h2 className="text-lg font-semibold mb-4">{t("costReport.selectionCriteria")}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">{t("costReport.dateFrom")}</p>
                <p className="font-medium">{dateFrom ? format(dateFrom, "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">{t("costReport.dateTo")}</p>
                <p className="font-medium">{dateTo ? format(dateTo, "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">{t("costReport.brandType")}</p>
                <p className="font-medium">{selectedBrandType === "all" ? t("costReport.allBrandTypes") : selectedBrandType}</p>
              </div>
            </div>
          </div>

          {/* Report Data Table */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-3 px-4 font-semibold">Brand Type</th>
                  <th className="text-right py-3 px-4 font-semibold">Amount</th>
                  <th className="text-right py-3 px-4 font-semibold">Transaction Count</th>
                  <th className="text-right py-3 px-4 font-semibold">Average</th>
                </tr>
              </thead>
              <tbody>
                {reportResults.map((row, index) => (
                  <tr key={index} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-4">{row.brand_type_name}</td>
                    <td className="text-right py-3 px-4">
                      {row.total_cost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right py-3 px-4">{row.transaction_count}</td>
                    <td className="text-right py-3 px-4">
                      {(row.total_cost / row.transaction_count).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold bg-muted/30">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">
                    {totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right py-3 px-4">{totalTransactions}</td>
                  <td className="text-right py-3 px-4">
                    {(totalCost / totalTransactions).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Report Footer */}
          <div className="text-xs text-muted-foreground text-right mt-8 pt-4 border-t border-border">
            <p>Generated on {dateRun}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostByBrandType;
