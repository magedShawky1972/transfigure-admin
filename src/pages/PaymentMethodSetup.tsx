import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { z } from "zod";

interface PaymentMethod {
  id: string;
  payment_type: string;
  payment_method: string;
  gateway_fee: number;
  fixed_value: number;
  vat_fee: number;
  is_active: boolean;
}

const paymentMethodSchema = z.object({
  payment_type: z.string().trim().min(1, { message: "Payment method is required" }).max(100),
  payment_method: z.string().trim().min(1, { message: "Payment brand is required" }).max(100),
  gateway_fee: z.number().min(0, { message: "Gateway fee must be 0 or greater" }),
  fixed_value: z.number().min(0, { message: "Fixed value must be 0 or greater" }),
  vat_fee: z.number().min(0, { message: "VAT fee must be 0 or greater" }),
});

const PaymentMethodSetup = () => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [newMethod, setNewMethod] = useState({
    payment_type: "",
    payment_method: "",
    gateway_fee: 0,
    fixed_value: 0,
    vat_fee: 0,
  });

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("is_active", true)
        .order("payment_method", { ascending: true });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar"
            ? "فشل في تحميل طرق الدفع"
            : "Failed to load payment methods",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMethod = async (method: PaymentMethod) => {
    try {
      // Validate input
      paymentMethodSchema.parse({
        payment_type: method.payment_type,
        payment_method: method.payment_method,
        gateway_fee: method.gateway_fee,
        fixed_value: method.fixed_value,
        vat_fee: method.vat_fee,
      });

      const { error } = await supabase
        .from("payment_methods")
        .update({
          payment_type: method.payment_type,
          payment_method: method.payment_method,
          gateway_fee: method.gateway_fee,
          fixed_value: method.fixed_value,
          vat_fee: method.vat_fee,
        })
        .eq("id", method.id);

      if (error) throw error;

      toast({
        title: language === "ar" ? "نجاح" : "Success",
        description:
          language === "ar"
            ? "تم تحديث طريقة الدفع بنجاح"
            : "Payment method updated successfully",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: language === "ar" ? "خطأ في التحقق" : "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Error updating payment method:", error);
        toast({
          title: language === "ar" ? "خطأ" : "Error",
          description:
            language === "ar"
              ? "فشل في تحديث طريقة الدفع"
              : "Failed to update payment method",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddMethod = async () => {
    try {
      // Validate input
      paymentMethodSchema.parse(newMethod);

      const { error } = await supabase
        .from("payment_methods")
        .insert([newMethod]);

      if (error) throw error;

      toast({
        title: language === "ar" ? "نجاح" : "Success",
        description:
          language === "ar"
            ? "تم إضافة طريقة الدفع بنجاح"
            : "Payment method added successfully",
      });

      setNewMethod({
        payment_type: "",
        payment_method: "",
        gateway_fee: 0,
        fixed_value: 0,
        vat_fee: 0,
      });

      fetchPaymentMethods();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: language === "ar" ? "خطأ في التحقق" : "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Error adding payment method:", error);
        toast({
          title: language === "ar" ? "خطأ" : "Error",
          description:
            language === "ar"
              ? "فشل في إضافة طريقة الدفع"
              : "Failed to add payment method",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteMethod = async (id: string) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: language === "ar" ? "نجاح" : "Success",
        description:
          language === "ar"
            ? "تم حذف طريقة الدفع بنجاح"
            : "Payment method deleted successfully",
      });

      fetchPaymentMethods();
    } catch (error) {
      console.error("Error deleting payment method:", error);
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description:
          language === "ar"
            ? "فشل في حذف طريقة الدفع"
            : "Failed to delete payment method",
        variant: "destructive",
      });
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);

      for (const method of paymentMethods) {
        await handleUpdateMethod(method);
      }

      toast({
        title: language === "ar" ? "نجاح" : "Success",
        description:
          language === "ar"
            ? "تم حفظ جميع التغييرات بنجاح"
            : "All changes saved successfully",
      });
    } catch (error) {
      console.error("Error saving all changes:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">
          {language === "ar" ? "إعداد طرق الدفع" : "Payment Method Setup"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar"
            ? "إدارة رسوم طرق الدفع المختلفة"
            : "Manage payment method fees"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar" ? "عمولات البنوك" : "Bank Commissions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="grid grid-cols-6 gap-4 font-semibold text-sm pb-2 border-b">
                <div className={language === "ar" ? "text-right" : ""}>
                  {language === "ar" ? "طريقة الدفع" : "Payment Method"}
                </div>
                <div className={language === "ar" ? "text-right" : ""}>
                  {language === "ar" ? "علامة الدفع التجارية" : "Payment Brand"}
                </div>
                <div className={language === "ar" ? "text-right" : ""}>
                  {language === "ar" ? "رسوم البوابة %" : "Gateway Fee %"}
                </div>
                <div className={language === "ar" ? "text-right" : ""}>
                  {language === "ar" ? "القيمة الثابتة" : "Fixed Value"}
                </div>
                <div className={language === "ar" ? "text-right" : ""}>
                  {language === "ar" ? "رسوم القيمة المضافة %" : "VAT Fee %"}
                </div>
                <div className={language === "ar" ? "text-right" : ""}>
                  {language === "ar" ? "إجراءات" : "Actions"}
                </div>
              </div>

              {/* Existing Payment Methods */}
              {paymentMethods.map((method) => (
                <div key={method.id} className="grid grid-cols-6 gap-4 items-center">
                  <Input
                    value={method.payment_type || ""}
                    onChange={(e) => {
                      setPaymentMethods((prev) =>
                        prev.map((m) =>
                          m.id === method.id ? { ...m, payment_type: e.target.value } : m
                        )
                      );
                    }}
                    placeholder={language === "ar" ? "نوع الدفع" : "Payment type"}
                  />
                  <Input
                    value={method.payment_method}
                    onChange={(e) => {
                      setPaymentMethods((prev) =>
                        prev.map((m) =>
                          m.id === method.id ? { ...m, payment_method: e.target.value } : m
                        )
                      );
                    }}
                    placeholder={language === "ar" ? "علامة الدفع" : "Payment brand"}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={method.gateway_fee}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setPaymentMethods((prev) =>
                        prev.map((m) =>
                          m.id === method.id ? { ...m, gateway_fee: isNaN(value) ? 0 : value } : m
                        )
                      );
                    }}
                    className="text-right"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={method.fixed_value}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setPaymentMethods((prev) =>
                        prev.map((m) =>
                          m.id === method.id ? { ...m, fixed_value: isNaN(value) ? 0 : value } : m
                        )
                      );
                    }}
                    className="text-right"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={method.vat_fee}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setPaymentMethods((prev) =>
                        prev.map((m) =>
                          m.id === method.id ? { ...m, vat_fee: isNaN(value) ? 0 : value } : m
                        )
                      );
                    }}
                    className="text-right"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      onClick={() => handleUpdateMethod(method)}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteMethod(method.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add New Method */}
              <div className="grid grid-cols-6 gap-4 items-center pt-4 border-t">
                <Input
                  placeholder={language === "ar" ? "نوع الدفع" : "Payment method"}
                  value={newMethod.payment_type}
                  onChange={(e) =>
                    setNewMethod((prev) => ({
                      ...prev,
                      payment_type: e.target.value,
                    }))
                  }
                />
                <Input
                  placeholder={language === "ar" ? "علامة الدفع التجارية" : "Payment brand"}
                  value={newMethod.payment_method}
                  onChange={(e) =>
                    setNewMethod((prev) => ({
                      ...prev,
                      payment_method: e.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newMethod.gateway_fee}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setNewMethod((prev) => ({
                      ...prev,
                      gateway_fee: isNaN(value) ? 0 : value,
                    }));
                  }}
                  className="text-right"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={newMethod.fixed_value}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setNewMethod((prev) => ({
                      ...prev,
                      fixed_value: isNaN(value) ? 0 : value,
                    }));
                  }}
                  className="text-right"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={newMethod.vat_fee}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setNewMethod((prev) => ({
                      ...prev,
                      vat_fee: isNaN(value) ? 0 : value,
                    }));
                  }}
                  className="text-right"
                />
                <Button onClick={handleAddMethod} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={fetchPaymentMethods}>
                  {language === "ar" ? "الغاء" : "Cancel"}
                </Button>
                <Button onClick={handleSaveAll} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {language === "ar" ? "جاري الحفظ..." : "Saving..."}
                    </>
                  ) : (
                    language === "ar" ? "حفظ التعديلات" : "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentMethodSetup;
