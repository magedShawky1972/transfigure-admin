import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Search, Undo2, CheckCircle, XCircle, RefreshCw, History, Printer } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";
import { VoidPaymentPrint } from "@/components/VoidPaymentPrint";

interface PaidExpenseRequest {
  id: string;
  request_number: string;
  description: string;
  amount: number;
  base_currency_amount: number | null;
  status: string;
  paid_at: string | null;
  paid_by: string | null;
  treasury_id: string | null;
  treasury_name?: string;
  currency_code?: string;
  treasury_currency_code?: string;
  expense_entry_id?: string;
  treasury_entry_id?: string;
  treasury_entry_number?: string;
  treasury_amount?: number;
}

interface VoidHistory {
  id: string;
  void_number: string;
  expense_request_id: string;
  request_number: string;
  description: string | null;
  original_amount: number;
  treasury_amount: number | null;
  currency_code: string | null;
  treasury_currency_code: string | null;
  treasury_id: string | null;
  treasury_name: string | null;
  treasury_entry_number: string | null;
  original_paid_at: string | null;
  voided_at: string;
  voided_by: string;
  voided_by_name: string | null;
  reason: string | null;
}

const VoidPayment = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/void-payment");
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [paidRequests, setPaidRequests] = useState<PaidExpenseRequest[]>([]);
  const [voidHistory, setVoidHistory] = useState<VoidHistory[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PaidExpenseRequest | null>(null);
  const [selectedVoidRecord, setSelectedVoidRecord] = useState<VoidHistory | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAccess) {
      fetchPaidRequests();
      fetchVoidHistory();
    }
  }, [hasAccess]);

  const fetchPaidRequests = async () => {
    setLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from("expense_requests")
        .select(`
          id,
          request_number,
          description,
          amount,
          base_currency_amount,
          status,
          paid_at,
          paid_by,
          treasury_id,
          currency_id,
          treasuries:treasury_id(treasury_name, currency_id, currencies:currency_id(currency_code)),
          currencies:currency_id(currency_code)
        `)
        .eq("status", "paid")
        .order("paid_at", { ascending: false });

      if (error) throw error;

      const enrichedRequests: PaidExpenseRequest[] = [];
      
      for (const request of requests || []) {
        const { data: treasuryEntry } = await supabase
          .from("treasury_entries")
          .select("id, entry_number, converted_amount")
          .eq("expense_request_id", request.id)
          .maybeSingle();

        const { data: expenseEntry } = await supabase
          .from("expense_entries")
          .select("id")
          .eq("expense_reference", request.request_number)
          .maybeSingle();

        const treasury = request.treasuries as any;
        
        enrichedRequests.push({
          id: request.id,
          request_number: request.request_number,
          description: request.description,
          amount: request.amount,
          base_currency_amount: request.base_currency_amount,
          status: request.status,
          paid_at: request.paid_at,
          paid_by: request.paid_by,
          treasury_id: request.treasury_id,
          treasury_name: treasury?.treasury_name || "-",
          currency_code: (request.currencies as any)?.currency_code || "-",
          treasury_currency_code: treasury?.currencies?.currency_code || null,
          expense_entry_id: expenseEntry?.id,
          treasury_entry_id: treasuryEntry?.id,
          treasury_entry_number: treasuryEntry?.entry_number,
          treasury_amount: treasuryEntry?.converted_amount,
        });
      }

      setPaidRequests(enrichedRequests);
    } catch (error: any) {
      console.error("Error fetching paid requests:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const fetchVoidHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("void_payment_history")
        .select("*")
        .order("voided_at", { ascending: false });

      if (error) throw error;
      setVoidHistory(data || []);
    } catch (error: any) {
      console.error("Error fetching void history:", error);
    }
  };

  const handleVoidPayment = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(language === "ar" ? "يجب تسجيل الدخول" : "You must be logged in");
        return;
      }

      // Get user profile for name
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", user.id)
        .maybeSingle();

      // 1. Insert void history record BEFORE deleting treasury entry
      const { error: historyError } = await supabase.from("void_payment_history").insert({
        expense_request_id: selectedRequest.id,
        request_number: selectedRequest.request_number,
        description: selectedRequest.description,
        original_amount: selectedRequest.amount,
        treasury_amount: selectedRequest.treasury_amount,
        currency_code: selectedRequest.currency_code,
        treasury_currency_code: selectedRequest.treasury_currency_code,
        treasury_id: selectedRequest.treasury_id,
        treasury_name: selectedRequest.treasury_name,
        treasury_entry_number: selectedRequest.treasury_entry_number,
        original_paid_at: selectedRequest.paid_at,
        voided_by: user.id,
        voided_by_name: profile?.user_name || user.email,
        reason: voidReason || null,
      } as any);

      if (historyError) {
        console.error("Error creating void history:", historyError);
        toast.error(language === "ar" ? "خطأ في تسجيل سجل الإلغاء" : "Error creating void history");
        return;
      }

      // 2. Delete the treasury entry (if exists)
      if (selectedRequest.treasury_entry_id) {
        const { error: treasuryDeleteError } = await supabase
          .from("treasury_entries")
          .delete()
          .eq("id", selectedRequest.treasury_entry_id);

        if (treasuryDeleteError) {
          console.error("Error deleting treasury entry:", treasuryDeleteError);
          toast.error(language === "ar" ? "خطأ في حذف قيد الخزينة" : "Error deleting treasury entry");
          return;
        }
      }

      // 3. Reopen the expense entry
      if (selectedRequest.expense_entry_id) {
        const { error: expenseEntryError } = await supabase
          .from("expense_entries")
          .update({
            status: "approved",
            paid_by: null,
            paid_at: null,
          })
          .eq("id", selectedRequest.expense_entry_id);

        if (expenseEntryError) {
          console.error("Error updating expense entry:", expenseEntryError);
          toast.error(language === "ar" ? "خطأ في تحديث قيد المصروفات" : "Error updating expense entry");
          return;
        }
      }

      // 4. Reopen the expense request
      const { error: requestError } = await supabase
        .from("expense_requests")
        .update({
          status: "approved",
          paid_by: null,
          paid_at: null,
        })
        .eq("id", selectedRequest.id);

      if (requestError) {
        console.error("Error updating expense request:", requestError);
        toast.error(language === "ar" ? "خطأ في تحديث طلب المصروفات" : "Error updating expense request");
        return;
      }

      // 5. Log the void action in audit_logs
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "VOID_PAYMENT",
        table_name: "expense_requests",
        record_id: selectedRequest.id,
        old_data: {
          status: "paid",
          treasury_entry_id: selectedRequest.treasury_entry_id,
          treasury_entry_number: selectedRequest.treasury_entry_number,
        },
        new_data: {
          status: "approved",
          voided_at: new Date().toISOString(),
          void_reason: voidReason || null,
        },
      });

      toast.success(
        language === "ar"
          ? `تم إلغاء الدفع للطلب ${selectedRequest.request_number} بنجاح`
          : `Payment voided for request ${selectedRequest.request_number} successfully`
      );

      setVoidDialogOpen(false);
      setSelectedRequest(null);
      setVoidReason("");
      fetchPaidRequests();
      fetchVoidHistory();
    } catch (error: any) {
      console.error("Error voiding payment:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في إلغاء الدفع" : "Error voiding payment"));
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${language === "ar" ? "rtl" : "ltr"}">
      <head>
        <title>${language === "ar" ? "سند إلغاء دفع" : "Payment Void Voucher"}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .bg-white { background: white; }
          .p-8 { padding: 2rem; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .font-mono { font-family: monospace; }
          .text-2xl { font-size: 1.5rem; }
          .text-lg { font-size: 1.125rem; }
          .text-sm { font-size: 0.875rem; }
          .text-xs { font-size: 0.75rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .mb-4 { margin-bottom: 1rem; }
          .mb-6 { margin-bottom: 1.5rem; }
          .mt-1 { margin-top: 0.25rem; }
          .mt-8 { margin-top: 2rem; }
          .mt-12 { margin-top: 3rem; }
          .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          .pb-2 { padding-bottom: 0.5rem; }
          .pb-4 { padding-bottom: 1rem; }
          .pb-16 { padding-bottom: 4rem; }
          .pt-4 { padding-top: 1rem; }
          .p-2 { padding: 0.5rem; }
          .p-3 { padding: 0.75rem; }
          .p-4 { padding: 1rem; }
          .border { border: 1px solid #333; }
          .border-2 { border: 2px solid #333; }
          .border-b { border-bottom: 1px solid #333; }
          .border-b-2 { border-bottom: 2px solid #333; }
          .border-t { border-top: 1px solid #333; }
          .border-dashed { border-style: dashed; }
          .border-black { border-color: #000; }
          .border-gray-300 { border-color: #d1d5db; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
          .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
          .gap-4 { gap: 1rem; }
          .gap-8 { gap: 2rem; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .text-gray-500 { color: #6b7280; }
          .text-gray-600 { color: #4b5563; }
          .text-red-600 { color: #dc2626; }
          .bg-gray-50 { background: #f9fafb; }
          .relative { position: relative; }
          .absolute { position: absolute; }
          .overflow-hidden { overflow: hidden; }
          .pointer-events-none { pointer-events: none; }
          
          @media print {
            @page { size: A4; margin: 10mm; }
          }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const filteredRequests = paidRequests.filter(
    (request) =>
      request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.treasury_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const filteredHistory = voidHistory.filter(
    (record) =>
      record.void_number.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      record.request_number.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      (record.description?.toLowerCase() || "").includes(historySearchTerm.toLowerCase()) ||
      (record.treasury_name?.toLowerCase() || "").includes(historySearchTerm.toLowerCase())
  );

  if (accessLoading) {
    return <LoadingOverlay message={language === "ar" ? "جاري التحقق من الصلاحيات..." : "Checking permissions..."} />;
  }

  if (hasAccess === false) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Undo2 className="h-6 w-6" />
            {language === "ar" ? "إلغاء الدفع" : "Void Payment"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "إلغاء دفعات المصروفات المدفوعة وإعادة فتح الطلبات"
              : "Void paid expense payments and reopen requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="gap-2">
                <Undo2 className="h-4 w-4" />
                {language === "ar" ? "المدفوعات" : "Paid Requests"}
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                {language === "ar" ? "سجل الإلغاء" : "Void History"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "ar" ? "بحث برقم الطلب أو الوصف..." : "Search by request number or description..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={fetchPaidRequests}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {language === "ar" ? "تحديث" : "Refresh"}
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "رقم الطلب" : "Request #"}</TableHead>
                      <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                      <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                      <TableHead>{language === "ar" ? "مبلغ الخزينة" : "Treasury Amt"}</TableHead>
                      <TableHead>{language === "ar" ? "الخزينة" : "Treasury"}</TableHead>
                      <TableHead>{language === "ar" ? "رقم قيد الخزينة" : "Treasury Entry #"}</TableHead>
                      <TableHead>{language === "ar" ? "تاريخ الدفع" : "Paid Date"}</TableHead>
                      <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {language === "ar" ? "لا توجد دفعات للإلغاء" : "No payments to void"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-mono">{request.request_number}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{request.description}</TableCell>
                          <TableCell>
                            {request.amount.toLocaleString()} {request.currency_code}
                          </TableCell>
                          <TableCell>
                            {request.treasury_amount?.toLocaleString() || "-"} {request.treasury_currency_code || ""}
                          </TableCell>
                          <TableCell>{request.treasury_name}</TableCell>
                          <TableCell className="font-mono">{request.treasury_entry_number || "-"}</TableCell>
                          <TableCell>
                            {request.paid_at ? format(new Date(request.paid_at), "yyyy-MM-dd HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setVoidDialogOpen(true);
                              }}
                            >
                              <Undo2 className="h-4 w-4 mr-1" />
                              {language === "ar" ? "إلغاء" : "Void"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "ar" ? "بحث برقم الإلغاء أو الطلب..." : "Search by void or request number..."}
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={fetchVoidHistory}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {language === "ar" ? "تحديث" : "Refresh"}
                </Button>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "رقم الإلغاء" : "Void #"}</TableHead>
                      <TableHead>{language === "ar" ? "رقم الطلب" : "Request #"}</TableHead>
                      <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                      <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                      <TableHead>{language === "ar" ? "مبلغ الخزينة" : "Treasury Amt"}</TableHead>
                      <TableHead>{language === "ar" ? "الخزينة" : "Treasury"}</TableHead>
                      <TableHead>{language === "ar" ? "تاريخ الإلغاء" : "Void Date"}</TableHead>
                      <TableHead>{language === "ar" ? "بواسطة" : "Voided By"}</TableHead>
                      <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {language === "ar" ? "لا يوجد سجل إلغاء" : "No void history"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistory.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-red-600 font-semibold">{record.void_number}</TableCell>
                          <TableCell className="font-mono">{record.request_number}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{record.description || "-"}</TableCell>
                          <TableCell>
                            {record.original_amount.toLocaleString()} {record.currency_code || ""}
                          </TableCell>
                          <TableCell>
                            {record.treasury_amount?.toLocaleString() || "-"} {record.treasury_currency_code || ""}
                          </TableCell>
                          <TableCell>{record.treasury_name || "-"}</TableCell>
                          <TableCell>
                            {format(new Date(record.voided_at), "yyyy-MM-dd HH:mm")}
                          </TableCell>
                          <TableCell>{record.voided_by_name || "-"}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedVoidRecord(record);
                                setPrintDialogOpen(true);
                              }}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              {language === "ar" ? "طباعة" : "Print"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Void Confirmation Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {language === "ar" ? "تأكيد إلغاء الدفع" : "Confirm Void Payment"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "هل أنت متأكد من إلغاء هذه الدفعة؟ سيتم:"
                : "Are you sure you want to void this payment? This will:"}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "ar" ? "رقم الطلب:" : "Request #:"}</span>
                  <span className="font-mono font-medium">{selectedRequest.request_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "ar" ? "المبلغ:" : "Amount:"}</span>
                  <span className="font-medium">
                    {selectedRequest.amount.toLocaleString()} {selectedRequest.currency_code}
                  </span>
                </div>
                {selectedRequest.treasury_amount && selectedRequest.treasury_currency_code && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{language === "ar" ? "مبلغ الخزينة:" : "Treasury Amount:"}</span>
                    <span className="font-medium text-green-600">
                      {selectedRequest.treasury_amount.toLocaleString()} {selectedRequest.treasury_currency_code}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "ar" ? "الخزينة:" : "Treasury:"}</span>
                  <span>{selectedRequest.treasury_name}</span>
                </div>
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  {selectedRequest.treasury_entry_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  )}
                  <span className={!selectedRequest.treasury_entry_id ? "text-muted-foreground" : ""}>
                    {language === "ar"
                      ? "حذف قيد الخزينة وإعادة حساب الرصيد"
                      : "Delete treasury entry and recalculate balance"}
                    {selectedRequest.treasury_amount && selectedRequest.treasury_currency_code && (
                      <span className="text-xs text-green-600 ml-1">
                        (+{selectedRequest.treasury_amount.toLocaleString()} {selectedRequest.treasury_currency_code})
                      </span>
                    )}
                    {!selectedRequest.treasury_entry_id && (
                      <span className="text-xs ml-1">
                        ({language === "ar" ? "لا يوجد قيد" : "no entry found"})
                      </span>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  {selectedRequest.expense_entry_id ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  )}
                  <span className={!selectedRequest.expense_entry_id ? "text-muted-foreground" : ""}>
                    {language === "ar"
                      ? "إعادة فتح قيد المصروفات (حالة: معتمد)"
                      : "Reopen expense entry (status: approved)"}
                    {!selectedRequest.expense_entry_id && (
                      <span className="text-xs ml-1">
                        ({language === "ar" ? "لا يوجد قيد" : "no entry found"})
                      </span>
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>
                    {language === "ar"
                      ? "إعادة فتح طلب المصروفات (حالة: معتمد)"
                      : "Reopen expense request (status: approved)"}
                  </span>
                </li>
              </ul>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {language === "ar" ? "سبب الإلغاء (اختياري):" : "Void Reason (optional):"}
                </label>
                <Textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={language === "ar" ? "أدخل سبب الإلغاء..." : "Enter void reason..."}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={processing}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleVoidPayment} disabled={processing}>
              {processing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Undo2 className="h-4 w-4 mr-2" />
              )}
              {language === "ar" ? "تأكيد الإلغاء" : "Confirm Void"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {language === "ar" ? "معاينة سند الإلغاء" : "Void Voucher Preview"}
            </DialogTitle>
          </DialogHeader>

          {selectedVoidRecord && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <VoidPaymentPrint
                  ref={printRef}
                  language={language}
                  voidNumber={selectedVoidRecord.void_number}
                  requestNumber={selectedVoidRecord.request_number}
                  description={selectedVoidRecord.description || ""}
                  originalAmount={selectedVoidRecord.original_amount}
                  treasuryAmount={selectedVoidRecord.treasury_amount}
                  currencyCode={selectedVoidRecord.currency_code || "SAR"}
                  treasuryCurrencyCode={selectedVoidRecord.treasury_currency_code}
                  treasuryName={selectedVoidRecord.treasury_name || "-"}
                  treasuryEntryNumber={selectedVoidRecord.treasury_entry_number}
                  originalPaidAt={selectedVoidRecord.original_paid_at}
                  voidedAt={selectedVoidRecord.voided_at}
                  voidedByName={selectedVoidRecord.voided_by_name || "-"}
                  reason={selectedVoidRecord.reason}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                  {language === "ar" ? "إغلاق" : "Close"}
                </Button>
                <Button onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  {language === "ar" ? "طباعة" : "Print"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VoidPayment;
