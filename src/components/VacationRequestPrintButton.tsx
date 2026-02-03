import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VacationRequestPrint } from "./VacationRequestPrint";
import { createRoot } from "react-dom/client";

interface VacationRequestPrintButtonProps {
  requestId: string;
  source: "vacation_requests" | "employee_requests";
  language: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
}

export const VacationRequestPrintButton = ({
  requestId,
  source,
  language,
  variant = "ghost",
  size = "icon",
}: VacationRequestPrintButtonProps) => {
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    setLoading(true);
    try {
      let requestData: any = null;

      if (source === "employee_requests") {
        const { data, error } = await supabase
          .from("employee_requests")
          .select(`
            *,
            employees:employee_id(
              first_name, first_name_ar, last_name, last_name_ar, employee_number,
              departments(department_name, department_name_ar),
              job_positions(position_name, position_name_ar)
            ),
            vacation_codes:vacation_code_id(code, name_en, name_ar)
          `)
          .eq("id", requestId)
          .single();

        if (error) throw error;
        requestData = data;
      } else {
        const { data, error } = await supabase
          .from("vacation_requests")
          .select(`
            *,
            employees:employee_id(
              first_name, first_name_ar, last_name, last_name_ar, employee_number,
              departments:department_id(department_name, department_name_ar),
              job_positions:job_position_id(position_name, position_name_ar)
            ),
            vacation_codes:vacation_code_id(code, name_en, name_ar)
          `)
          .eq("id", requestId)
          .single();

        if (error) throw error;
        requestData = data;
      }

      if (!requestData) {
        console.error("Request not found");
        return;
      }

      const employee = requestData.employees;
      const isArabic = language === "ar";

      const employeeName = isArabic
        ? `${employee?.first_name_ar || employee?.first_name || ""} ${employee?.last_name_ar || employee?.last_name || ""}`
        : `${employee?.first_name || ""} ${employee?.last_name || ""}`;

      const departmentName = isArabic
        ? employee?.departments?.department_name_ar || employee?.departments?.department_name || "-"
        : employee?.departments?.department_name || "-";

      const positionName = isArabic
        ? employee?.job_positions?.position_name_ar || employee?.job_positions?.position_name || "-"
        : employee?.job_positions?.position_name || "-";

      const vacationType = isArabic
        ? requestData.vacation_codes?.name_ar || requestData.vacation_codes?.name_en || "-"
        : requestData.vacation_codes?.name_en || "-";

      // Create print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        console.error("Could not open print window");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${isArabic ? "طلب إجازة" : "Vacation Request"}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; }
            </style>
          </head>
          <body>
            <div id="print-root"></div>
          </body>
        </html>
      `);

      const container = printWindow.document.getElementById("print-root");
      if (container) {
        const root = createRoot(container);
        root.render(
          <VacationRequestPrint
            language={language}
            requestNumber={requestData.request_number || undefined}
            employeeName={employeeName.trim()}
            employeeNumber={employee?.employee_number || "-"}
            departmentName={departmentName}
            positionName={positionName}
            vacationType={vacationType}
            startDate={requestData.start_date}
            endDate={requestData.end_date}
            totalDays={requestData.total_days}
            status={requestData.status}
            reason={requestData.reason}
            approvalComments={requestData.approval_comments}
            createdAt={requestData.created_at}
          />
        );

        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error("Error printing vacation request:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handlePrint}
      disabled={loading}
      title={language === "ar" ? "طباعة" : "Print"}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Printer className="h-4 w-4" />
      )}
    </Button>
  );
};
