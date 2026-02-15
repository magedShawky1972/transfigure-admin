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
import { Upload, ArrowLeft, Eye, Coins, CheckCircle, Plus, Image } from "lucide-react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";

const CoinsReceivingPhase = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/coins-receiving-phase");
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<"list" | "detail">("list");
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [receivings, setReceivings] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New receiving form
  const [newReceivingImage, setNewReceivingImage] = useState("");
  const [newReceivingNotes, setNewReceivingNotes] = useState("");

  useEffect(() => {
    fetchOrders();
    const orderId = searchParams.get("order");
    if (orderId) loadOrder(orderId);
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("coins_purchase_orders")
      .select("*")
      .eq("current_phase", "receiving")
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
  };

  const loadOrder = async (id: string) => {
    const [orderRes, recRes] = await Promise.all([
      supabase.from("coins_purchase_orders").select("*").eq("id", id).maybeSingle(),
      supabase.from("coins_purchase_receiving").select("*").eq("purchase_order_id", id).order("created_at", { ascending: false }),
    ]);
    if (orderRes.data) {
      setSelectedOrder(orderRes.data);
      setReceivings(recRes.data || []);
      setView("detail");
    }
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
      const publicId = `coins-receiving/${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const { data, error } = await supabase.functions.invoke("upload-to-cloudinary", {
        body: { imageBase64: base64, folder: "Edara_Images", publicId, resourceType: "image" },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Upload failed");
      setNewReceivingImage(data.url);
      toast.success(isArabic ? "تم رفع الصورة" : "Image uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleAddReceiving = async () => {
    if (!newReceivingImage) {
      toast.error(isArabic ? "يرجى رفع صورة الاستلام" : "Please upload a receiving image");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("coins_purchase_receiving").insert({
        purchase_order_id: selectedOrder.id,
        receiving_image: newReceivingImage,
        received_by: user?.email || "",
        received_by_name: user?.user_metadata?.display_name || user?.email || "",
        notes: newReceivingNotes,
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
        notes: newReceivingNotes,
      });

      toast.success(isArabic ? "تم تسجيل الاستلام" : "Receiving recorded");
      setNewReceivingImage("");
      setNewReceivingNotes("");
      loadOrder(selectedOrder.id);
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveToCoinsEntry = async () => {
    if (receivings.length === 0) {
      toast.error(isArabic ? "يجب تسجيل استلام واحد على الأقل" : "At least one receiving must be recorded");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      // Notify coins_entry phase responsible
      await notifyResponsible(selectedOrder.brand_id, "coins_entry", selectedOrder.id);

      toast.success(isArabic ? "تم الإرسال لمرحلة إدخال العملات" : "Sent to Coins Entry phase");
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
          title: isArabic ? "مهمة إدخال عملات جديدة" : "New Coins Entry Task",
          message: isArabic ? "لديك مهمة جديدة في مرحلة إدخال العملات" : "You have a new task in the coins entry phase",
          type: "coins_workflow",
          link: `/receiving-coins`,
        } as any);
        await supabase.functions.invoke("send-push-notification", {
          body: { userId: assignment.user_id, title: isArabic ? "مهمة جديدة" : "New Task", body: isArabic ? "إدخال عملات" : "Coins entry task" },
        });
      }
    } catch (err) { console.error("Notification error:", err); }
  };

  if (accessLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (hasAccess === false) return <AccessDenied />;

  if (view === "detail" && selectedOrder) {
    return (
      <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-5 w-5" /></Button>
            <Coins className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">{isArabic ? "استلام العملات من المورد" : "Receiving Coins from Supplier"}</h1>
          </div>
          <Button onClick={handleMoveToCoinsEntry} disabled={saving || receivings.length === 0}>
            <CheckCircle className="h-4 w-4 mr-2" />
            {isArabic ? "إرسال لإدخال العملات" : "Send to Coins Entry"}
          </Button>
        </div>

        {/* Order Info */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "معلومات الطلب" : "Order Info"}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div><span className="font-medium">{isArabic ? "رقم الطلب:" : "Order #:"}</span> {selectedOrder.order_number}</div>
              <div><span className="font-medium">{isArabic ? "المبلغ (SAR):" : "Amount (SAR):"}</span> {parseFloat(selectedOrder.base_amount_sar || 0).toFixed(2)}</div>
              <div><span className="font-medium">{isArabic ? "التاريخ:" : "Date:"}</span> {format(new Date(selectedOrder.created_at), "yyyy-MM-dd")}</div>
            </div>
            {selectedOrder.bank_transfer_image && (
              <div className="mt-4">
                <img src={selectedOrder.bank_transfer_image} alt="Transfer" className="max-w-sm max-h-48 rounded-lg border object-contain" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous Receivings */}
        {receivings.length > 0 && (
          <Card>
            <CardHeader><CardTitle>{isArabic ? "سجلات الاستلام السابقة" : "Previous Receivings"}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {receivings.map(r => (
                  <Card key={r.id} className="border">
                    <CardContent className="p-4 space-y-2">
                      {r.receiving_image && <img src={r.receiving_image} alt="Receiving" className="max-h-32 rounded border object-contain" />}
                      <div className="text-sm"><span className="font-medium">{isArabic ? "المستلم:" : "By:"}</span> {r.received_by_name || r.received_by}</div>
                      <div className="text-sm"><span className="font-medium">{isArabic ? "التاريخ:" : "Date:"}</span> {format(new Date(r.received_at), "yyyy-MM-dd HH:mm")}</div>
                      {r.notes && <div className="text-sm text-muted-foreground">{r.notes}</div>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add New Receiving */}
        <Card>
          <CardHeader><CardTitle>{isArabic ? "إضافة استلام جديد" : "Add New Receiving"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{isArabic ? "صورة الاستلام من تطبيق المورد" : "Receiving Image from Supplier App"}</Label>
              {newReceivingImage ? (
                <div className="relative inline-block">
                  <img src={newReceivingImage} alt="Receiving" className="max-w-sm max-h-48 rounded-lg border object-contain" />
                  <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setNewReceivingImage("")}>✕</Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-muted-foreground text-sm">{uploading ? (isArabic ? "جاري الرفع..." : "Uploading...") : (isArabic ? "رفع صورة الاستلام" : "Upload receiving image")}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "ملاحظات" : "Notes"}</Label>
              <Textarea value={newReceivingNotes} onChange={e => setNewReceivingNotes(e.target.value)} />
            </div>
            <Button onClick={handleAddReceiving} disabled={saving || !newReceivingImage}>
              <Plus className="h-4 w-4 mr-2" />
              {saving ? (isArabic ? "جاري الحفظ..." : "Saving...") : (isArabic ? "تسجيل الاستلام" : "Record Receiving")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      <div className="flex items-center gap-3">
        <Coins className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{isArabic ? "استلام العملات" : "Receiving Phase"}</h1>
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
                  <TableHead>{isArabic ? "أنشئ بواسطة" : "Created By"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {isArabic ? "لا توجد طلبات للاستلام" : "No orders pending receiving"}
                    </TableCell>
                  </TableRow>
                ) : orders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => loadOrder(o.id)}>
                    <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                    <TableCell>{format(new Date(o.created_at), "yyyy-MM-dd")}</TableCell>
                    <TableCell>{parseFloat(o.base_amount_sar || 0).toFixed(2)}</TableCell>
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
