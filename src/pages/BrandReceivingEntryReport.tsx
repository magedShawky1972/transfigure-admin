import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileDown, ArrowLeft, Check, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";

type Stage = "entry" | "confirmed" | "closed" | "sent_to_acc";

interface Row {
  header_id: string;
  receipt_number: string;
  receipt_date: string;
  order_number: string;
  supplier_name: string;
  currency_code: string;
  brand_id: string;
  brand_name: string;
  coins: number;
  unit_price: number;
  total: number;
  is_confirmed: boolean;
  stage: Stage;
}

const getStage = (r: any): Stage => {
  if (r?.sent_to_accounting) return "sent_to_acc";
  if (r?.status === "closed") return "closed";
  if (r?.status === "partial_delivery" || r?.status === "full_delivery") return "confirmed";
  return "entry";
};

const BrandReceivingEntryReport = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [brands, setBrands] = useState<{ id: string; brand_name: string }[]>([]);

  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [brandOpen, setBrandOpen] = useState(false);

  const stageLabels: Record<Stage, string> = {
    entry: isArabic ? "إدخال" : "Entry",
    confirmed: isArabic ? "مؤكد" : "Confirmed",
    closed: isArabic ? "مغلق" : "Closed",
    sent_to_acc: isArabic ? "مُرسل للمحاسبة" : "Sent to Acc.",
  };

  useEffect(() => {
    supabase.from("brands").select("id, brand_name").order("brand_name").then(({ data }) => {
      if (data) setBrands(data as any);
    });
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: headers, error } = await supabase
        .from("receiving_coins_header")
        .select("*, currencies(currency_code), main_supplier:suppliers!receiving_coins_header_supplier_id_fkey(supplier_name), coins_purchase_orders(order_number, suppliers(supplier_name))")
        .order("receipt_date", { ascending: false })
        .range(0, 9999);
      if (error) throw error;

      const ids = (headers || []).map((h: any) => h.id);
      const lines: any[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { data: lns } = await supabase
          .from("receiving_coins_line")
          .select("header_id, brand_id, brand_name, product_name, coins, unit_price, total, is_confirmed")
          .in("header_id", chunk);
        if (lns) lines.push(...lns);
      }

      const headerMap: Record<string, any> = {};
      (headers || []).forEach((h: any) => (headerMap[h.id] = h));

      // Per-brand control amounts from purchase order lines (for accurate unit price)
      const poIds = [...new Set((headers || []).map((h: any) => h.purchase_order_id).filter(Boolean))];
      const brandControlMap: Record<string, Record<string, number>> = {};
      for (let i = 0; i < poIds.length; i += 500) {
        const chunk = poIds.slice(i, i + 500);
        const { data: ols } = await supabase
          .from("coins_purchase_order_lines")
          .select("purchase_order_id, brand_id, amount_in_currency")
          .in("purchase_order_id", chunk);
        for (const ol of ols || []) {
          if (!ol.brand_id) continue;
          if (!brandControlMap[ol.purchase_order_id]) brandControlMap[ol.purchase_order_id] = {};
          brandControlMap[ol.purchase_order_id][ol.brand_id] =
            (brandControlMap[ol.purchase_order_id][ol.brand_id] || 0) + (Number(ol.amount_in_currency) || 0);
        }
      }

      // Brand one_usd_to_coins rates
      const brandIds = [...new Set(lines.map((l: any) => l.brand_id).filter(Boolean))];
      const brandRateMap: Record<string, number> = {};
      for (let i = 0; i < brandIds.length; i += 500) {
        const chunk = brandIds.slice(i, i + 500);
        const { data: brs } = await supabase.from("brands").select("id, one_usd_to_coins").in("id", chunk);
        for (const b of brs || []) brandRateMap[b.id] = Number(b.one_usd_to_coins) || 0;
      }

      const out: Row[] = lines.map((l: any) => {
        const h = headerMap[l.header_id] || {};
        const coins = Number(l.coins) || 0;
        const brandControl = l.brand_id ? (brandControlMap[h.purchase_order_id]?.[l.brand_id] || 0) : 0;
        const oneUsdToCoins = l.brand_id ? (brandRateMap[l.brand_id] || 0) : 0;
        const expectedCoins = oneUsdToCoins > 0 && brandControl > 0 ? Math.floor(brandControl * oneUsdToCoins) : 0;
        const unitPrice = expectedCoins > 0 && brandControl > 0 ? brandControl / expectedCoins : (Number(l.unit_price) || 0);
        return {
          header_id: l.header_id,
          receipt_number: h.receipt_number || "",
          receipt_date: h.receipt_date ? String(h.receipt_date).slice(0, 10) : "",
          order_number: h.coins_purchase_orders?.order_number || "-",
          supplier_name: h.main_supplier?.supplier_name || h.coins_purchase_orders?.suppliers?.supplier_name || "-",
          currency_code: h.currencies?.currency_code || "-",
          brand_id: l.brand_id || "",
          brand_name: l.brand_name || l.product_name || "-",
          coins,
          unit_price: unitPrice,
          total: coins * unitPrice,
          is_confirmed: !!l.is_confirmed,
          stage: getStage(h),
        };
      });
      setRows(out);

    } catch (err: any) {
      toast.error(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fromDate && r.receipt_date && r.receipt_date < fromDate) return false;
      if (toDate && r.receipt_date && r.receipt_date > toDate) return false;
      if (brandFilter !== "all" && r.brand_id !== brandFilter) return false;
      if (stageFilter !== "all" && r.stage !== stageFilter) return false;
      return true;
    });
  }, [rows, fromDate, toDate, brandFilter, stageFilter]);

  const totals = useMemo(() => ({
    coins: filtered.reduce((s, r) => s + r.coins, 0),
    amount: filtered.reduce((s, r) => s + r.total, 0),
  }), [filtered]);

  const handleExport = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Brand Receiving Entry");
      sheet.addRow([
        isArabic ? "رقم الإيصال" : "Receipt No.",
        isArabic ? "التاريخ" : "Date",
        isArabic ? "رقم الطلب" : "Order No.",
        isArabic ? "المورد" : "Supplier",
        isArabic ? "البراند" : "Brand",
        isArabic ? "العملة" : "Currency",
        isArabic ? "الكوينز" : "Coins",
        isArabic ? "سعر الوحدة" : "Unit Price",
        isArabic ? "الإجمالي" : "Total",
        isArabic ? "الحالة" : "Status",
      ]).font = { bold: true };
      filtered.forEach((r) => {
        sheet.addRow([
          r.receipt_number, r.receipt_date, r.order_number, r.supplier_name, r.brand_name,
          r.currency_code, r.coins, r.unit_price, r.total, stageLabels[r.stage],
        ]);
      });
      sheet.columns.forEach((col) => {
        let maxLen = 12;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = cell.value ? String(cell.value).length : 0;
          if (len > maxLen) maxLen = Math.min(len, 40);
        });
        col.width = maxLen + 2;
      });
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Brand_Receiving_Entry_${format(new Date(), "yyyyMMdd")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  };

  return (
    <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isArabic ? "تقرير استلام الكوينز حسب البراند" : "Brand Receiving Entry Report"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isArabic ? "تصفية حسب نطاق التاريخ والبراند والمرحلة" : "Filter by date range, brand and stage"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={handleExport} disabled={filtered.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            {isArabic ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{isArabic ? "الفلاتر" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>{isArabic ? "من تاريخ" : "From Date"}</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{isArabic ? "إلى تاريخ" : "To Date"}</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{isArabic ? "البراند" : "Brand"}</Label>
            <Popover open={brandOpen} onOpenChange={setBrandOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {brandFilter === "all"
                    ? (isArabic ? "كل البراندات" : "All Brands")
                    : brands.find((b) => b.id === brandFilter)?.brand_name || "-"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover z-50" align="start">
                <Command>
                  <CommandInput placeholder={isArabic ? "البحث عن براند..." : "Search brand..."} />
                  <CommandList>
                    <CommandEmpty>{isArabic ? "لا توجد نتائج" : "No results found."}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="all" onSelect={() => { setBrandFilter("all"); setBrandOpen(false); }}>
                        <Check className={`mr-2 h-4 w-4 ${brandFilter === "all" ? "opacity-100" : "opacity-0"}`} />
                        {isArabic ? "كل البراندات" : "All Brands"}
                      </CommandItem>
                      {brands.map((b) => (
                        <CommandItem key={b.id} value={b.brand_name} onSelect={() => { setBrandFilter(b.id); setBrandOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${brandFilter === b.id ? "opacity-100" : "opacity-0"}`} />
                          {b.brand_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label>{isArabic ? "الحالة" : "Status"}</Label>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">{isArabic ? "كل الحالات" : "All Statuses"}</SelectItem>
                <SelectItem value="entry">{stageLabels.entry}</SelectItem>
                <SelectItem value="confirmed">{stageLabels.confirmed}</SelectItem>
                <SelectItem value="closed">{stageLabels.closed}</SelectItem>
                <SelectItem value="sent_to_acc">{stageLabels.sent_to_acc}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{isArabic ? "عدد السطور" : "Lines"}</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{isArabic ? "إجمالي الكوينز" : "Total Coins"}</p>
          <p className="text-2xl font-bold">{totals.coins.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{isArabic ? "إجمالي المبلغ" : "Total Amount"}</p>
          <p className="text-2xl font-bold">{totals.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isArabic ? "رقم الإيصال" : "Receipt No."}</TableHead>
                <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{isArabic ? "رقم الطلب" : "Order No."}</TableHead>
                <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                <TableHead>{isArabic ? "البراند" : "Brand"}</TableHead>
                <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                <TableHead className="text-right">{isArabic ? "الكوينز" : "Coins"}</TableHead>
                <TableHead className="text-right">{isArabic ? "سعر الوحدة" : "Unit Price"}</TableHead>
                <TableHead className="text-right">{isArabic ? "الإجمالي" : "Total"}</TableHead>
                <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  {isArabic ? "جاري التحميل..." : "Loading..."}
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  {isArabic ? "لا توجد بيانات" : "No data"}
                </TableCell></TableRow>
              ) : filtered.map((r, i) => (
                <TableRow key={`${r.header_id}-${i}`}>
                  <TableCell className="font-medium">{r.receipt_number}</TableCell>
                  <TableCell>{r.receipt_date}</TableCell>
                  <TableCell>{r.order_number}</TableCell>
                  <TableCell>{r.supplier_name}</TableCell>
                  <TableCell>{r.brand_name}</TableCell>
                  <TableCell>{r.currency_code}</TableCell>
                  <TableCell className="text-right">{r.coins.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.unit_price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</TableCell>
                  <TableCell className="text-right">{r.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                  <TableCell><Badge variant="secondary">{stageLabels[r.stage]}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandReceivingEntryReport;
