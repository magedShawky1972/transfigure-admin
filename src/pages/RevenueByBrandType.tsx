import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ReportResult {
  brand_type_name: string;
  total_revenue: number;
  transaction_count: number;
}

const RevenueByBrandType = () => {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedBrandType, setSelectedBrandType] = useState<string>("all");
  const [reportResults, setReportResults] = useState<ReportResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

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

    setIsRunning(true);
    try {
      // Query to get revenue by brand type
      let query = supabase
        .from("purpletransaction")
        .select("brand_name, total")
        .gte("created_at_date", dateFrom)
        .lte("created_at_date", dateTo)
        .not("brand_name", "is", null);

      const { data: transactions, error: transError } = await query;
      if (transError) throw transError;

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
      
      transactions?.forEach((trans) => {
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
      toast.success("Report generated successfully");
    } catch (error: any) {
      console.error("Error running report:", error);
      toast.error(error.message || "Failed to run report");
    } finally {
      setIsRunning(false);
    }
  };

  const exportToCSV = () => {
    if (reportResults.length === 0) {
      toast.error("No data to export");
      return;
    }

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
    a.download = `revenue-by-brand-type-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalRevenue = reportResults.reduce((sum, row) => sum + row.total_revenue, 0);
  const totalTransactions = reportResults.reduce((sum, row) => sum + row.transaction_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
          <CardDescription>
            Select the criteria for your report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
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
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {reportResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
            <CardDescription>
              Revenue from {dateFrom} to {dateTo}
              {selectedBrandType !== "all" && ` - ${selectedBrandType}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand Type</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">Transaction Count</TableHead>
                    <TableHead className="text-right">Average per Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportResults.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.brand_type_name}</TableCell>
                      <TableCell className="text-right">
                        {row.total_revenue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right">{row.transaction_count}</TableCell>
                      <TableCell className="text-right">
                        {(row.total_revenue / row.transaction_count).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {totalRevenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">{totalTransactions}</TableCell>
                    <TableCell className="text-right">
                      {(totalRevenue / totalTransactions).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RevenueByBrandType;
