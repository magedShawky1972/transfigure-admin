import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPrintLogoUrl } from "@/lib/printLogo";

interface ExpenseEntryPrintButtonProps {
  requestNumber: string;
  language: string;
}

interface ExpenseEntryLine {
  line_number: number;
  expense_type_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  vat_percent: number;
  vat_amount: number;
  line_total: number;
}

interface ExpenseType {
  id: string;
  expense_name: string;
  expense_name_ar: string | null;
}

export const ExpenseEntryPrintButton = ({ requestNumber, language }: ExpenseEntryPrintButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      // Fetch expense entry by reference
      const { data: entry, error: entryError } = await supabase
        .from("expense_entries")
        .select("*")
        .eq("expense_reference", requestNumber)
        .maybeSingle();

      if (entryError) throw entryError;
      if (!entry) {
        toast.error(language === "ar" ? "لم يتم العثور على قيد المصروف" : "Expense entry not found");
        return;
      }

      // Fetch expense entry lines
      const { data: lines, error: linesError } = await supabase
        .from("expense_entry_lines")
        .select("*")
        .eq("expense_entry_id", entry.id)
        .order("line_number");

      if (linesError) throw linesError;

      // Fetch expense types
      const { data: expenseTypes } = await supabase
        .from("expense_types")
        .select("id, expense_name, expense_name_ar");

      // Fetch related data
      const [bankRes, treasuryRes, currencyRes, profileRes] = await Promise.all([
        entry.bank_id ? supabase.from("banks").select("bank_name").eq("id", entry.bank_id).single() : null,
        entry.treasury_id ? supabase.from("treasuries").select("treasury_name").eq("id", entry.treasury_id).single() : null,
        entry.currency_id ? supabase.from("currencies").select("currency_code").eq("id", entry.currency_id).single() : null,
        entry.created_by ? supabase.from("profiles").select("user_name").eq("id", entry.created_by).single() : null,
      ]);

      const bankName = bankRes?.data?.bank_name || "-";
      const treasuryName = treasuryRes?.data?.treasury_name || "-";
      const currencyCode = currencyRes?.data?.currency_code || "SAR";
      const createdBy = profileRes?.data?.user_name || "-";

      // Generate print HTML
      const isRtl = language === "ar";
      const printHtml = generatePrintHtml({
        language,
        isRtl,
        entryNumber: entry.entry_number,
        entryDate: entry.entry_date,
        expenseReference: entry.expense_reference || "",
        paymentMethod: entry.payment_method as "bank" | "treasury",
        bankName,
        treasuryName,
        currencyCode,
        exchangeRate: entry.exchange_rate || 1,
        lines: lines || [],
        expenseTypes: expenseTypes || [],
        subtotal: entry.subtotal || 0,
        totalVat: entry.total_vat || 0,
        grandTotal: entry.grand_total || 0,
        notes: entry.notes || "",
        createdBy,
        status: entry.status || "draft",
      });

      // Open print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error(language === "ar" ? "تعذر فتح نافذة الطباعة" : "Could not open print window");
        return;
      }

      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Error printing expense entry:", error);
      toast.error(language === "ar" ? "خطأ في طباعة قيد المصروف" : "Error printing expense entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handlePrint}
      disabled={loading}
      title={language === "ar" ? "طباعة المصروف" : "Print Expense"}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <FileCheck className="h-4 w-4 mr-1" />
      )}
      {language === "ar" ? "طباعة المصروف" : "Print Expense"}
    </Button>
  );
};

interface PrintData {
  language: string;
  isRtl: boolean;
  entryNumber: string;
  entryDate: string;
  expenseReference: string;
  paymentMethod: "bank" | "treasury";
  bankName: string;
  treasuryName: string;
  currencyCode: string;
  exchangeRate: number;
  lines: ExpenseEntryLine[];
  expenseTypes: ExpenseType[];
  subtotal: number;
  totalVat: number;
  grandTotal: number;
  notes: string;
  createdBy: string;
  status: string;
}

