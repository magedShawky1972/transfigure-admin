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
import { toast } from "sonner";
import { Plus, Trash2, Save, Upload, FileText, X, Coins, ArrowLeft, Eye, Image } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

interface Supplier { id: string; supplier_name: string; }
interface Brand { id: string; brand_name: string; }
interface Bank { id: string; bank_name: string; }
interface Currency { id: string; currency_code: string; currency_name: string; }
interface LineItem { 
  id: string; 
  brand_id: string; 
  brand_name: string; 
  supplier_id: string;
  coins: number; 
  unit_price: number; 
  total: number; 
}
interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
}

const ReceivingCoins = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/receiving-coins");
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<"list" | "form">("list");

  // Header state
  const [supplierId, setSupplierId] = useState("");
  const [receiptDate, setReceiptDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [controlAmount, setControlAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");

  // Line items (brand-based)
  const [lines, setLines] = useState<LineItem[]>([]);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Receiving images from coins_purchase_receiving (per brand)
  const [receivingImages, setReceivingImages] = useState<Record<string, string>>({});

  // Dropdown data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Track the linked purchase order to fetch receiving images
  const [linkedPurchaseOrderId, setLinkedPurchaseOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipts();
    const fromOrderId = searchParams.get("fromOrder");
    if (fromOrderId) {
      loadFromPurchaseOrder(fromOrderId);
    }
  }, []);

  useEffect(() => {
    if (view === "form") {
      fetchDropdowns();
    }
  }, [view]);

  const fetchDropdowns = async () => {
    const [suppRes, brandRes, bankRes, currRes] = await Promise.all([
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("brands").select("id, brand_name, abc_analysis").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("banks").select("id, bank_name").eq("is_active", true).order("bank_name"),
      supabase.from("currencies").select("id, currency_code, currency_name").order("currency_code"),
    ]);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bankRes.data) setBanks(bankRes.data);
    if (currRes.data) setCurrencies(currRes.data as Currency[]);
  };

  const loadFromPurchaseOrder = async (orderId: string) => {
    const [suppRes, brandRes, bankRes, currRes] = await Promise.all([
      supabase.from("suppliers").select("id, supplier_name").eq("status", "active").order("supplier_name"),
      supabase.from("brands").select("id, brand_name, abc_analysis").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("banks").select("id, bank_name").eq("is_active", true).order("bank_name"),
      supabase.from("currencies").select("id, currency_code, currency_name").order("currency_code"),
    ]);
    if (suppRes.data) setSuppliers(suppRes.data);
    if (brandRes.data) setBrands(brandRes.data);
    if (bankRes.data) setBanks(bankRes.data);
    if (currRes.data) setCurrencies(currRes.data as Currency[]);

    const { data: order } = await supabase
      .from("coins_purchase_orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      if (order.supplier_id) setSupplierId(order.supplier_id);
      if (order.bank_id) setBankId(order.bank_id);
      if (order.currency_id) setCurrencyId(order.currency_id);
      if (order.exchange_rate) setExchangeRate(String(order.exchange_rate));
      setControlAmount(String(parseFloat(String(order.base_amount_sar || "0"))));
      setLinkedPurchaseOrderId(orderId);
      setView("form");

      // Load order lines as brand-based lines
      const { data: orderLines } = await supabase
        .from("coins_purchase_order_lines")
        .select("*, brands(brand_name)")
        .eq("purchase_order_id", orderId)
        .order("line_number");
      if (orderLines && orderLines.length > 0) {
        setLines(orderLines.map((ol: any) => ({
          id: crypto.randomUUID(),
          brand_id: ol.brand_id,
          brand_name: ol.brands?.brand_name || "",
          supplier_id: ol.supplier_id || "",
          coins: 0,
          unit_price: 0,
          total: 0,
        })));
      }

      // Load receiving images for this purchase order
      const { data: recImages } = await supabase
        .from("coins_purchase_receiving")
        .select("brand_id, receiving_image")
        .eq("purchase_order_id", orderId);
      if (recImages) {
        const imgMap: Record<string, string> = {};
        for (const r of recImages) {
          if (r.brand_id && r.receiving_image) imgMap[r.brand_id] = r.receiving_image;
        }
        setReceivingImages(imgMap);
      }
    }
  };

  const fetchReceipts = async () => {
    const { data } = await supabase
      .from("receiving_coins_header")
      .select("*, currencies(currency_code), coins_purchase_orders(order_number)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setReceipts(data);
  };

  const addLine = () => {
    setLines([...lines, {
      id: crypto.randomUUID(),
      brand_id: "",
      brand_name: "",
      supplier_id: "",
      coins: 0,
      unit_price: 0,
      total: 0,
    }]);
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map(line => {
      if (line.id !== id) return line;
      const updated = { ...line, [field]: value };
      if (field === "brand_id") {
        const brand = brands.find(b => b.id === value);
        if (brand) {
          updated.brand_name = brand.brand_name;
        }
      }
      updated.total = updated.coins * updated.unit_price;
      return updated;
    }));
  };

  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  const totalAmount = lines.reduce((sum, l) => sum + l.total, 0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const resourceType = isImage ? 'image' : isVideo ? 'video' : 'raw';
        const publicId = `receiving-coins/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType },
        });
        if (uploadError) throw uploadError;
        if (!uploadData?.url) throw new Error("Upload failed");
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          file_name: file.name,
          file_path: uploadData.url,
          file_size: file.size,
        }]);
      }
      toast.success(isArabic ? "تم رفع الملفات بنجاح" : "Files uploaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const generateReceiptNumber = () => {
    const now = new Date();
    return `RC-${format(now, "yyyyMMdd")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
  };

  const handleSave = async () => {
    if (!supplierId || !bankId) {
      toast.error(isArabic ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    if (lines.length === 0) {
      toast.error(isArabic ? "يرجى إضافة علامة تجارية واحدة على الأقل" : "Please add at least one brand line");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const headerData = {
        receipt_number: selectedReceiptId ? undefined : generateReceiptNumber(),
        supplier_id: supplierId,
        receipt_date: receiptDate,
        brand_id: lines[0]?.brand_id || null, // keep first brand for backward compat
        control_amount: parseFloat(controlAmount) || 0,
        bank_id: bankId,
        receiver_name: receiverName,
        total_amount: totalAmount,
        created_by: user?.email || "",
        currency_id: currencyId || null,
        exchange_rate: parseFloat(exchangeRate) || null,
      };
      let headerId: string;
      if (selectedReceiptId) {
        const { receipt_number, ...updateData } = headerData;
        const { error } = await supabase.from("receiving_coins_header").update(updateData as any).eq("id", selectedReceiptId);
        if (error) throw error;
        headerId = selectedReceiptId;
        await supabase.from("receiving_coins_line").delete().eq("header_id", headerId);
      } else {
        const { data, error } = await supabase.from("receiving_coins_header").insert(headerData as any).select("id").single();
        if (error) throw error;
        headerId = data.id;
      }
      const lineInserts = lines.map(l => ({
        header_id: headerId,
        brand_id: l.brand_id || null,
        brand_name: l.brand_name,
        supplier_id: l.supplier_id || null,
        product_id: null,
        product_name: l.brand_name,
        coins: l.coins,
        unit_price: l.unit_price,
      }));
      const { error: lineError } = await supabase.from("receiving_coins_line").insert(lineInserts as any);
      if (lineError) throw lineError;
      if (attachments.length > 0) {
        const attInserts = attachments.map(a => ({
          header_id: headerId,
          file_name: a.file_name,
          file_path: a.file_path,
          file_size: a.file_size,
          uploaded_by: user?.email || "",
        }));
        await supabase.from("receiving_coins_attachments").insert(attInserts as any);
      }
      toast.success(isArabic ? "تم الحفظ بنجاح" : "Saved successfully");
      resetForm();
      fetchReceipts();
      setView("list");
    } catch (error: any) {
      toast.error(error.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSupplierId("");
    setReceiptDate(format(new Date(), "yyyy-MM-dd"));
    setControlAmount("");
    setBankId("");
    setReceiverName("");
    setCurrencyId("");
    setExchangeRate("");
    setLines([]);
    setAttachments([]);
    setSelectedReceiptId(null);
    setLinkedPurchaseOrderId(null);
    setReceivingImages({});
  };

  const openNewEntry = () => {
    resetForm();
    setView("form");
  };

  const loadReceipt = async (receiptId: string) => {
    const [headerRes, linesRes, attRes] = await Promise.all([
      supabase.from("receiving_coins_header").select("*").eq("id", receiptId).maybeSingle(),
      supabase.from("receiving_coins_line").select("*").eq("header_id", receiptId),
      supabase.from("receiving_coins_attachments").select("*").eq("header_id", receiptId),
    ]);
    if (headerRes.data) {
      const h = headerRes.data as any;
      setSelectedReceiptId(h.id);
      setSupplierId(h.supplier_id || "");
      setReceiptDate(h.receipt_date || format(new Date(), "yyyy-MM-dd"));
      setControlAmount(h.control_amount?.toString() || "");
      setBankId(h.bank_id || "");
      setReceiverName(h.receiver_name || "");
      setCurrencyId(h.currency_id || "");
      setExchangeRate(h.exchange_rate?.toString() || "");
    }
    if (linesRes.data) {
      setLines((linesRes.data as any[]).map(l => ({
        id: l.id,
        brand_id: l.brand_id || "",
        brand_name: l.brand_name || l.product_name || "",
        supplier_id: l.supplier_id || "",
        coins: l.coins || 0,
        unit_price: l.unit_price || 0,
        total: (l.coins || 0) * (l.unit_price || 0),
      })));

      // Try to load receiving images for brands in lines
      const brandIds = (linesRes.data as any[]).filter(l => l.brand_id).map(l => l.brand_id);
      if (brandIds.length > 0) {
        const { data: recImages } = await supabase
          .from("coins_purchase_receiving")
          .select("brand_id, receiving_image")
          .in("brand_id", brandIds);
        if (recImages) {
          const imgMap: Record<string, string> = {};
          for (const r of recImages) {
            if (r.brand_id && r.receiving_image) imgMap[r.brand_id] = r.receiving_image;
          }
          setReceivingImages(imgMap);
        }
      }
    }
    if (attRes.data) {
      setAttachments((attRes.data as any[]).map(a => ({
        id: a.id,
        file_name: a.file_name,
        file_path: a.file_path,
        file_size: a.file_size || 0,
      })));
    }
    setView("form");
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "إيصال الاستلام" : "Receiving Entry"}</h1>
          </div>
          <Button onClick={openNewEntry}>
            <Plus className="h-4 w-4 mr-1" />
            {isArabic ? "إدخال جديد" : "New Entry"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                    <TableHead>{isArabic ? "رقم الإيصال" : "Receipt #"}</TableHead>
                    <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                    <TableHead>{isArabic ? "سعر الصرف" : "Rate"}</TableHead>
                    <TableHead>{isArabic ? "مبلغ المعاملة" : "Transaction Amt"}</TableHead>
                    <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                    <TableHead>{isArabic ? "المستلم" : "Receiver"}</TableHead>
                    <TableHead>{isArabic ? "الحالة" : "Status"}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {isArabic ? "لا توجد إيصالات" : "No receipts found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    receipts.map(r => {
                      const rate = parseFloat(r.exchange_rate) || 0;
                      const sarAmount = parseFloat(r.control_amount) || 0;
                      const txnAmount = rate > 0 ? sarAmount / rate : sarAmount;
                      return (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadReceipt(r.id)}>
                          <TableCell className="font-mono text-sm">{(r as any).coins_purchase_orders?.order_number || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{r.receipt_number}</TableCell>
                          <TableCell>{r.receipt_date}</TableCell>
                          <TableCell>{(r as any).currencies?.currency_code || "-"}</TableCell>
                          <TableCell>{rate > 0 ? rate.toFixed(4) : "-"}</TableCell>
                          <TableCell>{rate > 0 ? txnAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</TableCell>
                          <TableCell>{sarAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>{r.receiver_name || "-"}</TableCell>
                          <TableCell>{r.status}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); loadReceipt(r.id); }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { resetForm(); setView("list"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Coins className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">
            {selectedReceiptId
              ? (isArabic ? "تعديل الإيصال" : "Edit Receipt")
              : (isArabic ? "إيصال جديد" : "New Receipt")}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "حفظ" : "Save")}
        </Button>
      </div>

      {/* Header Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isArabic ? "بيانات الإيصال" : "Receipt Header"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{isArabic ? "المورد الرئيسي *" : "Main Supplier *"}</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (<SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "التاريخ" : "Date"}</Label>
              <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "العملة" : "Currency"}</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر العملة" : "Select currency"} /></SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (<SelectItem key={c.id} value={c.id}>{c.currency_code} - {c.currency_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "سعر الصرف" : "Exchange Rate"}</Label>
              <Input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="0.00" step="0.0001" />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "المبلغ المتحكم (SAR)" : "Control Amount (SAR)"}</Label>
              <Input type="number" value={controlAmount} onChange={e => setControlAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "البنك *" : "Bank *"}</Label>
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger><SelectValue placeholder={isArabic ? "اختر البنك" : "Select bank"} /></SelectTrigger>
                <SelectContent>
                  {banks.map(b => (<SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "اسم المستلم" : "Receiver Name"}</Label>
              <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder={isArabic ? "أدخل اسم المستلم" : "Enter receiver name"} />
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
            <span className="font-semibold">{isArabic ? "إجمالي المبلغ" : "Total Amount"}</span>
            <span className="text-xl font-bold text-primary">{totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Attachments + Receiving Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isArabic ? "المرفقات" : "Attachments"}</span>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع ملفات" : "Upload Files")}
                </span>
              </Button>
            </label>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Receiving Images per Brand */}
          {Object.keys(receivingImages).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Image className="h-4 w-4" />
                {isArabic ? "صور الاستلام من المورد" : "Receiving Images from Supplier"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lines.filter(l => l.brand_id && receivingImages[l.brand_id]).map(l => (
                  <div key={l.brand_id} className="border rounded-lg p-2 space-y-1">
                    <p className="text-xs font-medium text-center">{l.brand_name}</p>
                    <a href={receivingImages[l.brand_id]} target="_blank" rel="noopener noreferrer">
                      <img src={receivingImages[l.brand_id]} alt={l.brand_name} className="w-full h-32 object-contain rounded border" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded Attachments */}
          {attachments.length === 0 && Object.keys(receivingImages).length === 0 ? (
            <p className="text-muted-foreground text-sm">{isArabic ? "لا توجد مرفقات" : "No attachments"}</p>
          ) : (
            attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <a href={att.file_path} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{att.file_name}</a>
                      <span className="text-xs text-muted-foreground">({(att.file_size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeAttachment(att.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Line Items - Brand based */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{isArabic ? "العلامات التجارية" : "Brands"}</span>
            <Button size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              {isArabic ? "إضافة علامة" : "Add Brand"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{isArabic ? "العلامة التجارية" : "Brand"}</TableHead>
                  <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                  <TableHead>{isArabic ? "العملات" : "Coins"}</TableHead>
                  <TableHead>{isArabic ? "سعر الوحدة" : "Unit Price"}</TableHead>
                  <TableHead>{isArabic ? "الإجمالي" : "Total"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      {isArabic ? "لا توجد علامات تجارية" : "No brands added"}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, idx) => (
                    <TableRow key={line.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Select value={line.brand_id} onValueChange={v => updateLine(line.id, "brand_id", v)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={isArabic ? "اختر العلامة" : "Select brand"} />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map(b => (<SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={line.supplier_id} onValueChange={v => updateLine(line.id, "supplier_id", v)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={isArabic ? "اختر المورد" : "Select supplier"} />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map(s => (<SelectItem key={s.id} value={s.id}>{s.supplier_name}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={line.coins} onChange={e => updateLine(line.id, "coins", parseFloat(e.target.value) || 0)} className="w-[120px]" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={line.unit_price} onChange={e => updateLine(line.id, "unit_price", parseFloat(e.target.value) || 0)} className="w-[120px]" step="0.01" />
                      </TableCell>
                      <TableCell className="font-semibold">{line.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeLine(line.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReceivingCoins;
