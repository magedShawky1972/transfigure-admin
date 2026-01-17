import { forwardRef } from "react";
import { format } from "date-fns";

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

interface ExpenseEntryPrintProps {
  language: string;
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
  status?: string;
}

export const ExpenseEntryPrint = forwardRef<HTMLDivElement, ExpenseEntryPrintProps>(
  (
    {
      language,
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
      status = "draft",
    },
    ref
  ) => {
    const formatNumber = (num: number) =>
      num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const getExpenseTypeName = (typeId: string) => {
      const type = expenseTypes.find((t) => t.id === typeId);
      if (!type) return "-";
      return language === "ar" && type.expense_name_ar ? type.expense_name_ar : type.expense_name;
    };

    const isRtl = language === "ar";
    const isDraft = status === "draft";
    const isPending = status === "pending";

    const getStatusLabel = () => {
      if (isDraft) return isRtl ? "مسودة" : "DRAFT";
      if (isPending) return isRtl ? "في الانتظار" : "PENDING";
      return "";
    };

    return (
      <div
        ref={ref}
        data-print-content="true"
        className="bg-white p-8 min-h-screen print:p-4 relative"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
      >
        {/* Watermark for Draft/Pending */}
        {(isDraft || isPending) && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <div 
              className="text-8xl font-bold opacity-10 transform -rotate-45 select-none"
              style={{ color: isDraft ? "#666" : "#f59e0b" }}
            >
              {getStatusLabel()}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6 relative" style={{ zIndex: 1 }}>
          <h1 className="text-2xl font-bold mb-2">
            {isRtl ? "سند صرف مصروفات" : "Expense Payment Voucher"}
          </h1>
          <p className="text-sm text-gray-600">
            {isRtl ? "نسخة أصلية" : "Original Copy"}
          </p>
          {(isDraft || isPending) && (
            <div className={`inline-block mt-2 px-3 py-1 text-sm font-semibold rounded ${isDraft ? "bg-gray-200 text-gray-700" : "bg-yellow-100 text-yellow-800"}`}>
              {getStatusLabel()}
            </div>
          )}
        </div>

        {/* Entry Info */}
        <div className="grid grid-cols-4 gap-4 mb-6 text-sm">
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "رقم القيد:" : "Entry No:"}</span>
            <span className="block font-mono">{entryNumber}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "التاريخ:" : "Date:"}</span>
            <span className="block">{format(new Date(entryDate), "yyyy-MM-dd")}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "المرجع:" : "Reference:"}</span>
            <span className="block">{expenseReference || "-"}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "طريقة الدفع:" : "Payment:"}</span>
            <span className="block">
              {paymentMethod === "bank"
                ? isRtl
                  ? "بنك"
                  : "Bank"
                : isRtl
                ? "خزينة"
                : "Treasury"}
            </span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">
              {paymentMethod === "bank"
                ? isRtl
                  ? "البنك:"
                  : "Bank:"
                : isRtl
                ? "الخزينة:"
                : "Treasury:"}
            </span>
            <span className="block">{paymentMethod === "bank" ? bankName : treasuryName}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "العملة:" : "Currency:"}</span>
            <span className="block">{currencyCode}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "سعر الصرف:" : "Exchange Rate:"}</span>
            <span className="block">{exchangeRate}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "بواسطة:" : "Created By:"}</span>
            <span className="block">{createdBy || "-"}</span>
          </div>
        </div>

        {/* Lines Table */}
        <table className="w-full border-collapse border border-black mb-6 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 w-12">#</th>
              <th className="border border-black p-2">{isRtl ? "نوع المصروف" : "Expense Type"}</th>
              <th className="border border-black p-2">{isRtl ? "الوصف" : "Description"}</th>
              <th className="border border-black p-2 w-20">{isRtl ? "الكمية" : "Qty"}</th>
              <th className="border border-black p-2 w-24">{isRtl ? "سعر الوحدة" : "Unit Price"}</th>
              <th className="border border-black p-2 w-24">{isRtl ? "الإجمالي" : "Total"}</th>
              <th className="border border-black p-2 w-16">{isRtl ? "الضريبة %" : "VAT %"}</th>
              <th className="border border-black p-2 w-24">{isRtl ? "قيمة الضريبة" : "VAT Amt"}</th>
              <th className="border border-black p-2 w-28">{isRtl ? "إجمالي البند" : "Line Total"}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="border border-black p-2 text-center">{line.line_number}</td>
                <td className="border border-black p-2">{getExpenseTypeName(line.expense_type_id)}</td>
                <td className="border border-black p-2">{line.description || "-"}</td>
                <td className="border border-black p-2 text-center">{line.quantity}</td>
                <td className="border border-black p-2 text-right font-mono">{formatNumber(line.unit_price)}</td>
                <td className="border border-black p-2 text-right font-mono">{formatNumber(line.total)}</td>
                <td className="border border-black p-2 text-center">{line.vat_percent}%</td>
                <td className="border border-black p-2 text-right font-mono">{formatNumber(line.vat_amount)}</td>
                <td className="border border-black p-2 text-right font-mono font-semibold">{formatNumber(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className={`flex ${isRtl ? "justify-start" : "justify-end"} mb-6`}>
          <table className="border-collapse border border-black text-sm w-72">
            <tbody>
              <tr>
                <td className="border border-black p-2 font-semibold">{isRtl ? "المجموع الفرعي" : "Subtotal"}</td>
                <td className="border border-black p-2 text-right font-mono w-32">{formatNumber(subtotal)}</td>
              </tr>
              <tr>
                <td className="border border-black p-2 font-semibold">{isRtl ? "إجمالي الضريبة" : "Total VAT"}</td>
                <td className="border border-black p-2 text-right font-mono">{formatNumber(totalVat)}</td>
              </tr>
              <tr className="bg-gray-100">
                <td className="border border-black p-2 font-bold text-lg">{isRtl ? "الإجمالي الكلي" : "Grand Total"}</td>
                <td className="border border-black p-2 text-right font-mono font-bold text-lg">{formatNumber(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {notes && (
          <div className="border border-black p-3 mb-6">
            <span className="font-semibold">{isRtl ? "ملاحظات:" : "Notes:"}</span>
            <p className="mt-1">{notes}</p>
          </div>
        )}

        {/* Signature Section */}
        <div className="grid grid-cols-3 gap-8 mt-12 text-sm">
          <div className="text-center">
            <div className="border-b border-black pb-16 mb-2"></div>
            <p className="font-semibold">{isRtl ? "المحضر" : "Prepared By"}</p>
            <p className="text-xs text-gray-600">{isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-black pb-16 mb-2"></div>
            <p className="font-semibold">{isRtl ? "المراجع" : "Reviewed By"}</p>
            <p className="text-xs text-gray-600">{isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-black pb-16 mb-2"></div>
            <p className="font-semibold">{isRtl ? "المعتمد" : "Approved By"}</p>
            <p className="text-xs text-gray-600">{isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
          <p>
            {isRtl
              ? `تم الطباعة بتاريخ: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
              : `Printed on: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}
          </p>
        </div>

        {/* Print Styles */}
        <style>{`
          @media print {
            html, body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: white !important;
            }
            
            /* Hide everything except the print content */
            body > *:not(#root) {
              display: none !important;
            }
            
            #root > *:not([data-print-content="true"]) {
              display: none !important;
            }
            
            /* Ensure print content is visible */
            [data-print-content="true"],
            [data-print-content="true"] * {
              visibility: visible !important;
              display: block;
            }
            
            [data-print-content="true"] {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
            }
            
            @page {
              size: A4;
              margin: 10mm;
            }
            
            /* Ensure tables display properly */
            table {
              display: table !important;
            }
            thead {
              display: table-header-group !important;
            }
            tbody {
              display: table-row-group !important;
            }
            tr {
              display: table-row !important;
            }
            td, th {
              display: table-cell !important;
            }
            
            /* Ensure grid displays */
            .grid {
              display: grid !important;
            }
          }
        `}</style>
      </div>
    );
  }
);

ExpenseEntryPrint.displayName = "ExpenseEntryPrint";
