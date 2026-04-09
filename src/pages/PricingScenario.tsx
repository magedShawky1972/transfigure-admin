import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calculator, Download, ArrowRight, FileSpreadsheet, Printer, Save, FolderOpen, Trash2, RotateCcw, CheckCircle, Star, ChevronsUpDown, Check, PackagePlus, Loader2, Plus, RefreshCw } from "lucide-react";
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
  transactionRate: number;
  amountToTransfer: number;
  numberOfTransactions: number;
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
  excluded_coins: number[] | null;
  created_by_name: string | null;
  created_at: string;
  is_active: boolean;
  brand_id: string | null;
}

interface Brand {
  id: string;
  brand_name: string;
  brand_code: string | null;
  sku_start_with: string | null;
  brand_type: { type_name: string } | null;
}

const DEFAULT_COINS_TIERS = [
  1, 100, 1000, 2000, 5000, 10000, 25000,
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
    transactionRate: 0,
    amountToTransfer: 0,
    numberOfTransactions: 1,
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodIds, setSelectedMethodIds] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [excludedCoins, setExcludedCoins] = useState<Set<number>>(new Set());
  const [customCoinsTiers, setCustomCoinsTiers] = useState<number[]>([]);
  const [savedCoinsTiers, setSavedCoinsTiers] = useState<number[]>(DEFAULT_COINS_TIERS);
  const [addCoinDialogOpen, setAddCoinDialogOpen] = useState(false);
  const [newCoinValue, setNewCoinValue] = useState("");
  const [generatingProducts, setGeneratingProducts] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [updatePriceDialogOpen, setUpdatePriceDialogOpen] = useState(false);
  const [updatePriceStatus, setUpdatePriceStatus] = useState<{ current: number; total: number; currentCoins: number; updated: number; skipped: number; error: string | null; done: boolean }>({ current: 0, total: 0, currentCoins: 0, updated: 0, skipped: 0, error: null, done: false });
  // Save/Load state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [saveMode, setSaveMode] = useState<"new" | "overwrite" | "version" | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [isCurrentActive, setIsCurrentActive] = useState(false);

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
    const fetchBrands = async () => {
      const { data } = await supabase
        .from("brands")
        .select("id, brand_name, brand_code, sku_start_with, brand_type:brand_type(type_name)")
        .eq("status", "active")
        .eq("abc_analysis", "A")
        .order("brand_name");
      if (data) setBrands(data);
    };
    fetchMethods();
    fetchUser();
    fetchBrands();
  }, []);

  const txRate = inputs.transactionRate || inputs.rate;
  const totalTransferCoins = inputs.amountToTransfer * inputs.cost1UsdCoins;
  const amountTransferSAR = inputs.amountToTransfer * txRate;

  // Helper to calculate transfer profit with a given cost rate
  const calcTransferProfit = (costRate: number) => {
    const { numberOfTransactions, sales1UsdCoins, cost1UsdCoins, cashBackPercent } = inputs;
    if (numberOfTransactions <= 0 || totalTransferCoins <= 0 || sales1UsdCoins <= 0 || cost1UsdCoins <= 0) return 0;
    const madaMethod = paymentMethods.find(m => m.payment_method.toLowerCase().includes("mada"));
    const gatewayRate = madaMethod ? madaMethod.gateway_fee / 100 : 0.008;
    const fixedVal = madaMethod ? madaMethod.fixed_value : 1;
    const vatRate = madaMethod ? madaMethod.vat_fee / 100 : 0.15;
    const cashBackRate = (cashBackPercent || 0) / 100;
    const coinsPerTx = totalTransferCoins / numberOfTransactions;
    const sarPricePerCoin = (1 / sales1UsdCoins) * inputs.rate;
    const costSarPerCoin = (1 / cost1UsdCoins) * costRate;
    const revenuePerTx = coinsPerTx * sarPricePerCoin;
    const costPerTx = coinsPerTx * costSarPerCoin;
    const commissionPerTx = revenuePerTx * gatewayRate;
    const vatPerTx = (fixedVal + commissionPerTx) * vatRate;
    const cashBackPerTx = revenuePerTx * cashBackRate;
    const profitPerTx = revenuePerTx - costPerTx - commissionPerTx - fixedVal - vatPerTx - cashBackPerTx;
    return profitPerTx * numberOfTransactions;
  };

  // Transfer Profit using Pricing Rate only (does NOT change with Transaction Rate)
  const totalTransferProfit = useMemo(() => {
    return calcTransferProfit(inputs.rate);
  }, [inputs, totalTransferCoins, paymentMethods]);

  // Transfer Profit using Transaction Rate (changes with Transaction Rate)
  const totalTransferProfitByTxRate = useMemo(() => {
    return calcTransferProfit(txRate);
  }, [inputs, totalTransferCoins, paymentMethods, txRate]);

  const totalTransferProfitPercent = useMemo(() => {
    const amountByPricingRate = inputs.amountToTransfer * inputs.rate;
    if (amountByPricingRate <= 0) return 0;
    return (totalTransferProfit / amountByPricingRate) * 100;
  }, [totalTransferProfit, inputs.amountToTransfer, inputs.rate]);

  const totalTransferProfitPercentByTxRate = useMemo(() => {
    if (amountTransferSAR <= 0) return 0;
    return (totalTransferProfitByTxRate / amountTransferSAR) * 100;
  }, [totalTransferProfitByTxRate, amountTransferSAR]);

  const allCoinsTiers = useMemo(() => {
    const merged = savedCoinsTiers.length > 0 ? savedCoinsTiers : [...DEFAULT_COINS_TIERS, ...customCoinsTiers];
    return [...new Set(merged)].sort((a, b) => a - b);
  }, [savedCoinsTiers, customCoinsTiers]);

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

    return allCoinsTiers.map((coins) => {
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
             <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Pricing Exchange Rate</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.rate}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Transaction Exchange Rate</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.transactionRate}</td>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Cost 1USD = Coins</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.cost1UsdCoins}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Sales 1USD = Coins</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.sales1UsdCoins}</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Cash Back %</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.cashBackPercent}%</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Profit %</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.profitPercentage}%</td></tr>
        <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Amount To Transfer (USD)</td><td style="padding:4px 8px;border:1px solid #ddd;">${inputs.amountToTransfer}</td>
            <td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Total Purchase Amount</td><td style="padding:4px 8px;border:1px solid #ddd;">${fmtNum(amountTransferSAR)}</td></tr>
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
  const saveScenario = async (mode: "new" | "overwrite" | "version") => {
    if ((mode === "new" || mode === "version") && !scenarioDescription.trim()) {
      toast.error(isRTL ? "يرجى إدخال وصف" : "Please enter a description");
      return;
    }
    if (!currentUser) {
      toast.error(isRTL ? "يجب تسجيل الدخول" : "Must be logged in");
      return;
    }

    const normalizedExcludedCoins = [...new Set(Array.from(excludedCoins)
      .map((coin) => Number(coin))
      .filter((coin) => Number.isFinite(coin)))].sort((a, b) => a - b);
    const savedCoinsTiers = [...allCoinsTiers].sort((a, b) => a - b);
    const coinSelectionState = Object.fromEntries(
      savedCoinsTiers.map((coin) => [String(coin), !normalizedExcludedCoins.includes(coin)])
    );
    const scenarioInputs = {
      ...inputs,
      excludedCoins: normalizedExcludedCoins,
      customCoinsTiers,
      savedCoinsTiers,
      coinSelectionState,
    };

    if (mode === "overwrite" && currentScenarioId) {
      const { data, error } = await supabase.from("pricing_scenarios").update({
        inputs: scenarioInputs as any,
        selected_payment_method_ids: selectedMethodIds,
        excluded_coins: normalizedExcludedCoins,
        brand_id: selectedBrandId || null,
        updated_at: new Date().toISOString(),
      } as any).eq("id", currentScenarioId).select("id, created_at, created_by_name, is_active");
      if (error) {
        toast.error(error.message);
      } else if (!data || data.length === 0) {
        toast.error(isRTL ? "لا يمكن تحديث هذا السيناريو. استخدم New Version أو New Scenario إذا لم تكن المالك." : "You cannot overwrite this scenario. Use New Version or New Scenario if you are not the owner.");
      } else {
        const updatedRow = data[0] as any;
        setSavedScenarios((prev) => prev.map((scenario) =>
          scenario.id === currentScenarioId
            ? {
                ...scenario,
                inputs: scenarioInputs as any,
                selected_payment_method_ids: selectedMethodIds,
                excluded_coins: normalizedExcludedCoins,
                brand_id: selectedBrandId || null,
                created_at: updatedRow.created_at ?? scenario.created_at,
                created_by_name: updatedRow.created_by_name ?? scenario.created_by_name,
                is_active: updatedRow.is_active ?? scenario.is_active,
              }
            : scenario
        ));
        toast.success(isRTL ? "تم تحديث السيناريو" : "Scenario updated successfully");
        setSaveDialogOpen(false);
      }
    } else {
      const { data: inserted, error } = await supabase.from("pricing_scenarios").insert({
        description: scenarioDescription.trim(),
        inputs: scenarioInputs as any,
        selected_payment_method_ids: selectedMethodIds,
        excluded_coins: normalizedExcludedCoins,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
        brand_id: selectedBrandId || null,
      } as any).select("id, created_at, created_by_name, is_active").single();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(isRTL ? "تم حفظ السيناريو" : "Scenario saved successfully");
        if (inserted) {
          setCurrentScenarioId(inserted.id);
          setSavedScenarios((prev) => [{
            id: inserted.id,
            description: scenarioDescription.trim(),
            inputs: scenarioInputs as any,
            selected_payment_method_ids: selectedMethodIds,
            excluded_coins: normalizedExcludedCoins,
            created_by_name: inserted.created_by_name ?? currentUser.name,
            created_at: inserted.created_at ?? new Date().toISOString(),
            is_active: inserted.is_active ?? false,
            brand_id: selectedBrandId || null,
          } as any, ...prev]);
        }
        setSaveDialogOpen(false);
        setScenarioDescription("");
      }
    }
  };

  // ========== Confirm as Active ==========
  const confirmAsActive = async () => {
    if (!currentScenarioId) {
      toast.error(isRTL ? "يرجى حفظ أو تحميل سيناريو أولاً" : "Please save or load a scenario first");
      return;
    }
    // Deactivate all scenarios first
    await supabase.from("pricing_scenarios").update({ is_active: false } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    // Set current as active
    const { error } = await supabase.from("pricing_scenarios").update({ is_active: true } as any).eq("id", currentScenarioId);
    if (error) {
      toast.error(error.message);
    } else {
      setIsCurrentActive(true);
      toast.success(isRTL ? "تم تعيين السيناريو كنشط" : "Scenario confirmed as active");
    }
  };

  // ========== Load Scenarios ==========
  const loadScenarios = async () => {
    const { data } = await supabase
      .from("pricing_scenarios")
      .select("id, description, inputs, selected_payment_method_ids, excluded_coins, created_by_name, created_at, is_active, brand_id")
      .order("created_at", { ascending: false });
    if (data) setSavedScenarios(data as any);
    setLoadDialogOpen(true);
  };

  const applyScenario = (scenario: SavedScenario) => {
    const savedCustomTiers = Array.isArray((scenario.inputs as any)?.customCoinsTiers)
      ? (scenario.inputs as any).customCoinsTiers.map(Number).filter(Number.isFinite)
      : [];
    const savedCoinsTiers = Array.isArray((scenario.inputs as any)?.savedCoinsTiers)
      ? (scenario.inputs as any).savedCoinsTiers.map(Number).filter(Number.isFinite)
      : [...new Set([...DEFAULT_COINS_TIERS, ...savedCustomTiers])];
    const selectionState = (scenario.inputs as any)?.coinSelectionState;
    const excludedFromSelectionState = selectionState && typeof selectionState === "object"
      ? savedCoinsTiers.filter((coin) => selectionState[String(coin)] === false)
      : [];
    const excludedFromInputs = Array.isArray((scenario.inputs as any)?.excludedCoins)
      ? (scenario.inputs as any).excludedCoins
      : [];
    const normalizedExcludedCoins: number[] = [...new Set<number>(
      (excludedFromSelectionState.length ? excludedFromSelectionState : (scenario.excluded_coins?.length ? scenario.excluded_coins : excludedFromInputs))
        .map((coin: unknown) => Number(coin))
        .filter((coin: number) => Number.isFinite(coin))
    )].sort((a: number, b: number) => a - b);

    const restoredCustomTiers = savedCoinsTiers.filter((coin) => !DEFAULT_COINS_TIERS.includes(coin));

    setInputs(scenario.inputs);
    setSelectedMethodIds(scenario.selected_payment_method_ids);
    setSavedCoinsTiers([...savedCoinsTiers].sort((a, b) => a - b));
    setCustomCoinsTiers(restoredCustomTiers);
    setExcludedCoins(new Set(normalizedExcludedCoins));
    setSelectedBrandId(scenario.brand_id || "");
    setCurrentScenarioId(scenario.id);
    setIsCurrentActive(scenario.is_active);
    setShowResults((scenario.selected_payment_method_ids?.length || 0) > 0);
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

  // ========== Generate Products & SKU ==========
  const generateProducts = async () => {
    if (selectedMethods.length === 0 || !selectedBrandId || !inputs.brandName) {
      toast.error(isRTL ? "يرجى اختيار علامة تجارية وطريقة دفع" : "Please select a brand and payment method");
      return;
    }

    const brand = brands.find(b => b.id === selectedBrandId);
    const skuPrefix = brand?.sku_start_with;
    if (!skuPrefix) {
      toast.error(isRTL ? "لا يوجد بادئة SKU لهذا البراند" : "No SKU prefix found for this brand");
      return;
    }

    setGeneratingProducts(true);
    try {
      const method = selectedMethods[0];
      const results = calculateForMethod(method);
      const filteredResults = results.filter(r => !excludedCoins.has(r.coins) && r.coins > 0);

      // Get max existing sequence for this prefix
      const { data: existingProducts } = await supabase
        .from("products")
        .select("sku")
        .like("sku", `${skuPrefix}-%`);

      const existingNums = (existingProducts || [])
        .map(p => {
          const match = p.sku?.match(new RegExp(`^${skuPrefix}-(\\d+)$`));
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(Boolean);

      let nextSeq = Math.max(0, ...existingNums) + 1;

      // Check which products already exist by brand_code + coins_number
      const brandCode = brand?.brand_code || "";
      const { data: existingByBrand } = await supabase
        .from("products")
        .select("coins_number")
        .eq("brand_code", brandCode);
      const existingCoinsSet = new Set((existingByBrand || []).map(p => p.coins_number).filter(Boolean));

      const newProducts = filteredResults
        .filter(r => !existingCoinsSet.has(r.coins))
        .map(r => {
          const sku = `${skuPrefix}-${String(nextSeq).padStart(4, "0")}`;
          nextSeq++;
          return {
            product_name: `كوينز ${r.coins.toLocaleString()} ${inputs.brandName}`,
            product_id: `كوينز ${r.coins.toLocaleString()} ${inputs.brandName}`,
            product_price: r.sarPrice.toFixed(4),
            product_cost: r.costSar.toFixed(4),
            sku,
            brand_name: inputs.brandName,
            brand_code: brandCode || null,
            coins_number: r.coins,
            brand_type: brand?.brand_type?.type_name || null,
            status: "active",
            creation_source: "manual",
          };
        });

      if (newProducts.length === 0) {
        toast.info(isRTL ? "جميع المنتجات موجودة بالفعل" : "All products already exist");
        setGeneratingProducts(false);
        return;
      }

      const { error } = await supabase.from("products").insert(newProducts);
      if (error) throw error;

      toast.success(
        isRTL
          ? `تم إنشاء ${newProducts.length} منتج بنجاح`
          : `${newProducts.length} products created successfully`
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setGeneratingProducts(false);
    }
  };

  // ========== Update Product Prices ==========
  const updateProductPrices = async () => {
    if (selectedMethods.length === 0 || !selectedBrandId || !inputs.brandName) {
      toast.error(isRTL ? "يرجى اختيار علامة تجارية وطريقة دفع" : "Please select a brand and payment method");
      return;
    }
    const brand = brands.find(b => b.id === selectedBrandId);
    const brandCode = brand?.brand_code || "";
    if (!brandCode) {
      toast.error(isRTL ? "لا يوجد كود براند" : "No brand code found");
      return;
    }

    setUpdatingPrices(true);
    try {
      const method = selectedMethods[0];
      const results = calculateForMethod(method);
      const filteredResults = results.filter(r => !excludedCoins.has(r.coins) && r.coins > 0);

      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of filteredResults) {
        const { data: existing } = await supabase
          .from("products")
          .select("id, product_price, product_cost")
          .eq("brand_code", brandCode)
          .eq("coins_number", row.coins);

        if (!existing || existing.length === 0) {
          skippedCount++;
          continue;
        }

        for (const product of existing) {
          const newPrice = row.sarPrice.toFixed(4);
          const newCost = row.costSar.toFixed(4);
          if (product.product_price === newPrice && product.product_cost === newCost) {
            skippedCount++;
            continue;
          }
          const { error } = await supabase
            .from("products")
            .update({ product_price: newPrice, product_cost: newCost })
            .eq("id", product.id);
          if (error) throw error;
          updatedCount++;
        }
      }

      toast.success(
        isRTL
          ? `تم تحديث ${updatedCount} منتج، تم تخطي ${skippedCount}`
          : `${updatedCount} products updated, ${skippedCount} skipped`
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdatingPrices(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">
              {isRTL ? "سيناريو التسعير" : "Pricing Scenario"}
            </h1>
            {isCurrentActive && currentScenarioId && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300 border border-green-300 dark:border-green-600">
                <CheckCircle className="h-4 w-4" />
                {isRTL ? "مؤكد - نشط" : "Confirmed - Active"}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {isRTL ? "حاسبة تسعير الكوينز - أدخل البيانات واختر طرق الدفع ثم اضغط حساب" : "Coins pricing calculator - enter data, select payment methods, then click Calculate"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => {
            setScenarioDescription(inputs.brandName ? `${inputs.brandName} Scenario` : "");
            setSaveMode(currentScenarioId ? null : "new");
            setSaveDialogOpen(true);
          }} className="gap-2">
            <Save className="h-4 w-4" />
            {isRTL ? "حفظ" : "Save"}
          </Button>
          <Button variant="outline" onClick={loadScenarios} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            {isRTL ? "تحميل" : "Load"}
          </Button>
          <Button variant="default" onClick={confirmAsActive} disabled={!currentScenarioId} className="gap-2 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4" />
            {isRTL ? "تأكيد كنشط" : "Confirm Active"}
          </Button>
          <Button variant="destructive" onClick={() => { setInputs({ brandName: "", cost1UsdCoins: 0, sales1UsdCoins: 0, profitPercentage: 0, cashBackPercent: 0, rate: 0, transactionRate: 0, amountToTransfer: 0, numberOfTransactions: 1 }); setSelectedMethodIds([]); setShowResults(false); setExcludedCoins(new Set()); setCustomCoinsTiers([]); setSavedCoinsTiers(DEFAULT_COINS_TIERS); setSelectedBrandId(""); setCurrentScenarioId(null); setIsCurrentActive(false); }} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {isRTL ? "إعادة تعيين" : "Restart"}
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
              <Label>
                {isRTL ? "اسم العلامة التجارية" : "Brand Name"}
                {selectedBrandId && (() => {
                  const brand = brands.find(b => b.id === selectedBrandId);
                  return (
                    <span className="ml-2 inline-flex gap-1">
                      {brand?.brand_code && (
                        <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{brand.brand_code}</span>
                      )}
                      {brand?.sku_start_with && (
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{brand.sku_start_with}</span>
                      )}
                    </span>
                  );
                })()}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedBrandId ? brands.find(b => b.id === selectedBrandId)?.brand_name : (isRTL ? "اختر العلامة التجارية" : "Select brand")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={isRTL ? "ابحث عن علامة تجارية..." : "Search brand..."} />
                    <CommandList>
                      <CommandEmpty>{isRTL ? "لا توجد نتائج" : "No brand found"}</CommandEmpty>
                      <CommandGroup>
                        {brands.map((b) => (
                          <CommandItem key={b.id} value={b.brand_name} onSelect={() => {
                            setSelectedBrandId(b.id);
                            updateInput("brandName", b.brand_name);
                          }}>
                            <Check className={`mr-2 h-4 w-4 ${selectedBrandId === b.id ? "opacity-100" : "opacity-0"}`} />
                            {b.brand_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <Label>{isRTL ? "سعر صرف التسعير" : "Pricing Exchange Rate"}</Label>
              <Input type="number" step="0.01" value={inputs.rate || ""} onChange={(e) => updateInput("rate", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "سعر صرف المعاملة" : "Transaction Exchange Rate"}</Label>
              <Input type="number" step="0.01" value={inputs.transactionRate || ""} onChange={(e) => updateInput("transactionRate", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "مبلغ التحويل (دولار)" : "Amount To Transfer (USD)"}</Label>
              <Input type="number" step="1" value={inputs.amountToTransfer || ""} onChange={(e) => updateInput("amountToTransfer", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "عدد المعاملات المتوقعة" : "Number of Transactions Expected"}</Label>
              <Input type="number" step="1" min="1" value={inputs.numberOfTransactions || ""} onChange={(e) => updateInput("numberOfTransactions", parseInt(e.target.value) || 1)} />
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
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">{isRTL ? "أجمالي مبلغ الشراء" : "Total Purchase Amount"}</p>
              <p className="text-lg font-bold">{fmtNum(amountTransferSAR)}</p>
            </div>
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي الكوينز المحولة" : "Total Transfer Coins"}</p>
              <p className="text-lg font-bold">{fmtNum(totalTransferCoins, 0)}</p>
            </div>
            <div className="p-3 rounded-md bg-muted">
              <p className="text-sm text-muted-foreground">{isRTL ? "كوينز لكل معاملة" : "Coins Per Transaction"}</p>
              <p className="text-lg font-bold">{inputs.numberOfTransactions > 0 ? fmtNum(totalTransferCoins / inputs.numberOfTransactions, 0) : "—"}</p>
            </div>
            <div className={`p-3 rounded-md ${totalTransferProfit >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي ربح التحويل" : "Total Transfer Profit"}</p>
              <p className={`text-lg font-bold ${totalTransferProfit >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{fmtNum(totalTransferProfit)} SAR</p>
            </div>
            <div className={`p-3 rounded-md ${totalTransferProfitPercent >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <p className="text-sm text-muted-foreground">{isRTL ? "نسبة ربح التحويل %" : "Transfer Profit %"}</p>
              <p className={`text-lg font-bold ${totalTransferProfitPercent >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{fmtNum(totalTransferProfitPercent, 2)}%</p>
            </div>
            <div className={`p-3 rounded-md ${totalTransferProfitByTxRate >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"} border border-green-300 dark:border-green-700`}>
              <p className="text-sm text-muted-foreground">{isRTL ? "إجمالي ربح التحويل (سعر المعاملة)" : "Transfer Profit (Tx Rate)"}</p>
              <p className={`text-lg font-bold ${totalTransferProfitByTxRate >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{fmtNum(totalTransferProfitByTxRate)} SAR</p>
            </div>
            <div className={`p-3 rounded-md ${totalTransferProfitPercentByTxRate >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"} border border-green-300 dark:border-green-700`}>
              <p className="text-sm text-muted-foreground">{isRTL ? "نسبة ربح التحويل بسعر المعاملة %" : "Transfer Profit By Tx Rate %"}</p>
              <p className={`text-lg font-bold ${totalTransferProfitPercentByTxRate >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{fmtNum(totalTransferProfitPercentByTxRate, 2)}%</p>
            </div>
            <div className="p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700">
              <p className="text-sm text-muted-foreground">{isRTL ? "متوسط سعر 1 كوين (MADA)" : "Avg Price for 1 Coin (MADA)"}</p>
              <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
                {(() => {
                  const madaMethod = paymentMethods.find(m => m.payment_method.toLowerCase().includes("mada"));
                  if (!madaMethod || inputs.sales1UsdCoins <= 0 || inputs.rate <= 0) return "—";
                  const results = calculateForMethod(madaMethod);
                  const validRows = results.filter(r => r.coins > 0 && !excludedCoins.has(r.coins));
                  if (validRows.length === 0) return "—";
                  const avgPricePerCoin = validRows.reduce((sum, r) => sum + (r.sarPrice / r.coins), 0) / validRows.length;
                  return fmtNum(avgPricePerCoin, 6) + " SAR";
                })()}
              </p>
            </div>
            <div className="p-3 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700">
              <p className="text-sm text-muted-foreground">{isRTL ? "متوسط تكلفة 1 كوين (MADA)" : "Avg Cost for 1 Coin (MADA)"}</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {(() => {
                  const madaMethod = paymentMethods.find(m => m.payment_method.toLowerCase().includes("mada"));
                  if (!madaMethod || inputs.cost1UsdCoins <= 0 || inputs.rate <= 0) return "—";
                  const results = calculateForMethod(madaMethod);
                  const validRows = results.filter(r => r.coins > 0 && !excludedCoins.has(r.coins));
                  if (validRows.length === 0) return "—";
                  const avgCostPerCoin = validRows.reduce((sum, r) => sum + (r.costSar / r.coins), 0) / validRows.length;
                  return fmtNum(avgCostPerCoin, 6) + " SAR";
                })()}
              </p>
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
              <Button variant="outline" onClick={() => setAddCoinDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {isRTL ? "إضافة فئة كوينز" : "Add Coin Category"}
              </Button>
              <Button variant="default" onClick={generateProducts} disabled={generatingProducts || !selectedBrandId} className="gap-2">
                {generatingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                {isRTL ? "إنشاء المنتجات و SKU" : "Generate Products & SKU"}
              </Button>
              <Button variant="secondary" onClick={updateProductPrices} disabled={updatingPrices || !selectedBrandId} className="gap-2">
                {updatingPrices ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isRTL ? "تحديث أسعار المنتجات" : "Update Product Prices"}
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
                    <span className="text-sm font-semibold px-2 py-1 rounded bg-muted text-muted-foreground">
                      {isRTL ? "عدد الفئات" : "Categories"}: {results.filter(r => !excludedCoins.has(r.coins)).length} / {results.length}
                    </span>
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
                          <TableHead className="text-center w-[40px]"></TableHead>
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
                            <TableCell className="text-center">
                              <button
                                onClick={() => {
                                  setSavedCoinsTiers((prev) => prev.filter((coin) => coin !== r.coins));
                                  setCustomCoinsTiers((prev) => prev.filter((t) => t !== r.coins));
                                  setExcludedCoins((prev) => {
                                    const next = new Set(prev);
                                    next.delete(r.coins);
                                    return next;
                                  });
                                }}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title={isRTL ? "حذف الفئة" : "Remove category"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
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
          {currentScenarioId && saveMode === null ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {isRTL ? "هذا السيناريو محمّل مسبقاً. كيف تريد الحفظ؟" : "This scenario is already loaded. How would you like to save?"}
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => setSaveMode("overwrite")}>
                  <Save className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">{isRTL ? "الكتابة فوق الحالي" : "Overwrite Current"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "تحديث السيناريو الحالي بالتغييرات الجديدة" : "Update the current scenario with new changes"}</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => { setSaveMode("version"); setScenarioDescription(inputs.brandName ? `${inputs.brandName} Scenario v2` : ""); }}>
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">{isRTL ? "إنشاء نسخة جديدة" : "Create New Version"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "حفظ كنسخة جديدة من نفس السيناريو" : "Save as a new version of the same scenario"}</p>
                  </div>
                </Button>
                <Button variant="outline" className="justify-start gap-2 h-auto py-3" onClick={() => { setSaveMode("new"); setScenarioDescription(""); }}>
                  <PackagePlus className="h-4 w-4 shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">{isRTL ? "سيناريو جديد" : "New Scenario"}</p>
                    <p className="text-xs text-muted-foreground">{isRTL ? "حفظ كسيناريو جديد بالكامل" : "Save as a completely new scenario"}</p>
                  </div>
                </Button>
              </div>
            </div>
          ) : saveMode === "overwrite" ? (
            <div className="space-y-4">
              <p className="text-sm">
                {isRTL ? "هل أنت متأكد من الكتابة فوق السيناريو الحالي؟" : "Are you sure you want to overwrite the current scenario?"}
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveMode(null)}>{isRTL ? "رجوع" : "Back"}</Button>
                <Button onClick={() => saveScenario("overwrite")} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isRTL ? "تحديث" : "Update"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isRTL ? "وصف السيناريو" : "Scenario Description"}</Label>
                <Input
                  value={scenarioDescription}
                  onChange={(e) => setScenarioDescription(e.target.value)}
                  placeholder={isRTL ? "مثال: سيناريو بيلا 1" : "e.g. Beela Scenario 1"}
                />
              </div>
              <DialogFooter>
                {currentScenarioId && <Button variant="outline" onClick={() => setSaveMode(null)}>{isRTL ? "رجوع" : "Back"}</Button>}
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
                <Button onClick={() => saveScenario(saveMode || "new")} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isRTL ? "حفظ" : "Save"}
                </Button>
              </DialogFooter>
            </div>
          )}
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
                <div key={s.id} className={`flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors ${s.is_active ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}`}>
                  <div className="cursor-pointer flex-1" onClick={() => applyScenario(s)}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{s.description}</p>
                      {s.is_active && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300">
                          <Star className="h-3 w-3" />
                          {isRTL ? "نشط" : "Active"}
                        </span>
                      )}
                    </div>
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

      {/* Add Coin Category Dialog */}
      <Dialog open={addCoinDialogOpen} onOpenChange={setAddCoinDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? "إضافة فئة كوينز جديدة" : "Add New Coin Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "قيمة الكوينز" : "Coin Value"}</Label>
              <Input
                type="number"
                min="1"
                value={newCoinValue}
                onChange={(e) => setNewCoinValue(e.target.value)}
                placeholder={isRTL ? "مثال: 50000" : "e.g. 50000"}
              />
            </div>
            {customCoinsTiers.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">{isRTL ? "الفئات المضافة" : "Added Categories"}</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {customCoinsTiers.map((tier) => (
                    <span key={tier} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm">
                      {tier.toLocaleString()}
                      <button
                        onClick={() => setCustomCoinsTiers((prev) => prev.filter((t) => t !== tier))}
                        className="text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCoinDialogOpen(false)}>
              {isRTL ? "إغلاق" : "Close"}
            </Button>
            <Button onClick={() => {
              const val = parseInt(newCoinValue);
              if (!val || val <= 0) {
                toast.error(isRTL ? "أدخل قيمة صحيحة" : "Enter a valid value");
                return;
              }
              if (allCoinsTiers.includes(val)) {
                toast.error(isRTL ? "هذه الفئة موجودة بالفعل" : "This category already exists");
                return;
              }
              setCustomCoinsTiers((prev) => [...prev, val]);
              setSavedCoinsTiers((prev) => [...new Set([...prev, val])].sort((a, b) => a - b));
              setNewCoinValue("");
              toast.success(isRTL ? `تم إضافة ${val.toLocaleString()} كوينز` : `Added ${val.toLocaleString()} coins`);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              {isRTL ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PricingScenario;
