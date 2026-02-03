import { forwardRef } from "react";
import { format } from "date-fns";
import { PRINT_LOGO_PATH } from "@/lib/printLogo";

interface VacationRequestPrintProps {
  language: string;
  requestNumber?: string;
  employeeName: string;
  employeeNumber: string;
  departmentName: string;
  positionName: string;
  vacationType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string | null;
  approvalComments?: string | null;
  createdAt?: string;
}

export const VacationRequestPrint = forwardRef<HTMLDivElement, VacationRequestPrintProps>(
  (
    {
      language,
      requestNumber,
      employeeName,
      employeeNumber,
      departmentName,
      positionName,
      vacationType,
      startDate,
      endDate,
      totalDays,
      status,
      reason,
      approvalComments,
      createdAt,
    },
    ref
  ) => {
    const isRtl = language === "ar";

    const getStatusLabel = (s: string) => {
      const statusLabels: Record<string, { en: string; ar: string }> = {
        pending: { en: "Pending", ar: "قيد الانتظار" },
        approved: { en: "Approved", ar: "مقبول" },
        rejected: { en: "Rejected", ar: "مرفوض" },
        manager_approved: { en: "Manager Approved", ar: "معتمد من المدير" },
        hr_pending: { en: "HR Pending", ar: "بانتظار الموارد البشرية" },
        cancelled: { en: "Cancelled", ar: "ملغي" },
      };
      return isRtl ? statusLabels[s]?.ar || s : statusLabels[s]?.en || s;
    };

    const getStatusColor = (s: string) => {
      switch (s) {
        case "approved":
          return "#16a34a";
        case "rejected":
        case "cancelled":
          return "#dc2626";
        case "pending":
        case "manager_approved":
        case "hr_pending":
          return "#ca8a04";
        default:
          return "#6b7280";
      }
    };

    return (
      <div
        ref={ref}
        data-print-content="true"
        className="bg-white p-8 min-h-screen print:p-4 relative"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ fontFamily: "Arial, sans-serif", color: "#000" }}
      >
        {/* Status Ribbon */}
        <div
          className="absolute overflow-hidden pointer-events-none"
          style={{
            top: 0,
            right: isRtl ? "auto" : 0,
            left: isRtl ? 0 : "auto",
            width: "150px",
            height: "150px",
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "30px",
              right: isRtl ? "auto" : "-40px",
              left: isRtl ? "-40px" : "auto",
              width: "180px",
              textAlign: "center",
              transform: isRtl ? "rotate(-45deg)" : "rotate(45deg)",
              backgroundColor: getStatusColor(status),
              color: "white",
              padding: "8px 0",
              fontWeight: "bold",
              fontSize: "12px",
              textTransform: "uppercase",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              letterSpacing: "1px",
            }}
          >
            {getStatusLabel(status)}
          </div>
        </div>

        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6 relative" style={{ zIndex: 1 }}>
          <img
            src={PRINT_LOGO_PATH}
            alt="Company Logo"
            style={{ width: "120px", height: "auto", margin: "0 auto 10px" }}
          />
          <h1 className="text-2xl font-bold mb-2">
            {isRtl ? "طلب إجازة" : "Vacation Request"}
          </h1>
          {requestNumber && (
            <p className="text-sm text-gray-600 font-mono">
              {isRtl ? `رقم الطلب: ${requestNumber}` : `Request #: ${requestNumber}`}
            </p>
          )}
          {createdAt && (
            <p className="text-sm text-gray-600">
              {isRtl ? `تاريخ الطلب: ` : `Request Date: `}
              {format(new Date(createdAt), "yyyy-MM-dd")}
            </p>
          )}
        </div>

        {/* Employee Information */}
        <div className="border border-black p-4 mb-6">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">
            {isRtl ? "بيانات الموظف" : "Employee Information"}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "اسم الموظف:" : "Employee Name:"}</span>
              <span>{employeeName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "الرقم الوظيفي:" : "Employee No:"}</span>
              <span className="font-mono">{employeeNumber}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "القسم:" : "Department:"}</span>
              <span>{departmentName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "المسمى الوظيفي:" : "Position:"}</span>
              <span>{positionName}</span>
            </div>
          </div>
        </div>

        {/* Vacation Details */}
        <div className="border border-black p-4 mb-6">
          <h2 className="font-bold text-lg mb-4 border-b pb-2">
            {isRtl ? "تفاصيل الإجازة" : "Vacation Details"}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "نوع الإجازة:" : "Vacation Type:"}</span>
              <span>{vacationType}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "عدد الأيام:" : "Total Days:"}</span>
              <span className="font-bold text-lg">{totalDays} {isRtl ? "يوم" : "days"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "تاريخ البداية:" : "Start Date:"}</span>
              <span>{format(new Date(startDate), "yyyy-MM-dd")}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dashed">
              <span className="font-semibold">{isRtl ? "تاريخ النهاية:" : "End Date:"}</span>
              <span>{format(new Date(endDate), "yyyy-MM-dd")}</span>
            </div>
          </div>
        </div>

        {/* Reason / Description */}
        {reason && (
          <div className="border border-black p-4 mb-6">
            <h2 className="font-bold text-lg mb-2">
              {isRtl ? "السبب / الوصف" : "Reason / Description"}
            </h2>
            <p className="text-sm whitespace-pre-wrap">{reason}</p>
          </div>
        )}

        {/* Approval Comments / Notes */}
        {approvalComments && (
          <div className="border border-black p-4 mb-6">
            <h2 className="font-bold text-lg mb-2">
              {isRtl ? "ملاحظات الاعتماد" : "Approval Notes"}
            </h2>
            <p className="text-sm whitespace-pre-wrap">{approvalComments}</p>
          </div>
        )}

        {/* Signature Section */}
        <div className="grid grid-cols-3 gap-8 mt-12 text-sm">
          <div className="text-center">
            <div className="border-b border-black pb-16 mb-2"></div>
            <p className="font-semibold">{isRtl ? "الموظف" : "Employee"}</p>
            <p className="text-xs text-gray-600">{isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-black pb-16 mb-2"></div>
            <p className="font-semibold">{isRtl ? "مدير القسم" : "Department Manager"}</p>
            <p className="text-xs text-gray-600">{isRtl ? "الاسم والتوقيع" : "Name & Signature"}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-black pb-16 mb-2"></div>
            <p className="font-semibold">{isRtl ? "الموارد البشرية" : "HR Manager"}</p>
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

VacationRequestPrint.displayName = "VacationRequestPrint";
