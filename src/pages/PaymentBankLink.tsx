import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Building2, CreditCard, Save, Link2, Unlink } from "lucide-react";

interface PaymentMethod {
  id: string;
  payment_type: string;
  payment_method: string;
  gateway_fee: number;
  fixed_value: number;
  vat_fee: number;
  is_active: boolean;
  bank_id: string | null;
}

interface Bank {
  id: string;
  bank_code: string;
  bank_name: string;
  bank_name_ar: string | null;
  is_active: boolean;
}

export default function PaymentBankLink() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [changes, setChanges] = useState<Record<string, string | null>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentRes, bankRes] = await Promise.all([
        supabase
          .from("payment_methods")
          .select("id, payment_type, payment_method, gateway_fee, fixed_value, vat_fee, is_active, bank_id")
          .eq("is_active", true)
          .order("payment_type", { ascending: true }),
        supabase
          .from("banks")
          .select("id, bank_code, bank_name, bank_name_ar, is_active")
          .eq("is_active", true)
          .order("bank_name", { ascending: true }),
      ]);

      if (paymentRes.error) throw paymentRes.error;
      if (bankRes.error) throw bankRes.error;

      setPaymentMethods(paymentRes.data || []);
      setBanks(bankRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(language === "ar" ? "خطأ في جلب البيانات" : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  const handleBankChange = (paymentMethodId: string, bankId: string | null) => {
    setChanges((prev) => ({
      ...prev,
      [paymentMethodId]: bankId,
    }));
  };

  const getCurrentBankId = (paymentMethod: PaymentMethod): string | null => {
    if (changes.hasOwnProperty(paymentMethod.id)) {
      return changes[paymentMethod.id];
    }
    return paymentMethod.bank_id;
  };

  const handleSaveAll = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info(language === "ar" ? "لا توجد تغييرات للحفظ" : "No changes to save");
      return;
    }

    setSaving(true);
    try {
      const updates = Object.entries(changes).map(([paymentMethodId, bankId]) =>
        supabase
          .from("payment_methods")
          .update({ bank_id: bankId, updated_at: new Date().toISOString() })
          .eq("id", paymentMethodId)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) {
        throw new Error(errors[0].error?.message);
      }

      toast.success(
        language === "ar"
          ? `تم حفظ ${Object.keys(changes).length} تغييرات بنجاح`
          : `Successfully saved ${Object.keys(changes).length} changes`
      );
      setChanges({});
      fetchData();
    } catch (error: any) {
      console.error("Error saving changes:", error);
      toast.error(language === "ar" ? "خطأ في حفظ التغييرات" : "Error saving changes");
    } finally {
      setSaving(false);
    }
  };

  const getBankName = (bankId: string | null): string => {
    if (!bankId) return language === "ar" ? "غير مرتبط" : "Not Linked";
    const bank = banks.find((b) => b.id === bankId);
    if (!bank) return language === "ar" ? "غير موجود" : "Not Found";
    return language === "ar" && bank.bank_name_ar ? bank.bank_name_ar : bank.bank_name;
  };

  const calculateNetAmount = (total: number, method: PaymentMethod): number => {
    const gatewayFeeAmount = (total * (method.gateway_fee || 0)) / 100;
    const fixedAmount = method.fixed_value || 0;
    const vatAmount = ((gatewayFeeAmount + fixedAmount) * (method.vat_fee || 0)) / 100;
    const totalFees = gatewayFeeAmount + fixedAmount + vatAmount;
    return total - totalFees;
  };

  const hasChanges = Object.keys(changes).length > 0;

  if (loading) {
    return <LoadingOverlay message={language === "ar" ? "جاري التحميل..." : "Loading..."} />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            {language === "ar" ? "ربط طرق الدفع بالبنوك" : "Payment Methods Bank Linking"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar"
              ? "ربط كل طريقة دفع ببنك لتحويل المبالغ بعد خصم الرسوم"
              : "Link each payment method to a bank for deposits after fee deduction"}
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={!hasChanges || saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving
            ? language === "ar"
              ? "جاري الحفظ..."
              : "Saving..."
            : language === "ar"
            ? "حفظ التغييرات"
            : "Save Changes"}
          {hasChanges && (
            <Badge variant="secondary" className="ml-2">
              {Object.keys(changes).length}
            </Badge>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{paymentMethods.length}</p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "طرق الدفع النشطة" : "Active Payment Methods"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Building2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{banks.length}</p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "البنوك النشطة" : "Active Banks"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Link2 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {paymentMethods.filter((pm) => getCurrentBankId(pm)).length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "طرق دفع مرتبطة" : "Linked Methods"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {language === "ar" ? "جدول ربط طرق الدفع" : "Payment Methods Linking Table"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</TableHead>
                  <TableHead>{language === "ar" ? "البنك المرتبط" : "Linked Bank"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "الحالة" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.map((method) => {
                  const currentBankId = getCurrentBankId(method);
                  const hasChange = changes.hasOwnProperty(method.id);

                  return (
                    <TableRow key={method.id} className={hasChange ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">{method.payment_type?.toUpperCase() || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={currentBankId || "none"}
                          onValueChange={(value) =>
                            handleBankChange(method.id, value === "none" ? null : value)
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder={language === "ar" ? "اختر بنك" : "Select Bank"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <div className="flex items-center gap-2">
                                <Unlink className="h-4 w-4 text-muted-foreground" />
                                {language === "ar" ? "غير مرتبط" : "Not Linked"}
                              </div>
                            </SelectItem>
                            {banks.map((bank) => (
                              <SelectItem key={bank.id} value={bank.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-primary" />
                                  {language === "ar" && bank.bank_name_ar
                                    ? bank.bank_name_ar
                                    : bank.bank_name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        {currentBankId ? (
                          <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30">
                            <Link2 className="h-3 w-3 mr-1" />
                            {language === "ar" ? "مرتبط" : "Linked"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Unlink className="h-3 w-3 mr-1" />
                            {language === "ar" ? "غير مرتبط" : "Not Linked"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {paymentMethods.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              {language === "ar" ? "لا توجد طرق دفع نشطة" : "No active payment methods found"}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {language === "ar" ? "كيف يعمل الربط؟" : "How does linking work?"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            {language === "ar"
              ? "• عند استلام دفعة عبر طريقة دفع مرتبطة ببنك، سيتم إضافة المبلغ الصافي (بعد خصم الرسوم) إلى رصيد البنك."
              : "• When a payment is received via a linked payment method, the net amount (after fees) will be added to the bank balance."}
          </p>
          <p>
            {language === "ar"
              ? "• الرسوم تشمل: رسوم البوابة + القيمة الثابتة + ضريبة القيمة المضافة على الرسوم."
              : "• Fees include: Gateway fee + Fixed value + VAT on fees."}
          </p>
          <p>
            {language === "ar"
              ? "• مثال: لمبلغ 1000 ريال مع رسوم بوابة 2.25% وقيمة ثابتة 1 وضريبة 15%، سيتم إضافة الصافي للبنك."
              : "• Example: For 1000 SAR with 2.25% gateway fee, 1 fixed value, and 15% VAT, the net will be added to the bank."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
