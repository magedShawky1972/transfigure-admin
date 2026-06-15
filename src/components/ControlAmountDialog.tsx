import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ControlAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excelTotal: number;
  onConfirm: (controlAmount: number) => void;
  onCancel: () => void;
}

export const ControlAmountDialog = ({
  open,
  onOpenChange,
  excelTotal,
  onConfirm,
  onCancel,
}: ControlAmountDialogProps) => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [controlAmount, setControlAmount] = useState("");

  const roundedExcelTotal = Math.trunc(excelTotal);
  const enteredAmount = parseInt(controlAmount.replace(/[,\s]/g, '')) || 0;
  const isMatch = enteredAmount > 0 && enteredAmount === roundedExcelTotal;
  const showMismatch = enteredAmount > 0 && !isMatch;
  const difference = enteredAmount - roundedExcelTotal;

  const handleConfirm = () => {
    if (isMatch) {
      onConfirm(enteredAmount);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isAr ? "أدخل مبلغ التحكم" : "Enter Control Amount"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "أدخل المبلغ الإجمالي المتوقع (بدون كسور عشرية) للتحقق من إجمالي ملف Excel قبل الرفع."
              : "Enter the expected total amount (without decimals) to verify against the Excel file total before uploading."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">{isAr ? "إجمالي ملف Excel (بدون كسور)" : "Excel File Total (no decimals)"}</p>
            <p className="text-2xl font-bold text-primary">
              {roundedExcelTotal.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="control-amount">{isAr ? "مبلغ التحكم (بدون كسور)" : "Control Amount (no decimals)"}</Label>
            <Input
              id="control-amount"
              type="text"
              inputMode="numeric"
              placeholder={isAr ? "أدخل مبلغ التحكم..." : "Enter control amount..."}
              value={controlAmount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setControlAmount(val);
              }}
              className={`text-lg font-mono ${
                isMatch ? 'border-green-500 focus-visible:ring-green-500' :
                showMismatch ? 'border-destructive focus-visible:ring-destructive' : ''
              }`}
              autoFocus
            />
          </div>

          {isMatch && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">{isAr ? "الإجماليات متطابقة! جاهز للرفع." : "Totals match! Ready to upload."}</span>
            </div>
          )}

          {showMismatch && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div className="text-sm">
                <p className="font-medium">{isAr ? "تم اكتشاف عدم تطابق!" : "Mismatch detected!"}</p>
                <p>{isAr ? "الفرق:" : "Difference:"} {difference > 0 ? '+' : ''}{difference.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!isMatch}
              className="flex-1"
            >
              {isAr ? "تأكيد والرفع" : "Confirm & Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
