import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Filter, Clock, CheckCircle, DollarSign } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "react-router-dom";

interface ExpenseRequest {
  id: string;
  request_number: string;
  request_date: string;
  description: string;
  amount: number;
  status: string;
  expense_type_id: string | null;
  payment_method: string | null;
  paid_at: string | null;
  notes: string | null;
}

interface ExpenseType {
  id: string;
  expense_name: string;
  expense_name_ar: string | null;
}

const ExpenseReports = () => {
  const { language } = useLanguage();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"pending" | "paid">(
    tabParam === "paid" ? "paid" : "pending"
  );
  const [loading, setLoading] = useState(false);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);

  // Pending filters
  const [pendingData, setPendingData] = useState<ExpenseRequest[]>([]);
  const [pendingExpenseType, setPendingExpenseType] = useState("all");

  // Paid filters
  const [paidData, setPaidData] = useState<ExpenseRequest[]>([]);
  const [paidDateFrom, setPaidDateFrom] = useState("");
  const [paidDateTo, setPaidDateTo] = useState("");
  const [paidExpenseType, setPaidExpenseType] = useState("all");
  const [paidPaymentMethod, setPaidPaymentMethod] = useState("all");

  useEffect(() => {
    fetchExpenseTypes();
  }, []);

  const fetchExpenseTypes = async () => {
    const { data } = await supabase
      .from("expense_types")
      .select("id, expense_name, expense_name_ar")
      .eq("is_active", true);
    if (data) setExpenseTypes(data);
  };

  const runPendingReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("expense_requests")
        .select("*")
        .in("status", ["pending", "classified", "approved"])
        .order("request_date", { ascending: false });

      if (pendingExpenseType !== "all") {
        query = query.eq("expense_type_id", pendingExpenseType);
      }

      const { data, error } = await query;
      if (error) throw error;

      setPendingData(data || []);
      toast.success(
        language === "ar"
          ? `تم العثور على ${data?.length || 0} طلب`
          : `Found ${data?.length || 0} requests`
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runPaidReport = async () => {
    if (!paidDateFrom || !paidDateTo) {
      toast.error(
        language === "ar"
          ? "يرجى تحديد الفترة الزمنية"
          : "Please select date range"
      );
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from("expense_requests")
        .select("*")
        .eq("status", "paid")
        .gte("paid_at", paidDateFrom)
        .lte("paid_at", paidDateTo + "T23:59:59")
        .order("paid_at", { ascending: false });

      if (paidExpenseType !== "all") {
        query = query.eq("expense_type_id", paidExpenseType);
      }
      if (paidPaymentMethod !== "all") {
        query = query.eq("payment_method", paidPaymentMethod);
      }

      const { data, error } = await query;
      if (error) throw error;

      setPaidData(data || []);
      toast.success(
        language === "ar"
          ? `تم العثور على ${data?.length || 0} مصروف`
          : `Found ${data?.length || 0} expenses`
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data: ExpenseRequest[], filename: string) => {
    if (data.length === 0) {
      toast.error(
        language === "ar"
          ? "لا توجد بيانات للتصدير"
          : "No data to export"
      );
      return;
    }

    const headers = [
      language === "ar" ? "رقم الطلب" : "Request No",
      language === "ar" ? "التاريخ" : "Date",
      language === "ar" ? "الوصف" : "Description",
      language === "ar" ? "المبلغ" : "Amount",
      language === "ar" ? "الحالة" : "Status",
      language === "ar" ? "طريقة الدفع" : "Payment Method",
      language === "ar" ? "تاريخ الدفع" : "Paid Date",
    ];

    const rows = data.map((r) => [
      r.request_number,
      r.request_date,
      r.description,
      r.amount,
      r.status,
      r.payment_method || "",
      r.paid_at ? format(new Date(r.paid_at), "yyyy-MM-dd") : "",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: "Pending", ar: "في الانتظار" },
      classified: { en: "Classified", ar: "مصنف" },
      approved: { en: "Approved", ar: "معتمد" },
      paid: { en: "Paid", ar: "مدفوع" },
    };
    return labels[status] ? (language === "ar" ? labels[status].ar : labels[status].en) : status;
  };

  const getExpenseTypeName = (typeId: string | null) => {
    if (!typeId) return "-";
    const type = expenseTypes.find((t) => t.id === typeId);
    return type ? (language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name) : "-";
  };

  const pendingTotal = pendingData.reduce((sum, r) => sum + r.amount, 0);
  const paidTotal = paidData.reduce((sum, r) => sum + r.amount, 0);

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "تقارير المصروفات" : "Expense Reports"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "تقارير المصروفات المعلقة والمدفوعة" : "Pending and paid expense reports"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "paid")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            {language === "ar" ? "المعلق" : "Pending"}
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {language === "ar" ? "المدفوع" : "Paid"}
          </TabsTrigger>
        </TabsList>

        {/* Pending Expenses Report */}
        <TabsContent value="pending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "المصروفات المعلقة" : "Pending Expenses"}</CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "جميع المصروفات في الانتظار والمصنفة والمعتمدة"
                  : "All pending, classified, and approved expenses"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نوع المصروف" : "Expense Type"}</Label>
                  <Select value={pendingExpenseType} onValueChange={setPendingExpenseType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                      {expenseTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {language === "ar" && t.expense_name_ar ? t.expense_name_ar : t.expense_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={runPendingReport} className="gap-2">
                  <Filter className="h-4 w-4" />
                  {language === "ar" ? "تشغيل التقرير" : "Run Report"}
                </Button>
                <Button variant="outline" onClick={() => exportToCSV(pendingData, "pending-expenses")} className="gap-2">
                  <Download className="h-4 w-4" />
                  {language === "ar" ? "تصدير CSV" : "Export CSV"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {pendingData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{language === "ar" ? "النتائج" : "Results"}</CardTitle>
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-lg">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="font-bold text-lg">{pendingTotal.toLocaleString()}</span>
                  </div>
                </div>
                <CardDescription>
                  {language === "ar" ? `${pendingData.length} طلب` : `${pendingData.length} requests`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "رقم الطلب" : "Request No"}</TableHead>
                      <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                      <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                      <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingData.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.request_number}</TableCell>
                        <TableCell>{format(new Date(r.request_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                        <TableCell>{getExpenseTypeName(r.expense_type_id)}</TableCell>
                        <TableCell className="font-semibold">{r.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                            {getStatusLabel(r.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right">
                        {language === "ar" ? "الإجمالي:" : "Total:"}
                      </TableCell>
                      <TableCell className="text-primary text-lg">{pendingTotal.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Paid Expenses Report */}
        <TabsContent value="paid" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "المصروفات المدفوعة" : "Paid Expenses"}</CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "جميع المصروفات المدفوعة خلال فترة محددة"
                  : "All paid expenses within a selected period"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "من تاريخ *" : "From Date *"}</Label>
                  <Input type="date" value={paidDateFrom} onChange={(e) => setPaidDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "إلى تاريخ *" : "To Date *"}</Label>
                  <Input type="date" value={paidDateTo} onChange={(e) => setPaidDateTo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نوع المصروف" : "Expense Type"}</Label>
                  <Select value={paidExpenseType} onValueChange={setPaidExpenseType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                      {expenseTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {language === "ar" && t.expense_name_ar ? t.expense_name_ar : t.expense_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                  <Select value={paidPaymentMethod} onValueChange={setPaidPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="bank">{language === "ar" ? "بنك" : "Bank"}</SelectItem>
                      <SelectItem value="treasury">{language === "ar" ? "خزينة" : "Treasury"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={runPaidReport} className="gap-2">
                  <Filter className="h-4 w-4" />
                  {language === "ar" ? "تشغيل التقرير" : "Run Report"}
                </Button>
                <Button variant="outline" onClick={() => exportToCSV(paidData, "paid-expenses")} className="gap-2">
                  <Download className="h-4 w-4" />
                  {language === "ar" ? "تصدير CSV" : "Export CSV"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {paidData.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{language === "ar" ? "النتائج" : "Results"}</CardTitle>
                  <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                    <DollarSign className="h-5 w-5" />
                    <span className="font-bold text-lg">{paidTotal.toLocaleString()}</span>
                  </div>
                </div>
                <CardDescription>
                  {language === "ar" ? `${paidData.length} مصروف` : `${paidData.length} expenses`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "رقم الطلب" : "Request No"}</TableHead>
                      <TableHead>{language === "ar" ? "تاريخ الطلب" : "Request Date"}</TableHead>
                      <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                      <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment"}</TableHead>
                      <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                      <TableHead>{language === "ar" ? "تاريخ الدفع" : "Paid Date"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidData.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{r.request_number}</TableCell>
                        <TableCell>{format(new Date(r.request_date), "yyyy-MM-dd")}</TableCell>
                        <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                        <TableCell>{getExpenseTypeName(r.expense_type_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {r.payment_method === "bank"
                              ? language === "ar" ? "بنك" : "Bank"
                              : language === "ar" ? "خزينة" : "Treasury"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{r.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          {r.paid_at ? format(new Date(r.paid_at), "yyyy-MM-dd HH:mm") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={5} className="text-right">
                        {language === "ar" ? "الإجمالي:" : "Total:"}
                      </TableCell>
                      <TableCell className="text-primary text-lg">{paidTotal.toLocaleString()}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpenseReports;
