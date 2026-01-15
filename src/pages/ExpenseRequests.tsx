import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Check, X, DollarSign, Building2, Vault, Package, Receipt } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ExpenseRequest {
  id: string;
  request_number: string;
  ticket_id: string | null;
  request_date: string;
  description: string;
  amount: number;
  currency_id: string | null;
  expense_type_id: string | null;
  is_asset: boolean;
  payment_method: string | null;
  bank_id: string | null;
  treasury_id: string | null;
  status: string;
  classified_by: string | null;
  classified_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_by: string | null;
  paid_at: string | null;
  requester_id: string;
  notes: string | null;
}

interface ExpenseType {
  id: string;
  expense_name: string;
  expense_name_ar: string | null;
  is_asset: boolean;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
}

interface Treasury {
  id: string;
  treasury_code: string;
  treasury_name: string;
}

interface Currency {
  id: string;
  currency_code: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  classified: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  paid: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const ExpenseRequests = () => {
  const { language } = useLanguage();
  const [requests, setRequests] = useState<ExpenseRequest[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ExpenseRequest | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("pending");

  const [classifyData, setClassifyData] = useState({
    expense_type_id: "",
    is_asset: false,
    payment_method: "treasury",
    bank_id: "",
    treasury_id: "",
  });

  useEffect(() => {
    fetchData();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, typesRes, banksRes, treasuriesRes, currenciesRes] = await Promise.all([
        supabase.from("expense_requests").select("*").order("request_date", { ascending: false }),
        supabase.from("expense_types").select("id, expense_name, expense_name_ar, is_asset").eq("is_active", true),
        supabase.from("banks").select("id, bank_code, bank_name").eq("is_active", true),
        supabase.from("treasuries").select("id, treasury_code, treasury_name").eq("is_active", true),
        supabase.from("currencies").select("id, currency_code").eq("is_active", true),
      ]);

      if (requestsRes.error) throw requestsRes.error;
      if (typesRes.error) throw typesRes.error;
      if (banksRes.error) throw banksRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;
      if (currenciesRes.error) throw currenciesRes.error;

      setRequests(requestsRes.data || []);
      setExpenseTypes(typesRes.data || []);
      setBanks(banksRes.data || []);
      setTreasuries(treasuriesRes.data || []);
      setCurrencies(currenciesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleClassify = async () => {
    if (!selectedRequest) return;
    if (!classifyData.expense_type_id) {
      toast.error(language === "ar" ? "يرجى اختيار نوع المصروف" : "Please select expense type");
      return;
    }
    if (classifyData.payment_method === "bank" && !classifyData.bank_id) {
      toast.error(language === "ar" ? "يرجى اختيار البنك" : "Please select bank");
      return;
    }
    if (classifyData.payment_method === "treasury" && !classifyData.treasury_id) {
      toast.error(language === "ar" ? "يرجى اختيار الخزينة" : "Please select treasury");
      return;
    }

    try {
      const { error } = await supabase.from("expense_requests").update({
        expense_type_id: classifyData.expense_type_id,
        is_asset: classifyData.is_asset,
        payment_method: classifyData.payment_method,
        bank_id: classifyData.payment_method === "bank" ? classifyData.bank_id : null,
        treasury_id: classifyData.payment_method === "treasury" ? classifyData.treasury_id : null,
        status: "classified",
        classified_by: currentUserId,
        classified_at: new Date().toISOString(),
      }).eq("id", selectedRequest.id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم تصنيف الطلب بنجاح" : "Request classified successfully");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error classifying:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التصنيف" : "Error classifying"));
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "approved") {
        updateData.approved_by = currentUserId;
        updateData.approved_at = new Date().toISOString();
      } else if (newStatus === "paid") {
        updateData.paid_by = currentUserId;
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await supabase.from("expense_requests").update(updateData).eq("id", id);
      if (error) throw error;
      
      toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
      fetchData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في التحديث" : "Error updating"));
    }
  };

  const openClassifyDialog = (request: ExpenseRequest) => {
    setSelectedRequest(request);
    setClassifyData({
      expense_type_id: request.expense_type_id || "",
      is_asset: request.is_asset,
      payment_method: request.payment_method || "treasury",
      bank_id: request.bank_id || "",
      treasury_id: request.treasury_id || "",
    });
    setDialogOpen(true);
  };

  const handleExpenseTypeChange = (typeId: string) => {
    const type = expenseTypes.find(t => t.id === typeId);
    setClassifyData({
      ...classifyData,
      expense_type_id: typeId,
      is_asset: type?.is_asset || false,
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: "Pending", ar: "في الانتظار" },
      classified: { en: "Classified", ar: "مصنف" },
      approved: { en: "Approved", ar: "معتمد" },
      paid: { en: "Paid", ar: "مدفوع" },
      rejected: { en: "Rejected", ar: "مرفوض" },
      cancelled: { en: "Cancelled", ar: "ملغي" },
    };
    return labels[status] ? (language === "ar" ? labels[status].ar : labels[status].en) : status;
  };

  const getExpenseTypeName = (typeId: string | null) => {
    if (!typeId) return "-";
    const type = expenseTypes.find(t => t.id === typeId);
    return type ? (language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name) : "-";
  };

  const filteredRequests = requests.filter(r => {
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "classified") return r.status === "classified";
    if (activeTab === "approved") return r.status === "approved";
    if (activeTab === "paid") return r.status === "paid";
    return true;
  });

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{language === "ar" ? "طلبات المصروفات" : "Expense Requests"}</h1>
          <p className="text-muted-foreground">{language === "ar" ? "قائمة انتظار المحاسبة" : "Accounting Queue"}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "في الانتظار" : "Pending"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "pending").length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "مصنف" : "Classified"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "classified").length}</p>
              </div>
              <Receipt className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "معتمد" : "Approved"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "approved").length}</p>
              </div>
              <Check className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{language === "ar" ? "مدفوع" : "Paid"}</p>
                <p className="text-2xl font-bold">{requests.filter(r => r.status === "paid").length}</p>
              </div>
              <Package className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending">{language === "ar" ? "في الانتظار" : "Pending"}</TabsTrigger>
              <TabsTrigger value="classified">{language === "ar" ? "مصنف" : "Classified"}</TabsTrigger>
              <TabsTrigger value="approved">{language === "ar" ? "معتمد" : "Approved"}</TabsTrigger>
              <TabsTrigger value="paid">{language === "ar" ? "مدفوع" : "Paid"}</TabsTrigger>
              <TabsTrigger value="all">{language === "ar" ? "الكل" : "All"}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "رقم الطلب" : "Request No."}</TableHead>
                <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                <TableHead>{language === "ar" ? "الوصف" : "Description"}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{language === "ar" ? "أصل/مصروف" : "Asset/Expense"}</TableHead>
                <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-mono">{request.request_number}</TableCell>
                  <TableCell>{format(new Date(request.request_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell className="max-w-xs truncate">{request.description}</TableCell>
                  <TableCell className="font-semibold">{request.amount.toLocaleString()}</TableCell>
                  <TableCell>{getExpenseTypeName(request.expense_type_id)}</TableCell>
                  <TableCell>
                    {request.expense_type_id && (
                      <Badge variant={request.is_asset ? "default" : "secondary"}>
                        {request.is_asset 
                          ? (language === "ar" ? "أصل" : "Asset")
                          : (language === "ar" ? "مصروف" : "Expense")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {request.payment_method && (
                      <div className="flex items-center gap-1">
                        {request.payment_method === "bank" ? (
                          <Building2 className="h-4 w-4" />
                        ) : (
                          <Vault className="h-4 w-4" />
                        )}
                        <span className="text-xs">
                          {request.payment_method === "bank" 
                            ? (language === "ar" ? "بنك" : "Bank")
                            : (language === "ar" ? "خزينة" : "Treasury")}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[request.status] || ""}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {request.status === "pending" && (
                        <Button variant="outline" size="sm" onClick={() => openClassifyDialog(request)}>
                          {language === "ar" ? "تصنيف" : "Classify"}
                        </Button>
                      )}
                      {request.status === "classified" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(request.id, "approved")}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleStatusChange(request.id, "rejected")}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {request.status === "approved" && (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(request.id, "paid")}>
                          {language === "ar" ? "دفع" : "Pay"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد طلبات" : "No requests found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Classify Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تصنيف طلب المصروف" : "Classify Expense Request"}</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-mono text-sm">{selectedRequest.request_number}</p>
                <p className="text-lg font-semibold">{selectedRequest.amount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "نوع المصروف *" : "Expense Type *"}</Label>
                <Select value={classifyData.expense_type_id} onValueChange={handleExpenseTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {language === "ar" && t.expense_name_ar ? t.expense_name_ar : t.expense_name}
                        {t.is_asset && <span className="text-xs text-muted-foreground ml-2">({language === "ar" ? "أصل" : "Asset"})</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={classifyData.is_asset}
                  onCheckedChange={(v) => setClassifyData({ ...classifyData, is_asset: v })}
                />
                <Label>{language === "ar" ? "أصل ثابت" : "Fixed Asset"}</Label>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "طريقة الدفع *" : "Payment Method *"}</Label>
                <Select value={classifyData.payment_method} onValueChange={(v) => setClassifyData({ ...classifyData, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="treasury">
                      <div className="flex items-center gap-2">
                        <Vault className="h-4 w-4" />
                        {language === "ar" ? "خزينة" : "Treasury"}
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {language === "ar" ? "بنك" : "Bank"}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {classifyData.payment_method === "bank" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "البنك *" : "Bank *"}</Label>
                  <Select value={classifyData.bank_id} onValueChange={(v) => setClassifyData({ ...classifyData, bank_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر البنك" : "Select Bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_code} - {b.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {classifyData.payment_method === "treasury" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الخزينة *" : "Treasury *"}</Label>
                  <Select value={classifyData.treasury_id} onValueChange={(v) => setClassifyData({ ...classifyData, treasury_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} />
                    </SelectTrigger>
                    <SelectContent>
                      {treasuries.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.treasury_code} - {t.treasury_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handleClassify} className="w-full">
                {language === "ar" ? "تصنيف الطلب" : "Classify Request"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseRequests;
