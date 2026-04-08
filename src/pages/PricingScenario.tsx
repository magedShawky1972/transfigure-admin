import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, Download, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PaymentMethod {
  id: string;
  payment_method: string;
  payment_type: string;
  gateway_fee: number;
  fixed_value: number;
  vat_fee: number;
}

interface ScenarioInputs {
  brandName: string;
  cost1UsdCoins: number;
  sales1UsdCoins: number;
  profitPercentage: number;
  cashBackPercent: number;
  rate: number;
  amountToTransfer: number;
}

interface ResultRow {
  coins: number;
  priceUsd: number;
  sarPrice: number;
  paymentCommission: number;
  fixedValue: number;
  vat: number;
  cashBack: number;
  net: number;
  costSar: number;
  costUsd: number;
}

const DEFAULT_COINS_TIERS = [
  1, 100, 1000,
  50000, 75000, 100000, 125000, 150000, 175000, 215000,
  300000, 400000, 500000, 600000, 700000, 800000, 900000,
  1000000, 1500000, 2000000, 2500000, 3000000, 3500000,
  4000000, 4500000, 5000000,
];

const PricingScenario = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const [inputs, setInputs] = useState<ScenarioInputs>({
    brandName: "",
    cost1UsdCoins: 0,
    sales1UsdCoins: 0,
    profitPercentage: 0,
    cashBackPercent: 0,
    rate: 0,
    amountToTransfer: 0,
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const fetchMethods = async () => {
      const { data } = await supabase
        .from("payment_methods")
        .select("id, payment_method, payment_type, gateway_fee, fixed_value, vat_fee")
        .eq("is_active", true)
        .order("payment_method");
      if (data) setPaymentMethods(data);
    };
    fetchMethods();
  }, []);

  const totalTransferCoins = inputs.amountToTransfer * inputs.cost1UsdCoins;
  const amountTransferSAR = inputs.amountToTransfer * inputs.rate;

  const selectedMethods = useMemo(
    () => paymentMethods.filter((m) => selectedMethodIds.includes(m.id)),
    [paymentMethods, selectedMethodIds]
  );

  const calculateForMethod = (method: PaymentMethod): ResultRow[] => {
    const { sales1UsdCoins, cost1UsdCoins, rate, cashBackPercent } = inputs;
    const gatewayRate = (method.gateway_fee || 0) / 100;
    const fixedVal = method.fixed_value || 0;
    const vatRate = (method.vat_fee || 0) / 100;
    const cashBackRate = cashBackPercent / 100;

    return DEFAULT_COINS_TIERS.map((coins) => {
      const priceUsd = coins / sales1UsdCoins;
      const sarPrice = priceUsd * rate;
      const costUsd = coins / cost1UsdCoins;
      const costSar = costUsd * rate;
      const paymentCommission = sarPrice * gatewayRate;
      const vat = (fixedVal + paymentCommission) * vatRate;
      const cashBack = cashBackRate * sarPrice;
      const net = sarPrice - costSar - paymentCommission - fixedVal - vat - cashBack;

      return { coins, priceUsd, sarPrice, paymentCommission, fixedValue: fixedVal, vat, cashBack, net, costSar, costUsd };
    });
  };

  const getAvgProfitPercent = (results: ResultRow[]): number => {
    const validRows = results.filter((r) => r.sarPrice > 0);
    if (validRows.length === 0) return 0;
    const totalPercent = validRows.reduce((sum, r) => sum + (r.net / r.sarPrice) * 100, 0);
    return totalPercent / validRows.length;
  };

  const toggleMethod = (id: string) => {
    setSelectedMethodIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setShowResults(false);
  };

  const updateInput = (field: keyof ScenarioInputs, value: string | number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setShowResults(false);
  };

  const fmtNum = (v: number, decimals = 2) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const exportToCSV = () => {
    if (selectedMethods.length === 0) return;
    const headers = ["Payment Brand", "Coins", "Price USD", "SAR Price", "Payment Commission", "Fixed Value", "VAT", "Cash Back", "Net", "Cost SAR", "Cost USD"];
    const rows: string[] = [headers.join(",")];
    selectedMethods.forEach((method) => {
      const results = calculateForMethod(method);
      results.forEach((r) => {
        rows.push(
          [method.payment_method, r.coins, r.priceUsd.toFixed(6), r.sarPrice.toFixed(4), r.paymentCommission.toFixed(4), r.fixedValue, r.vat.toFixed(6), r.cashBack.toFixed(6), r.net.toFixed(2), r.costSar.toFixed(4), r.costUsd.toFixed(6)].join(",")
        );
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pricing-scenario-${inputs.brandName || "brand"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {isRTL ? "سيناريو التسعير" : "Pricing Scenario"}
        </h1>
        <p className="text-muted-foreground">
          {isRTL ? "حاسبة تسعير الكوينز - أدخل البيانات واختر طرق الدفع ثم اضغط حساب" : "Coins pricing calculator - enter data, select payment methods, then click Calculate"}
        </p>
      </div>

      {/* Step 1: Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {isRTL ? "الخطوة 1: إدخال البيانات" : "Step 1: Enter Data"}
          </CardTitle>
          <CardDescription>
            {isRTL ? "أدخل بيانات العلامة التجارية والتسعير" : "Enter brand and pricing data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? "اسم العلامة التجارية" : "Brand Name"}</Label>
              <Input value={inputs.brandName} onChange={(e) => updateInput("brandName", e.target.value)} placeholder={isRTL ? "أدخل اسم العلامة" : "Enter brand name"} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "التكلفة 1 دولار = كوينز" : "Cost 1USD = Coins"}</Label>
              <Input type="number" step="1" value={inputs.cost1UsdCoins || ""} onChange={(e) => updateInput("cost1UsdCoins", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "المبيعات 1 دولار = كوينز" : "Sales 1USD = Coins"}</Label>
              <Input type="number" step="1" value={inputs.sales1UsdCoins || ""} onChange={(e) => updateInput("sales1UsdCoins", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "نسبة الربح %" : "Profit Percentage %"}</Label>
              <Input type="number" step="0.01" value={inputs.profitPercentage || ""} onChange={(e) => updateInput("profitPercentage", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "نسبة استرداد النقد %" : "Cash Back %"}</Label>
              <Input type="number" step="0.01" value={inputs.cashBackPercent || ""} onChange={(e) => updateInput("cashBackPercent", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "سعر الصرف (Rate)" : "Exchange Rate"}</Label>
              <Input type="number" step="0.01" value={inputs.rate || ""} onChange={(e) => updateInput("rate", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "مبلغ التحويل (دولار)" : "Amount To Transfer (USD)"}</Label>
              <Input type="number" step="1" value={inputs.amountToTransfer || ""} onChange={(e) => updateInput("amountToTransfer", parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Payment Methods Selection */}
          <div className="mt-6">
            <Label className="text-base font-semibold mb-3 block">
              {isRTL ? "اختر طرق الدفع" : "Select Payment Methods"}
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                    selectedMethodIds.includes(method.id)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleMethod(method.id)}
                >
                  <Checkbox
                    checked={selectedMethodIds.includes(method.id)}
                    onCheckedChange={() => toggleMethod(method.id)}
                  />
                  <div className="text-sm">
                    <p className="font-medium">{method.payment_method}</p>
                    <p className="text-muted-foreground text-xs">
                      {method.gateway_fee}% + {method.fixed_value} | VAT {method.vat_fee}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Calculated summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الكوينز المحولة" : "Total Transfer Coins"}</p>
              <p className="text-lg font-bold">{fmtNum(totalTransferCoins, 0)}</p>
            </div>
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">{isRTL ? "مبلغ التحويل بالريال" : "Amount Transfer SAR"}</p>
              <p className="text-lg font-bold">{fmtNum(amountTransferSAR)}</p>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => {
                setShowResults(true);
                // Calculate average profit % across all selected methods
                const allAvgs = selectedMethods.map((m) => getAvgProfitPercent(calculateForMethod(m)));
                const overallAvg = allAvgs.length > 0 ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : 0;
                setInputs((prev) => ({ ...prev, profitPercentage: parseFloat(overallAvg.toFixed(4)) }));
              }}
              className="gap-2"
              disabled={inputs.sales1UsdCoins === 0 || inputs.cost1UsdCoins === 0 || selectedMethodIds.length === 0}
            >
              <ArrowRight className="h-4 w-4" />
              {isRTL ? "حساب جدول الأسعار" : "Calculate Pricing Table"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Results - One table per selected payment method */}
      {showResults && selectedMethods.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">
              {isRTL ? "الخطوة 2: جداول الأسعار" : "Step 2: Pricing Tables"}
            </h2>
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              {isRTL ? "تصدير الكل CSV" : "Export All CSV"}
            </Button>
          </div>

          {selectedMethods.map((method) => {
            const results = calculateForMethod(method);
            return (
              <Card key={method.id}>
                <CardHeader>
                  <CardTitle className="text-xl">
                    {method.payment_method}
                    {inputs.brandName && (
                      <span className="text-muted-foreground text-base font-normal ms-2">
                        — {inputs.brandName}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isRTL ? "العمولة" : "Fee"}: {method.gateway_fee}% + {method.fixed_value} {isRTL ? "ثابت" : "fixed"} | {isRTL ? "الضريبة" : "VAT"}: {method.vat_fee}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">{isRTL ? "الكوينز" : "Coins"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "السعر بالدولار" : "Price USD"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "السعر بالريال" : "SAR Price"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "عمولة الدفع" : "Payment Commission"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "القيمة الثابتة" : "Fixed Value"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "الضريبة" : "VAT"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "استرداد نقدي" : "Cash Back"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "التكلفة بالريال" : "Cost SAR"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "التكلفة بالدولار" : "Cost USD"}</TableHead>
                          <TableHead className="text-right font-bold">{isRTL ? "الصافي" : "Net"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => (
                          <TableRow key={r.coins} className={r.net < 0 ? "bg-destructive/10" : ""}>
                            <TableCell className="text-right font-medium">{r.coins.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.priceUsd, 6)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.sarPrice, 4)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.paymentCommission, 4)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.fixedValue)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.vat, 6)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.cashBack, 6)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.costSar, 4)}</TableCell>
                            <TableCell className="text-right">{fmtNum(r.costUsd, 6)}</TableCell>
                            <TableCell className={`text-right font-bold ${r.net < 0 ? "text-destructive" : r.net > 0 ? "text-green-600" : ""}`}>
                              {fmtNum(r.net)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PricingScenario;
