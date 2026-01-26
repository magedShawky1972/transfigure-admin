import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Search, Undo2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { usePageAccess } from "@/hooks/usePageAccess";
import { AccessDenied } from "@/components/AccessDenied";

interface PaidExpenseRequest {
  id: string;
  request_number: string;
  description: string;
  amount: number;
  status: string;
  paid_at: string | null;
  paid_by: string | null;
  treasury_id: string | null;
  treasury_name?: string;
  currency_code?: string;
  expense_entry_id?: string;
  treasury_entry_id?: string;
  treasury_entry_number?: string;
}

const VoidPayment = () => {
  const { language } = useLanguage();
  const { hasAccess, isLoading: accessLoading } = usePageAccess("/void-payment");
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [paidRequests, setPaidRequests] = useState<PaidExpenseRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PaidExpenseRequest | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (hasAccess) {
      fetchPaidRequests();
    }
  }, [hasAccess]);

  const fetchPaidRequests = async () => {
    setLoading(true);
    try {
      // Fetch paid expense requests with treasury info
      const { data: requests, error } = await supabase
        .from("expense_requests")
        .select(`
          id,
          request_number,
          description,
          amount,
          status,
          paid_at,
          paid_by,
          treasury_id,
          currency_id,
          treasuries:treasury_id(treasury_name),
          currencies:currency_id(currency_code)
        `)
        .eq("status", "paid")
        .order("paid_at", { ascending: false });

      if (error) throw error;

      // Fetch associated treasury entries for each request
      const enrichedRequests: PaidExpenseRequest[] = [];
      
      for (const request of requests || []) {
        const { data: treasuryEntry } = await supabase
          .from("treasury_entries")
          .select("id, entry_number")
          .eq("expense_request_id", request.id)
          .maybeSingle();

        const { data: expenseEntry } = await supabase
          .from("expense_entries")
          .select("id")
          .eq("expense_reference", request.request_number)
          .maybeSingle();

        enrichedRequests.push({
          id: request.id,
          request_number: request.request_number,
          description: request.description,
          amount: request.amount,
          status: request.status,
          paid_at: request.paid_at,
          paid_by: request.paid_by,
          treasury_id: request.treasury_id,
          treasury_name: (request.treasuries as any)?.treasury_name || "-",
          currency_code: (request.currencies as any)?.currency_code || "-",
          expense_entry_id: expenseEntry?.id,
          treasury_entry_id: treasuryEntry?.id,
          treasury_entry_number: treasuryEntry?.entry_number,
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

  const handleVoidPayment = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(language === "ar" ? "يجب تسجيل الدخول" : "You must be logged in");
        return;
      }

      // 1. Soft-delete the treasury entry (if exists)
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

        // Treasury balance will be auto-recalculated by database trigger
      }

      // 2. Reopen the expense entry (set status back to approved)
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

      // 3. Reopen the expense request (set status back to approved)
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

      // 4. Log the void action in audit_logs
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
        },
      });

      toast.success(
        language === "ar"
          ? `تم إلغاء الدفع للطلب ${selectedRequest.request_number} بنجاح`
          : `Payment voided for request ${selectedRequest.request_number} successfully`
      );

      setVoidDialogOpen(false);
      setSelectedRequest(null);
      fetchPaidRequests();
    } catch (error: any) {
      console.error("Error voiding payment:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في إلغاء الدفع" : "Error voiding payment"));
    } finally {
      setProcessing(false);
    }
  };

  const filteredRequests = paidRequests.filter(
    (request) =>
      request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (request.treasury_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
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
        <CardContent className="space-y-4">
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
                  <TableHead>{language === "ar" ? "الخزينة" : "Treasury"}</TableHead>
                  <TableHead>{language === "ar" ? "رقم قيد الخزينة" : "Treasury Entry #"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ الدفع" : "Paid Date"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{language === "ar" ? "الخزينة:" : "Treasury:"}</span>
                  <span>{selectedRequest.treasury_name}</span>
                </div>
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <span>
                    {language === "ar"
                      ? "حذف قيد الخزينة وإعادة حساب الرصيد"
                      : "Delete treasury entry and recalculate balance"}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-warning mt-0.5" />
                  <span>
                    {language === "ar"
                      ? "إعادة فتح قيد المصروفات (حالة: معتمد)"
                      : "Reopen expense entry (status: approved)"}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-warning mt-0.5" />
                  <span>
                    {language === "ar"
                      ? "إعادة فتح طلب المصروفات (حالة: معتمد)"
                      : "Reopen expense request (status: approved)"}
                  </span>
                </li>
              </ul>
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
    </div>
  );
};

export default VoidPayment;
