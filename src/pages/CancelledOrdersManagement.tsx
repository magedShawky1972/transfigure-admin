import { useEffect, useMemo, useState } from "react";
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
import { Loader2, ListX, RefreshCw } from "lucide-react";
import { format } from "date-fns";

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

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dateFrom, setDateFrom] = useState(format(firstOfMonth, "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      {isAr ? "لا توجد طلبات إلغاء في هذه الفترة." : "No cancellation requests in this period."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.order_number}</TableCell>
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
