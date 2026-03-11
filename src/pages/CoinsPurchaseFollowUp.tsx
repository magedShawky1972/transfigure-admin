import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, ClipboardList, RefreshCw, Undo2, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const phaseConfig = {
  creation: { label: "Creation", labelAr: "الإنشاء", color: "bg-blue-100 text-blue-800" },
  sending: { label: "Sending", labelAr: "الإرسال", color: "bg-yellow-100 text-yellow-800" },
  receiving: { label: "Receiving", labelAr: "الاستلام", color: "bg-orange-100 text-orange-800" },
  coins_entry: { label: "Coins Entry", labelAr: "إدخال الكوينز", color: "bg-purple-100 text-purple-800" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "bg-green-100 text-green-800" },
};

const sheetPhaseConfig = {
  creation: { label: "Creation", labelAr: "إنشاء", color: "bg-blue-100 text-blue-800" },
  sent_for_payment: { label: "Sent for Payment", labelAr: "مرسل للدفع", color: "bg-yellow-100 text-yellow-800" },
  accounting_approved: { label: "Accounting Review", labelAr: "مراجعة المحاسبة", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "bg-green-100 text-green-800" },
};

const salesSheetPhaseConfig = {
  entry: { label: "Entry", labelAr: "إدخال", color: "bg-blue-100 text-blue-800" },
  accounting_approved: { label: "Accounting Review", labelAr: "مراجعة المحاسبة", color: "bg-orange-100 text-orange-800" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "bg-green-100 text-green-800" },
};

const advancePaymentPhaseConfig = {
  entry: { label: "Entry", labelAr: "إدخال", color: "bg-blue-100 text-blue-800" },
  receiving: { label: "Receiving", labelAr: "استلام", color: "bg-amber-100 text-amber-800" },
  accounting: { label: "Accounting", labelAr: "محاسبة", color: "bg-green-100 text-green-800" },
};

const statusConfig = {
  draft: { label: "Draft", labelAr: "مسودة", variant: "secondary" as const },
  in_progress: { label: "In Progress", labelAr: "قيد التنفيذ", variant: "default" as const },
  active: { label: "Active", labelAr: "نشط", variant: "default" as const },
  completed: { label: "Completed", labelAr: "مكتمل", variant: "outline" as const },
};

