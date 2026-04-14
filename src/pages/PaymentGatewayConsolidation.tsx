import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Printer, CreditCard, Building2, TrendingUp, ShieldCheck, ShieldX, Landmark } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";

const today = () => format(new Date(), "yyyy-MM-dd");

const fmtNum = (v: number) =>
  v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SalesRow {
  payment_method: string;
  payment_brand: string;
  total: number;
  count: number;
  bank_fee: number;
}

interface HyperpayRow {
  brand: string;
  result: string;
  debit_total: number;
  count: number;
}

interface BankCardRow {
  clearinginstitutename: string;
  brand: string;
  result: string;
  debit_total: number;
  count: number;
}

const PaymentGatewayConsolidation = () => {
  const { t, language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/reports/payment-gateway-consolidation");

  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [loading, setLoading] = useState(false);

  // Data
  const [salesData, setSalesData] = useState<SalesRow[]>([]);
  const [hyperpayData, setHyperpayData] = useState<HyperpayRow[]>([]);
  const [bankCardData, setBankCardData] = useState<BankCardRow[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fromInt = parseInt(dateFrom.replace(/-/g, ""), 10);
      const toInt = parseInt(dateTo.replace(/-/g, ""), 10);

      // 1) Sales from ordertotals (excluding point)
      const { data: salesRaw, error: e1 } = await supabase
        .from("ordertotals")
        .select("payment_method, payment_brand, total, bank_fee")
        .gte("order_date_int", fromInt)
        .lte("order_date_int", toInt)
        .neq("payment_method", "point");

      if (e1) throw e1;

      // aggregate
      const salesMap = new Map<string, SalesRow>();
      (salesRaw || []).forEach((r: any) => {
        const key = `${r.payment_method || "unknown"}|${r.payment_brand || "unknown"}`;
        const existing = salesMap.get(key);
        if (existing) {
          existing.total += Number(r.total) || 0;
          existing.count += 1;
          existing.bank_fee += Number(r.bank_fee) || 0;
        } else {
          salesMap.set(key, {
            payment_method: r.payment_method || "unknown",
            payment_brand: r.payment_brand || "unknown",
            total: Number(r.total) || 0,
            count: 1,
            bank_fee: Number(r.bank_fee) || 0,
          });
        }
      });
      setSalesData(Array.from(salesMap.values()).sort((a, b) => b.total - a.total));

      // 2) Hyberpay statement
      const { data: hpRaw, error: e2 } = await supabase
        .from("hyberpaystatement")
        .select("brand, result, debit, clearinginstitutename")
        .gte("request_date", dateFrom)
        .lte("request_date", dateTo);

      if (e2) throw e2;

      // aggregate hyperpay by brand+result
      const hpMap = new Map<string, HyperpayRow>();
      const bankMap = new Map<string, BankCardRow>();

      (hpRaw || []).forEach((r: any) => {
        const brand = r.brand || "OTHER";
        const result = r.result || "UNKNOWN";
        const debit = parseFloat(r.debit) || 0;
        const bank = r.clearinginstitutename || "Unknown Bank";

        // Hyperpay card aggregation
        const hKey = `${brand}|${result}`;
        const hEx = hpMap.get(hKey);
        if (hEx) { hEx.debit_total += debit; hEx.count += 1; }
        else { hpMap.set(hKey, { brand, result, debit_total: debit, count: 1 }); }

        // Bank card aggregation
        const bKey = `${bank}|${brand}|${result}`;
        const bEx = bankMap.get(bKey);
        if (bEx) { bEx.debit_total += debit; bEx.count += 1; }
        else { bankMap.set(bKey, { clearinginstitutename: bank, brand, result, debit_total: debit, count: 1 }); }
      });

      setHyperpayData(Array.from(hpMap.values()).sort((a, b) => b.debit_total - a.debit_total));
      setBankCardData(Array.from(bankMap.values()).sort((a, b) => b.debit_total - a.debit_total));

    } catch (err: any) {
      toast.error(err.message || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Derived: total sales excluding point
  const totalSales = useMemo(() => salesData.reduce((s, r) => s + r.total, 0), [salesData]);
  const totalBankFee = useMemo(() => salesData.reduce((s, r) => s + r.bank_fee, 0), [salesData]);
  const totalSalesCount = useMemo(() => salesData.reduce((s, r) => s + r.count, 0), [salesData]);

  // Sales by payment method group
  const salesByMethod = useMemo(() => {
    const map = new Map<string, { total: number; count: number; bank_fee: number }>();
    salesData.forEach(r => {
      const ex = map.get(r.payment_method);
      if (ex) { ex.total += r.total; ex.count += r.count; ex.bank_fee += r.bank_fee; }
      else { map.set(r.payment_method, { total: r.total, count: r.count, bank_fee: r.bank_fee }); }
    });
    return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [salesData]);

  // Hyperpay summary cards
  const hpAccepted = useMemo(() => hyperpayData.filter(r => r.result === "ACK"), [hyperpayData]);
  const hpRejected = useMemo(() => hyperpayData.filter(r => r.result === "NOK"), [hyperpayData]);
  const totalAccepted = useMemo(() => hpAccepted.reduce((s, r) => s + r.debit_total, 0), [hpAccepted]);
  const totalRejected = useMemo(() => hpRejected.reduce((s, r) => s + r.debit_total, 0), [hpRejected]);
  const countAccepted = useMemo(() => hpAccepted.reduce((s, r) => s + r.count, 0), [hpAccepted]);
  const countRejected = useMemo(() => hpRejected.reduce((s, r) => s + r.count, 0), [hpRejected]);

  // Card brand pivot for hyperpay
  const CARD_BRANDS = ["MADA", "VISA", "MASTER", "STC_PAY", "URPAY"];
  const hpCardPivot = useMemo(() => {
    const result: Record<string, { ack: number; nok: number; ackCount: number; nokCount: number }> = {};
    CARD_BRANDS.forEach(b => { result[b] = { ack: 0, nok: 0, ackCount: 0, nokCount: 0 }; });
    result["OTHER"] = { ack: 0, nok: 0, ackCount: 0, nokCount: 0 };

    hyperpayData.forEach(r => {
      const brand = CARD_BRANDS.includes(r.brand) ? r.brand : "OTHER";
      if (r.result === "ACK") { result[brand].ack += r.debit_total; result[brand].ackCount += r.count; }
      else { result[brand].nok += r.debit_total; result[brand].nokCount += r.count; }
    });
    return result;
  }, [hyperpayData]);

  // Bank consolidation pivot
  const bankPivot = useMemo(() => {
    const banks = new Map<string, Record<string, { ack: number; nok: number; ackCount: number; nokCount: number }>>();
    bankCardData.forEach(r => {
      if (!banks.has(r.clearinginstitutename)) {
        const init: Record<string, { ack: number; nok: number; ackCount: number; nokCount: number }> = {};
        [...CARD_BRANDS, "OTHER"].forEach(b => { init[b] = { ack: 0, nok: 0, ackCount: 0, nokCount: 0 }; });
        banks.set(r.clearinginstitutename, init);
      }
      const bk = banks.get(r.clearinginstitutename)!;
      const brand = CARD_BRANDS.includes(r.brand) ? r.brand : "OTHER";
      if (r.result === "ACK") { bk[brand].ack += r.debit_total; bk[brand].ackCount += r.count; }
      else { bk[brand].nok += r.debit_total; bk[brand].nokCount += r.count; }
    });
    return banks;
  }, [bankCardData]);

  if (accessLoading) return <div className="p-8 text-center">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>;
  if (hasAccess === false) return <AccessDenied />;

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <div className="p-4 md:p-6 space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            {language === 'ar' ? 'توحيد بوابة الدفع والبنوك' : 'Payment Gateway & Bank Consolidation'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {language === 'ar' ? 'تقرير المبيعات والمدفوعات وبطاقات الدفع' : 'Sales, payments, and card consolidation report'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 me-1" />
          {language === 'ar' ? 'طباعة' : 'Print'}
        </Button>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>{language === 'ar' ? 'من تاريخ' : 'From Date'}</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label>{language === 'ar' ? 'إلى تاريخ' : 'To Date'}</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-44" />
            </div>
            <Button onClick={fetchData} disabled={loading}>
              <Search className="h-4 w-4 me-1" />
              {loading ? (language === 'ar' ? 'جاري...' : 'Loading...') : (language === 'ar' ? 'بحث' : 'Search')}
            </Button>
            <Button variant="outline" onClick={() => { setDateFrom(today()); setDateTo(today()); }}>
              {language === 'ar' ? 'اليوم' : 'Today'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'ar' ? 'إجمالي المبيعات (بدون النقاط)' : 'Total Sales (Excl. Points)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{fmtNum(totalSales)}</div>
            <p className="text-xs text-muted-foreground">{totalSalesCount} {language === 'ar' ? 'عملية' : 'transactions'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === 'ar' ? 'رسوم البنك' : 'Bank Fees'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{fmtNum(totalBankFee)}</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              {language === 'ar' ? 'إجمالي المقبول (Hyperpay)' : 'Total Accepted (Hyperpay)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmtNum(totalAccepted)}</div>
            <p className="text-xs text-muted-foreground">{countAccepted} {language === 'ar' ? 'عملية' : 'txns'}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <ShieldX className="h-4 w-4 text-red-600" />
              {language === 'ar' ? 'إجمالي المرفوض (Hyperpay)' : 'Total Rejected (Hyperpay)'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{fmtNum(totalRejected)}</div>
            <p className="text-xs text-muted-foreground">{countRejected} {language === 'ar' ? 'عملية' : 'txns'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales">
            <TrendingUp className="h-4 w-4 me-1" />
            {language === 'ar' ? 'المبيعات بطريقة الدفع' : 'Sales by Payment Method'}
          </TabsTrigger>
          <TabsTrigger value="salesDetail">
            <CreditCard className="h-4 w-4 me-1" />
            {language === 'ar' ? 'تفاصيل المبيعات' : 'Sales Detail'}
          </TabsTrigger>
          <TabsTrigger value="hyperpay">
            <ShieldCheck className="h-4 w-4 me-1" />
            {language === 'ar' ? 'بطاقات Hyperpay' : 'Hyperpay Cards'}
          </TabsTrigger>
          <TabsTrigger value="banks">
            <Building2 className="h-4 w-4 me-1" />
            {language === 'ar' ? 'البنوك' : 'Banks'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales by Payment Method */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'المبيعات حسب بوابة الدفع' : 'Sales by Payment Gateway'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'عدد العمليات' : 'Count'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'رسوم البنك' : 'Bank Fee'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'صافي' : 'Net'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesByMethod.map(([method, data]) => (
                    <TableRow key={method}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono uppercase">{method}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{data.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">{fmtNum(data.total)}</TableCell>
                      <TableCell className="text-right text-orange-600 dark:text-orange-400">{fmtNum(data.bank_fee)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">{fmtNum(data.total - data.bank_fee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                    <TableCell className="text-right">{totalSalesCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmtNum(totalSales)}</TableCell>
                    <TableCell className="text-right text-orange-600 dark:text-orange-400">{fmtNum(totalBankFee)}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">{fmtNum(totalSales - totalBankFee)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Sales Detail by Payment Method + Brand */}
        <TabsContent value="salesDetail">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'تفاصيل المبيعات حسب طريقة الدفع والبراند' : 'Sales Detail by Method & Brand'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</TableHead>
                    <TableHead>{language === 'ar' ? 'براند الدفع' : 'Payment Brand'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'عدد' : 'Count'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'إجمالي' : 'Total'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'رسوم البنك' : 'Bank Fee'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesData.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline" className="font-mono uppercase">{r.payment_method}</Badge></TableCell>
                      <TableCell className="font-mono">{r.payment_brand}</TableCell>
                      <TableCell className="text-right">{r.count.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">{fmtNum(r.total)}</TableCell>
                      <TableCell className="text-right text-orange-600 dark:text-orange-400">{fmtNum(r.bank_fee)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                    <TableCell className="text-right">{totalSalesCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-blue-600 dark:text-blue-400">{fmtNum(totalSales)}</TableCell>
                    <TableCell className="text-right text-orange-600 dark:text-orange-400">{fmtNum(totalBankFee)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Hyperpay Cards */}
        <TabsContent value="hyperpay">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {language === 'ar' ? 'بطاقات Hyperpay - مقبول / مرفوض' : 'Hyperpay Cards — Accepted / Rejected'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'نوع البطاقة' : 'Card Brand'}</TableHead>
                    <TableHead className="text-right text-green-600">{language === 'ar' ? 'مقبول (عدد)' : 'Accepted (Count)'}</TableHead>
                    <TableHead className="text-right text-green-600">{language === 'ar' ? 'مقبول (مبلغ)' : 'Accepted (Amount)'}</TableHead>
                    <TableHead className="text-right text-red-600">{language === 'ar' ? 'مرفوض (عدد)' : 'Rejected (Count)'}</TableHead>
                    <TableHead className="text-right text-red-600">{language === 'ar' ? 'مرفوض (مبلغ)' : 'Rejected (Amount)'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...CARD_BRANDS, "OTHER"].map(brand => {
                    const d = hpCardPivot[brand];
                    if (!d || (d.ackCount === 0 && d.nokCount === 0)) return null;
                    return (
                      <TableRow key={brand}>
                        <TableCell><Badge variant="outline" className="font-mono">{brand}</Badge></TableCell>
                        <TableCell className="text-right text-green-600">{d.ackCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{fmtNum(d.ack)}</TableCell>
                        <TableCell className="text-right text-red-600">{d.nokCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{fmtNum(d.nok)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                    <TableCell className="text-right text-green-600">{countAccepted.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600">{fmtNum(totalAccepted)}</TableCell>
                    <TableCell className="text-right text-red-600">{countRejected.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-red-600">{fmtNum(totalRejected)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Banks Consolidation */}
        <TabsContent value="banks">
          <div className="space-y-6">
            {Array.from(bankPivot.entries()).map(([bankName, cards]) => {
              const bankTotalAck = Object.values(cards).reduce((s, c) => s + c.ack, 0);
              const bankTotalNok = Object.values(cards).reduce((s, c) => s + c.nok, 0);
              const bankCountAck = Object.values(cards).reduce((s, c) => s + c.ackCount, 0);
              const bankCountNok = Object.values(cards).reduce((s, c) => s + c.nokCount, 0);

              return (
                <Card key={bankName}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {bankName}
                      <Badge variant="secondary" className="ms-2">
                        {language === 'ar' ? 'مقبول' : 'Accepted'}: {fmtNum(bankTotalAck)}
                      </Badge>
                      <Badge variant="destructive" className="ms-1">
                        {language === 'ar' ? 'مرفوض' : 'Rejected'}: {fmtNum(bankTotalNok)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === 'ar' ? 'نوع البطاقة' : 'Card Brand'}</TableHead>
                          <TableHead className="text-right text-green-600">{language === 'ar' ? 'مقبول (عدد)' : 'ACK Count'}</TableHead>
                          <TableHead className="text-right text-green-600">{language === 'ar' ? 'مقبول (مبلغ)' : 'ACK Amount'}</TableHead>
                          <TableHead className="text-right text-red-600">{language === 'ar' ? 'مرفوض (عدد)' : 'NOK Count'}</TableHead>
                          <TableHead className="text-right text-red-600">{language === 'ar' ? 'مرفوض (مبلغ)' : 'NOK Amount'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...CARD_BRANDS, "OTHER"].map(brand => {
                          const d = cards[brand];
                          if (!d || (d.ackCount === 0 && d.nokCount === 0)) return null;
                          return (
                            <TableRow key={brand}>
                              <TableCell><Badge variant="outline" className="font-mono">{brand}</Badge></TableCell>
                              <TableCell className="text-right text-green-600">{d.ackCount.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-semibold text-green-600">{fmtNum(d.ack)}</TableCell>
                              <TableCell className="text-right text-red-600">{d.nokCount.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-semibold text-red-600">{fmtNum(d.nok)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="font-bold">
                          <TableCell>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableCell>
                          <TableCell className="text-right text-green-600">{bankCountAck.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600">{fmtNum(bankTotalAck)}</TableCell>
                          <TableCell className="text-right text-red-600">{bankCountNok.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-red-600">{fmtNum(bankTotalNok)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentGatewayConsolidation;
