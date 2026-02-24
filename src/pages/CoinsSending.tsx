import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Download, Send, ArrowLeft, Eye, Coins, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import CoinsPhaseFilterBar, { type PhaseViewFilter } from "@/components/CoinsPhaseFilterBar";

const CoinsSending = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-sending");
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<"list" | "detail">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [sendingConfirmed, setSendingConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [viewFilter, setViewFilter] = useState<PhaseViewFilter>("pending");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  useEffect(() => {
    fetchOrders();
    const orderId = searchParams.get("order");
    if (orderId) loadOrder(orderId);
  }, []);

  const fetchOrders = async () => {
    let query = supabase
      .from("coins_purchase_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (viewFilter === "pending") {
      query = query.eq("current_phase", "sending");
    } else if (viewFilter === "sent") {
      query = query.neq("current_phase", "sending").in("current_phase", ["receiving", "coins_entry", "completed"]);
    }
    // "all" = no phase filter, but still show orders that passed through sending
    // For simplicity, show all orders when "all"

    if (fromDate) query = query.gte("created_at", format(fromDate, "yyyy-MM-dd"));
    if (toDate) query = query.lte("created_at", format(toDate, "yyyy-MM-dd") + "T23:59:59");

    const { data } = await query;
    if (data) setOrders(data);
  };

  useEffect(() => { fetchOrders(); }, [viewFilter, fromDate, toDate]);

  const loadOrder = async (id: string) => {
    const [orderRes, linesRes] = await Promise.all([
      supabase.from("coins_purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("coins_purchase_order_lines").select("*, brands(brand_name), suppliers(supplier_name)").eq("purchase_order_id", id).order("line_number"),
    ]);
    if (orderRes.data) {
      setSelectedOrder(orderRes.data);
      setSendingConfirmed(orderRes.data.sending_confirmed || false);
      setOrderLines(linesRes.data || []);
      setView("detail");
    }
  };

  const handleDownload = () => {
    if (selectedOrder?.bank_transfer_image) {
      window.open(selectedOrder.bank_transfer_image, "_blank");
    }
  };

  const handleConfirmSending = async () => {
    if (!sendingConfirmed) {
      toast.error(isArabic ? "يرجى تأكيد الإرسال أولاً" : "Please confirm sending first");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("coins_purchase_orders").update({
        sending_confirmed: true,
        sending_confirmed_by: user?.email || "",
        sending_confirmed_name: user?.user_metadata?.display_name || user?.email || "",
        sending_confirmed_at: new Date().toISOString(),
        current_phase: "receiving",
        status: "in_progress",
      }).eq("id", selectedOrder.id);

      await supabase.from("coins_purchase_phase_history").insert({
        purchase_order_id: selectedOrder.id,
        from_phase: "sending",
        to_phase: "receiving",
        action: "confirm_sending",
        action_by: user?.email || "",
        action_by_name: user?.user_metadata?.display_name || user?.email || "",
      });

      // Notify receiving phase responsible
      await notifyResponsible(selectedOrder.brand_id, "receiving", selectedOrder.id);

      toast.success(isArabic ? "تم التأكيد والإرسال للمرحلة التالية" : "Confirmed and sent to next phase");
      setView("list");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const notifyResponsible = async (bId: string, phase: string, orderId: string) => {
    try {
      const { data: assignments } = await supabase
        .from("coins_workflow_assignments")
        .select("user_id, user_name")
        .eq("brand_id", bId)
        .eq("phase", phase);
      if (!assignments || assignments.length === 0) return;

      for (const assignment of assignments) {
        await supabase.from("notifications").insert({
          user_id: assignment.user_id,
          title: isArabic ? "مهمة معاملات عملات جديدة" : "New Coins Transaction Task",
          message: isArabic ? "لديك مهمة جديدة في مرحلة الاستلام" : "You have a new task in the receiving phase",
          type: "coins_workflow",
          link: `/coins-receiving-phase?order=${orderId}`,
        } as any);

        supabase.functions.invoke("send-coins-workflow-notification", {
          body: {
            type: "phase_transition",
            userId: assignment.user_id,
            userName: assignment.user_name || "",
            brandName: selectedOrder?.brand_id || "",
            phase,
            phaseLabel: isArabic ? "الاستلام" : "Receiving",
            orderNumber: selectedOrder?.order_number || "",
            orderId,
          },
        }).catch(err => console.error("Notification error:", err));
      }
    } catch (err) { console.error("Notification error:", err); }
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  if (view === "detail" && selectedOrder) {
    return (
      <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-5 w-5" /></Button>
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "توجيه - إرسال التحويل" : "Sending - Transfer Dispatch"}</h1>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>{isArabic ? "تفاصيل الطلب" : "Order Details"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="font-medium">{isArabic ? "رقم الطلب:" : "Order #:"}</span> {selectedOrder.order_number}</div>
              <div><span className="font-medium">{isArabic ? "إجمالي المبلغ (SAR):" : "Total Amount (SAR):"}</span> {parseFloat(selectedOrder.base_amount_sar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div><span className="font-medium">{isArabic ? "التاريخ:" : "Date:"}</span> {format(new Date(selectedOrder.created_at), "yyyy-MM-dd")}</div>
            </div>
          </CardContent>
        </Card>

        {/* Order Lines - Brands & Suppliers Breakdown */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "تفاصيل العلامات التجارية والمبالغ" : "Brands & Amounts Breakdown"}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>{isArabic ? "العلامة التجارية" : "Brand"}</TableHead>
                    <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                    <TableHead>{isArabic ? "المبلغ بالعملة" : "Amount (Currency)"}</TableHead>
                    <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                    <TableHead>{isArabic ? "ملاحظات" : "Notes"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                        {isArabic ? "لا توجد تفاصيل أسطر" : "No line details available"}
                      </TableCell>
                    </TableRow>
                  ) : orderLines.map((line, idx) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{line.brands?.brand_name || "-"}</TableCell>
                      <TableCell>{line.suppliers?.supplier_name || "-"}</TableCell>
                      <TableCell>{parseFloat(line.amount_in_currency || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>{parseFloat(line.base_amount_sar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{line.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {orderLines.length > 0 && (
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={3} className="text-end">{isArabic ? "الإجمالي" : "Total"}</TableCell>
                      <TableCell>{orderLines.reduce((s, l) => s + (parseFloat(l.amount_in_currency) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>{orderLines.reduce((s, l) => s + (parseFloat(l.base_amount_sar) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Download Image */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "صورة التحويل البنكي" : "Bank Transfer Image"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {selectedOrder.bank_transfer_image && (
              <img src={selectedOrder.bank_transfer_image} alt="Transfer" className="max-w-md max-h-64 rounded-lg border object-contain" />
            )}
            <Button onClick={handleDownload} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              {isArabic ? "تحميل الصورة" : "Download Image"}
            </Button>
          </CardContent>
        </Card>

        {/* Confirm Sending */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "تأكيد الإرسال" : "Confirm Sending"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {isArabic
                ? "قم بتحميل الصورة وإرسالها عبر تطبيق المورد. بعد الإرسال، قم بتأكيد ذلك هنا."
                : "Download the image and send it via the supplier app. After sending, confirm it here."}
            </p>
            <div className="flex items-center gap-3">
              <Checkbox
                id="confirm-sending"
                checked={sendingConfirmed}
                onCheckedChange={(checked) => setSendingConfirmed(checked === true)}
              />
              <label htmlFor="confirm-sending" className="font-medium cursor-pointer">
                {isArabic ? "أؤكد أنني أرسلت التحويل للمورد" : "I confirm that I have sent the transfer to the supplier"}
              </label>
            </div>
            <Button onClick={handleConfirmSending} disabled={saving || !sendingConfirmed}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {saving ? (isArabic ? "جاري الإرسال..." : "Sending...") : (isArabic ? "تأكيد وإرسال للاستلام" : "Confirm & Send to Receiving")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Coins className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isArabic ? "توجيه التحويلات" : "Sending Transfers"}</h1>
        </div>
        <CoinsPhaseFilterBar
          viewFilter={viewFilter}
          onViewFilterChange={setViewFilter}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          pendingLabel={{ ar: "المعلقة (توجيه)", en: "Pending (Sending)" }}
          sentLabel={{ ar: "المرسلة فقط", en: "Sent Only" }}
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                  <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                  <TableHead>{isArabic ? "أنشئ بواسطة" : "Created By"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {isArabic ? "لا توجد طلبات للتوجيه" : "No orders pending sending"}
                    </TableCell>
                  </TableRow>
                ) : orders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadOrder(o.id)}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                    <TableCell>{parseFloat(o.base_amount_sar || 0).toFixed(2)}</TableCell>
                    <TableCell>{o.created_by_name || o.created_by}</TableCell>
                    <TableCell><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoinsSending;
