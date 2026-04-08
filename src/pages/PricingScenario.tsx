import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, Download, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

interface ScenarioInputs {
  brandName: string;
  cost1UsdCoins: number;
  sales1UsdCoins: number;
  profitPercentage: number;
  cashBackPercent: number;
  rate: number;
  amountToTransfer: number;
  visaPercent: number;
  fixedValue: number;
  vatPercent: number;
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
    visaPercent: 0,
    fixedValue: 0,
    vatPercent: 0,
  });

  const [showResults, setShowResults] = useState(false);

  const totalTransferCoins = inputs.amountToTransfer * inputs.cost1UsdCoins;
  const amountTransferSAR = inputs.amountToTransfer * inputs.rate;

  const results: ResultRow[] = useMemo(() => {
    if (!showResults) return [];

    const { sales1UsdCoins, cost1UsdCoins, rate, visaPercent, fixedValue, vatPercent, cashBackPercent } = inputs;
    const vatRate = vatPercent / 100;
    const visaRate = visaPercent / 100;
    const cashBackRate = cashBackPercent / 100;

    return DEFAULT_COINS_TIERS.map((coins) => {
      const priceUsd = coins / sales1UsdCoins;
      const sarPrice = priceUsd * rate;
      const costUsd = coins / cost1UsdCoins;
      const costSar = costUsd * rate;
      const paymentCommission = sarPrice * visaRate;
      const vat = (fixedValue + paymentCommission) * vatRate;
      const cashBack = cashBackRate * sarPrice;
      const net = sarPrice - costSar - paymentCommission - fixedValue - vat - cashBack;

      return { coins, priceUsd, sarPrice, paymentCommission, fixedValue, vat, cashBack, net, costSar, costUsd };
    });
  }, [showResults, inputs]);

  const updateInput = (field: keyof ScenarioInputs, value: string | number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setShowResults(false);
  };

  const fmtNum = (v: number, decimals = 2) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const exportToCSV = () => {
    if (results.length === 0) return;
    const headers = ["Coins", "Price USD", "SAR Price", "Payment Commission", "Fixed Value", "VAT", "Cash Back", "Net", "Cost SAR", "Cost USD"];
    const csv = [
      headers.join(","),
      ...results.map((r) =>
        [r.coins, r.priceUsd.toFixed(6), r.sarPrice.toFixed(4), r.paymentCommission.toFixed(4), r.fixedValue, r.vat.toFixed(6), r.cashBack.toFixed(6), r.net.toFixed(2), r.costSar.toFixed(4), r.costUsd.toFixed(6)].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
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
          {isRTL ? "حاسبة تسعير الكوينز - أدخل البيانات ثم اضغط حساب لعرض جدول الأسعار" : "Coins pricing calculator - enter data then click Calculate to view the pricing table"}
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
              <Input type="number" step="1" value={inputs.cost1UsdCoins} onChange={(e) => updateInput("cost1UsdCoins", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "المبيعات 1 دولار = كوينز" : "Sales 1USD = Coins"}</Label>
              <Input type="number" step="1" value={inputs.sales1UsdCoins} onChange={(e) => updateInput("sales1UsdCoins", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "نسبة الربح %" : "Profit Percentage %"}</Label>
              <Input type="number" step="0.01" value={inputs.profitPercentage} onChange={(e) => updateInput("profitPercentage", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "نسبة استرداد النقد %" : "Cash Back %"}</Label>
              <Input type="number" step="0.01" value={inputs.cashBackPercent} onChange={(e) => updateInput("cashBackPercent", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "سعر الصرف (Rate)" : "Exchange Rate"}</Label>
              <Input type="number" step="0.01" value={inputs.rate} onChange={(e) => updateInput("rate", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "مبلغ التحويل (دولار)" : "Amount To Transfer (USD)"}</Label>
              <Input type="number" step="1" value={inputs.amountToTransfer} onChange={(e) => updateInput("amountToTransfer", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "عمولة فيزا %" : "Visa Commission %"}</Label>
              <Input type="number" step="0.01" value={inputs.visaPercent} onChange={(e) => updateInput("visaPercent", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "القيمة الثابتة" : "Fixed Value"}</Label>
              <Input type="number" step="0.01" value={inputs.fixedValue} onChange={(e) => updateInput("fixedValue", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "ضريبة القيمة المضافة %" : "VAT %"}</Label>
              <Input type="number" step="0.01" value={inputs.vatPercent} onChange={(e) => updateInput("vatPercent", parseFloat(e.target.value) || 0)} />
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
            <Button onClick={() => setShowResults(true)} className="gap-2" disabled={inputs.sales1UsdCoins === 0 || inputs.cost1UsdCoins === 0}>
              <ArrowRight className="h-4 w-4" />
              {isRTL ? "حساب جدول الأسعار" : "Calculate Pricing Table"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Results */}
      {showResults && results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle>{isRTL ? "الخطوة 2: جدول الأسعار" : "Step 2: Pricing Table"}</CardTitle>
                <CardDescription>
                  {inputs.brandName ? `${isRTL ? "العلامة التجارية:" : "Brand:"} ${inputs.brandName}` : ""}
                </CardDescription>
              </div>
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download className="h-4 w-4" />
                {isRTL ? "تصدير CSV" : "Export CSV"}
              </Button>
            </div>
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
                    <TableRow key={r.coins} className={r.net < 0 ? "bg-destructive/10" : r.net > 0 ? "" : "bg-muted/30"}>
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
      )}
    </div>
  );
};

export default PricingScenario;
