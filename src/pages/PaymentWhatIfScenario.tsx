import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, TrendingDown, TrendingUp, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PaymentMethod {
  id: string;
  payment_method: string;
  payment_type: string | null;
  gateway_fee: number;
  fixed_value: number;
  vat_fee: number;
  is_active: boolean;
}

interface SimulationRow {
  payment_method: string;
  payment_type: string | null;
  current_gateway_fee: number;
  new_gateway_fee: number;
  current_fixed_value: number;
  new_fixed_value: number;
  vat_fee: number;
  transaction_count: number;
  total_sales: number;
  current_charges: number;
  new_charges: number;
  difference: number;
  difference_percent: number;
}

const PaymentWhatIfScenario = () => {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return format(d, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [newFees, setNewFees] = useState<Record<string, { gateway_fee: number; fixed_value: number }>>({});
  const [results, setResults] = useState<SimulationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [methodsLoading, setMethodsLoading] = useState(true);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    setMethodsLoading(true);
    const { data, error } = await supabase
      .from("payment_methods")
      .select("*")
      .eq("is_active", true)
      .order("payment_method");

    if (data) {
      setPaymentMethods(data);
      const initial: Record<string, { gateway_fee: number; fixed_value: number }> = {};
      data.forEach((pm) => {
        initial[pm.id] = { gateway_fee: pm.gateway_fee, fixed_value: pm.fixed_value };
      });
      setNewFees(initial);
    }
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setMethodsLoading(false);
  };

  const runSimulation = async () => {
    setLoading(true);
    try {
      const fromInt = parseInt(dateFrom.replace(/-/g, ""));
      const toInt = parseInt(dateTo.replace(/-/g, ""));

      // Fetch transaction aggregates grouped by payment_method + payment_brand
      const { data: txData, error } = await supabase
        .from("purpletransaction")
        .select("payment_method, payment_brand, total")
        .gte("created_at_date", dateFrom)
        .lte("created_at_date", dateTo)
        .neq("payment_method", "point");

      if (error) throw error;

      // Aggregate by payment_brand (which maps to payment_methods.payment_method)
      const aggregated: Record<string, { count: number; totalSales: number }> = {};
      (txData || []).forEach((tx: any) => {
        const key = (tx.payment_brand || "").toLowerCase();
        if (!key) return;
        if (!aggregated[key]) aggregated[key] = { count: 0, totalSales: 0 };
        aggregated[key].count += 1;
        aggregated[key].totalSales += Number(tx.total) || 0;
      });

      // Build simulation rows
      const rows: SimulationRow[] = paymentMethods.map((pm) => {
        const key = pm.payment_method.toLowerCase();
        const agg = aggregated[key] || { count: 0, totalSales: 0 };
        const currentFee = pm.gateway_fee;
        const currentFixed = pm.fixed_value;
        const vatRate = pm.vat_fee || 15;
        const newFee = newFees[pm.id]?.gateway_fee ?? currentFee;
        const newFixed = newFees[pm.id]?.fixed_value ?? currentFixed;

        const calcCharges = (fee: number, fixed: number) => {
          const gatewayCharge = agg.totalSales * (fee / 100);
          const fixedCharge = fixed * agg.count;
          return (gatewayCharge + fixedCharge) * (1 + vatRate / 100);
        };

        const currentCharges = calcCharges(currentFee, currentFixed);
        const newCharges = calcCharges(newFee, newFixed);
        const difference = newCharges - currentCharges;
        const differencePercent = currentCharges !== 0 ? (difference / currentCharges) * 100 : 0;

        return {
          payment_method: pm.payment_method,
          payment_type: pm.payment_type,
          current_gateway_fee: currentFee,
          new_gateway_fee: newFee,
          current_fixed_value: currentFixed,
          new_fixed_value: newFixed,
          vat_fee: vatRate,
          transaction_count: agg.count,
          total_sales: agg.totalSales,
          current_charges: currentCharges,
          new_charges: newCharges,
          difference,
          difference_percent: differencePercent,
        };
      }).filter(r => r.transaction_count > 0 || r.current_gateway_fee !== r.new_gateway_fee || r.current_fixed_value !== r.new_fixed_value);

      // Sort by total_sales desc
      rows.sort((a, b) => b.total_sales - a.total_sales);

      setResults(rows);
      toast({
        title: "Simulation Complete",
        description: `Analyzed ${rows.length} payment methods`,
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalCurrentCharges = results.reduce((s, r) => s + r.current_charges, 0);
  const totalNewCharges = results.reduce((s, r) => s + r.new_charges, 0);
  const totalDifference = totalNewCharges - totalCurrentCharges;

  const exportToCSV = () => {
    if (results.length === 0) return;
    const headers = [
      "Payment Method", "Payment Type", "Current Fee %", "New Fee %",
      "Current Fixed", "New Fixed", "VAT %", "Transactions", "Total Sales",
      "Current Charges", "New Charges", "Difference", "Difference %"
    ];
    const csv = [
      headers.join(","),
      ...results.map(r => [
        `"${r.payment_method}"`, `"${r.payment_type || ""}"`,
        r.current_gateway_fee, r.new_gateway_fee,
        r.current_fixed_value, r.new_fixed_value, r.vat_fee,
        r.transaction_count, r.total_sales.toFixed(2),
        r.current_charges.toFixed(2), r.new_charges.toFixed(2),
        r.difference.toFixed(2), r.difference_percent.toFixed(2)
      ].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-whatif-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const updateFee = (id: string, field: "gateway_fee" | "fixed_value", value: number) => {
    setNewFees(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Payment What-If Scenario</h1>
        <p className="text-muted-foreground">
          Simulate the impact of changing payment gateway fees on your e-payment charges
        </p>
      </div>

      {/* Date Range & Payment Method Fees */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Scenario Configuration
          </CardTitle>
          <CardDescription>
            Set the date range and adjust gateway fees to see the impact
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          {/* Payment Methods Fee Adjustment */}
          {methodsLoading ? (
            <p className="text-muted-foreground">Loading payment methods...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Payment Type</TableHead>
                    <TableHead className="text-center">Current Fee %</TableHead>
                    <TableHead className="text-center">New Fee %</TableHead>
                    <TableHead className="text-center">Current Fixed</TableHead>
                    <TableHead className="text-center">New Fixed</TableHead>
                    <TableHead className="text-center">VAT %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map((pm) => {
                    const isChanged = newFees[pm.id]?.gateway_fee !== pm.gateway_fee || newFees[pm.id]?.fixed_value !== pm.fixed_value;
                    return (
                      <TableRow key={pm.id} className={isChanged ? "bg-accent/30" : ""}>
                        <TableCell className="font-medium">{pm.payment_method}</TableCell>
                        <TableCell>{pm.payment_type}</TableCell>
                        <TableCell className="text-center">{pm.gateway_fee}%</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-24 mx-auto text-center"
                            value={newFees[pm.id]?.gateway_fee ?? pm.gateway_fee}
                            onChange={e => updateFee(pm.id, "gateway_fee", parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-center">{pm.fixed_value}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-24 mx-auto text-center"
                            value={newFees[pm.id]?.fixed_value ?? pm.fixed_value}
                            onChange={e => updateFee(pm.id, "fixed_value", parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="text-center">{pm.vat_fee}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={runSimulation} disabled={loading} className="gap-2">
              <Calculator className="h-4 w-4" />
              {loading ? "Calculating..." : "Run Simulation"}
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Total Charges</CardDescription>
              <CardTitle className="text-2xl">
                SAR {totalCurrentCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Total Charges (Simulated)</CardDescription>
              <CardTitle className="text-2xl">
                SAR {totalNewCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={totalDifference > 0 ? "border-destructive/50" : totalDifference < 0 ? "border-green-500/50" : ""}>
            <CardHeader className="pb-2">
              <CardDescription>Impact (Difference)</CardDescription>
              <CardTitle className={`text-2xl flex items-center gap-2 ${totalDifference > 0 ? "text-destructive" : totalDifference < 0 ? "text-green-600" : ""}`}>
                {totalDifference > 0 ? <TrendingUp className="h-5 w-5" /> : totalDifference < 0 ? <TrendingDown className="h-5 w-5" /> : null}
                SAR {totalDifference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Simulation Results</CardTitle>
            <CardDescription>
              Detailed breakdown by payment method for {dateFrom} to {dateTo}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Method</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-center">Fee %</TableHead>
                    <TableHead className="text-right">Current Charges</TableHead>
                    <TableHead className="text-right">New Charges</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">Change %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.payment_method}>
                      <TableCell className="font-medium">
                        {r.payment_method}
                        {r.payment_type && <span className="text-muted-foreground text-xs ml-1">({r.payment_type})</span>}
                      </TableCell>
                      <TableCell className="text-right">{r.transaction_count.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        SAR {r.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">{r.current_gateway_fee}%</span>
                        {r.current_gateway_fee !== r.new_gateway_fee && (
                          <span className="text-primary font-semibold"> → {r.new_gateway_fee}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        SAR {r.current_charges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        SAR {r.new_charges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${r.difference > 0 ? "text-destructive" : r.difference < 0 ? "text-green-600" : ""}`}>
                        SAR {r.difference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right ${r.difference > 0 ? "text-destructive" : r.difference < 0 ? "text-green-600" : ""}`}>
                        {r.difference_percent.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row */}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{results.reduce((s, r) => s + r.transaction_count, 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      SAR {results.reduce((s, r) => s + r.total_sales, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right">
                      SAR {totalCurrentCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      SAR {totalNewCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right ${totalDifference > 0 ? "text-destructive" : totalDifference < 0 ? "text-green-600" : ""}`}>
                      SAR {totalDifference.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right ${totalDifference > 0 ? "text-destructive" : totalDifference < 0 ? "text-green-600" : ""}`}>
                      {totalCurrentCharges !== 0 ? ((totalDifference / totalCurrentCharges) * 100).toFixed(2) : "0.00"}%
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

export default PaymentWhatIfScenario;
