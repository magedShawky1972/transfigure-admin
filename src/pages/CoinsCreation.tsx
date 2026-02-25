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
import { Plus, Save, Upload, ArrowLeft, Eye, Send, Coins, Trash2, Lock, FileText } from "lucide-react";
import { format } from "date-fns";
import { convertToBaseCurrency, type CurrencyRate, type Currency } from "@/lib/currencyConversion";
import CoinsPhaseFilterBar, { type PhaseViewFilter } from "@/components/CoinsPhaseFilterBar";
import CoinsPhaseSteps from "@/components/CoinsPhaseSteps";
import CoinsOrderAttachments from "@/components/CoinsOrderAttachments";

interface OrderLine {
  id?: string;
  brand_id: string;
  supplier_id: string;
  amount_in_currency: string;
  base_amount_sar: string;
  notes: string;
  line_number: number;
}

const emptyLine = (lineNumber: number): OrderLine => ({
  brand_id: "",
  supplier_id: "",
  amount_in_currency: "",
  base_amount_sar: "",
  notes: "",
  line_number: lineNumber,
});

const CoinsCreation = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-creation");

  const [view, setView] = useState<"list" | "form">("list");
  const [orders, setOrders] = useState<any[]>([]);

  // Header state
  const [supplierId, setSupplierId] = useState("");
  const [bankId, setBankId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [notes, setNotes] = useState("");
  const [bankTransferImage, setBankTransferImage] = useState("");
  const [bankTransferFee, setBankTransferFee] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderPhase, setSelectedOrderPhase] = useState<string>("creation");

  // Filters
  const [viewFilter, setViewFilter] = useState<PhaseViewFilter>("pending");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  // Lines state
  const [lines, setLines] = useState<OrderLine[]>([emptyLine(1)]);

  // Dropdown data
  const [brands, setBrands] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);

  useEffect(() => { fetchOrders(); }, []);
  useEffect(() => { if (view === "form") fetchDropdowns(); }, [view]);

  useEffect(() => {
    if (currencyId) {
      const baseCurrency = currencies.find(c => c.is_base);
      const rate = currencyRates.find(r => r.currency_id === currencyId);
      if (rate) {
        setExchangeRate(String(rate.rate_to_base));
      } else if (baseCurrency && currencyId === baseCurrency.id) {
        setExchangeRate("1");
      }
    }
  }, [currencyId, currencyRates, currencies]);

  // Helper to calculate base amount using manual exchange rate
  const calcBaseAmount = (amount: number): number => {
    const rate = parseFloat(exchangeRate) || 1;
    const baseCurrency = currencies.find(c => c.is_base);
    if (baseCurrency && currencyId === baseCurrency.id) return amount;
    // Use the conversion operator from DB if available, otherwise multiply
    const rateRecord = currencyRates.find(r => r.currency_id === currencyId);
    const operator = rateRecord?.conversion_operator || 'multiply';
    return operator === 'multiply' ? amount * rate : amount / rate;
  };

  // Recalculate base amounts when currency/rate changes
  useEffect(() => {
    setLines(prev => prev.map(line => {
      const amount = parseFloat(line.amount_in_currency) || 0;
      const converted = calcBaseAmount(amount);
      return { ...line, base_amount_sar: converted.toFixed(2) };
    }));
  }, [currencyId, exchangeRate, currencyRates, currencies]);

  const totalInCurrency = lines.reduce((sum, l) => sum + (parseFloat(l.amount_in_currency) || 0), 0);
  const totalBaseSar = lines.reduce((sum, l) => sum + (parseFloat(l.base_amount_sar) || 0), 0) + (parseFloat(bankTransferFee) || 0);

  const fetchOrders = async () => {
    let query = supabase
      .from("coins_purchase_orders")
      .select("*, currencies(currency_code)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (viewFilter === "pending") {
      query = query.eq("current_phase", "creation");
    } else if (viewFilter === "sent") {
      query = query.neq("current_phase", "creation");
    }

    if (fromDate) query = query.gte("created_at", format(fromDate, "yyyy-MM-dd"));
    if (toDate) query = query.lte("created_at", format(toDate, "yyyy-MM-dd") + "T23:59:59");

    const { data } = await query;
    if (data) setOrders(data);
  };

  useEffect(() => { fetchOrders(); }, [viewFilter, fromDate, toDate]);

  const fetchDropdowns = async () => {
    const [brandRes, suppRes, bankRes, currRes, rateRes] = await Promise.all([
      supabase.from("brands").select("id, brand_name, abc_analysis").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("banks").select("id, bank_name").eq("is_active", true).order("bank_name"),
      supabase.from("currencies").select("*").eq("is_active", true).order("currency_name"),
      supabase.from("currency_rates").select("*"),
    ]);
    if (brandRes.data) setBrands(brandRes.data);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (bankRes.data) setBanks(bankRes.data);
    if (currRes.data) setCurrencies(currRes.data as any);
    if (rateRes.data) setCurrencyRates(rateRes.data as any);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
      const publicId = `coins-creation/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");
      setBankTransferImage(data.url);
      toast.success(isArabic ? "تم رفع الملف بنجاح" : "File uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const updateLine = (index: number, field: keyof OrderLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-calculate base amount when amount changes
      if (field === "amount_in_currency") {
        const amount = parseFloat(value) || 0;
        const converted = calcBaseAmount(amount);
        updated[index].base_amount_sar = converted.toFixed(2);
      }
      return updated;
    });
  };

  const addLine = () => {
    setLines(prev => [...prev, emptyLine(prev.length + 1)]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, line_number: i + 1 })));
  };

  // Auto-select supplier when brand changes (per line)
  const handleBrandChange = async (index: number, brandIdVal: string) => {
    updateLine(index, "brand_id", brandIdVal);
    if (brandIdVal) {
      const { data } = await supabase.from("brand_suppliers").select("supplier_id").eq("brand_id", brandIdVal);
      if (data && data.length > 0) {
        const linkedIds = data.map(d => d.supplier_id);
        const filtered = suppliers.filter(s => linkedIds.includes(s.id));
        if (filtered.length === 1) {
          updateLine(index, "supplier_id", filtered[0].id);
        }
      }
    }
  };

  const handleSave = async (sendToNext = false) => {
    if (!bankId || !currencyId) {
      toast.error(isArabic ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    const validLines = lines.filter(l => l.brand_id);
    if (validLines.length === 0) {
      toast.error(isArabic ? "يرجى إضافة سطر واحد على الأقل" : "Please add at least one line");
      return;
    }
    if (!bankTransferImage) {
      toast.error(isArabic ? "يرجى رفع صورة التحويل البنكي" : "Please upload the bank transfer image");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Use first line's brand for backward compat
      const orderData: any = {
        brand_id: validLines[0].brand_id,
        supplier_id: supplierId || null,
        bank_id: bankId,
        currency_id: currencyId,
        exchange_rate: parseFloat(exchangeRate) || 1,
        amount_in_currency: totalInCurrency,
        base_amount_sar: totalBaseSar,
        bank_transfer_image: bankTransferImage,
        bank_transfer_fee: parseFloat(bankTransferFee) || 0,
        notes,
        created_by: user?.email || "",
        created_by_name: user?.user_metadata?.display_name || user?.email || "",
        current_phase: sendToNext ? "sending" : "creation",
        status: sendToNext ? "in_progress" : "draft",
      };

      let orderId: string;
      if (selectedOrderId) {
        const { error } = await supabase.from("coins_purchase_orders").update(orderData).eq("id", selectedOrderId);
        if (error) throw error;
        orderId = selectedOrderId;
        // Delete old lines then re-insert
        await supabase.from("coins_purchase_order_lines").delete().eq("purchase_order_id", selectedOrderId);
      } else {
        orderData.order_number = `CPO-${format(new Date(), "yyyyMMdd")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
        const { data, error } = await supabase.from("coins_purchase_orders").insert(orderData).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }

      // Insert lines
      const lineInserts = validLines.map((l, i) => ({
        purchase_order_id: orderId,
        brand_id: l.brand_id,
        supplier_id: l.supplier_id || null,
        amount_in_currency: parseFloat(l.amount_in_currency) || 0,
        base_amount_sar: parseFloat(l.base_amount_sar) || 0,
        notes: l.notes || null,
        line_number: i + 1,
      }));
      const { error: lineErr } = await supabase.from("coins_purchase_order_lines").insert(lineInserts);
      if (lineErr) throw lineErr;

      // Log phase history & notify
      if (sendToNext) {
        await supabase.from("coins_purchase_phase_history").insert({
          purchase_order_id: orderId,
          from_phase: "creation",
          to_phase: "sending",
          action: "submit",
          action_by: user?.email || "",
          action_by_name: user?.user_metadata?.display_name || user?.email || "",
        });

        // Notify for each brand's responsible person
        for (const line of validLines) {
          await notifyResponsible(line.brand_id, "sending", orderId);
        }
      }

      toast.success(isArabic ? "تم الحفظ بنجاح" : "Saved successfully");
      resetForm();
      fetchOrders();
      setView("list");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
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

      const brand = brands.find(b => b.id === bId);
      const phaseLabelsAr: Record<string, string> = { sending: "التوجيه", receiving: "الاستلام", coins_entry: "إدخال الكوينز" };
      const order = orders.find(o => o.id === orderId);

      for (const assignment of assignments) {
        await supabase.from("notifications").insert({
          user_id: assignment.user_id,
          title: isArabic ? "مهمة معاملات كوينز جديدة" : "New Coins Transaction Task",
          message: isArabic
            ? `لديك مهمة جديدة في مرحلة ${phaseLabelsAr[phase] || phase}`
            : `You have a new task in the ${phase} phase`,
          type: "coins_workflow",
          link: phase === "sending" ? `/coins-sending?order=${orderId}` : phase === "receiving" ? `/coins-receiving-phase?order=${orderId}` : `/receiving-coins`,
        } as any);

        supabase.functions.invoke("send-coins-workflow-notification", {
          body: {
            type: "phase_transition",
            userId: assignment.user_id,
            userName: assignment.user_name || "",
            brandNames: [brand?.brand_name || ""],
            phase,
            phaseLabel: phaseLabelsAr[phase] || phase,
            orderNumber: order?.order_number || "",
            orderId,
            link: phase === "sending" ? `/coins-sending?order=${orderId}` : phase === "receiving" ? `/coins-receiving-phase?order=${orderId}` : `/receiving-coins`,
          },
        }).catch(err => console.error("Notification error:", err));
      }
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  const resetForm = () => {
    setSupplierId(""); setBankId(""); setCurrencyId("");
    setExchangeRate("1"); setNotes(""); setBankTransferImage("");
    setBankTransferFee(""); setSelectedOrderId(null); setSelectedOrderPhase("creation"); setLines([emptyLine(1)]);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(isArabic ? "هل أنت متأكد من حذف هذا الطلب؟" : "Are you sure you want to delete this order?")) return;
    try {
      await supabase.from("coins_purchase_order_lines").delete().eq("purchase_order_id", orderId);
      await supabase.from("coins_purchase_phase_history").delete().eq("purchase_order_id", orderId);
      const { error } = await supabase.from("coins_purchase_orders").delete().eq("id", orderId);
      if (error) throw error;
      toast.success(isArabic ? "تم حذف الطلب بنجاح" : "Order deleted successfully");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  const loadOrder = async (id: string) => {
    const [orderRes, linesRes] = await Promise.all([
      supabase.from("coins_purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("coins_purchase_order_lines").select("*").eq("purchase_order_id", id).order("line_number"),
    ]);
    const data = orderRes.data;
    if (data) {
      setSelectedOrderId(data.id);
      setSelectedOrderPhase(data.current_phase || "creation");
      setSupplierId(data.supplier_id || "");
      setBankId(data.bank_id || "");
      setCurrencyId(data.currency_id || "");
      setExchangeRate(String(data.exchange_rate || 1));
      setNotes(data.notes || "");
      setBankTransferImage(data.bank_transfer_image || "");
      setBankTransferFee(String(data.bank_transfer_fee || ""));

      if (linesRes.data && linesRes.data.length > 0) {
        setLines(linesRes.data.map((l: any) => ({
          id: l.id,
          brand_id: l.brand_id || "",
          supplier_id: l.supplier_id || "",
          amount_in_currency: String(l.amount_in_currency || ""),
          base_amount_sar: String(l.base_amount_sar || ""),
          notes: l.notes || "",
          line_number: l.line_number,
        })));
      } else {
        // Legacy single-line order - load from header
        setLines([{
          brand_id: data.brand_id || "",
          supplier_id: data.supplier_id || "",
          amount_in_currency: String(data.amount_in_currency || ""),
          base_amount_sar: String(data.base_amount_sar || ""),
          notes: "",
          line_number: 1,
        }]);
      }
      setView("form");
    }
  };

  const getPhaseLabel = (phase: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      creation: { ar: "إنشاء", en: "Creation" },
      sending: { ar: "توجيه", en: "Sending" },
      receiving: { ar: "استلام", en: "Receiving" },
      coins_entry: { ar: "إدخال الكوينز", en: "Coins Entry" },
      completed: { ar: "مكتمل", en: "Completed" },
    };
    return isArabic ? map[phase]?.ar || phase : map[phase]?.en || phase;
  };

  const getPhaseColor = (phase: string) => {
    const map: Record<string, string> = {
      creation: "bg-blue-100 text-blue-800",
      sending: "bg-yellow-100 text-yellow-800",
      receiving: "bg-orange-100 text-orange-800",
      coins_entry: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
    };
    return map[phase] || "bg-gray-100 text-gray-800";
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  if (view === "list") {
    return (
      <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "إنشاء طلب شراء عملات" : "Coins Purchase Creation"}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <CoinsPhaseFilterBar
              viewFilter={viewFilter}
              onViewFilterChange={setViewFilter}
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              pendingLabel={isArabic ? "المعلقة (الإنشاء)" : "Pending (Creation)"}
              sentLabel={isArabic ? "المرسلة فقط" : "Sent Only"}
            />
            <Button onClick={() => { resetForm(); setView("form"); }}>
              <Plus className={`h-4 w-4 ${isArabic ? "ml-2" : "mr-2"}`} />
              {isArabic ? "طلب جديد" : "New Order"}
            </Button>
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                   <TableRow>
                     <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                     <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                     <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                     <TableHead>{isArabic ? "المبلغ بالعملة" : "Amount (Currency)"}</TableHead>
                     <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                     <TableHead>{isArabic ? "المرحلة" : "Phase"}</TableHead>
                     <TableHead>{isArabic ? "أنشئ بواسطة" : "Created By"}</TableHead>
                     <TableHead></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {orders.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                         {isArabic ? "لا توجد طلبات" : "No orders found"}
                       </TableCell>
                     </TableRow>
                   ) : orders.map(o => (
                     <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadOrder(o.id)}>
                       <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                       <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                       <TableCell>{(o.currencies as any)?.currency_code || "-"}</TableCell>
                       <TableCell>{parseFloat(o.amount_in_currency || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                       <TableCell>{parseFloat(o.base_amount_sar || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge className={getPhaseColor(o.current_phase)}>{getPhaseLabel(o.current_phase)}</Badge></TableCell>
                      <TableCell>{o.created_by_name || o.created_by}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                          {o.current_phase === "creation" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={isArabic ? "حذف الطلب" : "Delete Order"}
                              onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReadOnly = selectedOrderId !== null && selectedOrderPhase !== "creation";

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Coins className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">
            {isReadOnly
              ? (isArabic ? "عرض طلب شراء عملات" : "View Coins Purchase Order")
              : (isArabic ? "إنشاء طلب شراء عملات" : "Create Coins Purchase Order")}
          </h1>
          {isReadOnly && <Lock className="h-5 w-5 text-muted-foreground" />}
        </div>
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {isArabic ? "حفظ كمسودة" : "Save Draft"}
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              <Send className="h-4 w-4 mr-1" />
              {isArabic ? "إرسال للتوجيه" : "Send to Sending"}
            </Button>
          </div>
        )}
      </div>

      {/* Phase Stepper */}
      {selectedOrderId && (
        <Card>
          <CardContent className="py-3 px-4">
            <CoinsPhaseSteps currentPhase={selectedOrderPhase} />
          </CardContent>
        </Card>
      )}

      {/* Bank Transfer Image Upload */}
      <Card>
        <CardHeader><CardTitle>{isArabic ? "صورة التحويل البنكي" : "Bank Transfer Image"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {bankTransferImage ? (
              <div className="relative">
                {bankTransferImage.match(/\.pdf$/i) || bankTransferImage.includes("/raw/upload/") ? (
                  <iframe
                    src={bankTransferImage}
                    title="Bank Transfer"
                    className="w-full h-[300px] rounded-lg border"
                  />
                ) : (
                  <img src={bankTransferImage} alt="Bank Transfer" className="max-w-md max-h-64 rounded-lg border object-contain" />
                )}
                {!isReadOnly && <Button variant="destructive" size="sm" className="absolute top-2 right-2 z-10" onClick={() => setBankTransferImage("")}>✕</Button>}
              </div>
            ) : !isReadOnly ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-muted-foreground">{uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "اضغط لرفع ملف التحويل" : "Click to upload transfer file")}</span>
                <input type="file" accept="*/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            ) : (
              <span className="text-muted-foreground">{isArabic ? "لا توجد صورة" : "No image"}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Header Details */}
      <Card>
        <CardHeader><CardTitle>{isArabic ? "بيانات الطلب الرئيسية" : "Order Header"}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isArabic ? "المورد الرئيسي" : "Main Supplier"}</Label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "البنك *" : "Bank *"}</Label>
              <Select value={bankId} onValueChange={setBankId} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر البنك" : "Select bank"} /></SelectTrigger>
                <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "العملة *" : "Currency *"}</Label>
              <Select value={currencyId} onValueChange={setCurrencyId} disabled={isReadOnly}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العملة" : "Select currency"} /></SelectTrigger>
                <SelectContent>{currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_name} ({c.currency_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "سعر الصرف" : "Exchange Rate"}</Label>
              <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} readOnly={isReadOnly} className={isReadOnly ? "bg-muted" : ""} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "رسوم التحويل البنكي" : "Bank Transfer Fee"}</Label>
              <Input type="number" step="0.01" value={bankTransferFee} onChange={e => setBankTransferFee(e.target.value)} readOnly={isReadOnly} className={isReadOnly ? "bg-muted" : ""} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "إجمالي التحويل البنكي" : "Total Bank Transfer"}</Label>
              <Input type="text" value={totalInCurrency.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "إجمالي المبلغ الأساسي (SAR)" : "Total Base Amount (SAR)"}</Label>
              <Input type="text" value={totalBaseSar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly className="bg-muted" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} readOnly={isReadOnly} className={isReadOnly ? "bg-muted" : ""} />
          </div>
        </CardContent>
      </Card>

      {/* Order Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{isArabic ? "بنود الطلب" : "Order Lines"}</CardTitle>
            {!isReadOnly && (
              <Button size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                {isArabic ? "إضافة سطر" : "Add Line"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{isArabic ? "العلامة التجارية *" : "Brand *"}</TableHead>
                  <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ بالعملة" : "Amount in Currency"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                  {!isReadOnly && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-center font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <Select value={line.brand_id} onValueChange={(v) => handleBrandChange(index, v)} disabled={isReadOnly}>
                        <SelectTrigger className="min-w-[180px]"><SelectValue placeholder={isArabic ? "اختر العلامة" : "Select brand"} /></SelectTrigger>
                        <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={line.supplier_id} onValueChange={(v) => updateLine(index, "supplier_id", v)} disabled={isReadOnly}>
                        <SelectTrigger className="min-w-[180px]"><SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className={`min-w-[120px] ${isReadOnly ? "bg-muted" : ""}`}
                        value={line.amount_in_currency}
                        onChange={e => updateLine(index, "amount_in_currency", e.target.value)}
                        readOnly={isReadOnly}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="min-w-[120px] bg-muted"
                        value={line.base_amount_sar}
                        readOnly
                      />
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 1}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Attachments */}
      {selectedOrderId && (
        <CoinsOrderAttachments
          purchaseOrderId={selectedOrderId}
          currentPhase="creation"
          readOnly={isReadOnly}
        />
      )}
    </div>
  );
};

export default CoinsCreation;
