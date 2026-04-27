import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldX, XCircle } from "lucide-react";

export default function CancelledOrders() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/cancelled-orders");

  const [shiftLoading, setShiftLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [shiftLabel, setShiftLabel] = useState<string>("");
  const [orderNumber, setOrderNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const checkActiveShift = async () => {
    setShiftLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setHasActiveShift(false);
      setShiftLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("shift_sessions")
      .select(`id, opened_at, shift_assignments ( shifts ( shift_name ) )`)
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setHasActiveShift(false);
    } else if (data) {
      setHasActiveShift(true);
      const sa: any = data.shift_assignments;
      setShiftLabel(sa?.shifts?.shift_name || "");
    } else {
      setHasActiveShift(false);
    }
    setShiftLoading(false);
  };

  useEffect(() => {
    checkActiveShift();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderNumber.trim();
    if (!trimmed) {
      toast({
        title: isAr ? "رقم الطلب مطلوب" : "Order number required",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("cancelled_orders")
      .insert({
        order_number: trimmed,
        submitted_by: (await supabase.auth.getUser()).data.user!.id,
      });
    setSubmitting(false);

    if (error) {
      const msg = error.message || "";
      let display = msg;
      if (msg.includes("duplicate") || (error as any).code === "23505") {
        display = isAr
          ? "هذا الطلب تم إرسال طلب إلغاء له مسبقاً."
          : "This order number has already been submitted for cancellation.";
      } else if (msg.includes("active shift")) {
        display = isAr
          ? "لا توجد وردية نشطة. يجب فتح وردية لتقديم طلب الإلغاء."
          : "No active shift. You must have an open shift to submit a cancellation.";
        setHasActiveShift(false);
      }
      toast({
        title: isAr ? "فشل الإرسال" : "Submission failed",
        description: display,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: isAr ? "تم الإرسال" : "Submitted",
      description: isAr
        ? `تم تسجيل طلب إلغاء الطلب ${trimmed}.`
        : `Cancellation request for order ${trimmed} recorded.`,
    });
    setOrderNumber("");
  };

  if (accessLoading) return <AccessDenied isLoading />;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className="container mx-auto p-6 max-w-2xl" dir={isAr ? "rtl" : "ltr"}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <XCircle className="h-7 w-7 text-destructive" />
          {isAr ? "الطلبات الملغاة" : "Cancelled Orders"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAr
            ? "إرسال طلب إلغاء للطلب — متاح فقط أثناء وجود وردية نشطة."
            : "Submit an order cancellation request — only available while you have an active shift."}
        </p>
      </div>

      {shiftLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : !hasActiveShift ? (
        <Alert variant="destructive">
          <ShieldX className="h-5 w-5" />
          <AlertTitle>{isAr ? "الوصول مرفوض" : "Access Denied"}</AlertTitle>
          <AlertDescription>
            {isAr
              ? "ليس لديك وردية نشطة الآن. يرجى فتح جلسة وردية أولاً قبل تقديم طلب إلغاء."
              : "You don't have an active shift right now. Please open a shift session before submitting a cancellation request."}
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{isAr ? "طلب إلغاء جديد" : "New Cancellation Request"}</CardTitle>
            {shiftLabel && (
              <p className="text-sm text-muted-foreground">
                {isAr ? "الوردية النشطة: " : "Active shift: "}
                <span className="font-medium text-foreground">{shiftLabel}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumber">
                  {isAr ? "رقم الطلب" : "Order Number"}
                </Label>
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder={isAr ? "أدخل رقم الطلب" : "Enter order number"}
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isAr ? "إرسال" : "Submit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
