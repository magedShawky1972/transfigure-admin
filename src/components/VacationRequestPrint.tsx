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
        className="bg-white min-h-screen relative"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ 
          fontFamily: "Arial, sans-serif", 
          color: "#000",
          maxWidth: "700px",
          margin: "0 auto",
          padding: "20px 30px"
        }}
      >
        {/* Status Ribbon */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: isRtl ? "auto" : 0,
            left: isRtl ? 0 : "auto",
            width: "150px",
            height: "150px",
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "28px",
              right: isRtl ? "auto" : "-45px",
              left: isRtl ? "-45px" : "auto",
              width: "180px",
              textAlign: "center",
              transform: isRtl ? "rotate(-45deg)" : "rotate(45deg)",
              backgroundColor: getStatusColor(status),
              color: "white",
              padding: "6px 0",
              fontWeight: "bold",
              fontSize: "11px",
              textTransform: "uppercase",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              letterSpacing: "0.5px",
            }}
          >
            {getStatusLabel(status)}
          </div>
        </div>

        {/* Header with Logo */}
        <div style={{ textAlign: "center", marginBottom: "20px", paddingTop: "10px" }}>
          <img
            src={PRINT_LOGO_PATH}
            alt="Company Logo"
            style={{ width: "140px", height: "auto", margin: "0 auto 15px" }}
          />
          <h1 style={{ 
            fontSize: "22px", 
            fontWeight: "bold", 
            margin: "0 0 8px 0",
            color: "#1a1a1a"
          }}>
            {isRtl ? "طلب إجازة" : "Vacation Request"}
          </h1>
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            gap: "30px",
            fontSize: "12px",
            color: "#555"
          }}>
            {requestNumber && (
              <span>
                <strong>{isRtl ? "رقم الطلب:" : "Request #:"}</strong> {requestNumber}
              </span>
            )}
            {createdAt && (
              <span>
                <strong>{isRtl ? "تاريخ الطلب:" : "Date:"}</strong> {format(new Date(createdAt), "yyyy-MM-dd")}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderBottom: "2px solid #333", marginBottom: "20px" }} />

        {/* Employee Information Section */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ 
            fontSize: "14px", 
            fontWeight: "bold", 
            backgroundColor: "#f5f5f5",
            padding: "8px 12px",
            margin: "0 0 12px 0",
            borderRadius: "4px",
            borderRight: isRtl ? "4px solid #2563eb" : "none",
            borderLeft: isRtl ? "none" : "4px solid #2563eb"
          }}>
            {isRtl ? "بيانات الموظف" : "Employee Information"}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "8px 12px", width: "25%", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "اسم الموظف:" : "Employee Name:"}
                </td>
                <td style={{ padding: "8px 12px", width: "25%" }}>{employeeName}</td>
                <td style={{ padding: "8px 12px", width: "25%", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "الرقم الوظيفي:" : "Employee No:"}
                </td>
                <td style={{ padding: "8px 12px", width: "25%", fontFamily: "monospace" }}>{employeeNumber}</td>
              </tr>
              <tr style={{ backgroundColor: "#fafafa" }}>
                <td style={{ padding: "8px 12px", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "القسم:" : "Department:"}
                </td>
                <td style={{ padding: "8px 12px" }}>{departmentName}</td>
                <td style={{ padding: "8px 12px", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "المسمى الوظيفي:" : "Position:"}
                </td>
                <td style={{ padding: "8px 12px" }}>{positionName}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Vacation Details Section */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ 
            fontSize: "14px", 
            fontWeight: "bold", 
            backgroundColor: "#f5f5f5",
            padding: "8px 12px",
            margin: "0 0 12px 0",
            borderRadius: "4px",
            borderRight: isRtl ? "4px solid #16a34a" : "none",
            borderLeft: isRtl ? "none" : "4px solid #16a34a"
          }}>
            {isRtl ? "تفاصيل الإجازة" : "Vacation Details"}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "8px 12px", width: "25%", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "نوع الإجازة:" : "Vacation Type:"}
                </td>
                <td style={{ padding: "8px 12px", width: "25%" }}>{vacationType}</td>
                <td style={{ padding: "8px 12px", width: "25%", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "عدد الأيام:" : "Total Days:"}
                </td>
                <td style={{ padding: "8px 12px", width: "25%" }}>
                  <span style={{ 
                    fontWeight: "bold", 
                    fontSize: "15px",
                    color: "#2563eb"
                  }}>
                    {totalDays} {isRtl ? "يوم" : "days"}
                  </span>
                </td>
              </tr>
              <tr style={{ backgroundColor: "#fafafa" }}>
                <td style={{ padding: "8px 12px", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "تاريخ البداية:" : "Start Date:"}
                </td>
                <td style={{ padding: "8px 12px" }}>{format(new Date(startDate), "yyyy-MM-dd")}</td>
                <td style={{ padding: "8px 12px", fontWeight: "600", color: "#555" }}>
                  {isRtl ? "تاريخ النهاية:" : "End Date:"}
                </td>
                <td style={{ padding: "8px 12px" }}>{format(new Date(endDate), "yyyy-MM-dd")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Reason Section */}
        {reason && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ 
              fontSize: "14px", 
              fontWeight: "bold", 
              backgroundColor: "#f5f5f5",
              padding: "8px 12px",
              margin: "0 0 12px 0",
              borderRadius: "4px",
              borderRight: isRtl ? "4px solid #f59e0b" : "none",
              borderLeft: isRtl ? "none" : "4px solid #f59e0b"
            }}>
              {isRtl ? "السبب / الوصف" : "Reason / Description"}
            </h2>
            <div style={{ 
              padding: "12px", 
              backgroundColor: "#fffbeb",
              borderRadius: "4px",
              fontSize: "13px",
              lineHeight: "1.6",
              border: "1px solid #fef3c7"
            }}>
              {reason}
            </div>
          </div>
        )}

        {/* Approval Comments Section */}
        {approvalComments && (
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ 
              fontSize: "14px", 
              fontWeight: "bold", 
              backgroundColor: "#f5f5f5",
              padding: "8px 12px",
              margin: "0 0 12px 0",
              borderRadius: "4px",
              borderRight: isRtl ? "4px solid #8b5cf6" : "none",
              borderLeft: isRtl ? "none" : "4px solid #8b5cf6"
            }}>
              {isRtl ? "ملاحظات الاعتماد" : "Approval Notes"}
            </h2>
            <div style={{ 
              padding: "12px", 
              backgroundColor: "#f5f3ff",
              borderRadius: "4px",
              fontSize: "13px",
              lineHeight: "1.6",
              border: "1px solid #ede9fe"
            }}>
              {approvalComments}
            </div>
          </div>
        )}

        {/* Signature Section */}
        <div style={{ marginTop: "40px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ 
                  width: "33.33%", 
                  textAlign: "center", 
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  borderBottom: "2px solid #e5e7eb"
                }}>
                  {isRtl ? "الموظف" : "Employee"}
                </th>
                <th style={{ 
                  width: "33.33%", 
                  textAlign: "center", 
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  borderBottom: "2px solid #e5e7eb"
                }}>
                  {isRtl ? "مدير القسم" : "Department Manager"}
                </th>
                <th style={{ 
                  width: "33.33%", 
                  textAlign: "center", 
                  padding: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  borderBottom: "2px solid #e5e7eb"
                }}>
                  {isRtl ? "الموارد البشرية" : "HR Manager"}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ height: "70px", verticalAlign: "bottom", textAlign: "center" }}>
                  <div style={{ borderBottom: "1px solid #999", width: "80%", margin: "0 auto" }} />
                </td>
                <td style={{ height: "70px", verticalAlign: "bottom", textAlign: "center" }}>
                  <div style={{ borderBottom: "1px solid #999", width: "80%", margin: "0 auto" }} />
                </td>
                <td style={{ height: "70px", verticalAlign: "bottom", textAlign: "center" }}>
                  <div style={{ borderBottom: "1px solid #999", width: "80%", margin: "0 auto" }} />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "center", padding: "8px", fontSize: "11px", color: "#666" }}>
                  {isRtl ? "الاسم والتوقيع" : "Name & Signature"}
                </td>
                <td style={{ textAlign: "center", padding: "8px", fontSize: "11px", color: "#666" }}>
                  {isRtl ? "الاسم والتوقيع" : "Name & Signature"}
                </td>
                <td style={{ textAlign: "center", padding: "8px", fontSize: "11px", color: "#666" }}>
                  {isRtl ? "الاسم والتوقيع" : "Name & Signature"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: "30px", 
          paddingTop: "15px", 
          borderTop: "1px solid #e5e7eb",
          textAlign: "center",
          fontSize: "10px",
          color: "#888"
        }}>
          {isRtl
            ? `تم الطباعة بتاريخ: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`
            : `Printed on: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`}
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
              padding: 15mm !important;
              max-width: none !important;
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
