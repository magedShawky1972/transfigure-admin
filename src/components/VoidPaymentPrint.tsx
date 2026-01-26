import { forwardRef } from "react";
import { format } from "date-fns";

interface VoidPaymentPrintProps {
  language: string;
  voidNumber: string;
  requestNumber: string;
  description: string;
  originalAmount: number;
  treasuryAmount: number | null;
  currencyCode: string;
  treasuryCurrencyCode: string | null;
  treasuryName: string;
  treasuryEntryNumber: string | null;
  originalPaidAt: string | null;
  voidedAt: string;
  voidedByName: string;
  reason: string | null;
}

export const VoidPaymentPrint = forwardRef<HTMLDivElement, VoidPaymentPrintProps>(
  (
    {
      language,
      voidNumber,
      requestNumber,
      description,
      originalAmount,
      treasuryAmount,
      currencyCode,
      treasuryCurrencyCode,
      treasuryName,
      treasuryEntryNumber,
      originalPaidAt,
      voidedAt,
      voidedByName,
      reason,
    },
    ref
  ) => {
    const isRtl = language === "ar";
    const formatNumber = (num: number) =>
      num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
      <div
        ref={ref}
        data-print-content="true"
        className="bg-white p-8 min-h-screen print:p-4 relative"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
      >
        {/* VOIDED Ribbon - Top Right Corner */}
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
              backgroundColor: "#ef4444",
              color: "white",
              padding: "8px 0",
              fontWeight: "bold",
              fontSize: "14px",
              textTransform: "uppercase",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              letterSpacing: "1px"
            }}
          >
            {isRtl ? "ملغي" : "VOIDED"}
          </div>
        </div>

        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6 relative" style={{ zIndex: 1 }}>
          <h1 className="text-2xl font-bold mb-2">
            {isRtl ? "سند إلغاء دفع" : "Payment Void Voucher"}
          </h1>
          <p className="text-sm text-gray-600">
            {isRtl ? "نسخة أصلية" : "Original Copy"}
          </p>
        </div>

        {/* Void Info */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "رقم الإلغاء:" : "Void No:"}</span>
            <span className="block font-mono text-red-600 font-bold">{voidNumber}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "تاريخ الإلغاء:" : "Void Date:"}</span>
            <span className="block">{format(new Date(voidedAt), "yyyy-MM-dd HH:mm")}</span>
          </div>
          <div className="border p-2">
            <span className="font-semibold">{isRtl ? "بواسطة:" : "Voided By:"}</span>
            <span className="block">{voidedByName || "-"}</span>
          </div>
        </div>

        {/* Original Payment Info */}
        <div className="border border-black p-4 mb-6">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">
            {isRtl ? "تفاصيل الدفعة الأصلية" : "Original Payment Details"}
          </h2>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "رقم الطلب:" : "Request #:"}</span>
              <span className="font-mono">{requestNumber}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "تاريخ الدفع الأصلي:" : "Original Paid Date:"}</span>
              <span>{originalPaidAt ? format(new Date(originalPaidAt), "yyyy-MM-dd HH:mm") : "-"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "الخزينة:" : "Treasury:"}</span>
              <span>{treasuryName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "رقم قيد الخزينة:" : "Treasury Entry #:"}</span>
              <span className="font-mono">{treasuryEntryNumber || "-"}</span>
            </div>
          </div>
          
          <div className="py-2 border-b border-dashed">
            <span className="font-semibold">{isRtl ? "البيان:" : "Description:"}</span>
            <p className="mt-1">{description || "-"}</p>
          </div>
        </div>

        {/* Amount Box */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border-2 border-black p-4 bg-gray-50">
            <div className="text-sm text-gray-600 mb-1">{isRtl ? "المبلغ الأصلي" : "Original Amount"}</div>
            <div className="text-2xl font-bold">{formatNumber(originalAmount)} {currencyCode}</div>
          </div>
          {treasuryAmount && treasuryCurrencyCode && treasuryCurrencyCode !== currencyCode && (
            <div className="border-2 border-black p-4 bg-gray-50">
              <div className="text-sm text-gray-600 mb-1">{isRtl ? "مبلغ الخزينة" : "Treasury Amount"}</div>
              <div className="text-2xl font-bold">{formatNumber(treasuryAmount)} {treasuryCurrencyCode}</div>
            </div>
          )}
        </div>

        {/* Reason */}
        {reason && (
          <div className="border border-black p-3 mb-6">
            <span className="font-semibold">{isRtl ? "سبب الإلغاء:" : "Void Reason:"}</span>
            <p className="mt-1">{reason}</p>
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

            body * {
              visibility: hidden !important;
            }

            [data-print-content="true"],
            [data-print-content="true"] * {
              visibility: visible !important;
            }

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
          }
        `}</style>
      </div>
    );
  }
);

VoidPaymentPrint.displayName = "VoidPaymentPrint";
