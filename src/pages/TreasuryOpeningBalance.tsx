import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wallet, Save, Check, X } from "lucide-react";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";

interface OpeningBalance {
  id: string;
  treasury_id: string;
  fiscal_year: number;
  opening_date: string;
  amount: number;
  notes: string | null;
  entered_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Treasury {
  id: string;
  treasury_code: string;
  treasury_name: string;
  treasury_name_ar: string | null;
}

const TreasuryOpeningBalance = () => {
  const { language } = useLanguage();
  const [balances, setBalances] = useState<OpeningBalance[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [formData, setFormData] = useState({
    treasury_id: "",
    fiscal_year: new Date().getFullYear(),
    opening_date: format(new Date(), "yyyy-MM-dd"),
    amount: 0,
    notes: "",
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
      const [balancesRes, treasuriesRes] = await Promise.all([
        supabase.from("treasury_opening_balances").select("*").order("fiscal_year", { ascending: false }),
        supabase.from("treasuries").select("id, treasury_code, treasury_name, treasury_name_ar").eq("is_active", true),
      ]);

      if (balancesRes.error) throw balancesRes.error;
      if (treasuriesRes.error) throw treasuriesRes.error;

      setBalances(balancesRes.data || []);
      setTreasuries(treasuriesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.treasury_id || !formData.amount) {
      toast.error(language === "ar" ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    try {
      const { error } = await supabase.from("treasury_opening_balances").insert([{
        treasury_id: formData.treasury_id,
        fiscal_year: formData.fiscal_year,
        opening_date: formData.opening_date,
        amount: formData.amount,
        notes: formData.notes || null,
        entered_by: currentUserId,
      }]);

      if (error) throw error;
      toast.success(language === "ar" ? "تم إضافة الرصيد الافتتاحي بنجاح" : "Opening balance added successfully");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الحفظ" : "Error saving"));
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("treasury_opening_balances")
        .update({
          approved_by: currentUserId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success(language === "ar" ? "تم الاعتماد بنجاح" : "Approved successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error approving:", error);
      toast.error(error.message || (language === "ar" ? "خطأ في الاعتماد" : "Error approving"));
    }
  };

  const resetForm = () => {
    setFormData({
      treasury_id: "",
      fiscal_year: new Date().getFullYear(),
      opening_date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      notes: "",
    });
  };

  const getTreasuryName = (treasuryId: string) => {
    const treasury = treasuries.find((t) => t.id === treasuryId);
    return treasury 
      ? (language === "ar" && treasury.treasury_name_ar ? treasury.treasury_name_ar : treasury.treasury_name)
      : "-";
  };

  if (loading) return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">{language === "ar" ? "الأرصدة الافتتاحية للخزائن" : "Treasury Opening Balances"}</h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة رصيد افتتاحي" : "Add Opening Balance"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إضافة رصيد افتتاحي جديد" : "Add New Opening Balance"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الخزينة *" : "Treasury *"}</Label>
                <Select value={formData.treasury_id} onValueChange={(v) => setFormData({ ...formData, treasury_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={language === "ar" ? "اختر الخزينة" : "Select Treasury"} />
                  </SelectTrigger>
                  <SelectContent>
                    {treasuries.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.treasury_code} - {language === "ar" && t.treasury_name_ar ? t.treasury_name_ar : t.treasury_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "السنة المالية" : "Fiscal Year"}</Label>
                  <Input
                    type="number"
                    value={formData.fiscal_year}
                    onChange={(e) => setFormData({ ...formData, fiscal_year: parseInt(e.target.value) || new Date().getFullYear() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "تاريخ الرصيد" : "Opening Date"}</Label>
                  <Input
                    type="date"
                    value={formData.opening_date}
                    onChange={(e) => setFormData({ ...formData, opening_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "المبلغ *" : "Amount *"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full gap-2">
                <Save className="h-4 w-4" />
                {language === "ar" ? "حفظ" : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "سجل الأرصدة الافتتاحية" : "Opening Balances History"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الخزينة" : "Treasury"}</TableHead>
                <TableHead>{language === "ar" ? "السنة المالية" : "Fiscal Year"}</TableHead>
                <TableHead>{language === "ar" ? "تاريخ الرصيد" : "Opening Date"}</TableHead>
                <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                <TableHead>{language === "ar" ? "ملاحظات" : "Notes"}</TableHead>
                <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((balance) => (
                <TableRow key={balance.id}>
                  <TableCell>{getTreasuryName(balance.treasury_id)}</TableCell>
                  <TableCell>{balance.fiscal_year}</TableCell>
                  <TableCell>{format(new Date(balance.opening_date), "yyyy-MM-dd")}</TableCell>
                  <TableCell className="font-semibold">{balance.amount.toLocaleString()}</TableCell>
                  <TableCell>{balance.notes || "-"}</TableCell>
                  <TableCell>
                    {balance.approved_by ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {language === "ar" ? "معتمد" : "Approved"}
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        {language === "ar" ? "في انتظار الاعتماد" : "Pending Approval"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!balance.approved_by && (
                      <Button variant="outline" size="sm" onClick={() => handleApprove(balance.id)} className="gap-1">
                        <Check className="h-4 w-4" />
                        {language === "ar" ? "اعتماد" : "Approve"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {balances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {language === "ar" ? "لا توجد أرصدة افتتاحية" : "No opening balances found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TreasuryOpeningBalance;
