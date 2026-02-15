import { useState, useEffect } from "react";
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
import { Plus, Save, Upload, ArrowLeft, Eye, Send, Coins } from "lucide-react";
import { format } from "date-fns";
import { convertToBaseCurrency, type CurrencyRate, type Currency } from "@/lib/currencyConversion";

const CoinsCreation = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-creation");

  const [view, setView] = useState<"list" | "form">("list");
  const [orders, setOrders] = useState<any[]>([]);

  // Form state
  const [brandId, setBrandId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [bankId, setBankId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [amountInCurrency, setAmountInCurrency] = useState("");
  const [baseAmountSar, setBaseAmountSar] = useState("");
  const [notes, setNotes] = useState("");
  const [bankTransferImage, setBankTransferImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Dropdown data
  const [brands, setBrands] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);

  useEffect(() => { fetchOrders(); }, []);
  useEffect(() => { if (view === "form") fetchDropdowns(); }, [view]);

  useEffect(() => {
    if (brandId) {
      // Auto-select supplier if only one linked
      const fetchBrandSupplier = async () => {
        const { data } = await supabase.from("brand_suppliers").select("supplier_id").eq("brand_id", brandId);
        if (data && data.length > 0) {
          const linkedIds = data.map(d => d.supplier_id);
          const filtered = suppliers.filter(s => linkedIds.includes(s.id));
          if (filtered.length === 1) setSupplierId(filtered[0].id);
        }
      };
      fetchBrandSupplier();
    }
  }, [brandId, suppliers]);

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

  useEffect(() => {
    const amount = parseFloat(amountInCurrency) || 0;
    const baseCurrency = currencies.find(c => c.is_base);
    const converted = convertToBaseCurrency(amount, currencyId, currencyRates as any, baseCurrency);
    setBaseAmountSar(converted.toFixed(2));
  }, [amountInCurrency, currencyId, exchangeRate, currencyRates, currencies]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("coins_purchase_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setOrders(data);
  };

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
      const publicId = `coins-creation/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType: "image" },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");
      setBankTransferImage(data.url);
      toast.success(isArabic ? "تم رفع الصورة بنجاح" : "Image uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async (sendToNext = false) => {
    if (!brandId || !bankId || !currencyId) {
      toast.error(isArabic ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    if (!bankTransferImage) {
      toast.error(isArabic ? "يرجى رفع صورة التحويل البنكي" : "Please upload the bank transfer image");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const orderData: any = {
        brand_id: brandId,
        supplier_id: supplierId || null,
        bank_id: bankId,
        currency_id: currencyId,
        exchange_rate: parseFloat(exchangeRate) || 1,
        amount_in_currency: parseFloat(amountInCurrency) || 0,
        base_amount_sar: parseFloat(baseAmountSar) || 0,
        bank_transfer_image: bankTransferImage,
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
      } else {
        orderData.order_number = `CPO-${format(new Date(), "yyyyMMdd")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
        const { data, error } = await supabase.from("coins_purchase_orders").insert(orderData).select("id").single();
        if (error) throw error;
        orderId = data.id;
      }

      // Log phase history
      if (sendToNext) {
        await supabase.from("coins_purchase_phase_history").insert({
          purchase_order_id: orderId,
          from_phase: "creation",
          to_phase: "sending",
          action: "submit",
          action_by: user?.email || "",
          action_by_name: user?.user_metadata?.display_name || user?.email || "",
        });

        // Notify responsible person for sending phase
        await notifyResponsible(brandId, "sending", orderId);
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

      for (const assignment of assignments) {
        // Send notification
        await supabase.from("notifications").insert({
          user_id: assignment.user_id,
          title: isArabic ? "مهمة معاملات عملات جديدة" : "New Coins Transaction Task",
          message: isArabic
            ? `لديك مهمة جديدة في مرحلة ${phase === "sending" ? "التوجيه" : phase === "receiving" ? "الاستلام" : phase}`
            : `You have a new task in the ${phase} phase`,
          type: "coins_workflow",
          link: phase === "sending" ? `/coins-sending?order=${orderId}` : phase === "receiving" ? `/coins-receiving-phase?order=${orderId}` : `/receiving-coins`,
        } as any);

        // Send email via existing edge function
        const { data: profile } = await supabase.from("profiles").select("email").eq("id", assignment.user_id).maybeSingle();
        if (profile?.email) {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              userId: assignment.user_id,
              title: isArabic ? "مهمة معاملات عملات جديدة" : "New Coins Transaction Task",
              body: isArabic ? "لديك مهمة جديدة" : "You have a new coins workflow task",
            },
          });
        }
      }
    } catch (err) {
      console.error("Notification error:", err);
    }
  };

  const resetForm = () => {
    setBrandId(""); setSupplierId(""); setBankId(""); setCurrencyId("");
    setExchangeRate("1"); setAmountInCurrency(""); setBaseAmountSar("");
    setNotes(""); setBankTransferImage(""); setSelectedOrderId(null);
  };

  const loadOrder = async (id: string) => {
    const { data } = await supabase.from("coins_purchase_orders").select("*").eq("id", id).maybeSingle();
    if (data) {
      setSelectedOrderId(data.id);
      setBrandId(data.brand_id || "");
      setSupplierId(data.supplier_id || "");
      setBankId(data.bank_id || "");
      setCurrencyId(data.currency_id || "");
      setExchangeRate(String(data.exchange_rate || 1));
      setAmountInCurrency(String(data.amount_in_currency || ""));
      setBaseAmountSar(String(data.base_amount_sar || ""));
      setNotes(data.notes || "");
      setBankTransferImage(data.bank_transfer_image || "");
      setView("form");
    }
  };

  const getPhaseLabel = (phase: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      creation: { ar: "إنشاء", en: "Creation" },
      sending: { ar: "توجيه", en: "Sending" },
      receiving: { ar: "استلام", en: "Receiving" },
      coins_entry: { ar: "إدخال العملات", en: "Coins Entry" },
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "إنشاء طلب شراء عملات" : "Coins Purchase Creation"}</h1>
          </div>
          <Button onClick={() => { resetForm(); setView("form"); }}>
            <Plus className="h-4 w-4 mr-1" />
            {isArabic ? "طلب جديد" : "New Order"}
          </Button>
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
                    <TableHead>{isArabic ? "المرحلة" : "Phase"}</TableHead>
                    <TableHead>{isArabic ? "أنشئ بواسطة" : "Created By"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {isArabic ? "لا توجد طلبات" : "No orders found"}
                      </TableCell>
                    </TableRow>
                  ) : orders.map(o => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadOrder(o.id)}>
                      <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                      <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                      <TableCell>{parseFloat(o.base_amount_sar || 0).toFixed(2)}</TableCell>
                      <TableCell><Badge className={getPhaseColor(o.current_phase)}>{getPhaseLabel(o.current_phase)}</Badge></TableCell>
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
  }

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Coins className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isArabic ? "إنشاء طلب شراء عملات" : "Create Coins Purchase Order"}</h1>
        </div>
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
      </div>

      {/* Bank Transfer Image Upload */}
      <Card>
        <CardHeader><CardTitle>{isArabic ? "صورة التحويل البنكي" : "Bank Transfer Image"}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            {bankTransferImage ? (
              <div className="relative">
                <img src={bankTransferImage} alt="Bank Transfer" className="max-w-md max-h-64 rounded-lg border object-contain" />
                <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setBankTransferImage("")}>✕</Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <span className="text-muted-foreground">{uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "اضغط لرفع صورة التحويل" : "Click to upload transfer image")}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Details */}
      <Card>
        <CardHeader><CardTitle>{isArabic ? "تفاصيل الطلب" : "Order Details"}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isArabic ? "العلامة التجارية *" : "Brand *"}</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العلامة" : "Select brand"} /></SelectTrigger>
                <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المورد" : "Supplier"}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "البنك *" : "Bank *"}</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر البنك" : "Select bank"} /></SelectTrigger>
                <SelectContent>{banks.map(b => <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "العملة *" : "Currency *"}</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العملة" : "Select currency"} /></SelectTrigger>
                <SelectContent>{currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_name} ({c.currency_code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "سعر الصرف" : "Exchange Rate"}</Label>
              <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المبلغ بالعملة" : "Amount in Currency"}</Label>
              <Input type="number" step="0.01" value={amountInCurrency} onChange={e => setAmountInCurrency(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المبلغ الأساسي (SAR)" : "Base Amount (SAR)"}</Label>
              <Input type="number" step="0.01" value={baseAmountSar} onChange={e => setBaseAmountSar(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoinsCreation;
