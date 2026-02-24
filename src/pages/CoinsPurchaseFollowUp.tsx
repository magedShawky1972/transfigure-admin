import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Eye, ClipboardList, RefreshCw, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const phaseConfig = {
  creation: { label: "Creation", labelAr: "الإنشاء", color: "bg-blue-100 text-blue-800" },
  sending: { label: "Sending", labelAr: "الإرسال", color: "bg-yellow-100 text-yellow-800" },
  receiving: { label: "Receiving", labelAr: "الاستلام", color: "bg-orange-100 text-orange-800" },
  coins_entry: { label: "Coins Entry", labelAr: "إدخال العملات", color: "bg-purple-100 text-purple-800" },
  completed: { label: "Completed", labelAr: "مكتمل", color: "bg-green-100 text-green-800" },
};

const statusConfig = {
  draft: { label: "Draft", labelAr: "مسودة", variant: "secondary" as const },
  in_progress: { label: "In Progress", labelAr: "قيد التنفيذ", variant: "default" as const },
  completed: { label: "Completed", labelAr: "مكتمل", variant: "outline" as const },
};

const CoinsPurchaseFollowUp = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-purchase-followup");
  const navigate = useNavigate();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  useEffect(() => { fetchOrders(); }, []);

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

      // If rolling back FROM coins_entry, delete auto-created receiving entries
      if (order.current_phase === "coins_entry") {
        // Find headers linked to this purchase order
        const { data: headers } = await supabase
          .from("receiving_coins_header")
          .select("id")
          .eq("purchase_order_id", order.id);
        if (headers && headers.length > 0) {
          const headerIds = headers.map((h: any) => h.id);
          // Delete lines first (FK constraint), then headers
          await supabase.from("receiving_coins_line").delete().in("header_id", headerIds);
          await supabase.from("receiving_coins_attachments").delete().in("header_id", headerIds);
          await supabase.from("receiving_coins_header").delete().in("id", headerIds);
        }
      }

      await supabase.from("coins_purchase_orders").update({
        current_phase: previousPhase,
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

  const phaseCounts = orders.reduce((acc, o) => {
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
          <h1 className="text-2xl font-bold">{isArabic ? "متابعة شراء العملات" : "Coins Purchase Follow-Up"}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"} ${loading ? "animate-spin" : ""}`} />
          {isArabic ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Summary Cards */}
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

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder={isArabic ? "بحث بالرقم أو الاسم..." : "Search by number or name..."}
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-64"
        />
        <Select value={filterPhase} onValueChange={setFilterPhase}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isArabic ? "جميع المراحل" : "All Phases"}</SelectItem>
            {Object.entries(phaseConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isArabic ? "جميع الحالات" : "All Statuses"}</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{isArabic ? v.labelAr : v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
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
                      <TableCell>
                        <Badge variant={status.variant}>{isArabic ? status.labelAr : status.label}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{o.created_by_name || o.created_by}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" title={isArabic ? "فتح" : "Open"}>
                            <Eye className="h-4 w-4" />
                          </Button>
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
    </div>
  );
};

export default CoinsPurchaseFollowUp;
