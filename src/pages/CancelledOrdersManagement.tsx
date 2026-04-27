import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { Loader2, ListX, RefreshCw, Pencil, Check, X, Upload, Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Row {
  id: string;
  order_number: string;
  submitted_by_name: string | null;
  shift_name: string | null;
  shift_session_id: string | null;
  created_at: string;
}

export default function CancelledOrdersManagement() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/cancelled-orders-management");
  const { toast } = useToast();

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(format(firstOfMonth, "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["order_number"], ["12345"], ["67890"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cancelled Orders");
    XLSX.writeFile(wb, "cancelled_orders_template.xlsx");
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      // Extract order numbers from column "order_number" (case-insensitive) or first column
      const numbers: string[] = [];
      for (const row of json) {
        const keys = Object.keys(row);
        const key =
          keys.find((k) => k.toLowerCase().trim() === "order_number") ||
          keys.find((k) => k.toLowerCase().includes("order")) ||
          keys[0];
        const raw = row[key];
        if (raw === null || raw === undefined) continue;
        const val = String(raw).trim();
        if (val) numbers.push(val);
      }

      // Dedupe within file
      const unique = Array.from(new Set(numbers));
      if (unique.length === 0) {
        toast({
          title: isAr ? "ملف فارغ" : "Empty file",
          description: isAr ? "لم يتم العثور على أرقام طلبات." : "No order numbers found.",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: isAr ? "غير مصرح" : "Not authorized", variant: "destructive" });
        return;
      }

      // Filter out already-existing order numbers
      const { data: existing } = await supabase
        .from("cancelled_orders")
        .select("order_number")
        .in("order_number", unique);
      const existingSet = new Set((existing || []).map((r: any) => r.order_number));
      const toInsert = unique.filter((n) => !existingSet.has(n));
      const skipped = unique.length - toInsert.length;

      if (toInsert.length === 0) {
        toast({
          title: isAr ? "لا توجد سجلات جديدة" : "No new records",
          description: isAr
            ? `جميع الأرقام (${unique.length}) موجودة بالفعل.`
            : `All ${unique.length} order numbers already exist.`,
        });
        return;
      }

      const rowsToInsert = toInsert.map((n) => ({
        order_number: n,
        submitted_by: user.id,
      }));

      const { error } = await supabase.from("cancelled_orders").insert(rowsToInsert);
      if (error) {
        toast({
          title: isAr ? "فشل الاستيراد" : "Import failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isAr ? "تم الاستيراد" : "Imported",
        description: isAr
          ? `تم إضافة ${toInsert.length} سجل${skipped ? `, تم تخطي ${skipped} مكرر` : ""}.`
          : `Added ${toInsert.length} record(s)${skipped ? `, skipped ${skipped} duplicate(s)` : ""}.`,
      });
      fetchRows();
    } catch (err: any) {
      console.error(err);
      toast({
        title: isAr ? "خطأ في قراءة الملف" : "File read error",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setEditValue(r.order_number);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };
  const saveEdit = async (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast({ title: isAr ? "رقم الطلب مطلوب" : "Order number required", variant: "destructive" });
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from("cancelled_orders")
      .update({ order_number: trimmed })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      const msg = error.message || "";
      const display =
        msg.includes("duplicate") || (error as any).code === "23505"
          ? isAr
            ? "هذا الرقم موجود مسبقاً."
            : "This order number already exists."
          : msg;
      toast({ title: isAr ? "فشل التحديث" : "Update failed", description: display, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, order_number: trimmed } : r)));
    cancelEdit();
    toast({ title: isAr ? "تم التحديث" : "Updated" });
  };

  const fetchRows = async () => {
    setLoading(true);
    const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
    const toIso = new Date(`${dateTo}T23:59:59.999`).toISOString();
    const { data, error } = await supabase
      .from("cancelled_orders")
      .select("id, order_number, submitted_by_name, shift_name, shift_session_id, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data as Row[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess]);

  const total = useMemo(() => rows.length, [rows]);

  if (accessLoading) return <AccessDenied isLoading />;
  if (hasAccess === false) return <AccessDenied />;

  return (
    <div className="container mx-auto p-6" dir={isAr ? "rtl" : "ltr"}>
      <div className="mb-6 flex items-center gap-2">
        <ListX className="h-7 w-7 text-destructive" />
        <div>
          <h1 className="text-3xl font-bold">
            {isAr ? "إدارة الطلبات الملغاة" : "Cancelled Orders Management"}
          </h1>
          <p className="text-muted-foreground">
            {isAr
              ? "جميع طلبات الإلغاء المقدمة من فريق المبيعات."
              : "All cancellation requests submitted by sales staff."}
          </p>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{isAr ? "تصفية" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>{isAr ? "من تاريخ" : "From date"}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{isAr ? "إلى تاريخ" : "To date"}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button onClick={fetchRows} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {isAr ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{isAr ? "النتائج" : "Results"}</CardTitle>
          <Badge variant="secondary">
            {total} {isAr ? "سجل" : "records"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "رقم الطلب" : "Order Number"}</TableHead>
                  <TableHead>{isAr ? "الموظف" : "Employee"}</TableHead>
                  <TableHead>{isAr ? "الوردية" : "Shift"}</TableHead>
                  <TableHead>{isAr ? "تاريخ الإرسال" : "Submitted At"}</TableHead>
                  <TableHead className="text-right">{isAr ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      {isAr ? "لا توجد طلبات إلغاء في هذه الفترة." : "No cancellation requests in this period."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const isEditing = editingId === r.id;
                    const isSaving = savingId === r.id;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {isEditing ? (
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              disabled={isSaving}
                              className="h-8 max-w-[200px]"
                              autoFocus
                            />
                          ) : (
                            r.order_number
                          )}
                        </TableCell>
                        <TableCell>{r.submitted_by_name || "—"}</TableCell>
                        <TableCell>
                          {r.shift_name ? (
                            <Badge variant="outline">{r.shift_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(r.created_at), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="default" onClick={() => saveEdit(r.id)} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
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
