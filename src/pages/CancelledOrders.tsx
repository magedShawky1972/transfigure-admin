import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShieldX, XCircle, Plus, Pencil, Check, X, Trash2, Send,
} from "lucide-react";

interface PendingItem {
  id: string;
  order_number: string;
}

export default function CancelledOrders() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { toast } = useToast();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/cancelled-orders");

  const [shiftLoading, setShiftLoading] = useState(true);
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const [shiftLabel, setShiftLabel] = useState<string>("");

  const [orderNumber, setOrderNumber] = useState("");
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderNumber.trim();
    if (!trimmed) {
      toast({
        title: isAr ? "رقم الطلب مطلوب" : "Order number required",
        variant: "destructive",
      });
      return;
    }
    if (pending.some((p) => p.order_number === trimmed)) {
      toast({
        title: isAr ? "مكرر" : "Duplicate",
        description: isAr ? "هذا الرقم موجود بالفعل في القائمة." : "This order number is already in the list.",
        variant: "destructive",
      });
      return;
    }
    setPending((prev) => [
      { id: crypto.randomUUID(), order_number: trimmed },
      ...prev,
    ]);
    setOrderNumber("");
  };

  const startEdit = (item: PendingItem) => {
    setEditingId(item.id);
    setEditValue(item.order_number);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };
  const saveEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast({
        title: isAr ? "رقم الطلب مطلوب" : "Order number required",
        variant: "destructive",
      });
      return;
    }
    if (pending.some((p) => p.id !== id && p.order_number === trimmed)) {
      toast({
        title: isAr ? "مكرر" : "Duplicate",
        description: isAr ? "هذا الرقم موجود بالفعل في القائمة." : "This order number is already in the list.",
        variant: "destructive",
      });
      return;
    }
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, order_number: trimmed } : p)));
    cancelEdit();
  };

  const removeItem = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) cancelEdit();
  };

  const handleSubmit = async () => {
    if (pending.length === 0) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      toast({ title: isAr ? "غير مصرح" : "Not authorized", variant: "destructive" });
      return;
    }

    const rows = pending.map((p) => ({
      order_number: p.order_number,
      submitted_by: user.id,
    }));

    const { data, error } = await supabase
      .from("cancelled_orders")
      .insert(rows)
      .select("order_number");

    setSubmitting(false);

    if (error) {
      const msg = error.message || "";
      let display = msg;
      if (msg.includes("duplicate") || (error as any).code === "23505") {
        display = isAr
          ? "بعض أرقام الطلبات تم إرسالها مسبقاً. يرجى مراجعة القائمة."
          : "Some order numbers were already submitted before. Please review the list.";
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
        ? `تم إرسال ${data?.length ?? rows.length} طلب إلغاء إلى الإدارة.`
        : `${data?.length ?? rows.length} cancellation request(s) sent to management.`,
    });
    setPending([]);
  };

  if (accessLoading) return <AccessDenied isLoading />;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className="container mx-auto p-6 max-w-3xl" dir={isAr ? "rtl" : "ltr"}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <XCircle className="h-7 w-7 text-destructive" />
          {isAr ? "الطلبات الملغاة تم تنفيذها يدوي" : "Cancelled Orders"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAr
            ? "أضف أرقام الطلبات للقائمة، ثم اعتمد وأرسلها إلى الإدارة."
            : "Add order numbers to the list, then approve and submit them to management."}
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
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{isAr ? "إضافة رقم طلب" : "Add Order Number"}</CardTitle>
              {shiftLabel && (
                <p className="text-sm text-muted-foreground">
                  {isAr ? "الوردية النشطة: " : "Active shift: "}
                  <span className="font-medium text-foreground">{shiftLabel}</span>
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">
                    {isAr ? "رقم الطلب" : "Order Number"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="orderNumber"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder={isAr ? "أدخل رقم الطلب" : "Enter order number"}
                      disabled={submitting}
                      autoComplete="off"
                    />
                    <Button type="submit" disabled={submitting} className="shrink-0">
                      <Plus className="h-4 w-4 mr-1" />
                      {isAr ? "إضافة" : "Add"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                {isAr ? "قائمة الإلغاء (لم تُرسل بعد)" : "Cancellation List (not submitted yet)"}
              </CardTitle>
              <Badge variant="secondary">
                {pending.length} {isAr ? "طلب" : "items"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isAr ? "رقم الطلب" : "Order Number"}</TableHead>
                      <TableHead className="text-right w-[180px]">
                        {isAr ? "إجراءات" : "Actions"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                          {isAr ? "لا توجد طلبات في القائمة." : "No items in the list."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pending.map((item) => {
                        const isEditing = editingId === item.id;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {isEditing ? (
                                <Input
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="h-8 max-w-[240px]"
                                  autoFocus
                                  disabled={submitting}
                                />
                              ) : (
                                item.order_number
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                {isEditing ? (
                                  <>
                                    <Button size="sm" variant="default" onClick={() => saveEdit(item.id)} disabled={submitting}>
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={submitting}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => startEdit(item)} disabled={submitting}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeItem(item.id)}
                                      disabled={submitting}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || pending.length === 0 || editingId !== null}
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isAr ? "اعتماد وإرسال" : "Approve & Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