const CoinsPurchaseFollowUp = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-purchase-followup");
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("purchase");
  const [orders, setOrders] = useState<any[]>([]);
  const [sheetOrders, setSheetOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [sheetFilterPhase, setSheetFilterPhase] = useState("all");
  const [sheetSearchText, setSheetSearchText] = useState("");

  // Sales Sheet state
  const [salesSheetOrders, setSalesSheetOrders] = useState<any[]>([]);
  const [salesSheetLoading, setSalesSheetLoading] = useState(true);
  const [salesSheetFilterPhase, setSalesSheetFilterPhase] = useState("all");
  const [salesSheetSearchText, setSalesSheetSearchText] = useState("");

  useEffect(() => { fetchOrders(); fetchSheetOrders(); fetchSalesSheetOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("coins_purchase_orders")
      .select("*, brands(brand_name), suppliers(supplier_name), banks(bank_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setOrders(data);
    setLoading(false);
  };

  const fetchSheetOrders = async () => {
    setSheetLoading(true);
    const { data } = await supabase
      .from("coins_sheet_orders")
      .select("*, coins_sheet_order_lines(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setSheetOrders(data);
    setSheetLoading(false);
  };

  const fetchSalesSheetOrders = async () => {
    setSalesSheetLoading(true);
    const { data } = await supabase
      .from("sales_sheet_orders" as any)
      .select("*, sales_sheet_order_lines(*)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data) setSalesSheetOrders(data as any[]);
    setSalesSheetLoading(false);
  };

  const filteredOrders = orders.filter(o => {
    if (filterPhase !== "all" && o.current_phase !== filterPhase) return false;
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (
        !o.order_number?.toLowerCase().includes(s) &&
        !o.created_by_name?.toLowerCase().includes(s) &&
        !(o.brands as any)?.brand_name?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const filteredSheetOrders = sheetOrders.filter(o => {
    if (sheetFilterPhase !== "all" && o.current_phase !== sheetFilterPhase) return false;
    if (sheetSearchText) {
      const s = sheetSearchText.toLowerCase();
      if (
        !o.order_number?.toLowerCase().includes(s) &&
        !o.created_by_name?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const filteredSalesSheetOrders = salesSheetOrders.filter(o => {
    if (salesSheetFilterPhase !== "all" && o.current_phase !== salesSheetFilterPhase) return false;
    if (salesSheetSearchText) {
      const s = salesSheetSearchText.toLowerCase();
      if (
        !o.order_number?.toLowerCase().includes(s) &&
        !o.created_by_name?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const navigateToPhase = (order: any) => {
    const phaseRoutes: Record<string, string> = {
      creation: `/coins-creation`,
      sending: `/coins-sending?order=${order.id}`,
      receiving: `/coins-receiving-phase?order=${order.id}`,
      coins_entry: `/receiving-coins`,
    };
    const route = phaseRoutes[order.current_phase];
    if (route) navigate(route);
  };

  const phaseOrder = ["creation", "sending", "receiving", "coins_entry", "completed"];
  const sheetPhaseOrder = ["creation", "sent_for_payment", "accounting_approved", "completed"];

  const returnToPreviousPhase = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIdx = phaseOrder.indexOf(order.current_phase);
    if (currentIdx <= 0) {
      toast.error(isArabic ? "لا يمكن الرجوع من هذه المرحلة" : "Cannot go back from this phase");
      return;
    }
    const previousPhase = phaseOrder[currentIdx - 1];
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (order.current_phase === "coins_entry") {
        const { data: headers } = await supabase
          .from("receiving_coins_header")
          .select("id")
          .eq("purchase_order_id", order.id);
        if (headers && headers.length > 0) {
          const headerIds = headers.map((h: any) => h.id);
          await supabase.from("receiving_coins_line").delete().in("header_id", headerIds);
          await supabase.from("receiving_coins_attachments").delete().in("header_id", headerIds);
          await supabase.from("receiving_coins_header").delete().in("id", headerIds);
        }
      }

      await supabase.from("coins_purchase_orders").update({
        current_phase: previousPhase,
        phase_updated_at: new Date().toISOString(),
      }).eq("id", order.id);

      await supabase.from("coins_purchase_phase_history").insert({
        purchase_order_id: order.id,
        from_phase: order.current_phase,
        to_phase: previousPhase,
        action: "return_to_previous",
        action_by: user?.email || "",
        action_by_name: user?.user_metadata?.display_name || user?.email || "",
        notes: isArabic ? "إرجاع للمرحلة السابقة" : "Returned to previous phase",
      });

      const prevLabel = phaseConfig[previousPhase as keyof typeof phaseConfig];
      toast.success(isArabic ? `تم إرجاع الطلب إلى مرحلة ${prevLabel?.labelAr}` : `Order returned to ${prevLabel?.label} phase`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  const returnSheetToPreviousPhase = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIdx = sheetPhaseOrder.indexOf(order.current_phase);
    if (currentIdx <= 0) {
      toast.error(isArabic ? "لا يمكن الرجوع من هذه المرحلة" : "Cannot go back from this phase");
      return;
    }
    const previousPhase = sheetPhaseOrder[currentIdx - 1];
    const confirmed = confirm(isArabic
      ? `هل تريد إرجاع الطلب ${order.order_number} إلى المرحلة السابقة؟`
      : `Return order ${order.order_number} to previous phase?`);
    if (!confirmed) return;

    try {
      const updateData: any = {
        current_phase: previousPhase,
        phase_updated_at: new Date().toISOString(),
      };
      // Clear accounting fields when rolling back from accounting_approved
      if (order.current_phase === "accounting_approved") {
        updateData.accounting_approved_by = null;
        updateData.accounting_approved_name = null;
        updateData.accounting_approved_at = null;
        updateData.accounting_notes = null;
        updateData.bank_transfer_image = null;
      }
      // Clear confirmation when rolling back from completed
      if (order.current_phase === "completed") {
        updateData.creator_confirmed = false;
        updateData.creator_confirmed_at = null;
      }

      const { error } = await supabase.from("coins_sheet_orders").update(updateData).eq("id", order.id);
      if (error) throw error;

      const prevLabel = sheetPhaseConfig[previousPhase as keyof typeof sheetPhaseConfig];
      toast.success(isArabic ? `تم إرجاع الطلب إلى مرحلة ${prevLabel?.labelAr}` : `Order returned to ${prevLabel?.label} phase`);
      fetchSheetOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  const returnSalesSheetToPreviousPhase = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const salesSheetPhaseOrder = ["entry", "accounting_approved", "completed"];
    const currentIdx = salesSheetPhaseOrder.indexOf(order.current_phase);
    if (currentIdx <= 0) {
      toast.error(isArabic ? "لا يمكن الرجوع من هذه المرحلة" : "Cannot go back from this phase");
      return;
    }
    const previousPhase = salesSheetPhaseOrder[currentIdx - 1];
    const confirmed = confirm(isArabic
      ? `هل تريد إرجاع الطلب ${order.order_number} إلى المرحلة السابقة؟`
      : `Return order ${order.order_number} to previous phase?`);
    if (!confirmed) return;

    try {
      const updateData: any = {
        current_phase: previousPhase,
        phase_updated_at: new Date().toISOString(),
      };
      if (order.current_phase === "completed") {
        updateData.accounting_approved_by = null;
        updateData.accounting_approved_name = null;
        updateData.accounting_approved_at = null;
        updateData.accounting_notes = null;
        updateData.bank_transfer_image = null;
        updateData.status = "active";
      }
      const { error } = await supabase.from("sales_sheet_orders" as any).update(updateData).eq("id", order.id);
      if (error) throw error;
      const prevLabel = salesSheetPhaseConfig[previousPhase as keyof typeof salesSheetPhaseConfig];
      toast.success(isArabic ? `تم إرجاع الطلب إلى مرحلة ${prevLabel?.labelAr}` : `Order returned to ${prevLabel?.label} phase`);
      fetchSalesSheetOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  const phaseCounts = orders.reduce((acc, o) => {
    acc[o.current_phase] = (acc[o.current_phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sheetPhaseCounts = sheetOrders.reduce((acc, o) => {
    acc[o.current_phase] = (acc[o.current_phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const salesSheetPhaseCounts = salesSheetOrders.reduce((acc, o) => {
    acc[o.current_phase] = (acc[o.current_phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isArabic ? "متابعة شراء الكوينز" : "Coins Purchase Follow-Up"}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchOrders(); fetchSheetOrders(); fetchSalesSheetOrders(); }} disabled={loading || sheetLoading || salesSheetLoading}>
          <RefreshCw className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"} ${loading || sheetLoading || salesSheetLoading ? "animate-spin" : ""}`} />
          {isArabic ? "تحديث" : "Refresh"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setFilterPhase("all"); setSheetFilterPhase("all"); }}>
        <TabsList>
          <TabsTrigger value="purchase" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            {isArabic ? "شراء الكوينز" : "Coins Purchase"}
            <Badge variant="secondary" className="ml-1">{orders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sheets" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {isArabic ? "شيتات الكوينز" : "Coins Sheets"}
            <Badge variant="secondary" className="ml-1">{sheetOrders.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sales_sheets" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {isArabic ? "شيت المبيعات" : "Sales Sheets"}
            <Badge variant="secondary" className="ml-1">{salesSheetOrders.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ===== COINS PURCHASE TAB ===== */}
        <TabsContent value="purchase" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(phaseConfig).map(([key, cfg]) => (
              <Card key={key} className={`cursor-pointer hover:shadow-md transition-shadow ${filterPhase === key ? "ring-2 ring-primary" : ""}`}
                onClick={() => setFilterPhase(filterPhase === key ? "all" : key)}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{phaseCounts[key] || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isArabic ? cfg.labelAr : cfg.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Input placeholder={isArabic ? "بحث بالرقم أو الاسم..." : "Search by number or name..."} value={searchText} onChange={e => setSearchText(e.target.value)} className="w-64" />
            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع المراحل" : "All Phases"}</SelectItem>
                {Object.entries(phaseConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع الحالات" : "All Statuses"}</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                      <TableHead>{isArabic ? "العلامة التجارية" : "Brand"}</TableHead>
                      <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                      <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                      <TableHead>{isArabic ? "المرحلة الحالية" : "Current Phase"}</TableHead>
                      <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                      <TableHead>{isArabic ? "أنشئ بواسطة" : "Created By"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          {loading ? (isArabic ? "جاري التحميل..." : "Loading...") : (isArabic ? "لا توجد طلبات" : "No orders found")}
                        </TableCell>
                      </TableRow>
                    ) : filteredOrders.map(o => {
                      const phase = phaseConfig[o.current_phase as keyof typeof phaseConfig] || phaseConfig.creation;
                      const status = statusConfig[o.status as keyof typeof statusConfig] || statusConfig.draft;
                      return (
                        <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigateToPhase(o)}>
                          <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                          <TableCell>{(o.brands as any)?.brand_name || "-"}</TableCell>
                          <TableCell>{(o.suppliers as any)?.supplier_name || "-"}</TableCell>
                          <TableCell>{parseFloat(o.base_amount_sar || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${phase.color}`}>
                              {isArabic ? phase.labelAr : phase.label}
                            </span>
                          </TableCell>
                          <TableCell><Badge variant={status.variant}>{isArabic ? status.labelAr : status.label}</Badge></TableCell>
                          <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                          <TableCell>{o.created_by_name || o.created_by}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" title={isArabic ? "فتح" : "Open"}><Eye className="h-4 w-4" /></Button>
                              {o.current_phase !== "creation" && o.current_phase !== "completed" && (
                                <Button variant="ghost" size="icon" title={isArabic ? "إرجاع للمرحلة السابقة" : "Return to previous phase"} onClick={(e) => returnToPreviousPhase(o, e)}>
                                  <Undo2 className="h-4 w-4 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SHEETS TAB ===== */}
        <TabsContent value="sheets" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(sheetPhaseConfig).map(([key, cfg]) => (
              <Card key={key} className={`cursor-pointer hover:shadow-md transition-shadow ${sheetFilterPhase === key ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSheetFilterPhase(sheetFilterPhase === key ? "all" : key)}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{sheetPhaseCounts[key] || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isArabic ? cfg.labelAr : cfg.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Input placeholder={isArabic ? "بحث بالرقم أو الاسم..." : "Search by number or name..."} value={sheetSearchText} onChange={e => setSheetSearchText(e.target.value)} className="w-64" />
            <Select value={sheetFilterPhase} onValueChange={setSheetFilterPhase}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع المراحل" : "All Phases"}</SelectItem>
                {Object.entries(sheetPhaseConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                      <TableHead>{isArabic ? "المنشئ" : "Created By"}</TableHead>
                      <TableHead>{isArabic ? "عدد الأسطر" : "Lines"}</TableHead>
                      <TableHead>{isArabic ? "الإجمالي ر.س" : "Total SAR"}</TableHead>
                      <TableHead>{isArabic ? "المرحلة الحالية" : "Current Phase"}</TableHead>
                      <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSheetOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {sheetLoading ? (isArabic ? "جاري التحميل..." : "Loading...") : (isArabic ? "لا توجد طلبات" : "No orders found")}
                        </TableCell>
                      </TableRow>
                    ) : filteredSheetOrders.map(o => {
                      const phase = sheetPhaseConfig[o.current_phase as keyof typeof sheetPhaseConfig] || sheetPhaseConfig.creation;
                      const totalSar = (o.coins_sheet_order_lines || []).reduce((s: number, l: any) => s + (l.total_sar || 0), 0);
                      return (
                        <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/coins-sheets")}>
                          <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                          <TableCell>{o.created_by_name || "-"}</TableCell>
                          <TableCell>{(o.coins_sheet_order_lines || []).length}</TableCell>
                          <TableCell>{totalSar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${phase.color}`}>
                              {isArabic ? phase.labelAr : phase.label}
                            </span>
                          </TableCell>
                          <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" title={isArabic ? "فتح" : "Open"} onClick={(e) => { e.stopPropagation(); navigate("/coins-sheets"); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {o.current_phase !== "creation" && o.current_phase !== "completed" && (
                                <Button variant="ghost" size="icon" title={isArabic ? "إرجاع للمرحلة السابقة" : "Return to previous phase"} onClick={(e) => returnSheetToPreviousPhase(o, e)}>
                                  <Undo2 className="h-4 w-4 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SALES SHEETS TAB ===== */}
        <TabsContent value="sales_sheets" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(salesSheetPhaseConfig).map(([key, cfg]) => (
              <Card key={key} className={`cursor-pointer hover:shadow-md transition-shadow ${salesSheetFilterPhase === key ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSalesSheetFilterPhase(salesSheetFilterPhase === key ? "all" : key)}>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{salesSheetPhaseCounts[key] || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">{isArabic ? cfg.labelAr : cfg.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Input placeholder={isArabic ? "بحث بالرقم أو الاسم..." : "Search by number or name..."} value={salesSheetSearchText} onChange={e => setSalesSheetSearchText(e.target.value)} className="w-64" />
            <Select value={salesSheetFilterPhase} onValueChange={setSalesSheetFilterPhase}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "جميع المراحل" : "All Phases"}</SelectItem>
                {Object.entries(salesSheetPhaseConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                      <TableHead>{isArabic ? "المنشئ" : "Created By"}</TableHead>
                      <TableHead>{isArabic ? "عدد الأسطر" : "Lines"}</TableHead>
                      <TableHead>{isArabic ? "الإجمالي ر.س" : "Total SAR"}</TableHead>
                      <TableHead>{isArabic ? "المرحلة الحالية" : "Current Phase"}</TableHead>
                      <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesSheetOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {salesSheetLoading ? (isArabic ? "جاري التحميل..." : "Loading...") : (isArabic ? "لا توجد طلبات" : "No orders found")}
                        </TableCell>
                      </TableRow>
                    ) : filteredSalesSheetOrders.map(o => {
                      const phase = salesSheetPhaseConfig[o.current_phase as keyof typeof salesSheetPhaseConfig] || salesSheetPhaseConfig.entry;
                      const totalSar = (o.sales_sheet_order_lines || []).reduce((s: number, l: any) => s + (l.total_sar || 0), 0);
                      return (
                        <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate("/sales-sheets")}>
                          <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                          <TableCell>{o.created_by_name || "-"}</TableCell>
                          <TableCell>{(o.sales_sheet_order_lines || []).length}</TableCell>
                          <TableCell>{totalSar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${phase.color}`}>
                              {isArabic ? phase.labelAr : phase.label}
                            </span>
                          </TableCell>
                          <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" title={isArabic ? "فتح" : "Open"} onClick={(e) => { e.stopPropagation(); navigate("/sales-sheets"); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {o.current_phase !== "entry" && o.current_phase !== "completed" && (
                                <Button variant="ghost" size="icon" title={isArabic ? "إرجاع للمرحلة السابقة" : "Return to previous phase"} onClick={(e) => returnSalesSheetToPreviousPhase(o, e)}>
                                  <Undo2 className="h-4 w-4 text-orange-500" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoinsPurchaseFollowUp;
