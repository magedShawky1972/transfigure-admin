import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, DollarSign, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
interface Currency {
  id: string;
  currency_code: string;
  currency_name: string;
  currency_name_ar: string | null;
  symbol: string | null;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CurrencyRate {
  id: string;
  currency_id: string;
  rate_to_base: number;
  conversion_operator: 'multiply' | 'divide';
  effective_date: string;
  created_at: string;
  updated_at: string;
}

const CurrencySetup = () => {
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<CurrencyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Currency dialog state
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
  const [currencyForm, setCurrencyForm] = useState({
    currency_code: "",
    currency_name: "",
    currency_name_ar: "",
    symbol: "",
    is_base: false,
    is_active: true,
  });

  // Rate dialog state
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CurrencyRate | null>(null);
  const [rateForm, setRateForm] = useState({
    currency_id: "",
    rate_to_base: "",
    conversion_operator: "multiply" as 'multiply' | 'divide',
    effective_date: new Date().toISOString().split("T")[0],
  });

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCurrency, setDeletingCurrency] = useState<Currency | null>(null);

  const translations = {
    title: isArabic ? "إعداد العملات" : "Currency Setup",
    currencies: isArabic ? "العملات" : "Currencies",
    conversionRates: isArabic ? "أسعار الصرف" : "Conversion Rates",
    addCurrency: isArabic ? "إضافة عملة" : "Add Currency",
    addRate: isArabic ? "إضافة سعر صرف" : "Add Rate",
    currencyCode: isArabic ? "رمز العملة" : "Currency Code",
    currencyName: isArabic ? "اسم العملة" : "Currency Name",
    currencyNameAr: isArabic ? "اسم العملة (عربي)" : "Currency Name (Arabic)",
    symbol: isArabic ? "الرمز" : "Symbol",
    isBase: isArabic ? "العملة الأساسية" : "Base Currency",
    isActive: isArabic ? "نشط" : "Active",
    rate: isArabic ? "سعر الصرف" : "Rate",
    effectiveDate: isArabic ? "تاريخ السريان" : "Effective Date",
    actions: isArabic ? "الإجراءات" : "Actions",
    save: isArabic ? "حفظ" : "Save",
    cancel: isArabic ? "إلغاء" : "Cancel",
    edit: isArabic ? "تعديل" : "Edit",
    delete: isArabic ? "حذف" : "Delete",
    editCurrency: isArabic ? "تعديل العملة" : "Edit Currency",
    newCurrency: isArabic ? "عملة جديدة" : "New Currency",
    editRate: isArabic ? "تعديل سعر الصرف" : "Edit Rate",
    newRate: isArabic ? "سعر صرف جديد" : "New Rate",
    selectCurrency: isArabic ? "اختر العملة" : "Select Currency",
    deleteConfirmTitle: isArabic ? "تأكيد الحذف" : "Confirm Delete",
    deleteConfirmMessage: isArabic
      ? "هل أنت متأكد من حذف هذه العملة؟ سيتم حذف جميع أسعار الصرف المرتبطة بها."
      : "Are you sure you want to delete this currency? All associated rates will be deleted.",
    yes: isArabic ? "نعم" : "Yes",
    no: isArabic ? "لا" : "No",
    baseCurrencyNote: isArabic
      ? "جميع أسعار الصرف مرتبطة بالعملة الأساسية"
      : "All rates are relative to the base currency",
    noBaseCurrency: isArabic
      ? "لم يتم تحديد عملة أساسية"
      : "No base currency selected",
    currency: isArabic ? "العملة" : "Currency",
    operator: isArabic ? "العملية" : "Operator",
    multiply: isArabic ? "ضرب" : "Multiply",
    divide: isArabic ? "قسمة" : "Divide",
    operatorNote: isArabic
      ? "ضرب: المبلغ × السعر | قسمة: المبلغ ÷ السعر"
      : "Multiply: Amount × Rate | Divide: Amount ÷ Rate",
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [currenciesRes, ratesRes] = await Promise.all([
        supabase.from("currencies").select("*").order("currency_code"),
        supabase.from("currency_rates").select("*").order("effective_date", { ascending: false }),
      ]);

      if (currenciesRes.error) throw currenciesRes.error;
      if (ratesRes.error) throw ratesRes.error;

      setCurrencies(currenciesRes.data || []);
      setRates((ratesRes.data || []).map(r => ({
        ...r,
        conversion_operator: (r.conversion_operator === 'divide' ? 'divide' : 'multiply') as 'multiply' | 'divide'
      })));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetCurrencyForm = () => {
    setCurrencyForm({
      currency_code: "",
      currency_name: "",
      currency_name_ar: "",
      symbol: "",
      is_base: false,
      is_active: true,
    });
    setEditingCurrency(null);
  };

  const resetRateForm = () => {
    setRateForm({
      currency_id: "",
      rate_to_base: "",
      conversion_operator: "multiply",
      effective_date: new Date().toISOString().split("T")[0],
    });
    setEditingRate(null);
  };

  const handleCurrencySubmit = async () => {
    if (!currencyForm.currency_code || !currencyForm.currency_name) {
      toast.error(isArabic ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingCurrency) {
        const { error } = await supabase
          .from("currencies")
          .update({
            currency_code: currencyForm.currency_code,
            currency_name: currencyForm.currency_name,
            currency_name_ar: currencyForm.currency_name_ar || null,
            symbol: currencyForm.symbol || null,
            is_base: currencyForm.is_base,
            is_active: currencyForm.is_active,
          })
          .eq("id", editingCurrency.id);

        if (error) throw error;
        toast.success(isArabic ? "تم تحديث العملة بنجاح" : "Currency updated successfully");
      } else {
        const { error } = await supabase.from("currencies").insert({
          currency_code: currencyForm.currency_code,
          currency_name: currencyForm.currency_name,
          currency_name_ar: currencyForm.currency_name_ar || null,
          symbol: currencyForm.symbol || null,
          is_base: currencyForm.is_base,
          is_active: currencyForm.is_active,
        });

        if (error) throw error;
        toast.success(isArabic ? "تم إضافة العملة بنجاح" : "Currency added successfully");
      }

      setCurrencyDialogOpen(false);
      resetCurrencyForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRateSubmit = async () => {
    if (!rateForm.currency_id || !rateForm.rate_to_base || !rateForm.effective_date) {
      toast.error(isArabic ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields");
      return;
    }

    setSaving(true);
    try {
      if (editingRate) {
        const { error } = await supabase
          .from("currency_rates")
          .update({
            currency_id: rateForm.currency_id,
            rate_to_base: parseFloat(rateForm.rate_to_base),
            conversion_operator: rateForm.conversion_operator,
            effective_date: rateForm.effective_date,
          })
          .eq("id", editingRate.id);

        if (error) throw error;
        toast.success(isArabic ? "تم تحديث سعر الصرف بنجاح" : "Rate updated successfully");
      } else {
        const { error } = await supabase.from("currency_rates").insert({
          currency_id: rateForm.currency_id,
          rate_to_base: parseFloat(rateForm.rate_to_base),
          conversion_operator: rateForm.conversion_operator,
          effective_date: rateForm.effective_date,
        });

        if (error) throw error;
        toast.success(isArabic ? "تم إضافة سعر الصرف بنجاح" : "Rate added successfully");
      }

      setRateDialogOpen(false);
      resetRateForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditCurrency = (currency: Currency) => {
    setEditingCurrency(currency);
    setCurrencyForm({
      currency_code: currency.currency_code,
      currency_name: currency.currency_name,
      currency_name_ar: currency.currency_name_ar || "",
      symbol: currency.symbol || "",
      is_base: currency.is_base,
      is_active: currency.is_active,
    });
    setCurrencyDialogOpen(true);
  };

  const handleDeleteCurrency = async () => {
    if (!deletingCurrency) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("currencies")
        .delete()
        .eq("id", deletingCurrency.id);

      if (error) throw error;
      toast.success(isArabic ? "تم حذف العملة بنجاح" : "Currency deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingCurrency(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditRate = (rate: CurrencyRate) => {
    setEditingRate(rate);
    setRateForm({
      currency_id: rate.currency_id,
      rate_to_base: rate.rate_to_base.toString(),
      conversion_operator: rate.conversion_operator || 'multiply',
      effective_date: rate.effective_date,
    });
    setRateDialogOpen(true);
  };

  const handleDeleteRate = async (rateId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("currency_rates").delete().eq("id", rateId);
      if (error) throw error;
      toast.success(isArabic ? "تم حذف سعر الصرف بنجاح" : "Rate deleted successfully");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const baseCurrency = currencies.find((c) => c.is_base);
  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency
      ? isArabic && currency.currency_name_ar
        ? currency.currency_name_ar
        : currency.currency_name
      : "";
  };

  const getCurrencyCode = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency?.currency_code || "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${isArabic ? "rtl" : "ltr"}`} dir={isArabic ? "rtl" : "ltr"}>
      {saving && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <DollarSign className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">{translations.title}</h1>
      </div>

      {/* Base Currency Note */}
      <div className="bg-muted p-4 rounded-lg">
        <p className="text-sm text-muted-foreground">
          {baseCurrency ? (
            <>
              {translations.baseCurrencyNote}:{" "}
              <strong>
                {baseCurrency.currency_code} -{" "}
                {isArabic && baseCurrency.currency_name_ar
                  ? baseCurrency.currency_name_ar
                  : baseCurrency.currency_name}
              </strong>
            </>
          ) : (
            translations.noBaseCurrency
          )}
        </p>
      </div>

      {/* Currencies Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{translations.currencies}</h2>
          <Button
            onClick={() => {
              resetCurrencyForm();
              setCurrencyDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {translations.addCurrency}
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translations.currencyCode}</TableHead>
                <TableHead>{translations.currencyName}</TableHead>
                <TableHead>{translations.symbol}</TableHead>
                <TableHead>{translations.isBase}</TableHead>
                <TableHead>{translations.isActive}</TableHead>
                <TableHead>{translations.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-medium">{currency.currency_code}</TableCell>
                  <TableCell>
                    {isArabic && currency.currency_name_ar
                      ? currency.currency_name_ar
                      : currency.currency_name}
                  </TableCell>
                  <TableCell>{currency.symbol}</TableCell>
                  <TableCell>
                    <Checkbox checked={currency.is_base} disabled />
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={currency.is_active} disabled />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditCurrency(currency)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingCurrency(currency);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {currencies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {isArabic ? "لا توجد عملات" : "No currencies found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Conversion Rates Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">{translations.conversionRates}</h2>
          <Button
            onClick={() => {
              resetRateForm();
              setRateDialogOpen(true);
            }}
            disabled={currencies.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            {translations.addRate}
          </Button>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{translations.currency}</TableHead>
                <TableHead>{translations.currencyCode}</TableHead>
                <TableHead>{translations.rate}</TableHead>
                <TableHead>{translations.operator}</TableHead>
                <TableHead>{translations.effectiveDate}</TableHead>
                <TableHead>{translations.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>{getCurrencyName(rate.currency_id)}</TableCell>
                  <TableCell className="font-medium">{getCurrencyCode(rate.currency_id)}</TableCell>
                  <TableCell>{rate.rate_to_base}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rate.conversion_operator === 'multiply' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    }`}>
                      {rate.conversion_operator === 'multiply' ? translations.multiply : translations.divide}
                    </span>
                  </TableCell>
                  <TableCell>{rate.effective_date}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEditRate(rate)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRate(rate.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {isArabic ? "لا توجد أسعار صرف" : "No rates found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Currency Dialog */}
      <Dialog open={currencyDialogOpen} onOpenChange={setCurrencyDialogOpen}>
        <DialogContent className={isArabic ? "rtl" : "ltr"} dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingCurrency ? translations.editCurrency : translations.newCurrency}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translations.currencyCode} *</Label>
              <Input
                value={currencyForm.currency_code}
                onChange={(e) =>
                  setCurrencyForm({ ...currencyForm, currency_code: e.target.value.toUpperCase() })
                }
                placeholder="USD, EUR, SAR..."
                maxLength={3}
              />
            </div>
            <div>
              <Label>{translations.currencyName} *</Label>
              <Input
                value={currencyForm.currency_name}
                onChange={(e) =>
                  setCurrencyForm({ ...currencyForm, currency_name: e.target.value })
                }
                placeholder={isArabic ? "مثال: دولار أمريكي" : "e.g., US Dollar"}
              />
            </div>
            <div>
              <Label>{translations.currencyNameAr}</Label>
              <Input
                value={currencyForm.currency_name_ar}
                onChange={(e) =>
                  setCurrencyForm({ ...currencyForm, currency_name_ar: e.target.value })
                }
                placeholder="مثال: دولار أمريكي"
                dir="rtl"
              />
            </div>
            <div>
              <Label>{translations.symbol}</Label>
              <Input
                value={currencyForm.symbol}
                onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                placeholder="$, €, ر.س..."
                maxLength={5}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_base"
                checked={currencyForm.is_base}
                onCheckedChange={(checked) =>
                  setCurrencyForm({ ...currencyForm, is_base: checked as boolean })
                }
              />
              <Label htmlFor="is_base">{translations.isBase}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={currencyForm.is_active}
                onCheckedChange={(checked) =>
                  setCurrencyForm({ ...currencyForm, is_active: checked as boolean })
                }
              />
              <Label htmlFor="is_active">{translations.isActive}</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCurrencyDialogOpen(false)}>
                {translations.cancel}
              </Button>
              <Button onClick={handleCurrencySubmit} disabled={saving}>
                {translations.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rate Dialog */}
      <Dialog open={rateDialogOpen} onOpenChange={setRateDialogOpen}>
        <DialogContent className={isArabic ? "rtl" : "ltr"} dir={isArabic ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editingRate ? translations.editRate : translations.newRate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{translations.currency} *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rateForm.currency_id}
                onChange={(e) => setRateForm({ ...rateForm, currency_id: e.target.value })}
              >
                <option value="">{translations.selectCurrency}</option>
                {currencies
                  .filter((c) => !c.is_base)
                  .map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.currency_code} -{" "}
                      {isArabic && currency.currency_name_ar
                        ? currency.currency_name_ar
                        : currency.currency_name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label>{translations.rate} *</Label>
              <Input
                type="number"
                step="0.0001"
                value={rateForm.rate_to_base}
                onChange={(e) => setRateForm({ ...rateForm, rate_to_base: e.target.value })}
                placeholder="1.0000"
              />
            </div>
            <div>
              <Label>{translations.operator} *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rateForm.conversion_operator}
                onChange={(e) => setRateForm({ ...rateForm, conversion_operator: e.target.value as 'multiply' | 'divide' })}
              >
                <option value="multiply">{translations.multiply}</option>
                <option value="divide">{translations.divide}</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">{translations.operatorNote}</p>
            </div>
            <div>
              <Label>{translations.effectiveDate} *</Label>
              <Input
                type="date"
                value={rateForm.effective_date}
                onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRateDialogOpen(false)}>
                {translations.cancel}
              </Button>
              <Button onClick={handleRateSubmit} disabled={saving}>
                {translations.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{translations.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{translations.deleteConfirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{translations.no}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCurrency}>{translations.yes}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CurrencySetup;
