import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttendanceSummary {
  employee_code: string;
  employee_name: string;
  employee_email: string;
  batch_number: string;
  records: {
    attendance_date: string;
    day_name: string;
    record_status: string;
    in_time: string | null;
    out_time: string | null;
    total_hours: number | null;
    difference_hours: number | null;
    deduction_amount: number | null;
    deduction_rule_name: string | null;
    notes: string | null;
  }[];
  total_deduction: number;
  total_absent_days: number;
  total_late_days: number;
  total_vacation_days: number;
}

interface SendSummaryRequest {
  batch_number: string;
  employee_codes?: string[]; // Optional: specific employees, if empty send to all
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { batch_number, employee_codes }: SendSummaryRequest = await req.json();

    if (!batch_number) {
      throw new Error("Batch number is required");
    }

    console.log(`Sending attendance summary for batch: ${batch_number}`);

    // Get system email config
    const { data: systemConfig } = await supabase
      .from("system_config")
      .select("config_value")
      .eq("config_key", "system_email")
      .maybeSingle();

    if (!systemConfig?.config_value) {
      throw new Error("System email not configured");
    }

    const emailConfig = JSON.parse(systemConfig.config_value);
    const { smtp_host, smtp_port, smtp_secure, email, password, from_name } = emailConfig;

    // Get confirmed attendance records for the batch
    let query = supabase
      .from("saved_attendance")
      .select(`
        *,
        deduction_rules:deduction_rule_id(rule_name, rule_name_ar)
      `)
      .eq("batch_number", batch_number)
      .eq("is_confirmed", true)
      .order("attendance_date", { ascending: true });

    if (employee_codes && employee_codes.length > 0) {
      query = query.in("employee_code", employee_codes);
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) throw recordsError;

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No confirmed records found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employees with emails
    const { data: employees } = await supabase
      .from("employees")
      .select("id, employee_number, first_name, last_name, email, zk_employee_code")
      .not("email", "is", null);

    const employeeMap = new Map(
      (employees || []).map(e => [e.zk_employee_code, e])
    );

    // Group records by employee
    const employeeSummaries = new Map<string, AttendanceSummary>();

    for (const record of records) {
      const emp = employeeMap.get(record.employee_code);
      if (!emp || !emp.email) continue;

      if (!employeeSummaries.has(record.employee_code)) {
        employeeSummaries.set(record.employee_code, {
          employee_code: record.employee_code,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          employee_email: emp.email,
          batch_number: batch_number,
          records: [],
          total_deduction: 0,
          total_absent_days: 0,
          total_late_days: 0,
          total_vacation_days: 0,
        });
      }

      const summary = employeeSummaries.get(record.employee_code)!;
      
      summary.records.push({
        attendance_date: record.attendance_date,
        day_name: record.day_name || "",
        record_status: record.record_status,
        in_time: record.in_time,
        out_time: record.out_time,
        total_hours: record.total_hours,
        difference_hours: record.difference_hours,
        deduction_amount: record.deduction_amount,
        deduction_rule_name: record.deduction_rules?.rule_name_ar || record.deduction_rules?.rule_name || null,
        notes: record.notes,
      });

      summary.total_deduction += record.deduction_amount || 0;
      
      if (record.record_status === "absent" || record.record_status === "absent_with_note") {
        summary.total_absent_days++;
      } else if (record.record_status === "vacation") {
        summary.total_vacation_days++;
      }
      
      if (record.deduction_rule_id) {
        summary.total_late_days++;
      }
    }

