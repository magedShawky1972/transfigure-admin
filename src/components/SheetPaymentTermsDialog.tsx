import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Trash2, Save } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PaymentTerm {
  id?: string;
  payment_date: Date;
  amount: number;
  is_remaining: boolean;
  notes: string;
}

interface SheetPaymentTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetOrderId: string | null;
  totalAmount: number;
  createdByName: string;
}

const SheetPaymentTermsDialog = ({ open, onOpenChange, sheetOrderId, totalAmount, createdByName }: SheetPaymentTermsDialogProps) => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sheetOrderId) {
      fetchTerms();
    }
  }, [open, sheetOrderId]);

  const fetchTerms = async () => {
    if (!sheetOrderId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("coins_sheet_payment_terms")
      .select("*")
      .eq("sheet_order_id", sheetOrderId)
      .order("payment_date", { ascending: true });

    if (data && data.length > 0) {
      setTerms(data.map((t: any) => ({
        id: t.id,
        payment_date: new Date(t.payment_date),
        amount: t.amount,
        is_remaining: t.is_remaining,
        notes: t.notes || "",
      })));
    } else {
      // Default: one row with today's date
      setTerms([{
        payment_date: new Date(),
        amount: 0,
        is_remaining: false,
        notes: "",
      }]);
    }
    setLoading(false);
  };

  const addTerm = () => {
    const lastDate = terms.length > 0 ? terms[terms.length - 1].payment_date : new Date();
    setTerms(prev => [...prev, {
      payment_date: addDays(lastDate, 10),
      amount: 0,
      is_remaining: false,
      notes: "",
    }]);
  };

  const removeTerm = (index: number) => {
    if (terms.length <= 1) return;
    setTerms(prev => prev.filter((_, i) => i !== index));
  };

  const updateTerm = (index: number, field: keyof PaymentTerm, value: any) => {
    setTerms(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // If marking as remaining, clear amount
      if (field === "is_remaining" && value === true) {
        updated[index].amount = 0;
      }
      return updated;
    });
  };

  // Calculate remaining
  const fixedTotal = terms.filter(t => !t.is_remaining).reduce((s, t) => s + t.amount, 0);
  const remainingAmount = totalAmount - fixedTotal;

  const handleSave = async () => {
    if (!sheetOrderId) return;
    setSaving(true);
    try {
      // Delete existing terms
      await supabase.from("coins_sheet_payment_terms").delete().eq("sheet_order_id", sheetOrderId);

      // Insert new terms
      const rows = terms.map(t => ({
        sheet_order_id: sheetOrderId,
        payment_date: format(t.payment_date, "yyyy-MM-dd"),
        amount: t.is_remaining ? remainingAmount : t.amount,
        is_remaining: t.is_remaining,
        notes: t.notes || null,
        created_by: createdByName,
      }));

      const { error } = await supabase.from("coins_sheet_payment_terms").insert(rows);
      if (error) throw error;

      toast.success(isArabic ? "تم حفظ شروط الدفع" : "Payment terms saved");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isArabic ? "شروط الدفع" : "Payment Terms"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Total display */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2">
              <span className="text-sm font-medium text-muted-foreground">{isArabic ? "إجمالي المبلغ (USD)" : "Total Amount (USD)"}</span>
              <span className="text-lg font-bold">${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{isArabic ? "تاريخ الدفع" : "Payment Date"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ (USD)" : "Amount (USD)"}</TableHead>
                  <TableHead className="text-center">{isArabic ? "المتبقي" : "Remaining"}</TableHead>
                  <TableHead>{isArabic ? "ملاحظات" : "Notes"}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("min-w-[140px] justify-start text-left font-normal h-9 text-xs", !term.payment_date && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {term.payment_date ? format(term.payment_date, "yyyy-MM-dd") : (isArabic ? "التاريخ" : "Date")}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={term.payment_date}
                            onSelect={(date) => date && updateTerm(index, "payment_date", date)}
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      {term.is_remaining ? (
                        <div className="min-w-[100px] h-9 flex items-center px-3 rounded-md bg-muted text-sm font-semibold text-green-600">
                          ${remainingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          value={term.amount || ""}
                          onChange={e => updateTerm(index, "amount", parseFloat(e.target.value) || 0)}
                          className="min-w-[100px]"
                          placeholder="0.00"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={term.is_remaining}
                        onCheckedChange={(checked) => updateTerm(index, "is_remaining", !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={term.notes}
                        onChange={e => updateTerm(index, "notes", e.target.value)}
                        placeholder={isArabic ? "ملاحظات" : "Notes"}
                        className="min-w-[100px]"
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeTerm(index)} disabled={terms.length <= 1}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Summary row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={2} className="text-end">{isArabic ? "الإجمالي" : "Total"}</TableCell>
                  <TableCell>
                    <span className={cn(
                      "text-sm font-bold",
                      Math.abs((fixedTotal + (terms.some(t => t.is_remaining) ? remainingAmount : 0)) - totalAmount) < 0.01
                        ? "text-green-600" : "text-destructive"
                    )}>
                      ${(fixedTotal + (terms.some(t => t.is_remaining) ? remainingAmount : 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell colSpan={3}></TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Button variant="outline" size="sm" onClick={addTerm}>
              <Plus className="h-4 w-4 mr-1" />
              {isArabic ? "إضافة دفعة" : "Add Payment"}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "..." : (isArabic ? "حفظ" : "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SheetPaymentTermsDialog;
