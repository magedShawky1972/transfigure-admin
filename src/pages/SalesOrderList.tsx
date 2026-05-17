import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Download, Upload, FileSpreadsheet } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { useRef } from "react";

const SalesOrderList = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const COLUMNS = [
    "order_number","order_date","customer_name","customer_phone","payment_method",
    "sales_reference","sales_person","company","notes","status",
    "brand_code","brand_name","product_name","coins_number","qty","unit_price","cost_price"
  ];

  const downloadXlsx = (rows: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SalesOrders");
    XLSX.writeFile(wb, filename);
  };

  const handleExportTemplate = () => {
    const sample = [{
      order_number: "SO-20260101-0001", order_date: "2026-01-01",
      customer_name: "Sample Customer", customer_phone: "0500000000",
      payment_method: "Cash", sales_reference: "REF-1", sales_person: "John",
      company: "Asus", notes: "", status: "draft",
      brand_code: "HC", brand_name: "Hawa Chat", product_name: "1 Coin",
      coins_number: 100, qty: 1, unit_price: 0.0025, cost_price: 0.0020,
    }];
    downloadXlsx(sample, "sales_orders_template.xlsx");
  };

  const handleExportData = async () => {
    const { data: ords, error: e1 } = await supabase.from("manual_sales_orders").select("*").order("order_date", { ascending: false }).limit(5000);
    if (e1) { toast({ title: "Export failed", description: e1.message, variant: "destructive" }); return; }
    const orderIds = (ords || []).map((o: any) => o.id);
    const { data: lines, error: e2 } = await supabase.from("manual_sales_order_lines").select("*").in("order_id", orderIds);
    if (e2) { toast({ title: "Export failed", description: e2.message, variant: "destructive" }); return; }
    const linesByOrder = new Map<string, any[]>();
    (lines || []).forEach((l: any) => {
      const arr = linesByOrder.get(l.order_id) || [];
      arr.push(l); linesByOrder.set(l.order_id, arr);
    });
    const rows: any[] = [];
    (ords || []).forEach((o: any) => {
      const oLines = linesByOrder.get(o.id) || [];
      if (oLines.length === 0) {
        rows.push({ order_number: o.order_number, order_date: o.order_date, customer_name: o.customer_name, customer_phone: o.customer_phone, payment_method: o.payment_method, sales_reference: o.sales_reference, sales_person: o.sales_person, company: o.company, notes: o.notes, status: o.status });
      } else {
        oLines.forEach((l: any) => rows.push({
          order_number: o.order_number, order_date: o.order_date,
          customer_name: o.customer_name, customer_phone: o.customer_phone,
          payment_method: o.payment_method, sales_reference: o.sales_reference,
          sales_person: o.sales_person, company: o.company, notes: o.notes, status: o.status,
          brand_code: l.brand_code, brand_name: l.brand_name, product_name: l.product_name,
          coins_number: Number(l.coins_number), qty: Number(l.qty),
          unit_price: Number(l.unit_price), cost_price: Number(l.cost_price),
        }));
      }
    });
    downloadXlsx(rows, `sales_orders_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });
      if (raw.length === 0) throw new Error("Empty file");

      // Resolve brands
      const { data: brandsData } = await supabase.from("brands").select("id, brand_code, brand_name");
      const brandByCode = new Map<string, any>();
      const brandByName = new Map<string, any>();
      (brandsData || []).forEach((b: any) => {
        if (b.brand_code) brandByCode.set(String(b.brand_code).trim().toLowerCase(), b);
        if (b.brand_name) brandByName.set(String(b.brand_name).trim().toLowerCase(), b);
      });

      // Group by order_number
      const groups = new Map<string, any[]>();
      raw.forEach((r: any) => {
        const num = String(r.order_number || "").trim();
        if (!num) return;
        const arr = groups.get(num) || [];
        arr.push(r); groups.set(num, arr);
      });

      let created = 0, skipped = 0;
      for (const [orderNum, grp] of groups) {
        const head = grp[0];
        // Skip if exists
        const { data: existing } = await supabase.from("manual_sales_orders").select("id").eq("order_number", orderNum).maybeSingle();
        if (existing) { skipped++; continue; }

        const lines = grp.filter(r => r.product_name || r.brand_code || r.brand_name).map((r, idx) => {
          const code = String(r.brand_code || "").trim().toLowerCase();
          const name = String(r.brand_name || "").trim().toLowerCase();
          const brand = brandByCode.get(code) || brandByName.get(name);
          const coins = Number(r.coins_number) || 0;
          const qty = Number(r.qty) || 0;
          const unit = Number(r.unit_price) || 0;
          const cost = Number(r.cost_price) || 0;
          return {
            line_number: idx + 1,
            brand_id: brand?.id || null,
            brand_code: brand?.brand_code || r.brand_code || null,
            brand_name: brand?.brand_name || r.brand_name || null,
            product_name: r.product_name || "",
            coins_number: coins, qty, unit_price: unit, cost_price: cost,
            total: coins * qty * unit,
            total_cost: coins * qty * cost,
            profit: (coins * qty * unit) - (coins * qty * cost),
          };
        });

        const totalAmount = lines.reduce((s, l) => s + l.total, 0);
        const totalCost = lines.reduce((s, l) => s + l.total_cost, 0);
        const totalCoins = lines.reduce((s, l) => s + (l.coins_number * l.qty), 0);

        const orderDate = head.order_date ? (typeof head.order_date === "number"
          ? XLSX.SSF.format("yyyy-mm-dd", head.order_date)
          : String(head.order_date).substring(0, 10)) : format(new Date(), "yyyy-MM-dd");

        const { data: ins, error: insErr } = await supabase.from("manual_sales_orders").insert({
          order_number: orderNum,
          order_date: orderDate,
          customer_name: head.customer_name || null,
          customer_phone: head.customer_phone ? String(head.customer_phone) : null,
          payment_method: head.payment_method || null,
          sales_reference: head.sales_reference || null,
          sales_person: head.sales_person || null,
          company: head.company || null,
          notes: head.notes || null,
          status: String(head.status || "draft").toLowerCase() === "confirmed" ? "draft" : "draft",
          total_amount: totalAmount,
          total_cost: totalCost,
          total_profit: totalAmount - totalCost,
          total_coins: totalCoins,
        }).select().single();
        if (insErr || !ins) { skipped++; continue; }

        if (lines.length > 0) {
          await supabase.from("manual_sales_order_lines").insert(lines.map(l => ({ ...l, order_id: ins.id })));
        }
        created++;
      }

      toast({ title: language === 'ar' ? 'تم الاستيراد' : 'Import complete', description: `Created: ${created}, Skipped: ${skipped}` });
      fetchOrders();
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manual_sales_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("manual_sales_orders").delete().eq("id", deleteId).select();
    if (error) {
      toast({ title: language === 'ar' ? 'خطأ في الحذف' : 'Delete failed', description: error.message, variant: "destructive" });
    } else {
      toast({ title: language === 'ar' ? 'تم الحذف' : 'Deleted' });
      setOrders(prev => prev.filter(o => o.id !== deleteId));
    }
    setDeleteId(null);
  };

  if (accessLoading) return null;
  if (!hasAccess) return <AccessDenied />;

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {language === 'ar' ? 'أوامر البيع' : 'Sales Orders'}
        </h1>
        <Button onClick={() => navigate("/sales-order-entry/new")}>
          <Plus className="h-4 w-4 mr-1" />
          {language === 'ar' ? 'إضافة جديد' : 'Add New'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === 'ar' ? 'القائمة' : 'List'} ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{language === 'ar' ? 'رقم الطلب' : 'Order #'}</TableHead>
                    <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                    <TableHead>{language === 'ar' ? 'العميل' : 'Customer'}</TableHead>
                    <TableHead>{language === 'ar' ? 'طريقة الدفع' : 'Payment'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الكوينز' : 'Coins'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الربح' : 'Profit'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="w-32">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {language === 'ar' ? 'لا توجد طلبات' : 'No orders yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((o, idx) => (
                      <TableRow key={o.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{o.order_number}</TableCell>
                        <TableCell>{o.order_date ? format(new Date(o.order_date), "yyyy-MM-dd") : ''}</TableCell>
                        <TableCell>{o.customer_name || '—'}{o.customer_phone ? ` (${o.customer_phone})` : ''}</TableCell>
                        <TableCell>{o.payment_method || '—'}</TableCell>
                        <TableCell className="text-right font-medium">{Number(o.total_coins || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium">{Number(o.total_amount || 0).toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-medium ${Number(o.total_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Number(o.total_profit || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={o.status === 'confirmed' ? 'default' : 'secondary'}>
                            {o.status === 'confirmed'
                              ? (language === 'ar' ? 'مؤكد' : 'Confirmed')
                              : (language === 'ar' ? 'مسودة' : 'Draft')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/sales-order-entry/${o.id}`)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {o.status !== 'confirmed' && (
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(o.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' ? 'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع.' : 'Are you sure you want to delete this draft order? This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{language === 'ar' ? 'حذف' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesOrderList;
