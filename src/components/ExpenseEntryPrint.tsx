import { forwardRef } from "react";
import { format } from "date-fns";
import { PRINT_LOGO_PATH } from "@/lib/printLogo";

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
    const isApproved = status === "approved";
    const isPosted = status === "posted";

    const getStatusLabel = () => {
      if (isDraft) return isRtl ? "مسودة" : "DRAFT";
      if (isPending) return isRtl ? "معلق" : "PENDING";
      if (isApproved) return isRtl ? "معتمد" : "APPROVED";
      if (isPosted) return isRtl ? "مدفوع" : "PAID";
      return "";
    };

    const getStatusColor = () => {
      if (isDraft) return "#ef4444"; // red
      if (isPending) return "#f59e0b"; // orange
      if (isApproved) return "#3b82f6"; // blue
      if (isPosted) return "#22c55e"; // green
      return "#6b7280"; // gray
    };

    return (
      <div
        ref={ref}
        data-print-content="true"
        className="bg-white p-8 min-h-screen print:p-4 relative"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
      >
        {/* Status Ribbon - Top Right Corner */}
        {(isDraft || isPending || isApproved || isPosted) && (
          <div 
            className="absolute overflow-hidden pointer-events-none"
            style={{ 
              top: 0, 
              right: 0, 
              width: "150px", 
              height: "150px",
              zIndex: 10 
            }}
          >
            <div 
              style={{
                position: "absolute",
                top: "30px",
                right: "-40px",
                width: "180px",
                textAlign: "center",
                transform: "rotate(45deg)",
                backgroundColor: getStatusColor(),
                color: "white",
                padding: "8px 0",
                fontWeight: "bold",
                fontSize: "14px",
                textTransform: "uppercase",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                letterSpacing: "1px"
              }}
            >
              {getStatusLabel()}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6 relative" style={{ zIndex: 1 }}>
          <img 
            src={PRINT_LOGO_PATH} 
            alt="ASUS Card" 
            style={{ width: "120px", height: "auto", margin: "0 auto 10px" }} 
          />
          <h1 className="text-2xl font-bold mb-2">
            {isRtl ? "طلب صرف" : "Expense Payment Voucher"}
          </h1>
          <p className="text-sm text-gray-600">
            {isRtl ? "نسخة أصلية" : "Original Copy"}
          </p>
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
                ? "نقدى"
                : "Cash"}
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
            <p className="font-semibold">{isRtl ? "مقدم الطلب" : "Prepared By"}</p>
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

            /* Hide everything */
            body * {
              visibility: hidden !important;
            }

            /* Show only print content */
            [data-print-content="true"],
            [data-print-content="true"] * {
              visibility: visible !important;
            }

            /* Place print content at top-left */
            [data-print-content="true"] {
              position: fixed !important;
              inset: 0 !important;
              width: 100% !important;
              height: auto !important;
              background: white !important;
            }

            @page {
              size: A4;
              margin: 10mm;
            }

            /* Ensure table elements keep their layout in print */
            table { display: table !important; }
            thead { display: table-header-group !important; }
            tbody { display: table-row-group !important; }
            tr { display: table-row !important; }
            td, th { display: table-cell !important; }
          }
        `}</style>
      </div>
    );
  }
);

ExpenseEntryPrint.displayName = "ExpenseEntryPrint";
