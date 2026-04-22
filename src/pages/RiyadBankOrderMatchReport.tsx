import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Landmark, Filter, Download, ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";

type OrderRow = {
  order_number: string;
  brand_name: string | null;
  brand_code: string | null;
  total: number | null;
  payment_method: string | null;
  payment_brand: string | null;
  created_at_date: string | null;
};

type MatchedRow = OrderRow & {
  matched: boolean;
  rb_txn_number: string | null;
  rb_txn_date: string | null;
  rb_payment_reference: string | null;
  rb_payment_number: string | null;
  rb_net_amount: string | null;
  rb_auth_code: string | null;
};

type GroupRow = {
  brand: string;
  rows: MatchedRow[];
  matchedCount: number;
  unmatchedCount: number;
  totalAmount: number;
  matchedAmount: number;
};

const RiyadBankOrderMatchReport = () => {
  const { language } = useLanguage();
  const isRTL = language === "ar";

  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [matchFilter, setMatchFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_distinct_payment_methods");
      if (data) setPaymentMethodOptions(data.map((r: any) => r.payment_method).filter(Boolean));
    })();
  }, []);

  const runReport = async () => {
    if (!dateFrom || !dateTo) {
      toast.error(isRTL ? "يرجى تحديد الفترة الزمنية" : "Please select a date range");
      return;
    }
    setLoading(true);
    try {
      const pageSize = 1000;
      let from = 0;
      let allOrders: OrderRow[] = [];
      const orderMap = new Map<string, OrderRow>();

      while (true) {
        let q = supabase
          .from("purpletransaction")
          .select("order_number, brand_name, brand_code, total, payment_method, payment_brand, created_at_date")
          .gte("created_at_date", dateFrom)
          .lte("created_at_date", dateTo + "T23:59:59")
          .neq("payment_method", "point")
          .not("order_number", "is", null)
          .range(from, from + pageSize - 1);

        if (paymentMethod !== "all") q = q.eq("payment_method", paymentMethod);

        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allOrders = allOrders.concat(data as OrderRow[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      for (const o of allOrders) {
        if (!o.order_number) continue;
        if (!orderMap.has(o.order_number)) {
          orderMap.set(o.order_number, o);
        } else {
          const existing = orderMap.get(o.order_number)!;
          existing.total = (existing.total || 0) + (o.total || 0);
        }
      }

      const orderNumbers = Array.from(orderMap.keys());
      if (orderNumbers.length === 0) {
        setGroups([]);
        toast.info(isRTL ? "لا توجد طلبات في هذه الفترة" : "No orders found in this period");
        return;
      }

      const refByOrder = new Map<string, string>();
      const orderByRef = new Map<string, string>();
      const chunkSize = 500;
      for (let i = 0; i < orderNumbers.length; i += chunkSize) {
        const chunk = orderNumbers.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("order_payment")
          .select("ordernumber, paymentrefrence")
          .in("ordernumber", chunk)
          .not("paymentrefrence", "is", null);
        if (error) throw error;
        for (const row of data || []) {
          if (row.ordernumber && row.paymentrefrence) {
            refByOrder.set(row.ordernumber, row.paymentrefrence);
            orderByRef.set(row.paymentrefrence, row.ordernumber);
          }
        }
      }

      const refs = Array.from(orderByRef.keys());
      const receiptByRef = new Map<string, string>();
      const refByReceipt = new Map<string, string>();
      for (let i = 0; i < refs.length; i += chunkSize) {
        const chunk = refs.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("hyberpaystatement")
          .select("transactionid, transaction_receipt")
          .in("transactionid", chunk)
          .not("transaction_receipt", "is", null);
        if (error) throw error;
        for (const row of data || []) {
          if (row.transactionid && row.transaction_receipt) {
            receiptByRef.set(row.transactionid, row.transaction_receipt);
            refByReceipt.set(row.transaction_receipt, row.transactionid);
          }
        }
      }

      const receipts = Array.from(refByReceipt.keys());
      type RBInfo = {
        txn_number: string;
        txn_date: string | null;
        payment_reference: string | null;
        payment_number: string | null;
        net_amount: string | null;
        auth_code: string | null;
      };
      const rbByReceipt = new Map<string, RBInfo>();
      for (let i = 0; i < receipts.length; i += chunkSize) {
        const chunk = receipts.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("riyadbankstatement")
          .select("txn_number, txn_date, payment_reference, payment_number, net_amount, auth_code")
          .in("txn_number", chunk);
        if (error) throw error;
        for (const row of data || []) {
          if (row.txn_number) rbByReceipt.set(row.txn_number, row as RBInfo);
        }
      }

      const matched: MatchedRow[] = [];
      for (const [orderNumber, o] of orderMap.entries()) {
        const ref = refByOrder.get(orderNumber);
        const receipt = ref ? receiptByRef.get(ref) : undefined;
        const rb = receipt ? rbByReceipt.get(receipt) : undefined;
        matched.push({
          ...o,
          matched: !!rb,
          rb_txn_number: rb?.txn_number || null,
          rb_txn_date: rb?.txn_date || null,
          rb_payment_reference: rb?.payment_reference || null,
          rb_payment_number: rb?.payment_number || null,
          rb_net_amount: rb?.net_amount || null,
          rb_auth_code: rb?.auth_code || null,
        });
      }

      const filtered = matched.filter((m) => {
        if (matchFilter === "matched") return m.matched;
        if (matchFilter === "unmatched") return !m.matched;
        return true;
      });

      const groupMap = new Map<string, GroupRow>();
      for (const r of filtered) {
        const key = r.brand_name || (isRTL ? "بدون براند" : "No Brand");
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            brand: key,
            rows: [],
            matchedCount: 0,
            unmatchedCount: 0,
            totalAmount: 0,
            matchedAmount: 0,
          });
        }
        const g = groupMap.get(key)!;
        g.rows.push(r);
        g.totalAmount += r.total || 0;
        if (r.matched) {
          g.matchedCount += 1;
          g.matchedAmount += r.total || 0;
        } else {
          g.unmatchedCount += 1;
        }
      }

      const result = Array.from(groupMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
      setGroups(result);
      const openInit: Record<string, boolean> = {};
      result.forEach((g) => (openInit[g.brand] = true));
      setOpenBrands(openInit);

      toast.success(
        isRTL
          ? `تم تحميل ${matched.length} طلب في ${result.length} براند`
          : `Loaded ${matched.length} orders across ${result.length} brands`
      );
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Error running report");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    let orders = 0,
      matched = 0,
      unmatched = 0,
      total = 0,
      matchedTotal = 0;
    for (const g of groups) {
      orders += g.rows.length;
      matched += g.matchedCount;
      unmatched += g.unmatchedCount;
      total += g.totalAmount;
      matchedTotal += g.matchedAmount;
    }
    return { orders, matched, unmatched, total, matchedTotal };
  }, [groups]);

  const exportCSV = () => {
    if (groups.length === 0) {
      toast.error(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    const headers = [
      "Brand",
      "Order Number",
      "Order Date",
      "Payment Method",
      "Payment Brand",
      "Order Amount",
      "Match Status",
      "Riyad Txn Number",
      "Riyad Txn Date",
      "Riyad Payment Ref",
      "Riyad Payment Number",
      "Riyad Net Amount",
      "Auth Code",
    ];
    const rows: string[] = [headers.join(",")];
    for (const g of groups) {
      for (const r of g.rows) {
        rows.push(
          [
            g.brand,
            r.order_number,
            r.created_at_date ? format(new Date(r.created_at_date), "yyyy-MM-dd") : "",
            r.payment_method || "",
            r.payment_brand || "",
            r.total ?? "",
            r.matched ? "Matched" : "Unmatched",
            r.rb_txn_number || "",
            r.rb_txn_date || "",
            r.rb_payment_reference || "",
            r.rb_payment_number || "",
            r.rb_net_amount || "",
            r.rb_auth_code || "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        );
      }
    }
    const blob = new Blob(["\ufeff" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riyad-bank-order-match-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  if (loading) return <LoadingOverlay message={isRTL ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {isRTL ? "مطابقة الطلبات مع تحصيلات بنك الرياض" : "Order ↔ Riyad Bank Collection Match"}
          </h1>
          <p className="text-muted-foreground">
            {isRTL
              ? "مطابقة أرقام الطلبات مع مرجع التحصيل في كشف بنك الرياض، مجمعة حسب البراند"
              : "Match orders to Riyad Bank collection references, grouped by brand"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isRTL ? "الفلاتر" : "Filters"}</CardTitle>
          <CardDescription>
            {isRTL
              ? "اختر الفترة وطريقة الدفع وحالة المطابقة"
              : "Choose date range, payment method and match status"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{isRTL ? "من تاريخ *" : "From Date *"}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "إلى تاريخ *" : "To Date *"}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "طريقة الدفع" : "Payment Method"}</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  {paymentMethodOptions.map((pm) => (
                    <SelectItem key={pm} value={pm}>
                      {pm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? "حالة المطابقة" : "Match Status"}</Label>
              <Select value={matchFilter} onValueChange={(v) => setMatchFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="matched">{isRTL ? "متطابق" : "Matched"}</SelectItem>
                  <SelectItem value="unmatched">{isRTL ? "غير متطابق" : "Unmatched"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={runReport} className="gap-2">
              <Filter className="h-4 w-4" />
              {isRTL ? "تشغيل التقرير" : "Run Report"}
            </Button>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" />
              {isRTL ? "تصدير CSV" : "Export CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {groups.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{isRTL ? "إجمالي الطلبات" : "Total Orders"}</div>
                <div className="text-2xl font-bold">{totals.orders.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{isRTL ? "متطابق" : "Matched"}</div>
                <div className="text-2xl font-bold text-green-600">{totals.matched.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{isRTL ? "غير متطابق" : "Unmatched"}</div>
                <div className="text-2xl font-bold text-destructive">{totals.unmatched.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">{isRTL ? "إجمالي المبلغ" : "Total Amount"}</div>
                <div className="text-2xl font-bold">{totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isRTL ? "متطابق:" : "Matched:"} {totals.matchedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
          </div>

          {groups.map((g) => (
            <Card key={g.brand}>
              <Collapsible
                open={openBrands[g.brand] ?? true}
                onOpenChange={(open) => setOpenBrands((s) => ({ ...s, [g.brand]: open }))}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        {openBrands[g.brand] ?? true ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                        <CardTitle className="text-lg">{g.brand}</CardTitle>
                        <Badge variant="outline">{g.rows.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {g.matchedCount}
                        </Badge>
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          {g.unmatchedCount}
                        </Badge>
                        <Badge variant="secondary">
                          {isRTL ? "الإجمالي:" : "Total:"} {g.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{isRTL ? "رقم الطلب" : "Order #"}</TableHead>
                          <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                          <TableHead>{isRTL ? "طريقة الدفع" : "Method"}</TableHead>
                          <TableHead>{isRTL ? "براند الدفع" : "Pay Brand"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "المبلغ" : "Amount"}</TableHead>
                          <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                          <TableHead>{isRTL ? "رقم معاملة الرياض" : "Riyad Txn #"}</TableHead>
                          <TableHead>{isRTL ? "مرجع التحصيل" : "Collection Ref"}</TableHead>
                          <TableHead>{isRTL ? "رقم الدفعة" : "Payment #"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "صافي البنك" : "Bank Net"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.rows.map((r) => (
                          <TableRow key={r.order_number}>
                            <TableCell className="font-mono">{r.order_number}</TableCell>
                            <TableCell>
                              {r.created_at_date ? format(new Date(r.created_at_date), "yyyy-MM-dd") : "-"}
                            </TableCell>
                            <TableCell>{r.payment_method || "-"}</TableCell>
                            <TableCell>{r.payment_brand || "-"}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {(r.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {r.matched ? (
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  {isRTL ? "متطابق" : "Matched"}
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {isRTL ? "غير متطابق" : "Unmatched"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.rb_txn_number || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.rb_payment_reference || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">{r.rb_payment_number || "-"}</TableCell>
                            <TableCell className="text-right">{r.rb_net_amount || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </>
      )}
    </div>
  );
};

export default RiyadBankOrderMatchReport;
