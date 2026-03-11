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
import { Plus, Save, ArrowLeft, Send, Trash2, FileText, Upload, Eye, CheckCircle, XCircle, Paperclip, Download, Image, File, ChevronsUpDown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { parseBankTransferImages } from "@/lib/bankTransferImages";
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

interface SheetLine {
  id?: string;
  seller_name: string;
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

const emptyLine = (lineNumber: number): SheetLine => ({
  seller_name: "",
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

  // Header fields
  const [headerBrandId, setHeaderBrandId] = useState("");
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);

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
      .from("coins_sheet_orders")
      .select("*, coins_sheet_order_lines(*)")
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
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
  };

  const handleLineChange = (index: number, field: keyof SheetLine, value: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (["coins", "extra_coins", "rate", "sar_rate"].includes(field)) {
        const coins = parseFloat(updated[index].coins) || 0;
        const extraCoins = parseFloat(updated[index].extra_coins) || 0;
        const rate = parseFloat(updated[index].rate) || 0;
        const sarRate = parseFloat(updated[index].sar_rate) || 1;
        updated[index].total_sar = ((coins + extraCoins) * rate * sarRate).toFixed(2);
      }

      if (field === "currency_id") {
        const rateEntry = currencyRates.find(r => r.currency_id === value);
        if (rateEntry) {
          updated[index].sar_rate = String(rateEntry.rate_to_base);
          const coins = parseFloat(updated[index].coins) || 0;
          const extraCoins = parseFloat(updated[index].extra_coins) || 0;
          const rate = parseFloat(updated[index].rate) || 0;
          updated[index].total_sar = ((coins + extraCoins) * rate * rateEntry.rate_to_base).toFixed(2);
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
        const publicId = `sheet-line-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}`;

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke("upload-to-cloudinary", {
          body: { imageBase64: base64, folder: "Edara_Sheet_Attachments", publicId, resourceType },
        });
        if (uploadError) throw uploadError;
        if (!uploadData?.url) throw new Error("Upload failed");

        newAttachments.push({
          file_name: file.name,
          file_url: uploadData.url,
          file_type: file.type,
          file_size: file.size,
        });
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
      updated[lineIndex] = {
        ...updated[lineIndex],
        attachments: updated[lineIndex].attachments.filter((_, i) => i !== attIndex),
      };
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
        receiving_date: receivingDate ? format(receivingDate, "yyyy-MM-dd") : null,
      };

      let orderId = selectedOrderId;

      if (selectedOrderId) {
        await supabase.from("coins_sheet_orders").update(headerData).eq("id", selectedOrderId);
        // Delete old lines and their attachments
        await supabase.from("coins_sheet_line_attachments").delete().eq("sheet_order_id", selectedOrderId);
        await supabase.from("coins_sheet_order_lines").delete().eq("sheet_order_id", selectedOrderId);
      } else {
        const { data: order, error } = await supabase.from("coins_sheet_orders").insert({
          order_number: "",
          created_by: currentUserId,
          created_by_name: currentUserName,
          ...headerData,
        } as any).select().single();
        if (error) throw error;
        orderId = order.id;
      }

      // Insert lines
      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i];
        const { data: lineData, error: lineErr } = await supabase.from("coins_sheet_order_lines").insert({
          sheet_order_id: orderId,
          line_number: i + 1,
          seller_name: l.seller_name,
          brand_id: headerBrandId,
          coins: parseFloat(l.coins) || 0,
          extra_coins: parseFloat(l.extra_coins) || 0,
          rate: parseFloat(l.rate) || 0,
          currency_id: l.currency_id || null,
          sar_rate: parseFloat(l.sar_rate) || 1,
          total_sar: parseFloat(l.total_sar) || 0,
          notes: l.notes,
        } as any).select().single();
        if (lineErr) throw lineErr;

        // Insert line attachments
        if (l.attachments.length > 0 && lineData) {
          const attInserts = l.attachments.map(a => ({
            line_id: lineData.id,
            sheet_order_id: orderId,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
            file_size: a.file_size,
            uploaded_by: currentUserId,
            uploaded_by_name: currentUserName,
          }));
          await supabase.from("coins_sheet_line_attachments").insert(attInserts as any);
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

  const handleSendForPayment = async (orderId: string) => {
    const { error } = await supabase.from("coins_sheet_orders").update({
      current_phase: "sent_for_payment",
      phase_updated_at: new Date().toISOString(),
    }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }

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

  const loadOrder = async (order: any) => {
    setSelectedOrderId(order.id);
    setSelectedOrderPhase(order.current_phase);
    setSelectedOrderNumber(order.order_number);
    setNotes(order.notes || "");
    setHeaderBrandId(order.brand_id || "");
    setReceivingDate(order.receiving_date ? new Date(order.receiving_date) : undefined);

    // Fetch line attachments
    const { data: lineAttachments } = await supabase
      .from("coins_sheet_line_attachments")
      .select("*")
      .eq("sheet_order_id", order.id);

    const orderLines = order.coins_sheet_order_lines || [];
    if (orderLines.length > 0) {
      setLines(orderLines.sort((a: any, b: any) => a.line_number - b.line_number).map((l: any) => ({
        id: l.id,
        seller_name: l.seller_name || "",
        coins: String(l.coins || 0),
        extra_coins: String(l.extra_coins || 0),
        rate: String(l.rate || 0),
        currency_id: l.currency_id || "",
        sar_rate: String(l.sar_rate || 1),
        total_sar: String(l.total_sar || 0),
        notes: l.notes || "",
        line_number: l.line_number,
        attachments: (lineAttachments || [])
          .filter((a: any) => a.line_id === l.id)
          .map((a: any) => ({
            id: a.id,
            file_name: a.file_name,
            file_url: a.file_url,
            file_type: a.file_type,
            file_size: a.file_size,
          })),
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
    setHeaderBrandId("");
    setReceivingDate(undefined);
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

        {/* Header: Brand + Receiving Date + Notes */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>{isArabic ? "العلامة التجارية" : "Brand"} *</Label>
                <Select value={headerBrandId} onValueChange={setHeaderBrandId} disabled={!isEditable}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={isArabic ? "اختر العلامة التجارية" : "Select Brand"} /></SelectTrigger>
                  <SelectContent>
                    {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.brand_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{isArabic ? "تاريخ الاستلام" : "Receiving Date"}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!isEditable}
                      className={cn("w-full mt-1 justify-start text-left font-normal", !receivingDate && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {receivingDate ? format(receivingDate, "yyyy-MM-dd") : (isArabic ? "اختر التاريخ" : "Pick a date")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={receivingDate}
                      onSelect={setReceivingDate}
                      disabled={!isEditable}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
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
                    <TableHead>{isArabic ? "الكوينز" : "Coins"}</TableHead>
                    <TableHead>{isArabic ? "كوينز إضافية" : "Extra Coins"}</TableHead>
                    <TableHead>{isArabic ? "السعر" : "Rate"}</TableHead>
                    <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                    <TableHead>{isArabic ? "سعر الريال" : "SAR Rate"}</TableHead>
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
                        <Input
                          value={line.seller_name}
                          onChange={e => handleLineChange(index, "seller_name", e.target.value)}
                          disabled={!isEditable}
                          placeholder={isArabic ? "اسم البائع" : "Seller name"}
                          className="min-w-[140px]"
                        />
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
                          value={line.extra_coins}
                          onChange={e => handleLineChange(index, "extra_coins", e.target.value)}
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
                        <div className="flex flex-col gap-1 min-w-[120px]">
                          {line.attachments.map((att, attIdx) => (
                            <div key={attIdx} className="flex items-center gap-1 text-xs bg-muted rounded px-1.5 py-0.5">
                              {getFileIcon(att.file_type)}
                              <span className="truncate max-w-[80px]" title={att.file_name}>{att.file_name}</span>
                              <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={() => downloadFile(att.file_url, att.file_name)}>
                                <Download className="h-2.5 w-2.5" />
                              </Button>
                              {isEditable && (
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-destructive" onClick={() => removeLineAttachment(index, attIdx)}>
                                  <XCircle className="h-2.5 w-2.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {isEditable && (
                            <div>
                              <input
                                type="file"
                                id={`line-attach-${index}`}
                                className="hidden"
                                multiple
                                accept="*/*"
                                onChange={e => handleLineAttachmentUpload(index, e)}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs px-1.5"
                                disabled={uploadingLineIndex === index}
                                onClick={() => document.getElementById(`line-attach-${index}`)?.click()}
                              >
                                <Paperclip className="h-3 w-3 mr-0.5" />
                                {uploadingLineIndex === index ? "..." : (isArabic ? "إرفاق" : "Attach")}
                              </Button>
                            </div>
                          )}
                        </div>
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
                    <TableCell colSpan={isEditable ? 3 : 2}></TableCell>
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