function generatePrintHtml(data: PrintData): string {
  const {
    language,
    isRtl,
    entryNumber,
    entryDate,
    expenseReference,
    paymentMethod,
    bankName,
    treasuryName,
    currencyCode,
    exchangeRate,
    lines,
    expenseTypes,
    subtotal,
    totalVat,
    grandTotal,
    notes,
    createdBy,
    status,
  } = data;

  const formatNumber = (num: number) =>
    num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getExpenseTypeName = (typeId: string) => {
    const type = expenseTypes.find((t) => t.id === typeId);
    if (!type) return "-";
    return language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name;
  };

  const getStatusLabel = () => {
    if (status === "draft") return isRtl ? "مسودة" : "DRAFT";
    if (status === "pending") return isRtl ? "معلق" : "PENDING";
    if (status === "approved") return isRtl ? "معتمد" : "APPROVED";
    if (status === "posted") return isRtl ? "مدفوع" : "PAID";
    return "";
  };

  const getStatusColor = () => {
    if (status === "draft") return "#ef4444";
    if (status === "pending") return "#f59e0b";
    if (status === "approved") return "#3b82f6";
    if (status === "posted") return "#22c55e";
    return "#6b7280";
  };

  const linesHtml = lines
    .map(
      (line) => `
      <tr>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${line.line_number}</td>
        <td style="border: 1px solid #000; padding: 8px;">${getExpenseTypeName(line.expense_type_id)}</td>
        <td style="border: 1px solid #000; padding: 8px;">${line.description || "-"}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${line.quantity}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-family: monospace;">${formatNumber(line.unit_price)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-family: monospace;">${formatNumber(line.total)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${line.vat_percent}%</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-family: monospace;">${formatNumber(line.vat_amount)}</td>
        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-family: monospace; font-weight: bold;">${formatNumber(line.line_total)}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html dir="${isRtl ? "rtl" : "ltr"}">
    <head>
      <title>${isRtl ? "طلب صرف" : "Expense Payment Voucher"} - ${entryNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          direction: ${isRtl ? "rtl" : "ltr"};
          background: white;
          color: #000;
        }
        .voucher {
          max-width: 800px;
          margin: 0 auto;
          padding: 30px;
          position: relative;
          overflow: hidden;
        }
        .ribbon {
          position: absolute;
          top: 30px;
          right: -40px;
          width: 180px;
          text-align: center;
          transform: rotate(45deg);
          background-color: ${getStatusColor()};
          color: white;
          padding: 8px 0;
          font-weight: bold;
          font-size: 14px;
          text-transform: uppercase;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          letter-spacing: 1px;
          z-index: 10;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0; color: #666; }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .info-box {
          border: 1px solid #000;
          padding: 8px;
        }
        .info-box .label { font-weight: bold; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          background: #f0f0f0;
          border: 1px solid #000;
          padding: 8px;
        }
        .totals-table {
          width: 280px;
          margin-${isRtl ? "right" : "left"}: auto;
        }
        .totals-table td {
          border: 1px solid #000;
          padding: 8px;
        }
        .totals-table .grand-total {
          background: #f0f0f0;
          font-weight: bold;
          font-size: 18px;
        }
        .notes-box {
          border: 1px solid #000;
          padding: 12px;
          margin-bottom: 20px;
        }
        .signature-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 30px;
          margin-top: 50px;
        }
        .signature-box {
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #000;
          margin-top: 60px;
          padding-top: 10px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ccc;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        @media print {
          body { padding: 0; }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="voucher">
        <div class="ribbon">${getStatusLabel()}</div>
        
        <div class="header">
          <img src="${getPrintLogoUrl()}" alt="ASUS Card" style="width: 120px; height: auto; margin: 0 auto 10px; display: block;" />
          <h1>${isRtl ? "طلب صرف" : "Expense Payment Voucher"}</h1>
          <p>${isRtl ? "نسخة أصلية" : "Original Copy"}</p>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <span class="label">${isRtl ? "رقم القيد:" : "Entry No:"}</span>
            <span style="display: block; font-family: monospace;">${entryNumber}</span>
          </div>
          <div class="info-box">
            <span class="label">${isRtl ? "التاريخ:" : "Date:"}</span>
            <span style="display: block;">${format(new Date(entryDate), "yyyy-MM-dd")}</span>
          </div>
          <div class="info-box">
            <span class="label">${isRtl ? "المرجع:" : "Reference:"}</span>
            <span style="display: block;">${expenseReference || "-"}</span>
          </div>
          <div class="info-box">
            <span class="label">${isRtl ? "طريقة الدفع:" : "Payment:"}</span>
            <span style="display: block;">${paymentMethod === "bank" ? (isRtl ? "بنك" : "Bank") : (isRtl ? "نقدى" : "Cash")}</span>
          </div>
          <div class="info-box">
            <span class="label">${paymentMethod === "bank" ? (isRtl ? "البنك:" : "Bank:") : (isRtl ? "الخزينة:" : "Treasury:")}</span>
            <span style="display: block;">${paymentMethod === "bank" ? bankName : treasuryName}</span>
          </div>
          <div class="info-box">
            <span class="label">${isRtl ? "العملة:" : "Currency:"}</span>
            <span style="display: block;">${currencyCode}</span>
          </div>
          <div class="info-box">
            <span class="label">${isRtl ? "سعر الصرف:" : "Exchange Rate:"}</span>
            <span style="display: block;">${exchangeRate}</span>
          </div>
          <div class="info-box">
            <span class="label">${isRtl ? "بواسطة:" : "Created By:"}</span>
            <span style="display: block;">${createdBy}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px;">#</th>
              <th>${isRtl ? "نوع المصروف" : "Expense Type"}</th>
              <th>${isRtl ? "الوصف" : "Description"}</th>
              <th style="width: 60px;">${isRtl ? "الكمية" : "Qty"}</th>
              <th style="width: 90px;">${isRtl ? "سعر الوحدة" : "Unit Price"}</th>
              <th style="width: 90px;">${isRtl ? "الإجمالي" : "Total"}</th>
              <th style="width: 60px;">${isRtl ? "الضريبة %" : "VAT %"}</th>
              <th style="width: 90px;">${isRtl ? "قيمة الضريبة" : "VAT Amt"}</th>
              <th style="width: 100px;">${isRtl ? "إجمالي البند" : "Line Total"}</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <table class="totals-table">
          <tr>
            <td style="font-weight: bold;">${isRtl ? "المجموع الفرعي" : "Subtotal"}</td>
            <td style="text-align: right; font-family: monospace; width: 120px;">${formatNumber(subtotal)}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">${isRtl ? "إجمالي الضريبة" : "Total VAT"}</td>
            <td style="text-align: right; font-family: monospace;">${formatNumber(totalVat)}</td>
          </tr>
          <tr class="grand-total">
            <td>${isRtl ? "الإجمالي الكلي" : "Grand Total"}</td>
            <td style="text-align: right; font-family: monospace;">${formatNumber(grandTotal)}</td>
          </tr>
        </table>

        ${notes ? `
        <div class="notes-box">
          <span style="font-weight: bold;">${isRtl ? "ملاحظات:" : "Notes:"}</span>
          <p style="margin: 5px 0 0 0;">${notes}</p>
        </div>
        ` : ""}

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">
              <p style="font-weight: bold; margin: 0;">${isRtl ? "مقدم الطلب" : "Prepared By"}</p>
              <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">${isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              <p style="font-weight: bold; margin: 0;">${isRtl ? "المراجع" : "Reviewed By"}</p>
              <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">${isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line">
              <p style="font-weight: bold; margin: 0;">${isRtl ? "المعتمد" : "Approved By"}</p>
              <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">${isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>${isRtl ? `تم الطباعة بتاريخ: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}` : `Printed on: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
