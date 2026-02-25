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
import { Upload, ArrowLeft, Eye, Coins, CheckCircle, Plus, Image, PackagePlus } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";
import CoinsPhaseFilterBar, { type PhaseViewFilter } from "@/components/CoinsPhaseFilterBar";

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

  useEffect(() => {
    fetchOrders();
    const orderId = searchParams.get("order");
    if (orderId) loadOrder(orderId);
  }, []);

  const fetchOrders = async () => {
    let query = supabase
      .from("coins_purchase_orders")
      .select("*, currencies(currency_code, currency_name)")
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
      supabase.from("coins_purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("coins_purchase_order_lines").select("*, brands(brand_name), suppliers(supplier_name)").eq("purchase_order_id", id).order("line_number"),
      supabase.from("coins_purchase_receiving").select("*, brands(brand_name)").eq("purchase_order_id", id).order("created_at", { ascending: false }),
    ]);
    if (orderRes.data) {
      setSelectedOrder(orderRes.data);
      setOrderLines(linesRes.data || []);
      setReceivings(recRes.data || []);
      setBrandReceivingImages({});
      setBrandReceivingNotes({});
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
        .select("id, usd_value_for_coins")
        .in("id", brandIds);
      const brandUsdMap: Record<string, number> = {};
      if (brandsData) {
        for (const b of brandsData) {
          if (b.usd_value_for_coins) brandUsdMap[b.id] = b.usd_value_for_coins;
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

        // Calculate expected coins using the line's amount_in_currency (USD) directly
        const usdValuePerCoin = brandUsdMap[brandId] || 0;
        const expectedCoins = usdValuePerCoin > 0 ? Math.floor(lineAmountInCurrency / usdValuePerCoin) : 0;

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
            unit_price: usdValuePerCoin,
          }];
          await supabase.from("receiving_coins_line").insert(lineInserts as any);
        }
      }

      await supabase.from("coins_purchase_orders").update({
        current_phase: "coins_entry",
        status: "in_progress",
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
      const { data: assignments } = await supabase
        .from("coins_workflow_assignments")
        .select("user_id, user_name")
        .eq("brand_id", bId)
        .eq("phase", phase);
      if (!assignments || assignments.length === 0) return;

      for (const assignment of assignments) {
        await supabase.from("notifications").insert({
          user_id: assignment.user_id,
          title: isArabic ? "مهمة إدخال كوينز جديدة" : "New Coins Entry Task",
          message: isArabic ? "لديك مهمة جديدة في مرحلة إدخال الكوينز" : "You have a new task in the coins entry phase",
          type: "coins_workflow",
          link: `/receiving-coins`,
        } as any);

        supabase.functions.invoke("send-coins-workflow-notification", {
          body: {
            type: "phase_transition",
            userId: assignment.user_id,
            userName: assignment.user_name || "",
            brandNames: orderLines.map((l: any) => l.brands?.brand_name || "").filter(Boolean),
            phase,
            phaseLabel: "إدخال الكوينز",
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
              <div><span className="font-medium">{isArabic ? "المبلغ (SAR):" : "Amount (SAR):"}</span> {parseFloat(selectedOrder.base_amount_sar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div><span className="font-medium">{isArabic ? "التاريخ:" : "Date:"}</span> {format(new Date(selectedOrder.created_at), "yyyy-MM-dd")}</div>
            </div>
            {selectedOrder.bank_transfer_image && (
              <div className="mt-4">
                <img src={selectedOrder.bank_transfer_image} alt="Transfer" className="max-w-sm max-h-48 rounded-lg border object-contain" />
              </div>
            )}
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
                      <TableHead>{isArabic ? "المورد" : "Supplier"}</TableHead>
                      <TableHead>{isArabic ? "المبلغ (SAR)" : "Amount (SAR)"}</TableHead>
                      <TableHead>{isArabic ? "صور الاستلام" : "Receiving Images"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderLines.map((line, idx) => {
                      const brandReceivings = receivingsByBrand[line.brand_id] || [];
                      return (
                        <TableRow key={line.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell className="font-medium">{line.brands?.brand_name || "-"}</TableCell>
                          <TableCell>{line.suppliers?.supplier_name || "-"}</TableCell>
                          <TableCell>{parseFloat(line.base_amount_sar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {isArabic ? "لا توجد طلبات للاستلام" : "No orders pending receiving"}
                    </TableCell>
                  </TableRow>
                ) : orders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadOrder(o.id)}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
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
