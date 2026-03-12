import { useState, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Save, Upload, ArrowLeft, Eye, Trash2, FileText, Maximize2, Download, Check, Send, BookCheck } from "lucide-react";
import { format } from "date-fns";
import { convertToBaseCurrency, type CurrencyRate, type Currency } from "@/lib/currencyConversion";
import { downloadFile } from "@/lib/fileDownload";

const SupplierAdvancePayment = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/supplier-advance-payment");

  const [view, setView] = useState<"list" | "form">("list");
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [bankFee, setBankFee] = useState("0");
  const [baseAmount, setBaseAmount] = useState("0");
  const [bankTransferImage, setBankTransferImage] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  // Phase-based workflow
  const [currentPhase, setCurrentPhase] = useState("entry");

  // Step 2: Receiving
  const [sentForReceiving, setSentForReceiving] = useState(false);
  const [receivingImage, setReceivingImage] = useState("");
  const [receivingNotes, setReceivingNotes] = useState("");
  const [uploadingReceiving, setUploadingReceiving] = useState(false);
  const [vendorInvoiceUrl, setVendorInvoiceUrl] = useState("");
  const [uploadingVendorInvoice, setUploadingVendorInvoice] = useState(false);

  // Step 3: Accounting
  const [accountingRecorded, setAccountingRecorded] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Dropdown data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);

  const loadedRateRef = useRef<string | null>(null);

  useEffect(() => { fetchPayments(); }, []);
  useEffect(() => { if (view === "form") fetchDropdowns(); }, [view]);

  useEffect(() => {
    if (currencyId && loadedRateRef.current === null) {
      const baseCurrency = currencies.find(c => c.is_base);
      const rate = currencyRates.find(r => r.currency_id === currencyId);
      if (rate) {
        setExchangeRate(String(rate.rate_to_base));
      } else if (baseCurrency && currencyId === baseCurrency.id) {
        setExchangeRate("1");
      }
    }
  }, [currencyId, currencyRates, currencies]);

  // Calculate base amount when amount/rate/fee changes
  useEffect(() => {
    const amount = parseFloat(transactionAmount) || 0;
    const fee = parseFloat(bankFee) || 0;
    const rate = parseFloat(exchangeRate) || 1;
    const rateRecord = currencyRates.find(r => r.currency_id === currencyId);
    const operator = rateRecord?.conversion_operator || "multiply";
    const baseCurrency = currencies.find(c => c.is_base);
    let converted = amount;
    if (baseCurrency && currencyId !== baseCurrency.id) {
      converted = operator === "multiply" ? amount * rate : amount / rate;
    }
    setBaseAmount((converted + fee).toFixed(2));
  }, [transactionAmount, bankFee, exchangeRate, currencyId, currencyRates, currencies]);

  const fetchPayments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("supplier_advance_payments")
      .select("*, suppliers(supplier_name), currencies(currency_code)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setPayments(data);
    setLoading(false);
  };

  const fetchDropdowns = async () => {
    const [suppRes, currRes, rateRes] = await Promise.all([
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("currencies").select("*").eq("is_active", true).order("currency_name"),
      supabase.from("currency_rates").select("*"),
    ]);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (currRes.data) setCurrencies(currRes.data as any);
    if (rateRes.data) setCurrencyRates(rateRes.data as any);
  };

  const fetchAttachments = async (paymentId: string) => {
    const { data } = await supabase
      .from("supplier_advance_payment_attachments")
      .select("*")
      .eq("payment_id", paymentId)
      .order("created_at", { ascending: true });
    if (data) setAttachments(data);
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
      const publicId = `supplier-advance/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
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

  const handleReceivingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPaymentId) return;
    setUploadingReceiving(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
      const publicId = `supplier-advance-receiving/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");
      setReceivingImage(data.url);
      toast.success(isArabic ? "تم رفع صورة الرصيد بنجاح" : "Balance screenshot uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingReceiving(false);
      e.target.value = "";
    }
  };

  const handleVendorInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPaymentId) return;
    setUploadingVendorInvoice(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
      const publicId = `supplier-advance-vendor-invoice/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");
      setVendorInvoiceUrl(data.url);
      await supabase.from("supplier_advance_payments").update({ vendor_invoice_url: data.url } as any).eq("id", selectedPaymentId);
      toast.success(isArabic ? "تم رفع فاتورة المورد بنجاح" : "Vendor invoice uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingVendorInvoice(false);
      e.target.value = "";
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPaymentId) return;
    setUploadingAttachment(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
      const publicId = `supplier-advance-docs/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user?.id).maybeSingle();

      await supabase.from("supplier_advance_payment_attachments").insert({
        payment_id: selectedPaymentId,
        file_name: file.name,
        file_url: data.url,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user?.id,
        uploaded_by_name: profile?.user_name || user?.email,
      });

      toast.success(isArabic ? "تم رفع المرفق بنجاح" : "Attachment uploaded successfully");
      fetchAttachments(selectedPaymentId);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const deleteAttachment = async (id: string) => {
    await supabase.from("supplier_advance_payment_attachments").delete().eq("id", id);
    if (selectedPaymentId) fetchAttachments(selectedPaymentId);
    toast.success(isArabic ? "تم حذف المرفق" : "Attachment deleted");
  };

  const resetForm = () => {
    setSupplierId("");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setCurrencyId("");
    setExchangeRate("1");
    setTransactionAmount("");
    setBankFee("0");
    setBaseAmount("0");
    setBankTransferImage("");
    setNotes("");
    setSelectedPaymentId(null);
    setAttachments([]);
    setCurrentPhase("entry");
    setSentForReceiving(false);
    setReceivingImage("");
    setReceivingNotes("");
    setVendorInvoiceUrl("");
    setAccountingRecorded(false);
    loadedRateRef.current = null;
  };

  const loadPayment = async (payment: any) => {
    setSupplierId(payment.supplier_id);
    setPaymentDate(payment.payment_date);
    setCurrencyId(payment.currency_id || "");
    loadedRateRef.current = String(payment.exchange_rate);
    setExchangeRate(String(payment.exchange_rate));
    setTransactionAmount(String(payment.transaction_amount));
    setBankFee(String(payment.bank_fee));
    setBaseAmount(String(payment.base_amount));
    setBankTransferImage(payment.bank_transfer_image || "");
    setNotes(payment.notes || "");
    setSelectedPaymentId(payment.id);
    setCurrentPhase(payment.current_phase || "entry");
    setSentForReceiving(payment.sent_for_receiving || false);
    setReceivingImage(payment.receiving_image || "");
    setReceivingNotes(payment.receiving_notes || "");
    setVendorInvoiceUrl(payment.vendor_invoice_url || "");
    setAccountingRecorded(payment.accounting_recorded || false);
    await Promise.all([fetchAttachments(payment.id), fetchDropdowns()]);
    setView("form");
    setTimeout(() => { loadedRateRef.current = null; }, 500);
  };

  const handleSave = async () => {
    if (!supplierId || !currencyId || !transactionAmount) {
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
      const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user?.id).maybeSingle();

      const paymentData: any = {
        supplier_id: supplierId,
        payment_date: paymentDate,
        currency_id: currencyId,
        exchange_rate: parseFloat(exchangeRate) || 1,
        transaction_amount: parseFloat(transactionAmount) || 0,
        bank_fee: parseFloat(bankFee) || 0,
        base_amount: parseFloat(baseAmount) || 0,
        bank_transfer_image: bankTransferImage,
        notes,
        created_by: user?.id,
        created_by_name: profile?.user_name || user?.email,
      };

      if (selectedPaymentId) {
        const { error } = await supabase.from("supplier_advance_payments").update(paymentData).eq("id", selectedPaymentId);
        if (error) throw error;
        toast.success(isArabic ? "تم تحديث الدفعة بنجاح" : "Payment updated successfully");
      } else {
        const { data, error } = await supabase.from("supplier_advance_payments").insert(paymentData).select("id").single();
        if (error) throw error;
        setSelectedPaymentId(data.id);
        toast.success(isArabic ? "تم حفظ الدفعة بنجاح" : "Payment saved successfully");
      }
      fetchPayments();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToReceiving = async () => {
    if (!selectedPaymentId) return;
    if (!receivingImage) {
      toast.error(isArabic ? "يرجى رفع صورة رصيد المورد" : "Please upload supplier balance screenshot");
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user?.id).maybeSingle();
      const { error } = await supabase.from("supplier_advance_payments").update({
        sent_for_receiving: true,
        sent_for_receiving_at: new Date().toISOString(),
        sent_for_receiving_by: profile?.user_name || user?.email,
        receiving_image: receivingImage,
        receiving_notes: receivingNotes,
        current_phase: "receiving",
      } as any).eq("id", selectedPaymentId);
      if (error) throw error;
      toast.success(isArabic ? "تم التأكيد والإرسال للاستلام بنجاح" : "Confirmed and sent to Receiving successfully");
      resetForm();
      setView("list");
      fetchPayments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleConfirmToAccounting = async () => {
    if (!selectedPaymentId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("user_name").eq("user_id", user?.id).maybeSingle();
      const { error } = await supabase.from("supplier_advance_payments").update({
        accounting_recorded: true,
        accounting_recorded_at: new Date().toISOString(),
        accounting_recorded_by: profile?.user_name || user?.email,
        current_phase: "accounting",
      } as any).eq("id", selectedPaymentId);
      if (error) throw error;
      toast.success(isArabic ? "تم التأكيد والإرسال للمحاسبة بنجاح" : "Confirmed and sent to Accounting successfully");
      resetForm();
      setView("list");
      fetchPayments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm(isArabic ? "هل أنت متأكد من حذف هذه الدفعة؟" : "Are you sure you want to delete this payment?")) return;
    try {
      // Delete attachments first
      await supabase.from("supplier_advance_payment_attachments").delete().eq("payment_id", paymentId);
      const { error } = await supabase.from("supplier_advance_payments").delete().eq("id", paymentId);
      if (error) throw error;
      toast.success(isArabic ? "تم حذف الدفعة بنجاح" : "Payment deleted successfully");
      fetchPayments();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const isPdf = (url: string) => url?.includes(".pdf") || url?.includes("/raw/upload/");

  const getPhaseFromPayment = (payment: any) => {
    return payment.current_phase || (payment.accounting_recorded ? "accounting" : payment.sent_for_receiving ? "receiving" : "entry");
  };

  const getPhaseBadge = (phase: string) => {
    if (phase === "entry") return <Badge variant="secondary">{isArabic ? "إدخال" : "Entry"}</Badge>;
    if (phase === "receiving") return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">{isArabic ? "استلام" : "Receiving"}</Badge>;
    return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">{isArabic ? "محاسبة" : "Recorded"}</Badge>;
  };

  const [phaseFilter, setPhaseFilter] = useState<"all" | "entry" | "receiving" | "accounting">("all");

  const phaseCounts = {
    all: payments.length,
    entry: payments.filter(p => getPhaseFromPayment(p) === "entry").length,
    receiving: payments.filter(p => getPhaseFromPayment(p) === "receiving").length,
    accounting: payments.filter(p => getPhaseFromPayment(p) === "accounting").length,
  };

  const filteredPayments = phaseFilter === "all" ? payments : payments.filter(p => getPhaseFromPayment(p) === phaseFilter);

  if (accessLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!hasAccess) return <AccessDenied />;

  const phaseTabButtons: { key: "all" | "entry" | "receiving" | "accounting"; labelEn: string; labelAr: string }[] = [
    { key: "all", labelEn: "All", labelAr: "الكل" },
    { key: "entry", labelEn: "Entry", labelAr: "إدخال" },
    { key: "receiving", labelEn: "Receiving", labelAr: "استلام" },
    { key: "accounting", labelEn: "Recorded", labelAr: "محاسبة" },
  ];

  return (
    <div className="p-4 space-y-4" dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isArabic ? "دفعات مقدمة للموردين" : "Supplier Advance Payments"}</h1>
        {view === "list" ? (
          <Button onClick={() => { resetForm(); setView("form"); }}>
            <Plus className="h-4 w-4 mr-1" />
            {isArabic ? "دفعة جديدة" : "New Payment"}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => { setView("list"); resetForm(); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {isArabic ? "العودة للقائمة" : "Back to List"}
          </Button>
        )}
      </div>

      {view === "list" ? (
        <>
          <div className="flex flex-wrap gap-2">
            {phaseTabButtons.map(tab => (
              <Button
                key={tab.key}
                variant={phaseFilter === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPhaseFilter(tab.key)}
                className="min-w-[100px]"
              >
                {isArabic ? tab.labelAr : tab.labelEn} ({phaseCounts[tab.key]})
              </Button>
            ))}
          </div>
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                  <TableHead>{isArabic ? "تاريخ التحويل" : "Transfer Date"}</TableHead>
                  <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ" : "Amount"}</TableHead>
                  <TableHead>{isArabic ? "رسوم بنكية" : "Bank Fee"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ الأساسي" : "Base Amount"}</TableHead>
                  <TableHead>{isArabic ? "المستخدم" : "Entry User"}</TableHead>
                  <TableHead>{isArabic ? "تاريخ الإدخال" : "Entry Date"}</TableHead>
                  <TableHead>{isArabic ? "المرحلة" : "Phase"}</TableHead>
                  <TableHead>{isArabic ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{(p.suppliers as any)?.supplier_name || "-"}</TableCell>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{(p.currencies as any)?.currency_code || "-"}</TableCell>
                    <TableCell>{Number(p.transaction_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.bank_fee).toLocaleString()}</TableCell>
                    <TableCell className="font-bold">{Number(p.base_amount).toLocaleString()}</TableCell>
                    <TableCell>{p.created_by_name || "-"}</TableCell>
                    <TableCell>{p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>{getPhaseBadge(getPhaseFromPayment(p))}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => loadPayment(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {getPhaseFromPayment(p) === "entry" && (
                        <Button size="sm" variant="ghost" onClick={() => handleDeletePayment(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      {isArabic ? "لا توجد دفعات" : "No payments found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </>

      ) : (
        <div className="space-y-4">
          {/* Step Indicators */}
          {selectedPaymentId && (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-2 md:gap-6">
                  {[
                    { key: "entry", label: isArabic ? "الإدخال" : "Entry", step: 1 },
                    { key: "receiving", label: isArabic ? "الاستلام" : "Receiving", step: 2 },
                    { key: "accounting", label: isArabic ? "القيد المحاسبي" : "Accounting", step: 3 },
                  ].map((s, i, arr) => {
                    const phases = ["entry", "receiving", "accounting"];
                    const currentIdx = phases.indexOf(currentPhase);
                    const stepIdx = phases.indexOf(s.key);
                    const isCompleted = stepIdx < currentIdx;
                    const isCurrent = stepIdx === currentIdx;
                    return (
                      <div key={s.key} className="flex items-center gap-2">
                        {i > 0 && <div className={`h-0.5 w-8 md:w-16 ${isCompleted || isCurrent ? "bg-primary" : "bg-muted"}`} />}
                        <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold ${isCompleted ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {isCompleted ? <Check className="h-4 w-4" /> : s.step}
                        </div>
                        <span className={`text-sm font-medium hidden md:inline ${isCurrent ? "text-primary" : ""}`}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Summary Header - shown in receiving/accounting phases */}
          {selectedPaymentId && currentPhase !== "entry" && (
            <Card>
              <CardHeader>
                <CardTitle>{isArabic ? "بيانات الدفعة" : "Payment Summary"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">{isArabic ? "المورد:" : "Supplier:"}</span> <span className="font-medium">{suppliers.find(s => s.id === supplierId)?.supplier_name || "-"}</span></div>
                  <div><span className="text-muted-foreground">{isArabic ? "التاريخ:" : "Date:"}</span> <span className="font-medium">{paymentDate}</span></div>
                  <div><span className="text-muted-foreground">{isArabic ? "المبلغ:" : "Amount:"}</span> <span className="font-medium">{Number(transactionAmount).toLocaleString()} {currencies.find(c => c.id === currencyId)?.currency_code || ""}</span></div>
                  <div><span className="text-muted-foreground">{isArabic ? "المبلغ الأساسي:" : "Base Amount:"}</span> <span className="font-bold">{Number(baseAmount).toLocaleString()} SAR</span></div>
                </div>
                {bankTransferImage && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => { setPreviewImageUrl(bankTransferImage); setShowImagePreview(true); }}>
                      <Eye className="h-4 w-4 mr-1" />
                      {isArabic ? "عرض صورة التحويل" : "View Transfer Image"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ============ STEP 1: ENTRY ============ */}
          {currentPhase === "entry" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</div>
                    {isArabic ? "بيانات الدفعة المقدمة" : "Advance Payment Details"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{isArabic ? "المورد *" : "Supplier *"}</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select Supplier"} /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabic ? "تاريخ التحويل *" : "Transfer Date *"}</Label>
                    <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabic ? "العملة *" : "Currency *"}</Label>
                    <Select value={currencyId} onValueChange={v => { setCurrencyId(v); loadedRateRef.current = null; }}>
                      <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العملة" : "Select Currency"} /></SelectTrigger>
                      <SelectContent>
                        {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code} - {c.currency_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabic ? "سعر الصرف" : "Exchange Rate"}</Label>
                    <Input type="number" step="any" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabic ? "مبلغ المعاملة *" : "Transaction Amount *"}</Label>
                    <Input type="number" step="any" value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)} className="text-lg font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabic ? "رسوم التحويل البنكي" : "Bank Transfer Fee"}</Label>
                    <Input type="number" step="any" value={bankFee} onChange={e => setBankFee(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{isArabic ? "المبلغ الأساسي (ريال)" : "Base Amount (SAR)"}</Label>
                    <Input type="number" value={baseAmount} readOnly className="bg-muted font-bold text-lg" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                  </div>
                </CardContent>
              </Card>

              {/* Bank Transfer Image */}
              <Card>
                <CardHeader>
                  <CardTitle>{isArabic ? "صورة التحويل البنكي" : "Bank Transfer Image"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer">
                      <Button variant="outline" asChild disabled={uploading}>
                        <span>
                          <Upload className="h-4 w-4 mr-1" />
                          {uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع صورة" : "Upload Image")}
                        </span>
                      </Button>
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                    {bankTransferImage && (
                      <Button variant="outline" size="sm" onClick={() => downloadFile(bankTransferImage, "bank-transfer")}>
                        <Download className="h-4 w-4 mr-1" />
                        {isArabic ? "تحميل" : "Download"}
                      </Button>
                    )}
                  </div>
                  {bankTransferImage && (
                    <div className="relative">
                      {isPdf(bankTransferImage) ? (
                        <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(bankTransferImage)}&embedded=true`} title="Transfer" className="w-full h-[400px] rounded-lg border" />
                      ) : (
                        <img src={bankTransferImage} alt="Transfer" className="max-w-md max-h-64 rounded-lg border object-contain" />
                      )}
                      <Button variant="secondary" size="icon" className="absolute top-2 left-2 z-10 h-8 w-8" onClick={() => { setPreviewImageUrl(bankTransferImage); setShowImagePreview(true); }}>
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="min-w-[200px]">
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ الدفعة" : "Save Payment")}
                </Button>
              </div>
            </>
          )}

          {/* ============ STEP 2: RECEIVING ============ */}
          {currentPhase === "receiving" && selectedPaymentId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</div>
                  {isArabic ? "الاستلام - صورة رصيد المورد" : "Receiving - Supplier Balance Screenshot"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="cursor-pointer">
                    <Button variant="outline" asChild disabled={uploadingReceiving}>
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        {uploadingReceiving ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع صورة الرصيد" : "Upload Balance Screenshot")}
                      </span>
                    </Button>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleReceivingImageUpload} disabled={uploadingReceiving} />
                  </label>
                  {receivingImage && (
                    <Button variant="outline" size="sm" onClick={() => downloadFile(receivingImage, "supplier-balance")}>
                      <Download className="h-4 w-4 mr-1" />
                      {isArabic ? "تحميل" : "Download"}
                    </Button>
                  )}
                </div>

                {receivingImage && (
                  <div className="relative">
                    {isPdf(receivingImage) ? (
                      <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(receivingImage)}&embedded=true`} title="Balance" className="w-full h-[400px] rounded-lg border" />
                    ) : (
                      <img src={receivingImage} alt="Balance" className="max-w-md max-h-64 rounded-lg border object-contain" />
                    )}
                    <Button variant="secondary" size="icon" className="absolute top-2 left-2 z-10 h-8 w-8" onClick={() => { setPreviewImageUrl(receivingImage); setShowImagePreview(true); }}>
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Vendor Invoice Upload */}
                <div className="border-t pt-4 mt-4">
                  <Label className="text-sm font-semibold mb-2 block">{isArabic ? "فاتورة المورد (PDF)" : "Vendor Invoice (PDF)"}</Label>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer">
                      <Button variant="outline" asChild disabled={uploadingVendorInvoice}>
                        <span>
                          <FileText className="h-4 w-4 mr-1" />
                          {uploadingVendorInvoice ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع فاتورة المورد" : "Upload Vendor Invoice")}
                        </span>
                      </Button>
                      <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleVendorInvoiceUpload} disabled={uploadingVendorInvoice} />
                    </label>
                    {vendorInvoiceUrl && (
                      <Button variant="outline" size="sm" onClick={() => downloadFile(vendorInvoiceUrl, "vendor-invoice")}>
                        <Download className="h-4 w-4 mr-1" />
                        {isArabic ? "تحميل" : "Download"}
                      </Button>
                    )}
                  </div>
                  {vendorInvoiceUrl && (
                    <div className="relative mt-3">
                      {isPdf(vendorInvoiceUrl) ? (
                        <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(vendorInvoiceUrl)}&embedded=true`} title="Vendor Invoice" className="w-full h-[400px] rounded-lg border" />
                      ) : (
                        <img src={vendorInvoiceUrl} alt="Vendor Invoice" className="max-w-md max-h-64 rounded-lg border object-contain" />
                      )}
                      <Button variant="secondary" size="icon" className="absolute top-2 left-2 z-10 h-8 w-8" onClick={() => { setPreviewImageUrl(vendorInvoiceUrl); setShowImagePreview(true); }}>
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{isArabic ? "ملاحظات الاستلام" : "Receiving Notes"}</Label>
                  <Textarea value={receivingNotes} onChange={e => setReceivingNotes(e.target.value)} rows={2} />
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleConfirmToReceiving} className="min-w-[200px]" variant="default">
                    <Send className="h-4 w-4 mr-1" />
                    {isArabic ? "تأكيد وإرسال للمحاسبة" : "Confirm and Send to Accounting"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ============ STEP 3: ACCOUNTING ============ */}
          {currentPhase === "accounting" && selectedPaymentId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
                  {isArabic ? "القيد المحاسبي - تسجيل في Odoo" : "Accounting Record - Enter In Odoo"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end">
                  <Button onClick={handleConfirmToAccounting} className="min-w-[200px]">
                    <BookCheck className="h-4 w-4 mr-1" />
                    {isArabic ? "تأكيد التسجيل" : "Confirm Record"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments section */}
          {selectedPaymentId && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{isArabic ? "المرفقات" : "Attachments"}</CardTitle>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploadingAttachment}>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      {uploadingAttachment ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع مرفق" : "Upload")}
                    </span>
                  </Button>
                  <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleAttachmentUpload} disabled={uploadingAttachment} />
                </label>
              </CardHeader>
              <CardContent>
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{isArabic ? "لا توجد مرفقات" : "No attachments"}</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {attachments.map(att => (
                      <div key={att.id} className="border rounded p-2 flex flex-col items-center gap-1">
                        {att.file_type?.startsWith("image/") ? (
                          <img src={att.file_url} alt={att.file_name} className="h-16 w-16 object-cover rounded" />
                        ) : (
                          <FileText className="h-10 w-10 text-destructive" />
                        )}
                        <p className="text-xs truncate w-full text-center">{att.file_name}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => downloadFile(att.file_url, att.file_name)}>
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteAttachment(att.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-2">
          {previewImageUrl && (
            isPdf(previewImageUrl) ? (
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(previewImageUrl)}&embedded=true`}
                title="Preview"
                className="w-full h-[85vh] rounded"
              />
            ) : (
              <img src={previewImageUrl} alt="Preview" className="max-w-full max-h-[85vh] object-contain mx-auto" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierAdvancePayment;
