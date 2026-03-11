import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Save, ArrowLeft, Send, Trash2, FileText, Upload, Eye, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { parseBankTransferImages } from "@/lib/bankTransferImages";

interface SheetLine {
  id?: string;
  seller_name: string;
  brand_id: string;
  coins: string;
  rate: string;
  currency_id: string;
  sar_rate: string;
  total_sar: string;
  notes: string;
  line_number: number;
}

const emptyLine = (lineNumber: number): SheetLine => ({
  seller_name: "",
  brand_id: "",
  coins: "",
  rate: "",
  currency_id: "",
  sar_rate: "1",
  total_sar: "0",
  notes: "",
  line_number: lineNumber,
});

const PHASES = [
  { key: "creation", ar: "إنشاء", en: "Creation" },
  { key: "sent_for_payment", ar: "مرسل للدفع", en: "Sent for Payment" },
  { key: "accounting_approved", ar: "اعتماد المحاسبة", en: "Accounting Approved" },
  { key: "completed", ar: "مكتمل", en: "Completed" },
];

const CoinsSheets = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-sheets");

  const [view, setView] = useState<"list" | "form">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<SheetLine[]>([emptyLine(1)]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderPhase, setSelectedOrderPhase] = useState("creation");
  const [selectedOrderNumber, setSelectedOrderNumber] = useState("");

  // Dropdowns
  const [brands, setBrands] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [currencyRates, setCurrencyRates] = useState<any[]>([]);

  // Filter
  const [phaseFilter, setPhaseFilter] = useState("all");

  // Accounting dialog
  const [accountingDialog, setAccountingDialog] = useState(false);
  const [accountingNotes, setAccountingNotes] = useState("");
  const [bankTransferImages, setBankTransferImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processingOrder, setProcessingOrder] = useState<any>(null);

  // Current user
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  useEffect(() => {
    fetchOrders();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (view === "form") fetchDropdowns();
  }, [view]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user.id).single();
      setCurrentUserName(profile?.user_name || user.email || "");
    }
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("coins_sheet_orders")
      .select("*, coins_sheet_order_lines(*)")
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
  };

  const fetchDropdowns = async () => {
    const [brandRes, currRes, rateRes] = await Promise.all([
      supabase.from("brands").select("id, brand_name").eq("status", "active").order("brand_name"),
      supabase.from("currencies").select("*").eq("is_active", true).order("currency_name"),
      supabase.from("currency_rates").select("*").order("effective_date", { ascending: false }),
    ]);
    if (brandRes.data) setBrands(brandRes.data);
    if (currRes.data) setCurrencies(currRes.data);
    if (rateRes.data) setCurrencyRates(rateRes.data);
  };

  const handleLineChange = (index: number, field: keyof SheetLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate total_sar
      if (["coins", "rate", "sar_rate"].includes(field)) {
        const coins = parseFloat(updated[index].coins) || 0;
        const rate = parseFloat(updated[index].rate) || 0;
        const sarRate = parseFloat(updated[index].sar_rate) || 1;
        updated[index].total_sar = (coins * rate * sarRate).toFixed(2);
      }

      // Auto-fill SAR rate when currency changes
      if (field === "currency_id") {
        const rateEntry = currencyRates.find(r => r.currency_id === value);
        if (rateEntry) {
          updated[index].sar_rate = String(rateEntry.rate_to_base);
          const coins = parseFloat(updated[index].coins) || 0;
          const rate = parseFloat(updated[index].rate) || 0;
          updated[index].total_sar = (coins * rate * rateEntry.rate_to_base).toFixed(2);
        }
      }

      return updated;
    });
  };

  const addLine = () => setLines(prev => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, line_number: i + 1 })));
  };

  const handleSave = async () => {
    const validLines = lines.filter(l => l.seller_name && l.brand_id && parseFloat(l.coins) > 0);
    if (validLines.length === 0) {
      toast.error(isArabic ? "يرجى إضافة سطر واحد على الأقل" : "Please add at least one line");
      return;
    }

    setSaving(true);
    try {
      if (selectedOrderId) {
        // Update
        await supabase.from("coins_sheet_orders").update({ notes }).eq("id", selectedOrderId);
        await supabase.from("coins_sheet_order_lines").delete().eq("sheet_order_id", selectedOrderId);
        const lineInserts = validLines.map((l, i) => ({
          sheet_order_id: selectedOrderId,
          line_number: i + 1,
          seller_name: l.seller_name,
          brand_id: l.brand_id,
          coins: parseFloat(l.coins) || 0,
          rate: parseFloat(l.rate) || 0,
          currency_id: l.currency_id || null,
          sar_rate: parseFloat(l.sar_rate) || 1,
          total_sar: parseFloat(l.total_sar) || 0,
          notes: l.notes,
        }));
        await supabase.from("coins_sheet_order_lines").insert(lineInserts);
        toast.success(isArabic ? "تم الحفظ" : "Saved");
      } else {
        // Create new
        const { data: order, error } = await supabase.from("coins_sheet_orders").insert({
          order_number: "",
          created_by: currentUserId,
          created_by_name: currentUserName,
          notes,
        }).select().single();
        if (error) throw error;

        const lineInserts = validLines.map((l, i) => ({
          sheet_order_id: order.id,
          line_number: i + 1,
          seller_name: l.seller_name,
          brand_id: l.brand_id,
          coins: parseFloat(l.coins) || 0,
          rate: parseFloat(l.rate) || 0,
          currency_id: l.currency_id || null,
          sar_rate: parseFloat(l.sar_rate) || 1,
          total_sar: parseFloat(l.total_sar) || 0,
          notes: l.notes,
        }));
        await supabase.from("coins_sheet_order_lines").insert(lineInserts);
        toast.success(isArabic ? "تم إنشاء الطلب" : "Order created");
      }

      resetForm();
      setView("list");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleSendForPayment = async (orderId: string) => {
    const { error } = await supabase.from("coins_sheet_orders").update({
      current_phase: "sent_for_payment",
      phase_updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }

    // Send notification to accounting users
    const { data: assignments } = await supabase
      .from("coins_sheet_workflow_assignments")
      .select("user_id, user_name")
      .eq("phase", "accounting");
    if (assignments) {
      for (const a of assignments) {
        await supabase.functions.invoke("send-coins-workflow-notification", {
          body: {
            type: "sheet_sent_for_payment",
            userId: a.user_id,
            userName: a.user_name || "",
            orderNumber: orders.find(o => o.id === orderId)?.order_number || "",
          },
        }).catch(console.error);
      }
    }

    toast.success(isArabic ? "تم الإرسال للدفع" : "Sent for payment");
    fetchOrders();
  };

  const handleAccountingApprove = async () => {
    if (!processingOrder) return;
    setSaving(true);
    try {
      const imageJson = bankTransferImages.length > 0 ? JSON.stringify(bankTransferImages) : null;
      const { error } = await supabase.from("coins_sheet_orders").update({
        current_phase: "accounting_approved",
        phase_updated_at: new Date().toISOString(),
        accounting_approved_by: currentUserId,
        accounting_approved_name: currentUserName,
        accounting_approved_at: new Date().toISOString(),
        accounting_notes: accountingNotes,
        bank_transfer_image: imageJson,
      }).eq("id", processingOrder.id);
      if (error) throw error;

      // Notify creator
      await supabase.functions.invoke("send-coins-workflow-notification", {
        body: {
          type: "sheet_accounting_approved",
          userId: processingOrder.created_by,
          userName: processingOrder.created_by_name || "",
          orderNumber: processingOrder.order_number,
        },
      }).catch(console.error);

      toast.success(isArabic ? "تم اعتماد المحاسبة" : "Accounting approved");
      setAccountingDialog(false);
      setAccountingNotes("");
      setBankTransferImages([]);
      setProcessingOrder(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreatorConfirm = async (orderId: string) => {
    const { error } = await supabase.from("coins_sheet_orders").update({
      current_phase: "completed",
      status: "completed",
      creator_confirmed: true,
      creator_confirmed_at: new Date().toISOString(),
      phase_updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(isArabic ? "تم التأكيد" : "Confirmed");
    fetchOrders();
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `sheet-transfers/${Date.now()}-${Math.random().toString(36).substr(2)}.${ext}`;
        const { error } = await supabase.storage.from("sheet-transfer-files").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("sheet-transfer-files").getPublicUrl(path);
        setBankTransferImages(prev => [...prev, urlData.publicUrl]);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const loadOrder = (order: any) => {
    setSelectedOrderId(order.id);
    setSelectedOrderPhase(order.current_phase);
    setSelectedOrderNumber(order.order_number);
    setNotes(order.notes || "");
    const orderLines = order.coins_sheet_order_lines || [];
    if (orderLines.length > 0) {
      setLines(orderLines.sort((a: any, b: any) => a.line_number - b.line_number).map((l: any) => ({
        id: l.id,
        seller_name: l.seller_name || "",
        brand_id: l.brand_id || "",
        coins: String(l.coins || 0),
        rate: String(l.rate || 0),
        currency_id: l.currency_id || "",
        sar_rate: String(l.sar_rate || 1),
        total_sar: String(l.total_sar || 0),
        notes: l.notes || "",
        line_number: l.line_number,
      })));
    } else {
      setLines([emptyLine(1)]);
    }
    setView("form");
  };

  const resetForm = () => {
    setSelectedOrderId(null);
    setSelectedOrderPhase("creation");
    setSelectedOrderNumber("");
    setNotes("");
    setLines([emptyLine(1)]);
  };

  const getPhaseLabel = (key: string) => {
    const p = PHASES.find(ph => ph.key === key);
    return isArabic ? p?.ar || key : p?.en || key;
  };

  const getPhaseBadgeVariant = (phase: string) => {
    switch (phase) {
      case "creation": return "secondary";
      case "sent_for_payment": return "default";
      case "accounting_approved": return "outline";
      case "completed": return "default";
      default: return "secondary";
    }
  };

  const filteredOrders = phaseFilter === "all" ? orders : orders.filter(o => o.current_phase === phaseFilter);

  const grandTotal = lines.reduce((sum, l) => sum + (parseFloat(l.total_sar) || 0), 0);

  const isEditable = !selectedOrderId || selectedOrderPhase === "creation";

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (hasAccess === false) return <AccessDenied />;

  if (view === "form") {
    return (
      <div className={`p-4 md:p-6 space-y-4 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { resetForm(); setView("list"); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{isArabic ? "شيتات - طلب دفع" : "Sheets - Payment Request"}</h1>
            {selectedOrderNumber && <Badge variant="outline" className="text-lg px-3">{selectedOrderNumber}</Badge>}
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {isArabic ? "حفظ" : "Save"}
                </Button>
                {selectedOrderId && selectedOrderPhase === "creation" && (
                  <Button variant="default" onClick={() => handleSendForPayment(selectedOrderId)} className="bg-blue-600 hover:bg-blue-700">
                    <Send className="h-4 w-4 mr-1" />
                    {isArabic ? "إرسال للدفع" : "Send for Payment"}
                  </Button>
                )}
              </>
            )}
            {selectedOrderPhase === "accounting_approved" && selectedOrderId && (
              <Button variant="default" onClick={() => handleCreatorConfirm(selectedOrderId)} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-4 w-4 mr-1" />
                {isArabic ? "تأكيد استلام التحويل" : "Confirm Transfer Received"}
              </Button>
            )}
          </div>
        </div>

        {/* Phase Steps */}
        <div className="flex items-center justify-center gap-2 py-3">
          {PHASES.map((p, i) => {
            const phaseIndex = PHASES.findIndex(ph => ph.key === selectedOrderPhase);
            const isActive = PHASES.findIndex(ph => ph.key === p.key) <= phaseIndex;
            return (
              <div key={p.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <span>{i + 1}.</span>
                  <span>{isArabic ? p.ar : p.en}</span>
                </div>
                {i < PHASES.length - 1 && <div className={`w-8 h-0.5 ${isActive ? "bg-primary" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>

        {/* Show bank transfer info if accounting approved */}
        {selectedOrderPhase === "accounting_approved" && selectedOrderId && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">{isArabic ? "تم اعتماد المحاسبة والتحويل البنكي" : "Accounting approved & bank transfer done"}</span>
              </div>
              {(() => {
                const order = orders.find(o => o.id === selectedOrderId);
                if (!order) return null;
                return (
                  <div className="space-y-2 text-sm">
                    {order.accounting_approved_name && <p>{isArabic ? "معتمد بواسطة:" : "Approved by:"} {order.accounting_approved_name}</p>}
                    {order.accounting_notes && <p>{isArabic ? "ملاحظات:" : "Notes:"} {order.accounting_notes}</p>}
                    {order.bank_transfer_image && (
                      <div className="flex gap-2 flex-wrap">
                        {parseBankTransferImages(order.bank_transfer_image).map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {isArabic ? `مرفق ${i + 1}` : `Attachment ${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardContent className="pt-4">
            <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={!isEditable} className="mt-1" />
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{isArabic ? "تفاصيل الشيت" : "Sheet Details"}</CardTitle>
              {isEditable && (
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isArabic ? "إضافة سطر" : "Add Line"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{isArabic ? "اسم البائع" : "Seller Name"}</TableHead>
                    <TableHead>{isArabic ? "العلامة التجارية" : "Brand"}</TableHead>
                    <TableHead>{isArabic ? "الكوينز" : "Coins"}</TableHead>
                    <TableHead>{isArabic ? "السعر" : "Rate"}</TableHead>
                    <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                    <TableHead>{isArabic ? "سعر الريال" : "SAR Rate"}</TableHead>
                    <TableHead>{isArabic ? "الإجمالي ر.س" : "Total SAR"}</TableHead>
                    <TableHead>{isArabic ? "ملاحظات" : "Notes"}</TableHead>
                    {isEditable && <TableHead className="w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{line.line_number}</TableCell>
                      <TableCell>
                        <Input
                          value={line.seller_name}
                          onChange={e => handleLineChange(index, "seller_name", e.target.value)}
                          disabled={!isEditable}
                          placeholder={isArabic ? "اسم البائع" : "Seller name"}
                          className="min-w-[140px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={line.brand_id} onValueChange={v => handleLineChange(index, "brand_id", v)} disabled={!isEditable}>
                          <SelectTrigger className="min-w-[130px]"><SelectValue placeholder={isArabic ? "اختر" : "Select"} /></SelectTrigger>
                          <SelectContent>
                            {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.coins}
                          onChange={e => handleLineChange(index, "coins", e.target.value)}
                          disabled={!isEditable}
                          className="min-w-[90px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.rate}
                          onChange={e => handleLineChange(index, "rate", e.target.value)}
                          disabled={!isEditable}
                          className="min-w-[90px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={line.currency_id} onValueChange={v => handleLineChange(index, "currency_id", v)} disabled={!isEditable}>
                          <SelectTrigger className="min-w-[110px]"><SelectValue placeholder={isArabic ? "اختر" : "Select"} /></SelectTrigger>
                          <SelectContent>
                            {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code || c.currency_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.sar_rate}
                          onChange={e => handleLineChange(index, "sar_rate", e.target.value)}
                          disabled={!isEditable}
                          className="min-w-[80px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.total_sar}
                          readOnly
                          className="min-w-[100px] bg-muted font-semibold"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.notes}
                          onChange={e => handleLineChange(index, "notes", e.target.value)}
                          disabled={!isEditable}
                          className="min-w-[100px]"
                        />
                      </TableCell>
                      {isEditable && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeLine(index)} disabled={lines.length <= 1}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {/* Grand Total Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={7} className="text-end">{isArabic ? "الإجمالي" : "Grand Total"}</TableCell>
                    <TableCell>{grandTotal.toFixed(2)}</TableCell>
                    <TableCell colSpan={isEditable ? 2 : 1}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className={`p-4 md:p-6 space-y-4 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isArabic ? "شيتات" : "Sheets"}</h1>
        </div>
        <Button onClick={() => { resetForm(); setView("form"); }}>
          <Plus className="h-4 w-4 mr-1" />
          {isArabic ? "طلب دفع جديد" : "New Payment Request"}
        </Button>
      </div>

      {/* Phase Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={phaseFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setPhaseFilter("all")}>
          {isArabic ? "الكل" : "All"} ({orders.length})
        </Button>
        {PHASES.map(p => {
          const count = orders.filter(o => o.current_phase === p.key).length;
          return (
            <Button key={p.key} variant={phaseFilter === p.key ? "default" : "outline"} size="sm" onClick={() => setPhaseFilter(p.key)}>
              {isArabic ? p.ar : p.en} ({count})
            </Button>
          );
        })}
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                <TableHead>{isArabic ? "المنشئ" : "Created By"}</TableHead>
                <TableHead>{isArabic ? "عدد الأسطر" : "Lines"}</TableHead>
                <TableHead>{isArabic ? "الإجمالي ر.س" : "Total SAR"}</TableHead>
                <TableHead>{isArabic ? "المرحلة" : "Phase"}</TableHead>
                <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{isArabic ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {isArabic ? "لا توجد طلبات" : "No orders found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => {
                  const totalSar = (order.coins_sheet_order_lines || []).reduce((s: number, l: any) => s + (l.total_sar || 0), 0);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.created_by_name}</TableCell>
                      <TableCell>{(order.coins_sheet_order_lines || []).length}</TableCell>
                      <TableCell className="font-semibold">{totalSar.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getPhaseBadgeVariant(order.current_phase)} className={
                          order.current_phase === "completed" ? "bg-green-600 text-white" :
                          order.current_phase === "accounting_approved" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""
                        }>
                          {getPhaseLabel(order.current_phase)}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => loadOrder(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {order.current_phase === "sent_for_payment" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => { setProcessingOrder(order); setAccountingDialog(true); }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Accounting Approval Dialog */}
      <Dialog open={accountingDialog} onOpenChange={setAccountingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isArabic ? "اعتماد المحاسبة وإرفاق التحويل" : "Accounting Approval & Attach Transfer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isArabic ? "ملاحظات المحاسبة" : "Accounting Notes"}</Label>
              <Textarea value={accountingNotes} onChange={e => setAccountingNotes(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{isArabic ? "إرفاق إيصال التحويل البنكي" : "Attach Bank Transfer Receipt"}</Label>
              <div className="mt-1">
                <Input type="file" accept="image/*,.pdf" multiple onChange={handleUploadFile} disabled={uploading} />
                {bankTransferImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {bankTransferImages.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                        {isArabic ? `مرفق ${i + 1}` : `File ${i + 1}`}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAccountingDialog(false); setProcessingOrder(null); }}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleAccountingApprove} disabled={saving || uploading} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-1" />
              {isArabic ? "اعتماد وإرسال" : "Approve & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoinsSheets;
