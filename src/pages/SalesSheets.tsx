import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
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
import { Plus, Save, ArrowLeft, Send, Trash2, FileText, Upload, Eye, CheckCircle, XCircle, Paperclip, Download, Image, File, ChevronsUpDown, Check, Maximize2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { downloadFile } from "@/lib/fileDownload";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface LineAttachment {
  id?: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
}

interface SalesSheetLine {
  id?: string;
  seller_name: string;
  usd_payment_amount: string;
  coins: string;
  extra_coins: string;
  rate: string;
  currency_id: string;
  sar_rate: string;
  total_sar: string;
  notes: string;
  line_number: number;
  attachments: LineAttachment[];
  receiving_date?: Date;
}

const emptyLine = (lineNumber: number): SalesSheetLine => ({
  seller_name: "",
  usd_payment_amount: "",
  coins: "",
  extra_coins: "0",
  rate: "",
  currency_id: "",
  sar_rate: "1",
  total_sar: "0",
  notes: "",
  line_number: lineNumber,
  attachments: [],
  receiving_date: undefined,
});

const PHASES = [
  { key: "entry", ar: "إدخال", en: "Entry" },
  { key: "accounting_approved", ar: "مراجعة وتأكيد المحاسبة", en: "Accounting Review & Confirm" },
  { key: "completed", ar: "مكتمل", en: "Completed" },
];

const SalesSheets = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/sales-sheets");

  const [view, setView] = useState<"list" | "form">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<SalesSheetLine[]>([emptyLine(1)]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderPhase, setSelectedOrderPhase] = useState<string | null>("entry");
  const [selectedOrderNumber, setSelectedOrderNumber] = useState("");

  // Header fields
  const [headerBrandId, setHeaderBrandId] = useState("");
  const [headerCoinsRate, setHeaderCoinsRate] = useState("");
  const [headerExtraCoinsRate, setHeaderExtraCoinsRate] = useState("");
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);

  // Dropdowns
  const [brands, setBrands] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [currencyRates, setCurrencyRates] = useState<any[]>([]);
  const [defaultSarRate, setDefaultSarRate] = useState<number>(3.75);

  // Filter
  const [phaseFilter, setPhaseFilter] = useState("all");

  // Accounting dialog
  const [accountingDialog, setAccountingDialog] = useState(false);
  const [accountingNotes, setAccountingNotes] = useState("");
  const [bankTransferImages, setBankTransferImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processingOrder, setProcessingOrder] = useState<any>(null);
  const [transferPreviewUrl, setTransferPreviewUrl] = useState<string | null>(null);

  // Line attachment upload
  const [uploadingLineIndex, setUploadingLineIndex] = useState<number | null>(null);

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
      .from("sales_sheet_orders" as any)
      .select("*, sales_sheet_order_lines(*)")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as any[]);
  };

  const fetchDropdowns = async () => {
    const [brandRes, currRes, rateRes] = await Promise.all([
      supabase.from("brands").select("id, brand_name, abc_analysis").eq("status", "active").eq("abc_analysis", "A").order("brand_name"),
      supabase.from("currencies").select("*").eq("is_active", true).order("currency_name"),
      supabase.from("currency_rates").select("*").order("effective_date", { ascending: false }),
    ]);
    if (brandRes.data) setBrands(brandRes.data);
    if (currRes.data) setCurrencies(currRes.data);
    if (rateRes.data) setCurrencyRates(rateRes.data);

    if (currRes.data && rateRes.data) {
      const usdCurrency = currRes.data.find((c: any) => c.currency_code === "USD");
      if (usdCurrency) {
        const usdRate = rateRes.data.find((r: any) => r.currency_id === usdCurrency.id);
        if (usdRate) setDefaultSarRate(usdRate.rate_to_base);
      }
    }
  };

  const parseNum = (v: string | number | null | undefined): number => {
    if (v === null || v === undefined || v === "") return 0;
    const cleaned = v.toString().replace(/,/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleLineChange = (index: number, field: keyof SalesSheetLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      const numericFields = ["coins", "extra_coins", "usd_payment_amount"];
      const cleanValue = numericFields.includes(field) ? value.replace(/,/g, "") : value;
      updated[index] = { ...updated[index], [field]: cleanValue };

      if (field === "usd_payment_amount") {
        const usdAmount = parseNum(cleanValue);
        const coinsRate = parseNum(headerCoinsRate);
        const extraCoinsRate = parseNum(headerExtraCoinsRate);
        if (coinsRate > 0) updated[index].coins = (usdAmount * coinsRate).toFixed(2);
        if (extraCoinsRate > 0) updated[index].extra_coins = (usdAmount * extraCoinsRate).toFixed(2);
        else updated[index].extra_coins = "0";
      }

      if (["coins", "extra_coins", "usd_payment_amount"].includes(field)) {
        const usdAmount = parseNum(updated[index].usd_payment_amount);
        updated[index].total_sar = (usdAmount * defaultSarRate).toFixed(2);
      }

      return updated;
    });
  };

  const addLine = () => setLines(prev => [...prev, emptyLine(prev.length + 1)]);
  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, line_number: i + 1 })));
  };

  const handleLineAttachmentUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingLineIndex(index);
    try {
      const newAttachments: LineAttachment[] = [];
      for (const file of Array.from(files)) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const resourceType = isImage ? "image" : isVideo ? "video" : "raw";
        const publicId = `sales-sheet-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { imageBase64: base64, folder: "Edara_Sales_Sheet_Attachments", publicId, resourceType },
        });
        if (uploadError) throw uploadError;
        if (!uploadData?.url) throw new Error("Upload failed");
        newAttachments.push({ file_name: file.name, file_url: uploadData.url, file_type: file.type, file_size: file.size });
      }
      setLines(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], attachments: [...updated[index].attachments, ...newAttachments] };
        return updated;
      });
      toast.success(isArabic ? "تم رفع الملف" : "File uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingLineIndex(null);
      e.target.value = "";
    }
  };

  const removeLineAttachment = (lineIndex: number, attIndex: number) => {
    setLines(prev => {
      const updated = [...prev];
      updated[lineIndex] = { ...updated[lineIndex], attachments: updated[lineIndex].attachments.filter((_, i) => i !== attIndex) };
      return updated;
    });
  };

  const handleSave = async () => {
    if (!headerBrandId) {
      toast.error(isArabic ? "يرجى اختيار العلامة التجارية" : "Please select a brand");
      return;
    }
    const validLines = lines.filter(l => l.seller_name && parseFloat(l.coins) > 0);
    if (validLines.length === 0) {
      toast.error(isArabic ? "يرجى إضافة سطر واحد على الأقل" : "Please add at least one line");
      return;
    }
    setSaving(true);
    try {
      const headerData = {
        notes,
        brand_id: headerBrandId,
        coins_rate: parseFloat(headerCoinsRate) || 0,
        extra_coins_rate: parseFloat(headerExtraCoinsRate) || 0,
      };
      let orderId = selectedOrderId;
      if (selectedOrderId) {
        await supabase.from("sales_sheet_orders" as any).update(headerData).eq("id", selectedOrderId);
        await supabase.from("sales_sheet_line_attachments" as any).delete().eq("sheet_order_id", selectedOrderId);
        await supabase.from("sales_sheet_order_lines" as any).delete().eq("sheet_order_id", selectedOrderId);
      } else {
        const { data: order, error } = await supabase.from("sales_sheet_orders" as any).insert({
          order_number: "",
          created_by: currentUserId,
          created_by_name: currentUserName,
          ...headerData,
        } as any).select().single();
        if (error) throw error;
        orderId = (order as any).id;
      }
      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i];
        const { data: lineData, error: lineErr } = await supabase.from("sales_sheet_order_lines" as any).insert({
          sheet_order_id: orderId,
          line_number: i + 1,
          seller_name: l.seller_name,
          brand_id: headerBrandId,
          usd_payment_amount: parseFloat(l.usd_payment_amount) || 0,
          coins: parseFloat(l.coins) || 0,
          extra_coins: parseFloat(l.extra_coins) || 0,
          sar_rate: defaultSarRate,
          total_sar: parseFloat(l.total_sar) || 0,
          notes: l.notes,
          receiving_date: l.receiving_date ? format(l.receiving_date, "yyyy-MM-dd") : null,
        } as any).select().single();
        if (lineErr) throw lineErr;
        if (l.attachments.length > 0 && lineData) {
          const attInserts = l.attachments.map(a => ({
            line_id: (lineData as any).id,
            sheet_order_id: orderId,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_by: currentUserId,
            uploaded_by_name: currentUserName,
          }));
          await supabase.from("sales_sheet_line_attachments" as any).insert(attInserts as any);
        }
      }
      toast.success(isArabic ? (selectedOrderId ? "تم الحفظ" : "تم إنشاء الطلب") : (selectedOrderId ? "Saved" : "Order created"));
      resetForm();
      setView("list");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleSendForAccounting = async (orderId: string) => {
    const { error } = await supabase.from("sales_sheet_orders" as any).update({
      current_phase: "accounting_approved",
      phase_updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }

    const { data: assignments } = await supabase
      .from("sales_sheet_workflow_assignments" as any)
      .select("user_id, user_name")
      .eq("phase", "accounting");
    if (assignments) {
      for (const a of assignments as any[]) {
        await supabase.functions.invoke("send-coins-workflow-notification", {
          body: {
            type: "sales_sheet_sent_for_review",
            userId: a.user_id,
            userName: a.user_name || "",
            orderNumber: orders.find(o => o.id === orderId)?.order_number || "",
          },
        }).catch(console.error);
      }
    }

    toast.success(isArabic ? "تم الإرسال للمحاسبة" : "Sent for accounting review");
    setSelectedOrderId(null);
    setSelectedOrderPhase(null);
    fetchOrders();
  };

  const handleAccountingApprove = async () => {
    if (!processingOrder) return;
    setSaving(true);
    try {
      const imageJson = bankTransferImages.length > 0 ? JSON.stringify(bankTransferImages) : null;
      const { error } = await supabase.from("sales_sheet_orders" as any).update({
        current_phase: "completed",
        status: "completed",
        phase_updated_at: new Date().toISOString(),
        accounting_approved_by: currentUserId,
        accounting_approved_name: currentUserName,
        accounting_approved_at: new Date().toISOString(),
        accounting_notes: accountingNotes,
        bank_transfer_image: imageJson,
      }).eq("id", processingOrder.id);
      if (error) throw error;
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

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `sales-sheet-transfers/${Date.now()}-${Math.random().toString(36).substr(2)}.${ext}`;
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

  const loadOrder = async (order: any) => {
    setSelectedOrderId(order.id);
    setSelectedOrderPhase(order.current_phase);
    setSelectedOrderNumber(order.order_number);
    setNotes(order.notes || "");
    setHeaderBrandId(order.brand_id || "");
    setHeaderCoinsRate(String(order.coins_rate || ""));
    setHeaderExtraCoinsRate(String(order.extra_coins_rate || ""));

    const { data: lineAttachments } = await supabase
      .from("sales_sheet_line_attachments" as any)
      .select("*")
      .eq("sheet_order_id", order.id);

    const orderLines = order.sales_sheet_order_lines || [];
    if (orderLines.length > 0) {
      setLines(orderLines.sort((a: any, b: any) => a.line_number - b.line_number).map((l: any) => ({
        id: l.id,
        seller_name: l.seller_name || "",
        usd_payment_amount: String(l.usd_payment_amount || ""),
        coins: String(l.coins || 0),
        extra_coins: String(l.extra_coins || 0),
        rate: String(l.rate || 0),
        currency_id: l.currency_id || "",
        sar_rate: String(l.sar_rate || 1),
        total_sar: String(l.total_sar || 0),
        notes: l.notes || "",
        line_number: l.line_number,
        receiving_date: l.receiving_date ? new Date(l.receiving_date) : undefined,
        attachments: ((lineAttachments as any[]) || [])
          .filter((a: any) => a.line_id === l.id)
          .map((a: any) => ({ id: a.id, file_name: a.file_name, file_url: a.file_url, file_type: a.file_type, file_size: a.file_size })),
      })));
    } else {
      setLines([emptyLine(1)]);
    }
    setView("form");
  };

  const resetForm = () => {
    setSelectedOrderId(null);
    setSelectedOrderPhase("entry");
    setSelectedOrderNumber("");
    setNotes("");
    setHeaderBrandId("");
    setHeaderCoinsRate("");
    setHeaderExtraCoinsRate("");
    setLines([emptyLine(1)]);
  };

  const getPhaseLabel = (key: string) => {
    const p = PHASES.find(ph => ph.key === key);
    return isArabic ? p?.ar || key : p?.en || key;
  };

  const getPhaseBadgeVariant = (phase: string) => {
    switch (phase) {
      case "entry": return "secondary";
      case "accounting_approved": return "default";
      case "completed": return "default";
      default: return "secondary";
    }
  };

  const filteredOrders = phaseFilter === "all" ? orders : orders.filter(o => o.current_phase === phaseFilter);
  const grandTotal = lines.reduce((sum, l) => sum + parseNum(l.total_sar), 0);
  const isEditable = !selectedOrderId || selectedOrderPhase === "entry";

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-3 w-3" />;
    if (fileType.startsWith("image/")) return <Image className="h-3 w-3 text-blue-600" />;
    if (fileType.includes("pdf")) return <FileText className="h-3 w-3 text-red-600" />;
    return <File className="h-3 w-3" />;
  };

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
            <h1 className="text-2xl font-bold">{isArabic ? "شيت المبيعات - طلب بيع" : "Sales Sheet - Sales Entry"}</h1>
            {selectedOrderNumber && <Badge variant="outline" className="text-lg px-3">{selectedOrderNumber}</Badge>}
          </div>
          <div className="flex gap-2">
            {isEditable && (
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {isArabic ? "حفظ" : "Save"}
              </Button>
            )}
          </div>
        </div>

        {/* Header */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{isArabic ? "بيانات الشيت" : "Sheet Header"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>{isArabic ? "العلامة التجارية" : "Brand"}</Label>
                <Popover open={brandPopoverOpen} onOpenChange={setBrandPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" disabled={!isEditable} className="w-full justify-between mt-1 font-normal">
                      {headerBrandId ? brands.find(b => b.id === headerBrandId)?.brand_name || "..." : (isArabic ? "اختر..." : "Select...")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder={isArabic ? "بحث..." : "Search..."} />
                      <CommandList>
                        <CommandEmpty>{isArabic ? "لا توجد نتائج" : "No results"}</CommandEmpty>
                        <CommandGroup>
                          {brands.map(b => (
                            <CommandItem key={b.id} value={b.brand_name} onSelect={() => { setHeaderBrandId(b.id); setBrandPopoverOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", headerBrandId === b.id ? "opacity-100" : "opacity-0")} />
                              {b.brand_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>{isArabic ? "سعر الكوينز" : "Coins Rate"}</Label>
                <Input type="number" value={headerCoinsRate} onChange={e => setHeaderCoinsRate(e.target.value)} disabled={!isEditable} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label>{isArabic ? "سعر الكوينز الإضافية" : "Extra Coins Rate"}</Label>
                <Input type="number" value={headerExtraCoinsRate} onChange={e => setHeaderExtraCoinsRate(e.target.value)} disabled={!isEditable} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={!isEditable} className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{isArabic ? "تفاصيل شيت المبيعات" : "Sales Sheet Details"}</CardTitle>
              <div className="flex items-center gap-2">
                {lines.some(l => l.seller_name) && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const brandName = brands.find(b => b.id === headerBrandId)?.brand_name || "";
                    const exportData = lines.filter(l => l.seller_name).map(l => ({
                      [isArabic ? "البراند" : "Brand"]: brandName,
                      [isArabic ? "#" : "#"]: l.line_number,
                      [isArabic ? "اسم العميل" : "Customer Name"]: l.seller_name,
                      [isArabic ? "تاريخ البيع" : "Sale Date"]: l.receiving_date ? format(l.receiving_date, "yyyy-MM-dd") : "",
                      [isArabic ? "مبلغ الدفع USD" : "USD Payment Amount"]: parseNum(l.usd_payment_amount),
                      [isArabic ? "الكوينز" : "Coins"]: parseNum(l.coins),
                      [isArabic ? "كوينز إضافية" : "Extra Coins"]: parseNum(l.extra_coins),
                      [isArabic ? "الإجمالي ر.س" : "Total SAR"]: parseNum(l.total_sar),
                      [isArabic ? "ملاحظات" : "Notes"]: l.notes,
                    }));
                    const ws = XLSX.utils.json_to_sheet(exportData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Sales Sheet Details");
                    XLSX.writeFile(wb, `sales_sheet_${selectedOrderNumber || "details"}_${brandName || "export"}.xlsx`);
                    toast.success(isArabic ? "تم التصدير بنجاح" : "Exported successfully");
                  }}>
                    <Download className="h-4 w-4 mr-1" />
                    {isArabic ? "تصدير Excel" : "Export Excel"}
                  </Button>
                )}
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    {isArabic ? "إضافة سطر" : "Add Line"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{isArabic ? "اسم العميل" : "Customer Name"}</TableHead>
                    <TableHead>{isArabic ? "تاريخ البيع" : "Sale Date"}</TableHead>
                    <TableHead>{isArabic ? "مبلغ الدفع USD" : "USD Payment Amount"}</TableHead>
                    <TableHead>{isArabic ? "الكوينز" : "Coins"}</TableHead>
                    <TableHead>{isArabic ? "كوينز إضافية" : "Extra Coins"}</TableHead>
                    <TableHead>{isArabic ? "الإجمالي ر.س" : "Total SAR"}</TableHead>
                    <TableHead>{isArabic ? "مرفقات" : "Attachments"}</TableHead>
                    <TableHead>{isArabic ? "ملاحظات" : "Notes"}</TableHead>
                    {isEditable && <TableHead className="w-10"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{line.line_number}</TableCell>
                      <TableCell>
                        <Input value={line.seller_name} onChange={e => handleLineChange(index, "seller_name", e.target.value)} disabled={!isEditable} placeholder={isArabic ? "اسم العميل" : "Customer name"} className="min-w-[140px]" />
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" disabled={!isEditable} className={cn("min-w-[130px] justify-start text-left font-normal h-9 text-xs", !line.receiving_date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {line.receiving_date ? format(line.receiving_date, "yyyy-MM-dd") : (isArabic ? "التاريخ" : "Date")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={line.receiving_date} onSelect={(date) => {
                              setLines(prev => { const updated = [...prev]; updated[index] = { ...updated[index], receiving_date: date || undefined }; return updated; });
                            }} disabled={!isEditable} className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={line.usd_payment_amount} onChange={e => handleLineChange(index, "usd_payment_amount", e.target.value)} disabled={!isEditable} className="min-w-[100px]" placeholder="0" />
                      </TableCell>
                      <TableCell>
                        <Input type="text" value={line.coins ? Number(line.coins).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""} onFocus={e => { e.target.value = line.coins; e.target.type = "number"; }} onBlur={e => { handleLineChange(index, "coins", e.target.value); e.target.type = "text"; }} onChange={e => handleLineChange(index, "coins", e.target.value)} disabled={!isEditable} className="min-w-[130px]" />
                      </TableCell>
                      <TableCell>
                        <Input type="text" value={line.extra_coins ? Number(line.extra_coins).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""} onFocus={e => { e.target.value = line.extra_coins; e.target.type = "number"; }} onBlur={e => { handleLineChange(index, "extra_coins", e.target.value); e.target.type = "text"; }} onChange={e => handleLineChange(index, "extra_coins", e.target.value)} disabled={!isEditable} className="min-w-[100px]" />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold">{parseNum(line.total_sar).toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-[100px]">
                          {line.attachments.map((att, ai) => (
                            <div key={ai} className="flex items-center gap-1 text-xs">
                              {getFileIcon(att.file_type)}
                              <button onClick={() => downloadFile(att.file_url, att.file_name)} className="text-primary hover:underline truncate max-w-[80px]" title={att.file_name}>{att.file_name}</button>
                              {isEditable && <button onClick={() => removeLineAttachment(index, ai)} className="text-destructive"><XCircle className="h-3 w-3" /></button>}
                            </div>
                          ))}
                          {isEditable && (
                            <label className="cursor-pointer">
                              <input type="file" className="hidden" multiple onChange={e => handleLineAttachmentUpload(index, e)} disabled={uploadingLineIndex === index} />
                              <span className="inline-flex items-center text-xs text-primary hover:underline">
                                {uploadingLineIndex === index ? <span className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full mr-1" /> : <Paperclip className="h-3 w-3 mr-1" />}
                                {isArabic ? "إرفاق" : "Attach"}
                              </span>
                            </label>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input value={line.notes} onChange={e => handleLineChange(index, "notes", e.target.value)} disabled={!isEditable} placeholder={isArabic ? "ملاحظات" : "Notes"} className="min-w-[100px]" />
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
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={6} className="text-end">{isArabic ? "الإجمالي" : "Grand Total"}</TableCell>
                    <TableCell>{grandTotal.toFixed(2)} SAR</TableCell>
                    <TableCell colSpan={isEditable ? 3 : 2}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Send for Accounting button */}
            {selectedOrderId && selectedOrderPhase === "entry" && (() => {
              const hasLines = lines.some(l => parseFloat(String(l.usd_payment_amount || 0)) > 0);
              return (
                <div className="flex justify-end mt-4">
                  <Button onClick={() => handleSendForAccounting(selectedOrderId)} disabled={!hasLines} className="bg-green-600 hover:bg-green-700" title={!hasLines ? (isArabic ? "يجب إضافة أسطر أولاً" : "Add lines first") : ""}>
                    <Send className="h-4 w-4 mr-1" />
                    {isArabic ? "إرسال للمحاسبة" : "Send for Accounting"}
                  </Button>
                </div>
              );
            })()}

            {/* Accounting phase view */}
            {selectedOrderId && selectedOrderPhase === "accounting_approved" && (
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold mb-2">{isArabic ? "في انتظار مراجعة المحاسبة" : "Awaiting Accounting Review"}</h3>
                <p className="text-sm text-muted-foreground">{isArabic ? "تم إرسال هذا الطلب للمراجعة من قبل المحاسبة" : "This order has been sent for accounting review"}</p>
              </div>
            )}

            {selectedOrderId && selectedOrderPhase === "completed" && (
              <div className="mt-4 p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <h3 className="font-semibold text-green-700 dark:text-green-400">{isArabic ? "مكتمل" : "Completed"}</h3>
              </div>
            )}
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
          <h1 className="text-2xl font-bold">{isArabic ? "شيت المبيعات" : "Sales Sheets"}</h1>
        </div>
        <Button onClick={() => { resetForm(); setView("form"); }}>
          <Plus className="h-4 w-4 mr-1" />
          {isArabic ? "طلب بيع جديد" : "New Sales Entry"}
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
                  const totalSar = (order.sales_sheet_order_lines || []).reduce((s: number, l: any) => s + (l.total_sar || 0), 0);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.created_by_name}</TableCell>
                      <TableCell>{(order.sales_sheet_order_lines || []).length}</TableCell>
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
                          {order.current_phase === "accounting_approved" && (
                            <Button variant="ghost" size="icon" className="text-green-600" onClick={() => { setProcessingOrder(order); setAccountingDialog(true); }}>
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
            <DialogTitle>{isArabic ? "اعتماد المحاسبة" : "Accounting Approval"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isArabic ? "ملاحظات المحاسبة" : "Accounting Notes"}</Label>
              <Textarea value={accountingNotes} onChange={e => setAccountingNotes(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>{isArabic ? "إرفاق إيصال" : "Attach Receipt"}</Label>
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
              {isArabic ? "اعتماد" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesSheets;
