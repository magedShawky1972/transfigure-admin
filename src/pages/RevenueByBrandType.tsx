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

interface ReportResult {
  brand_type_name: string;
  total_revenue: number;
  transaction_count: number;
}

const RevenueByBrandType = () => {
  const navigate = useNavigate();
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
      // Query to get revenue by brand type (excluding point transactions)
      let query = supabase
        .from("purpletransaction")
        .select("brand_name, total, payment_method")
        .gte("created_at_date", formattedDateFrom)
        .lte("created_at_date", formattedDateTo)
        .not("brand_name", "is", null);

      const { data: transactions, error: transError } = await query;
      if (transError) throw transError;

      // Filter out point transactions
      const filteredTransactions = transactions?.filter(
        (trans) => (trans.payment_method || "").toLowerCase() !== "point"
      ) || [];

      // Get all brands with their types
      const { data: brands, error: brandsError } = await supabase
        .from("brands")
        .select(`
          brand_name,
          brand_type:brand_type_id (
            id,
            type_name
          )
        `);
      
      if (brandsError) throw brandsError;

      // Create a map of brand_name to brand_type_name
      const brandTypeMap = new Map<string, string>();
      brands?.forEach((brand: any) => {
        if (brand.brand_type) {
          brandTypeMap.set(brand.brand_name, brand.brand_type.type_name);
        }
      });

      // Group transactions by brand type
      const revenueByType = new Map<string, { revenue: number; count: number }>();
      
      filteredTransactions.forEach((trans) => {
        const brandTypeName = brandTypeMap.get(trans.brand_name || "") || "Unknown";
        
        // Filter by selected brand type if not "all"
        if (selectedBrandType !== "all" && brandTypeName !== selectedBrandType) {
          return;
        }

        const current = revenueByType.get(brandTypeName) || { revenue: 0, count: 0 };
        revenueByType.set(brandTypeName, {
          revenue: current.revenue + (Number(trans.total) || 0),
          count: current.count + 1,
        });
      });

      // Convert to array for display
      const results: ReportResult[] = Array.from(revenueByType.entries()).map(
        ([brand_type_name, { revenue, count }]) => ({
          brand_type_name,
          total_revenue: revenue,
          transaction_count: count,
        })
      );

      // Sort by revenue descending
      results.sort((a, b) => b.total_revenue - a.total_revenue);

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
          <h1 className="text-3xl font-bold mb-2">Revenue by Brand Type</h1>
          <p className="text-muted-foreground">
            Calculate total revenue based on brand type
          </p>
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
          <CardDescription>
            Select the criteria for your report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date From</Label>
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
              <Label>Date To</Label>
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
              <Label htmlFor="brandType">Brand Type</Label>
              <Select value={selectedBrandType} onValueChange={setSelectedBrandType}>
                <SelectTrigger id="brandType">
                  <SelectValue placeholder="Select brand type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brand Types</SelectItem>
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
              {isRunning ? "Running..." : "Run Report"}
            </Button>
            {reportResults.length > 0 && (
              <>
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
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
            <h1 className="text-2xl font-bold mb-4">Revenue by Brand Type Report</h1>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Report Name</p>
                <p className="font-medium">Revenue by Brand Type</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Date Run</p>
                <p className="font-medium">{dateRun}</p>
              </div>
            </div>
          </div>

          {/* Selection Criteria */}
          <div className="mb-8 pb-6 border-b border-border">
            <h2 className="text-lg font-semibold mb-4">Selection Criteria</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Date From</p>
                <p className="font-medium">{dateFrom ? format(dateFrom, "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Date To</p>
                <p className="font-medium">{dateTo ? format(dateTo, "PPP") : "-"}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Brand Type</p>
                <p className="font-medium">{selectedBrandType === "all" ? "All Brand Types" : selectedBrandType}</p>
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
                      {row.total_revenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right py-3 px-4">{row.transaction_count}</td>
                    <td className="text-right py-3 px-4">
                      {(row.total_revenue / row.transaction_count).toLocaleString(undefined, {
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
                    {totalRevenue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="text-right py-3 px-4">{totalTransactions}</td>
                  <td className="text-right py-3 px-4">
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
          <div className="text-xs text-muted-foreground text-right mt-8 pt-4 border-t border-border">
            <p>Generated on {dateRun}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueByBrandType;