    // Send emails
    const client = new SMTPClient({
      connection: {
        hostname: smtp_host,
        port: smtp_port,
        tls: smtp_secure,
        auth: {
          username: email,
          password: password,
        },
      },
    });

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const [code, summary] of employeeSummaries) {
      try {
        const htmlContent = generateEmailHtml(summary);

        await client.send({
          from: `${from_name || "HR System"} <${email}>`,
          to: [summary.employee_email],
          subject: `تقرير الحضور والخصومات - ${batch_number} | Attendance Summary - ${batch_number}`,
          html: htmlContent,
        });

        console.log(`Email sent to ${summary.employee_email}`);
        sentCount++;
      } catch (err: any) {
        console.error(`Failed to send email to ${summary.employee_email}:`, err);
        failedCount++;
        errors.push(`${summary.employee_name}: ${err.message}`);
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending attendance summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateEmailHtml(summary: AttendanceSummary): string {
  const statusLabels: Record<string, string> = {
    normal: "عادي",
    absent: "غياب",
    absent_with_note: "غياب بعذر",
    vacation: "إجازة",
    weekend: "عطلة أسبوعية",
  };

  const dayLabels: Record<string, string> = {
    Sun: "الأحد",
    Mon: "الاثنين",
    Tue: "الثلاثاء",
    Wed: "الأربعاء",
    Thu: "الخميس",
    Fri: "الجمعة",
    Sat: "السبت",
  };

  const recordRows = summary.records.map(r => {
    const status = statusLabels[r.record_status] || r.record_status;
    const dayAr = dayLabels[r.day_name] || r.day_name;
    const deductionDisplay = r.deduction_amount && r.deduction_amount > 0 
      ? `${r.deduction_amount.toFixed(2)}` 
      : "-";
    const ruleDisplay = r.deduction_rule_name || "-";

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px; text-align: center;">${r.attendance_date}</td>
        <td style="padding: 8px; text-align: center;">${dayAr}</td>
        <td style="padding: 8px; text-align: center;">${status}</td>
        <td style="padding: 8px; text-align: center;">${r.in_time || "-"}</td>
        <td style="padding: 8px; text-align: center;">${r.out_time || "-"}</td>
        <td style="padding: 8px; text-align: center;">${r.total_hours?.toFixed(2) || "-"}</td>
        <td style="padding: 8px; text-align: center;">${ruleDisplay}</td>
        <td style="padding: 8px; text-align: center; color: ${r.deduction_amount && r.deduction_amount > 0 ? "#dc2626" : "inherit"};">${deductionDisplay}</td>
        <td style="padding: 8px; text-align: right; font-size: 12px;">${r.notes || ""}</td>
      </tr>
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير الحضور والخصومات</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 900px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">تقرير الحضور والخصومات</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Attendance & Deduction Report</p>
        </div>
        
        <div style="padding: 24px;">
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 4px 0;"><strong>الموظف:</strong></td>
                <td style="padding: 4px 0;">${summary.employee_name}</td>
                <td style="padding: 4px 0;"><strong>رقم الدفعة:</strong></td>
                <td style="padding: 4px 0;">${summary.batch_number}</td>
              </tr>
            </table>
          </div>

          <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 150px; background-color: #fef2f2; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #dc2626;">${summary.total_deduction.toFixed(2)}</div>
              <div style="color: #991b1b; font-size: 14px;">إجمالي الخصومات</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #fef3c7; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #d97706;">${summary.total_absent_days}</div>
              <div style="color: #92400e; font-size: 14px;">أيام الغياب</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #dbeafe; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${summary.total_vacation_days}</div>
              <div style="color: #1e40af; font-size: 14px;">أيام الإجازات</div>
            </div>
            <div style="flex: 1; min-width: 150px; background-color: #fce7f3; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #db2777;">${summary.total_late_days}</div>
              <div style="color: #9d174d; font-size: 14px;">أيام التأخير</div>
            </div>
          </div>

          <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">تفاصيل الحضور</h3>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background-color: #f3f4f6;">
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">التاريخ</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">اليوم</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">الحالة</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">الحضور</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">الانصراف</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">الساعات</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">نوع الخصم</th>
                  <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">الخصم</th>
                  <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #d1d5db;">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                ${recordRows}
              </tbody>
              <tfoot>
                <tr style="background-color: #fee2e2; font-weight: bold;">
                  <td colspan="7" style="padding: 12px 8px; text-align: left;">إجمالي الخصومات</td>
                  <td style="padding: 12px 8px; text-align: center; color: #dc2626;">${summary.total_deduction.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; text-align: center; color: #6b7280; font-size: 12px;">
            <p style="margin: 0;">تم إرسال هذا التقرير تلقائياً من نظام إدارة الموارد البشرية</p>
            <p style="margin: 4px 0 0;">This report was automatically sent from the HR Management System</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
