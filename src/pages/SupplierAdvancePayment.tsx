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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Save, Upload, ArrowLeft, Eye, Trash2, FileText, Maximize2, Download } from "lucide-react";
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
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

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
    await fetchAttachments(payment.id);
    setView("form");
    // Clear the loaded rate ref after a tick so currency changes re-calculate
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

  const isPdf = (url: string) => url?.includes(".pdf") || url?.includes("/raw/upload/");

  if (accessLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!hasAccess) return <AccessDenied />;

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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                  <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ" : "Amount"}</TableHead>
                  <TableHead>{isArabic ? "رسوم بنكية" : "Bank Fee"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ الأساسي" : "Base Amount"}</TableHead>
                  <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isArabic ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{(p.suppliers as any)?.supplier_name || "-"}</TableCell>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{(p.currencies as any)?.currency_code || "-"}</TableCell>
                    <TableCell>{Number(p.transaction_amount).toLocaleString()}</TableCell>
                    <TableCell>{Number(p.bank_fee).toLocaleString()}</TableCell>
                    <TableCell className="font-bold">{Number(p.base_amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => loadPayment(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {isArabic ? "لا توجد دفعات" : "No payments found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Main Form */}
          <Card>
            <CardHeader>
              <CardTitle>{isArabic ? "بيانات الدفعة المقدمة" : "Advance Payment Details"}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Supplier */}
              <div className="space-y-2">
                <Label>{isArabic ? "المورد *" : "Supplier *"}</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select Supplier"} /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>{isArabic ? "التاريخ *" : "Date *"}</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>

              {/* Currency */}
              <div className="space-y-2">
                <Label>{isArabic ? "العملة *" : "Currency *"}</Label>
                <Select value={currencyId} onValueChange={v => { setCurrencyId(v); loadedRateRef.current = null; }}>
                  <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العملة" : "Select Currency"} /></SelectTrigger>
                  <SelectContent>
                    {currencies.map(c => <SelectItem key={c.id} value={c.id}>{c.currency_code} - {c.currency_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Exchange Rate */}
              <div className="space-y-2">
                <Label>{isArabic ? "سعر الصرف" : "Exchange Rate"}</Label>
                <Input type="number" step="any" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
              </div>

              {/* Transaction Amount */}
              <div className="space-y-2">
                <Label>{isArabic ? "مبلغ المعاملة *" : "Transaction Amount *"}</Label>
                <Input type="number" step="any" value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)} className="text-lg font-bold" />
              </div>

              {/* Bank Fee */}
              <div className="space-y-2">
                <Label>{isArabic ? "رسوم التحويل البنكي" : "Bank Transfer Fee"}</Label>
                <Input type="number" step="any" value={bankFee} onChange={e => setBankFee(e.target.value)} />
              </div>

              {/* Base Amount (calculated) */}
              <div className="space-y-2">
                <Label>{isArabic ? "المبلغ الأساسي (ريال)" : "Base Amount (SAR)"}</Label>
                <Input type="number" value={baseAmount} readOnly className="bg-muted font-bold text-lg" />
              </div>

              {/* Notes */}
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
            <CardContent>
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
                  <div className="flex items-center gap-2">
                    {isPdf(bankTransferImage) ? (
                      <div className="flex items-center gap-2 p-2 border rounded bg-muted">
                        <FileText className="h-6 w-6 text-destructive" />
                        <span className="text-sm">{isArabic ? "ملف PDF" : "PDF File"}</span>
                        <Button size="sm" variant="ghost" onClick={() => window.open(bankTransferImage, "_blank")}>
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <img src={bankTransferImage} alt="Bank Transfer" className="h-16 w-16 object-cover rounded border cursor-pointer" onClick={() => setShowImagePreview(true)} />
                        <Button size="sm" variant="ghost" onClick={() => setShowImagePreview(true)}>
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attachments section - only show after save */}
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

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="min-w-[200px]">
              <Save className="h-4 w-4 mr-1" />
              {saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ الدفعة" : "Save Payment")}
            </Button>
          </div>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {bankTransferImage && (
            <img src={bankTransferImage} alt="Bank Transfer Preview" className="w-full h-auto object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierAdvancePayment;
