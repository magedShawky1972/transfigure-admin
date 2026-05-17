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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { format } from "date-fns";

const SalesOrderList = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { hasAccess, isLoading: accessLoading } = usePageAccess();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
                    <TableHead className="text-right">{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                    <TableHead className="text-right">{language === 'ar' ? 'الربح' : 'Profit'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead className="w-32">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
