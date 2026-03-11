import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Trash2, Save } from "lucide-react";
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
  lineId: string | null;
  lineAmount: number;
  sellerName: string;
  createdByName: string;
}

const SheetPaymentTermsDialog = ({ open, onOpenChange, sheetOrderId, lineId, lineAmount, sellerName, createdByName }: SheetPaymentTermsDialogProps) => {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const amountRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open && lineId) {
      fetchTerms();
    }
  }, [open, lineId]);

  const fetchTerms = async () => {
    if (!lineId) return;
    setLoading(true);
    const { data } = await supabase
      .from("coins_sheet_payment_terms")
      .select("*")
      .eq("line_id", lineId)
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
      setTerms([{
        payment_date: new Date(),
        amount: 0,
        is_remaining: false,
        notes: "",
      }]);
    }
    setLoading(false);
  };

  const getRunningRemaining = (upToIndex: number): number => {
    let used = 0;
    for (let i = 0; i <= upToIndex; i++) {
      if (!terms[i].is_remaining) used += terms[i].amount;
    }
    return lineAmount - used;
  };

  const totalEntered = terms.reduce((s, t) => s + (t.is_remaining ? 0 : t.amount), 0);
  const globalRemaining = lineAmount - totalEntered;
  const isFullyAllocated = Math.abs(globalRemaining) < 0.01;

  const addTermWithRemaining = () => {
    const lastDate = terms.length > 0 ? terms[terms.length - 1].payment_date : new Date();
    const rem = globalRemaining;
    setTerms(prev => [...prev, {
      payment_date: addDays(lastDate, 10),
      amount: rem > 0 ? parseFloat(rem.toFixed(2)) : 0,
      is_remaining: false,
      notes: "",
    }]);
    // Focus new row's amount after render
    setTimeout(() => {
      amountRefs.current[terms.length]?.focus();
    }, 100);
  };

  const removeTerm = (index: number) => {
    if (terms.length <= 1) return;
    setTerms(prev => prev.filter((_, i) => i !== index));
  };

  const updateTerm = (index: number, field: keyof PaymentTerm, value: any) => {
    setTerms(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Recalculate remaining after current state
      const currentTotal = terms.reduce((s, t, i) => {
        if (i === index) return s + (parseFloat((e.target as HTMLInputElement).value) || 0);
        return s + (t.is_remaining ? 0 : t.amount);
      }, 0);
      const rem = lineAmount - currentTotal;

      if (Math.abs(rem) < 0.01) {
        // Fully allocated → save
        handleSave();
      } else if (rem > 0) {
        // Add new line with remaining
        addTermWithRemaining();
      }
    }
  };

  const handleSave = async () => {
    if (!lineId || !sheetOrderId) return;
    setSaving(true);
    try {
      await supabase.from("coins_sheet_payment_terms").delete().eq("line_id", lineId);

      const rows = terms.map(t => ({
        sheet_order_id: sheetOrderId,
        line_id: lineId,
        payment_date: format(t.payment_date, "yyyy-MM-dd"),
        amount: t.amount,
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
          <DialogTitle>
            {isArabic ? "شروط الدفع" : "Payment Terms"}
            {sellerName && <span className="text-muted-foreground text-sm font-normal ml-2">— {sellerName}</span>}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header: Line amount + Remaining */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 bg-muted/50 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{isArabic ? "مبلغ السطر (USD)" : "Line Amount (USD)"}</span>
                <span className="text-lg font-bold">${lineAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={cn(
                "flex-1 rounded-lg px-4 py-2 flex items-center justify-between",
                isFullyAllocated ? "bg-primary/10" : "bg-destructive/10"
              )}>
                <span className="text-sm font-medium text-muted-foreground">{isArabic ? "المتبقي" : "Remaining"}</span>
                <span className={cn("text-lg font-bold", isFullyAllocated ? "text-primary" : "text-destructive")}>
                  ${globalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{isArabic ? "تاريخ الدفع" : "Payment Date"}</TableHead>
                  <TableHead>{isArabic ? "المبلغ (USD)" : "Amount (USD)"}</TableHead>
                  <TableHead>{isArabic ? "المتبقي بعد" : "Remaining After"}</TableHead>
                  <TableHead>{isArabic ? "ملاحظات" : "Notes"}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms.map((term, index) => {
                  const remainingAfter = getRunningRemaining(index);
                  const rowHasIssue = !isFullyAllocated && index === terms.length - 1 && remainingAfter > 0.01;
                  return (
                    <TableRow key={index} className={cn(rowHasIssue && "bg-destructive/10")}>
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
                        <Input
                          ref={el => { amountRefs.current[index] = el; }}
                          type="number"
                          value={term.amount || ""}
                          onChange={e => updateTerm(index, "amount", parseFloat(e.target.value) || 0)}
                          onKeyDown={e => handleAmountKeyDown(e, index)}
                          className="min-w-[100px]"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-sm font-semibold",
                          remainingAfter < -0.01 ? "text-destructive" : remainingAfter < 0.01 ? "text-primary" : "text-muted-foreground"
                        )}>
                          ${remainingAfter.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
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
                  );
                })}
                {/* Total row */}
                <TableRow className={cn("font-bold", isFullyAllocated ? "bg-muted/50" : "bg-destructive/10")}>
                  <TableCell colSpan={2} className="text-end">{isArabic ? "الإجمالي" : "Total"}</TableCell>
                  <TableCell>
                    <span className={cn("text-sm font-bold", isFullyAllocated ? "text-primary" : "text-destructive")}>
                      ${totalEntered.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-sm font-bold", isFullyAllocated ? "text-primary" : "text-destructive")}>
                      ${globalRemaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <p className="text-xs text-muted-foreground">
              {isArabic 
                ? "💡 اضغط Enter في حقل المبلغ لإضافة سطر جديد بالمتبقي تلقائياً، أو للحفظ إذا تم توزيع المبلغ بالكامل"
                : "💡 Press Enter in amount field to auto-add a new row with remaining, or to save if fully allocated"}
            </p>
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
