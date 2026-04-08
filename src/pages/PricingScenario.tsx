import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calculator, Download, ArrowRight, FileSpreadsheet, Printer, Save, FolderOpen, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { getPrintLogoUrl } from "@/lib/printLogo";

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

interface SavedScenario {
  id: string;
  description: string;
  inputs: ScenarioInputs;
  selected_payment_method_ids: string[];
  created_by_name: string | null;
  created_at: string;
}

const DEFAULT_COINS_TIERS = [
  1, 100, 1000, 2000, 10000, 25000,
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
  const [excludedCoins, setExcludedCoins] = useState<Set<number>>(new Set());

  // Save/Load state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchMethods = async () => {
      const { data } = await supabase
        .from("payment_methods")
        .select("id, payment_method, payment_type, gateway_fee, fixed_value, vat_fee")
        .eq("is_active", true)
        .order("payment_method");
      if (data) setPaymentMethods(data);
    };
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user.id).single();
        setCurrentUser({ id: user.id, name: profile?.user_name || user.email || "" });
      }
    };
    fetchMethods();
    fetchUser();
  }, []);

  const totalTransferCoins = inputs.amountToTransfer * inputs.cost1UsdCoins;
  const amountTransferSAR = inputs.amountToTransfer * inputs.rate;

  const selectedMethods = useMemo(
    () => paymentMethods.filter((m) => selectedMethodIds.includes(m.id)),
    [paymentMethods, selectedMethodIds]
  );

  useEffect(() => {
    if (!showResults || selectedMethods.length === 0) return;
    const firstMethod = selectedMethods[0];
    const avgProfit = getAvgProfitPercent(calculateForMethod(firstMethod), excludedCoins);
    const roundedAvgProfit = parseFloat(avgProfit.toFixed(2));
    setInputs((prev) =>
      prev.profitPercentage === roundedAvgProfit ? prev : { ...prev, profitPercentage: roundedAvgProfit }
    );
  }, [showResults, selectedMethods, inputs.sales1UsdCoins, inputs.cost1UsdCoins, inputs.rate, inputs.cashBackPercent, excludedCoins]);

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

  const getAvgProfitPercent = (results: ResultRow[], excluded: Set<number> = new Set()): number => {
    const validRows = results.filter((r) => r.sarPrice > 0 && !excluded.has(r.coins));
    if (validRows.length === 0) return 0;
    const totalPercent = validRows.reduce((sum, r) => sum + (r.net / r.sarPrice) * 100, 0);
    return totalPercent / validRows.length;
  };

  const toggleMethod = (id: string) => {
    setSelectedMethodIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setShowResults(false);
  };

  const updateInput = (field: keyof ScenarioInputs, value: string | number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
    setShowResults(false);
  };

  const fmtNum = (v: number, decimals = 2) =>
    v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // ========== Export CSV ==========
  const exportToCSV = () => {
    if (selectedMethods.length === 0) return;
    const headers = ["Payment Brand", "Coins", "Price USD", "SAR Price", "Payment Commission", "Fixed Value", "VAT", "Cash Back", "Net", "Profit %", "Cost SAR", "Cost USD"];
    const rows: string[] = [headers.join(",")];
    selectedMethods.forEach((method) => {
      calculateForMethod(method).forEach((r) => {
        const profitPct = r.sarPrice > 0 ? (r.net / r.sarPrice) * 100 : 0;
        rows.push([method.payment_method, r.coins, r.priceUsd.toFixed(6), r.sarPrice.toFixed(4), r.paymentCommission.toFixed(4), r.fixedValue, r.vat.toFixed(6), r.cashBack.toFixed(6), r.net.toFixed(2), profitPct.toFixed(2), r.costSar.toFixed(4), r.costUsd.toFixed(6)].join(","));
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = `pricing-scenario-${inputs.brandName || "brand"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  // ========== Export Excel ==========
  const exportToExcel = async () => {
    if (selectedMethods.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    selectedMethods.forEach((method) => {
      const results = calculateForMethod(method);
      const avgProfit = getAvgProfitPercent(results);
      const wsData = [
        ["Brand", inputs.brandName, "", "Avg Profit %", avgProfit.toFixed(4)],
        ["Fee", `${method.gateway_fee}% + ${method.fixed_value}`, "VAT", `${method.vat_fee}%`],
        [],
        ["Coins", "Price USD", "SAR Price", "Payment Commission", "Fixed Value", "VAT", "Cash Back", "Cost SAR", "Cost USD", "Net", "Profit %"],
        ...results.map((r) => { const pp = r.sarPrice > 0 ? (r.net / r.sarPrice) * 100 : 0; return [r.coins, r.priceUsd, r.sarPrice, r.paymentCommission, r.fixedValue, r.vat, r.cashBack, r.costSar, r.costUsd, r.net, parseFloat(pp.toFixed(2))]; }),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const sheetName = method.payment_method.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
    XLSX.writeFile(wb, `pricing-scenario-${inputs.brandName || "brand"}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  // ========== Print PDF ==========
  const printPDF = () => {
    if (selectedMethods.length === 0) return;
    const logoUrl = getPrintLogoUrl();
    const today = format(new Date(), "yyyy-MM-dd");

    let tablesHTML = "";
    selectedMethods.forEach((method) => {
      const results = calculateForMethod(method);
      const avgProfit = getAvgProfitPercent(results);
      tablesHTML += `
        <div style="page-break-inside:avoid;margin-bottom:30px;">
          <h2 style="margin:0 0 4px;font-size:16px;">${method.payment_method}${inputs.brandName ? ` — ${inputs.brandName}` : ""}</h2>
          <p style="margin:0 0 8px;color:#666;font-size:12px;">Fee: ${method.gateway_fee}% + ${method.fixed_value} fixed | VAT: ${method.vat_fee}% | Avg Profit: <strong style="color:${avgProfit >= 0 ? "green" : "red"}">${avgProfit.toFixed(4)}%</strong></p>
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
              <tr style="background:#1a1a2e;color:#fff;">
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Coins</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Price USD</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">SAR Price</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Commission</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Fixed Value</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">VAT</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Cash Back</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Cost SAR</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Cost USD</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Net</th>
                <th style="padding:4px 6px;text-align:right;border:1px solid #333;">Profit %</th>
              </tr>
            </thead>
            <tbody>
              ${results.map((r, i) => { const pp = r.sarPrice > 0 ? (r.net / r.sarPrice) * 100 : 0; return `
                <tr style="background:${r.net < 0 ? "#ffe0e0" : i % 2 === 0 ? "#f9f9f9" : "#fff"};">
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;font-weight:bold;">${r.coins.toLocaleString()}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.priceUsd.toFixed(6)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.sarPrice.toFixed(4)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.paymentCommission.toFixed(4)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.fixedValue.toFixed(2)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.vat.toFixed(6)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.cashBack.toFixed(6)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.costSar.toFixed(4)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;">${r.costUsd.toFixed(6)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;font-weight:bold;color:${r.net < 0 ? "red" : r.net > 0 ? "green" : "black"};">${r.net.toFixed(2)}</td>
                  <td style="padding:3px 6px;text-align:right;border:1px solid #ddd;font-weight:bold;color:${pp < 0 ? "red" : pp > 0 ? "green" : "black"};">${pp.toFixed(2)}%</td>
                </tr>
              `; }).join("")}
            </tbody>
          </table>
        </div>
      `;
    });

    const summaryHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Brand Name</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.brandName}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Exchange Rate</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.rate}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Cost 1USD = Coins</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.cost1UsdCoins}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Sales 1USD = Coins</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.sales1UsdCoins}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Cash Back %</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.cashBackPercent}%</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Profit %</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.profitPercentage}%</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Amount To Transfer (USD)</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.amountToTransfer}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Amount Transfer SAR</td><td style="padding:4px 8px;border:1px solid #ddd;">${fmtNum(amountTransferSAR)}</td></tr>
      </table>
    `;

    const signatureHTML = `
      <div style="margin-top:60px;display:flex;justify-content:space-between;padding:0 40px;">
        <div style="text-align:center;min-width:200px;">
          <div style="border-top:1px solid #333;padding-top:8px;font-size:12px;font-weight:bold;">Accounting Signature</div>
          <p style="font-size:11px;color:#666;margin:4px 0 0;">Name: ___________________</p>
          <p style="font-size:11px;color:#666;margin:4px 0 0;">Date: ___________________</p>
        </div>
        <div style="text-align:center;min-width:200px;">
          <div style="border-top:1px solid #333;padding-top:8px;font-size:12px;font-weight:bold;">Managing Director Signature</div>
          <p style="font-size:11px;color:#666;margin:4px 0 0;">Name: ___________________</p>
          <p style="font-size:11px;color:#666;margin:4px 0 0;">Date: ___________________</p>
        </div>
      </div>
    `;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head>
        <title>Pricing Scenario - ${inputs.brandName || "Brand"}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: Arial, sans-serif; color: #333; }
          @media print { .no-print { display: none; } }
        </style>
      </head><body>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:2px solid #1a1a2e;padding-bottom:10px;">
          <img src="${logoUrl}" style="height:50px;" />
          <div style="text-align:right;">
            <h1 style="margin:0;font-size:20px;color:#1a1a2e;">Pricing Scenario Report</h1>
            <p style="margin:2px 0 0;font-size:11px;color:#666;">Date: ${today} | Prepared by: ${currentUser?.name || ""}</p>
          </div>
        </div>
        ${summaryHTML}
        ${tablesHTML}
        ${signatureHTML}
        <script>window.onload=function(){window.print();}</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  // ========== Save Scenario ==========
  const saveScenario = async () => {
    if (!scenarioDescription.trim()) {
      toast.error(isRTL ? "يرجى إدخال وصف" : "Please enter a description");
      return;
    }
    if (!currentUser) {
      toast.error(isRTL ? "يجب تسجيل الدخول" : "Must be logged in");
      return;
    }
    const { error } = await supabase.from("pricing_scenarios").insert({
      description: scenarioDescription.trim(),
      inputs: inputs as any,
      selected_payment_method_ids: selectedMethodIds,
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isRTL ? "تم حفظ السيناريو" : "Scenario saved successfully");
      setSaveDialogOpen(false);
      setScenarioDescription("");
    }
  };

  // ========== Load Scenarios ==========
  const loadScenarios = async () => {
    const { data } = await supabase
      .from("pricing_scenarios")
      .select("id, description, inputs, selected_payment_method_ids, created_by_name, created_at")
      .order("created_at", { ascending: false });
    if (data) setSavedScenarios(data as any);
    setLoadDialogOpen(true);
  };

  const applyScenario = (scenario: SavedScenario) => {
    setInputs(scenario.inputs);
    setSelectedMethodIds(scenario.selected_payment_method_ids);
    setShowResults(false);
    setLoadDialogOpen(false);
    toast.success(isRTL ? `تم تحميل: ${scenario.description}` : `Loaded: ${scenario.description}`);
  };

  const deleteScenario = async (id: string) => {
    const { error } = await supabase.from("pricing_scenarios").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {isRTL ? "سيناريو التسعير" : "Pricing Scenario"}
          </h1>
          <p className="text-muted-foreground">
            {isRTL ? "حاسبة تسعير الكوينز - أدخل البيانات واختر طرق الدفع ثم اضغط حساب" : "Coins pricing calculator - enter data, select payment methods, then click Calculate"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { setScenarioDescription(inputs.brandName ? `${inputs.brandName} Scenario` : ""); setSaveDialogOpen(true); }} className="gap-2">
            <Save className="h-4 w-4" />
            {isRTL ? "حفظ" : "Save"}
          </Button>
          <Button variant="outline" onClick={loadScenarios} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            {isRTL ? "تحميل" : "Load"}
          </Button>
        </div>
      </div>

      {/* Step 1: Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {isRTL ? "الخطوة 1: إدخال البيانات" : "Step 1: Enter Data"}
          </CardTitle>
          <CardDescription>{isRTL ? "أدخل بيانات العلامة التجارية والتسعير" : "Enter brand and pricing data"}</CardDescription>
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
            <Label className="text-base font-semibold mb-3 block">{isRTL ? "اختر طرق الدفع" : "Select Payment Methods"}</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                    selectedMethodIds.includes(method.id) ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleMethod(method.id)}
                >
                  <Checkbox checked={selectedMethodIds.includes(method.id)} onCheckedChange={() => toggleMethod(method.id)} />
                  <div className="text-sm">
                    <p className="font-medium">{method.payment_method}</p>
                    <p className="text-muted-foreground text-xs">{method.gateway_fee}% + {method.fixed_value} | VAT {method.vat_fee}%</p>
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
            <Button onClick={() => setShowResults(true)} className="gap-2" disabled={inputs.sales1UsdCoins === 0 || inputs.cost1UsdCoins === 0 || selectedMethodIds.length === 0}>
              <ArrowRight className="h-4 w-4" />
              {isRTL ? "حساب جدول الأسعار" : "Calculate Pricing Table"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Results */}
      {showResults && selectedMethods.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-2xl font-bold">{isRTL ? "الخطوة 2: جداول الأسعار" : "Step 2: Pricing Tables"}</h2>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download className="h-4 w-4" />
                {isRTL ? "تصدير CSV" : "Export CSV"}
              </Button>
              <Button variant="outline" onClick={exportToExcel} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                {isRTL ? "تصدير Excel" : "Export Excel"}
              </Button>
              <Button variant="outline" onClick={printPDF} className="gap-2">
                <Printer className="h-4 w-4" />
                {isRTL ? "طباعة PDF" : "Print PDF"}
              </Button>
            </div>
          </div>

          {selectedMethods.map((method) => {
            const results = calculateForMethod(method);
            const avgProfit = getAvgProfitPercent(results, excludedCoins);
            const toggleCoinInAvg = (coins: number) => {
              setExcludedCoins((prev) => {
                const next = new Set(prev);
                if (next.has(coins)) next.delete(coins); else next.add(coins);
                return next;
              });
            };
            return (
              <Card key={method.id}>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-3 flex-wrap">
                    {method.payment_method}
                    {inputs.brandName && <span className="text-muted-foreground text-base font-normal">— {inputs.brandName}</span>}
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${avgProfit < 0 ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-600"}`}>
                      {isRTL ? "متوسط الربح" : "Avg Profit"}: {avgProfit.toFixed(4)}%
                    </span>
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
                          <TableHead className="text-center w-[50px]">{isRTL ? "تضمين" : "Avg"}</TableHead>
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
                          <TableHead className="text-right font-bold">{isRTL ? "نسبة الربح %" : "Profit %"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => {
                          const profitPct = r.sarPrice > 0 ? (r.net / r.sarPrice) * 100 : 0;
                          const isIncluded = !excludedCoins.has(r.coins);
                          return (
                          <TableRow key={r.coins} className={`${r.net < 0 ? "bg-destructive/10" : ""} ${!isIncluded ? "opacity-50" : ""}`}>
                            <TableCell className="text-center">
                              <Checkbox checked={isIncluded} onCheckedChange={() => toggleCoinInAvg(r.coins)} />
                            </TableCell>
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
                            <TableCell className={`text-right font-bold ${profitPct < 0 ? "text-destructive" : profitPct > 0 ? "text-green-600" : ""}`}>
                              {fmtNum(profitPct)}%
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "حفظ السيناريو" : "Save Scenario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isRTL ? "وصف السيناريو" : "Scenario Description"}</Label>
              <Input
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                placeholder={isRTL ? "مثال: سيناريو بيلا 1" : "e.g. Beela Scenario 1"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={saveScenario} className="gap-2">
              <Save className="h-4 w-4" />
              {isRTL ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isRTL ? "تحميل سيناريو محفوظ" : "Load Saved Scenario"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {savedScenarios.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">{isRTL ? "لا توجد سيناريوهات محفوظة" : "No saved scenarios"}</p>
            ) : (
              savedScenarios.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors">
                  <div className="cursor-pointer flex-1" onClick={() => applyScenario(s)}>
                    <p className="font-medium">{s.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.created_by_name} • {format(new Date(s.created_at), "yyyy-MM-dd HH:mm")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteScenario(s.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingScenario;
