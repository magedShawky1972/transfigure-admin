import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { Upload, ArrowLeft, Eye, Coins, CheckCircle, Plus, Image, PackagePlus, Download, FileText } from "lucide-react";
import { downloadFile } from "@/lib/fileDownload";
import { format } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";
import CoinsPhaseFilterBar, { type PhaseViewFilter } from "@/components/CoinsPhaseFilterBar";
import CoinsOrderAttachments from "@/components/CoinsOrderAttachments";

const CoinsReceivingPhase = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-receiving-phase");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "detail">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderLines, setOrderLines] = useState<any[]>([]);
  const [receivings, setReceivings] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Filters
  const [viewFilter, setViewFilter] = useState<PhaseViewFilter>("pending");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  // New receiving form - per brand (keyed by brand_id)
  const [brandReceivingImages, setBrandReceivingImages] = useState<Record<string, string>>({});
  const [brandReceivingNotes, setBrandReceivingNotes] = useState<Record<string, string>>({});
  const [uploadingBrand, setUploadingBrand] = useState<string | null>(null);
  const [savingBrand, setSavingBrand] = useState<string | null>(null);
  const [bankTransferImage, setBankTransferImage] = useState("");
  const [sendingAttachments, setSendingAttachments] = useState<{ id: string; file_name: string; file_url: string; file_type: string | null; uploaded_by_name: string | null }[]>([]);

  useEffect(() => {
    fetchOrders();
    const orderId = searchParams.get("order");
    if (orderId) loadOrder(orderId);
  }, []);

  const fetchOrders = async () => {
    let query = supabase
      .from("coins_purchase_orders")
      .select("*, currencies(currency_code, currency_name), suppliers(supplier_name)")
      .order("created_at", { ascending: false });

    if (viewFilter === "pending") {
      query = query.eq("current_phase", "receiving");
    } else if (viewFilter === "sent") {
      query = query.neq("current_phase", "receiving").in("current_phase", ["coins_entry", "completed"]);
    }

    if (fromDate) query = query.gte("created_at", format(fromDate, "yyyy-MM-dd"));
    if (toDate) query = query.lte("created_at", format(toDate, "yyyy-MM-dd") + "T23:59:59");

    const { data } = await query;
    if (data) setOrders(data);
  };

  useEffect(() => { fetchOrders(); }, [viewFilter, fromDate, toDate]);

  const loadOrder = async (id: string) => {
    const [orderRes, linesRes, recRes] = await Promise.all([
      supabase.from("coins_purchase_orders").select("*, currencies(currency_code, currency_name)").eq("id", id).maybeSingle(),
      supabase.from("coins_purchase_order_lines").select("*, brands(brand_name, one_usd_to_coins), suppliers(supplier_name)").eq("purchase_order_id", id).order("line_number"),
      supabase.from("coins_purchase_receiving").select("*, brands(brand_name)").eq("purchase_order_id", id).order("created_at", { ascending: false }),
    ]);
    if (orderRes.data) {
      setSelectedOrder(orderRes.data);
      setOrderLines(linesRes.data || []);
      setReceivings(recRes.data || []);
      setBrandReceivingImages({});
      setBrandReceivingNotes({});
      setBankTransferImage(orderRes.data.bank_transfer_image || "");
      // Fetch sending phase attachments
      const { data: sendingAtts } = await supabase
        .from("coins_purchase_attachments")
        .select("id, file_name, file_url, file_type, uploaded_by_name")
        .eq("purchase_order_id", id)
        .eq("phase", "sending");
      setSendingAttachments(sendingAtts || []);
      setView("detail");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, brandId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBrand(brandId);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const publicId = `coins-receiving/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType: "image" },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");
      // Auto-save receiving record immediately after upload
      await saveReceiving(brandId, data.url);
      toast.success(isArabic ? "تم رفع وحفظ صورة الاستلام" : "Receiving image uploaded and saved");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingBrand(null);
      e.target.value = "";
    }
  };

  const saveReceiving = async (brandId: string, imageUrl: string) => {
    setSavingBrand(brandId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("coins_purchase_receiving").insert({
        purchase_order_id: selectedOrder.id,
        receiving_image: imageUrl,
        received_by: user?.email || "",
        received_by_name: user?.user_metadata?.display_name || user?.email || "",
        notes: brandReceivingNotes[brandId] || "",
        brand_id: brandId,
        is_confirmed: true,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user?.email || "",
        confirmed_by_name: user?.user_metadata?.display_name || user?.email || "",
      });

      await supabase.from("coins_purchase_phase_history").insert({
        purchase_order_id: selectedOrder.id,
        from_phase: "receiving",
        to_phase: "receiving",
        action: "add_receiving",
        action_by: user?.email || "",
        action_by_name: user?.user_metadata?.display_name || user?.email || "",
        notes: brandReceivingNotes[brandId] || "",
      });

      toast.success(isArabic ? "تم تسجيل الاستلام" : "Receiving recorded");
      setBrandReceivingNotes(prev => { const n = { ...prev }; delete n[brandId]; return n; });
      loadOrder(selectedOrder.id);
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSavingBrand(null);
    }
  };

  // generateReceiptNumber is no longer needed - we use the purchase order number

  const handleMoveToCoinsEntry = async () => {
    if (receivings.length === 0) {
      toast.error(isArabic ? "يجب تسجيل استلام واحد على الأقل" : "At least one receiving must be recorded");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch brand USD values for coins calculation
      const brandIds = orderLines.map((l: any) => l.brand_id);
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id, one_usd_to_coins")
        .in("id", brandIds);
      const brandUsdMap: Record<string, number> = {};
      if (brandsData) {
        for (const b of brandsData) {
          if (b.one_usd_to_coins) brandUsdMap[b.id] = b.one_usd_to_coins;
        }
      }

      // Get USD exchange rate for converting SAR to USD
      const { data: usdCurrency } = await supabase
        .from("currencies")
        .select("id")
        .eq("currency_code", "USD")
        .maybeSingle();
      let usdRate = 3.75; // default SAR to USD
      if (usdCurrency) {
        const { data: rateData } = await supabase
          .from("currency_rates")
          .select("rate_to_base, conversion_operator")
          .eq("currency_id", usdCurrency.id)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rateData?.rate_to_base) usdRate = rateData.rate_to_base;
      }

      // Auto-create receiving entries for each brand line
      for (const line of orderLines) {
        const brandId = line.brand_id;
        const brandName = line.brands?.brand_name || "";
        const lineAmountInCurrency = parseFloat(String(line.amount_in_currency || 0));
        const sarAmount = parseFloat(String(line.base_amount_sar || 0));

        // Calculate expected coins using 1 USD = X coins rate
        const oneUsdToCoins = brandUsdMap[brandId] || 0;
        const expectedCoins = oneUsdToCoins > 0 ? Math.floor(lineAmountInCurrency * oneUsdToCoins) : 0;

        // Create receiving_coins_header - use purchase order number
        // Control amount = line's amount in original currency (e.g. USD)
        const headerData = {
          receipt_number: selectedOrder.order_number,
          purchase_order_id: selectedOrder.id,
          supplier_id: selectedOrder.supplier_id,
          receipt_date: format(new Date(), "yyyy-MM-dd"),
          brand_id: brandId,
          control_amount: lineAmountInCurrency,
          bank_id: selectedOrder.bank_id,
          receiver_name: user?.user_metadata?.display_name || user?.email || "",
          total_amount: 0,
          created_by: user?.email || "",
          currency_id: selectedOrder.currency_id || null,
          exchange_rate: selectedOrder.exchange_rate || null,
        };

        const { data: headerResult, error: headerError } = await supabase
          .from("receiving_coins_header")
          .insert(headerData as any)
          .select("id")
          .single();

        if (headerError) throw headerError;

        // Create receiving_coins_line entry for the brand with supplier and expected coins
        if (headerResult) {
          const lineInserts = [{
            header_id: headerResult.id,
            brand_id: brandId,
            brand_name: brandName,
            supplier_id: line.supplier_id || null,
            product_id: null,
            product_name: brandName,
            coins: expectedCoins,
            unit_price: oneUsdToCoins,
          }];
          await supabase.from("receiving_coins_line").insert(lineInserts as any);
        }
      }

      await supabase.from("coins_purchase_orders").update({
        current_phase: "coins_entry",
        status: "in_progress",
        phase_updated_at: new Date().toISOString(),
      }).eq("id", selectedOrder.id);

      await supabase.from("coins_purchase_phase_history").insert({
        purchase_order_id: selectedOrder.id,
        from_phase: "receiving",
        to_phase: "coins_entry",
        action: "move_to_coins_entry",
        action_by: user?.email || "",
        action_by_name: user?.user_metadata?.display_name || user?.email || "",
      });

      await notifyResponsible(selectedOrder.brand_id, "coins_entry", selectedOrder.id);

      toast.success(isArabic ? "تم الإرسال لمرحلة إدخال الكوينز وإنشاء إيصالات الاستلام" : "Sent to Coins Entry phase and receiving entries created");
      setView("list");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const notifyResponsible = async (bId: string, phase: string, orderId: string) => {
    try {
      const [assignmentsRes, supervisorsRes] = await Promise.all([
        supabase.from("coins_workflow_assignments").select("user_id, user_name").eq("brand_id", bId).eq("phase", phase),
        supabase.from("coins_workflow_supervisors").select("user_id, user_name").eq("is_active", true),
      ]);
      const assignments = assignmentsRes.data || [];
      const supervisors = supervisorsRes.data || [];

      const notifiedUserIds = new Set<string>();
      const allRecipients = [...assignments];
      for (const sup of supervisors) {
        if (!allRecipients.some(a => a.user_id === sup.user_id)) {
          allRecipients.push(sup);
        }
      }
      if (allRecipients.length === 0) return;

      const phaseLabelsAr: Record<string, string> = { sending: "التوجيه", receiving: "الاستلام", coins_entry: "إدخال الكوينز" };
      const link = phase === "coins_entry" ? `/receiving-coins` : phase === "receiving" ? `/coins-receiving-phase?order=${orderId}` : `/coins-sending?order=${orderId}`;

      for (const recipient of allRecipients) {
        if (notifiedUserIds.has(recipient.user_id)) continue;
        notifiedUserIds.add(recipient.user_id);

        await supabase.from("notifications").insert({
          user_id: recipient.user_id,
          title: isArabic ? "مهمة كوينز جديدة" : "New Coins Task",
          message: isArabic ? `لديك مهمة جديدة في مرحلة ${phaseLabelsAr[phase] || phase}` : `You have a new task in the ${phase} phase`,
          type: "coins_workflow",
          link,
        } as any);

        supabase.functions.invoke("send-coins-workflow-notification", {
          body: {
            type: "phase_transition",
            userId: recipient.user_id,
            userName: recipient.user_name || "",
            brandNames: orderLines.map((l: any) => l.brands?.brand_name || "").filter(Boolean),
            phase,
            phaseLabel: phaseLabelsAr[phase] || phase,
            orderNumber: selectedOrder?.order_number || "",
            orderId,
          },
        }).catch(err => console.error("Notification error:", err));
      }
    } catch (err) { console.error("Notification error:", err); }
  };

  // Group receivings by brand
  const getReceivingsByBrand = () => {
    const grouped: Record<string, any[]> = {};
    for (const r of receivings) {
      const key = r.brand_id || "unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }
    return grouped;
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  if (view === "detail" && selectedOrder) {
    const receivingsByBrand = getReceivingsByBrand();

    return (
      <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-5 w-5" /></Button>
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "استلام الكوينز من المورد" : "Receiving Coins from Supplier"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/receiving-coins?fromOrder=${selectedOrder.id}`)}>
              <PackagePlus className="h-4 w-4 mr-2" />
              {isArabic ? "إنشاء إيصال استلام" : "Create Receiving Entry"}
            </Button>
            <Button onClick={handleMoveToCoinsEntry} disabled={saving || receivings.length === 0}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {isArabic ? "إرسال لإدخال الكوينز" : "Send to Coins Entry"}
            </Button>
          </div>
        </div>

        {/* Order Info */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "معلومات الطلب" : "Order Info"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="font-medium">{isArabic ? "رقم الطلب:" : "Order #:"}</span> {selectedOrder.order_number}</div>
              <div><span className="font-medium">{isArabic ? "التاريخ:" : "Date:"}</span> {format(new Date(selectedOrder.created_at), "yyyy-MM-dd")}</div>
              <div><span className="font-medium">{isArabic ? "أنشئ بواسطة:" : "Created By:"}</span> {selectedOrder.created_by_name || selectedOrder.created_by}</div>
            </div>
            {/* Prominent Currency & Transaction Amount */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-muted/40 rounded-lg border text-center">
                <div className="text-xs text-muted-foreground mb-1">{isArabic ? "العملة" : "Currency"}</div>
                <div className="text-2xl font-bold text-primary">{selectedOrder.currencies?.currency_code || orders.find(o => o.id === selectedOrder.id)?.currencies?.currency_code || "-"}</div>
              </div>
              <div className="p-4 bg-muted/40 rounded-lg border text-center">
                <div className="text-xs text-muted-foreground mb-1">{isArabic ? "المبلغ بالعملة" : "Transaction Amount"}</div>
                <div className="text-2xl font-bold text-primary">
                  {selectedOrder.amount_in_currency ? parseFloat(selectedOrder.amount_in_currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                </div>
              </div>
              <div className="p-4 bg-muted/40 rounded-lg border text-center">
                <div className="text-xs text-muted-foreground mb-1">{isArabic ? "المبلغ بالريال" : "Amount (SAR)"}</div>
                <div className="text-2xl font-bold text-primary">
                  {parseFloat(selectedOrder.base_amount_sar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Lines Breakdown */}
        {orderLines.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{isArabic ? "تفاصيل العلامات التجارية" : "Brands Breakdown"}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{isArabic ? "العلامة التجارية" : "Brand"}</TableHead>
                      <TableHead>{isArabic ? "المبلغ بالعملة" : "Amount (Currency)"}</TableHead>
                      <TableHead>{isArabic ? "1 USD = كوينز" : "1 USD = Coins"}</TableHead>
                      <TableHead>{isArabic ? "الكوينز المتوقعة" : "Expected Coins"}</TableHead>
                      <TableHead>{isArabic ? "صور الاستلام" : "Receiving Images"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderLines.map((line, idx) => {
                      const brandReceivings = receivingsByBrand[line.brand_id] || [];
                      const amountInCurrency = parseFloat(line.amount_in_currency || 0);
                      const oneUsdToCoins = line.brands?.one_usd_to_coins || 0;
                      const expectedCoins = oneUsdToCoins > 0 && amountInCurrency > 0 ? Math.floor(amountInCurrency * oneUsdToCoins) : 0;
                      return (
                        <TableRow key={line.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{line.brands?.brand_name || "-"}</TableCell>
                          <TableCell className="font-bold text-lg text-primary">
                            {amountInCurrency > 0 ? amountInCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}
                          </TableCell>
                          <TableCell className="font-medium text-primary">
                            {oneUsdToCoins > 0 ? oneUsdToCoins.toFixed(8) : "-"}
                          </TableCell>
                          <TableCell className="font-bold text-lg">
                            {expectedCoins > 0 ? expectedCoins.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            {brandReceivings.length > 0 ? (
                              <div className="flex items-center gap-1">
                                <Image className="h-4 w-4 text-green-600" />
                                <span className="text-green-600 font-medium">{brandReceivings.length}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">{isArabic ? "لا يوجد" : "None"}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank Transfer Document (from Sending phase) */}
        {bankTransferImage && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{isArabic ? "مستند التحويل البنكي" : "Bank Transfer Document"}</CardTitle></CardHeader>
            <CardContent>
              <div className="max-w-md">
                {bankTransferImage.match(/\.pdf($|\?)/i) || bankTransferImage.includes("/raw/upload/") ? (
                  <iframe
                    src={`https://docs.google.com/gview?url=${encodeURIComponent(bankTransferImage)}&embedded=true`}
                    title="Bank Transfer"
                    className="w-full h-[300px] rounded-lg border"
                  />
                ) : (
                  <a href={bankTransferImage} target="_blank" rel="noopener noreferrer">
                    <img src={bankTransferImage} alt="Bank Transfer" className="max-w-full max-h-64 rounded-lg border object-contain" />
                  </a>
                )}
                <Button variant="outline" size="sm" className="mt-2" onClick={() => downloadFile(bankTransferImage, "bank-transfer")}>
                  <Download className="h-4 w-4 mr-1" />
                  {isArabic ? "تحميل الملف" : "Download File"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sending Phase Attachments */}
        {sendingAttachments.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{isArabic ? "مرفقات التوجيه" : "Sending Attachments"}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sendingAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{att.file_name}</a>
                    {att.uploaded_by_name && <span className="text-xs text-muted-foreground">• {att.uploaded_by_name}</span>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadFile(att.file_url, att.file_name || "attachment")}>
                    <Download className="h-4 w-4 mr-1" />
                    {isArabic ? "تحميل" : "Download"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Receiving Images - Per Brand */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "صور الاستلام" : "Receiving Images"}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {orderLines.map((line) => {
              const brandId = line.brand_id;
              const brandName = line.brands?.brand_name || brandId;
              const isUploading = uploadingBrand === brandId;
              const isSaving = savingBrand === brandId;
              // Check if there's already a saved receiving for this brand
              const existingReceiving = (receivingsByBrand[brandId] || [])[0];
              const pendingImage = brandReceivingImages[brandId] || "";
              // Show saved image or pending upload
              const displayImage = existingReceiving?.receiving_image || pendingImage;
              const isSaved = !!existingReceiving;

              return (
                <div key={brandId} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      {brandName}
                    </h4>
                    {isSaved && (
                      <span className="text-xs flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        {isArabic ? "تم الاستلام" : "Received"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{isArabic ? "صورة الاستلام من تطبيق المورد" : "Receiving Image from Supplier App"}</Label>
                    {displayImage ? (
                      <div className="relative inline-block">
                        <img src={displayImage} alt="Receiving" className="max-w-sm max-h-48 rounded-lg border object-contain" />
                        <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={async () => {
                          if (isSaved && existingReceiving) {
                            // Delete from DB
                            await supabase.from("coins_purchase_receiving").delete().eq("id", existingReceiving.id);
                            toast.success(isArabic ? "تم حذف صورة الاستلام" : "Receiving image removed");
                            loadOrder(selectedOrder.id);
                          }
                          setBrandReceivingImages(prev => { const n = { ...prev }; delete n[brandId]; return n; });
                        }}>✕</Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-muted-foreground text-sm">{isUploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع صورة الاستلام" : "Upload receiving image")}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, brandId)} disabled={isUploading} />
                      </label>
                    )}
                  </div>

                  {!isSaved && pendingImage && (
                    <div className="space-y-2">
                      <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
                      <Textarea value={brandReceivingNotes[brandId] || ""} onChange={e => setBrandReceivingNotes(prev => ({ ...prev, [brandId]: e.target.value }))} />
                    </div>
                  )}

                  {isSaved && existingReceiving?.notes && (
                    <div className="text-sm text-muted-foreground">{existingReceiving.notes}</div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Attachments */}
        <CoinsOrderAttachments
          purchaseOrderId={selectedOrder.id}
          currentPhase="receiving"
        />
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Coins className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">{isArabic ? "استلام الكوينز" : "Coins Receiving"}</h1>
        </div>
        <CoinsPhaseFilterBar
          viewFilter={viewFilter}
          onViewFilterChange={setViewFilter}
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          pendingLabel={isArabic ? "المعلقة (الاستلام)" : "Pending (Receiving)"}
          sentLabel={isArabic ? "المرسلة فقط" : "Sent Only"}
        />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isArabic ? "رقم الطلب" : "Order #"}</TableHead>
                  <TableHead>{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isArabic ? "المورد الرئيسي" : "Main Supplier"}</TableHead>
                  <TableHead>{isArabic ? "العملة" : "Currency"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ بالعملة" : "Amount (Currency)"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                  <TableHead>{isArabic ? "أنشئ بواسطة" : "Created By"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {isArabic ? "لا توجد طلبات للاستلام" : "No orders pending receiving"}
                    </TableCell>
                  </TableRow>
                ) : orders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadOrder(o.id)}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                    <TableCell>{(o as any).suppliers?.supplier_name || "-"}</TableCell>
                    <TableCell>{o.currencies?.currency_code || "-"}</TableCell>
                    <TableCell>{o.amount_in_currency ? parseFloat(o.amount_in_currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</TableCell>
                    <TableCell>{parseFloat(o.base_amount_sar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
};

export default CoinsReceivingPhase;
