import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get yesterday's date in KSA timezone (UTC+3)
function getYesterdayKSA(): string {
  const now = new Date();
  const ksaOffset = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  const ksaDate = new Date(now.getTime() + ksaOffset);
  ksaDate.setDate(ksaDate.getDate() - 1);
  return ksaDate.toISOString().split('T')[0];
}

// Async email sending to not block the response
async function sendEmailInBackground(
  email: string, 
  emailHtml: string, 
  ccEmails: string[] = []
) {
  try {
    const smtpClient = new SMTPClient({
      connection: {
        hostname: "smtp.hostinger.com",
        port: 465,
        tls: true,
        auth: {
          username: "edara@asuscards.com",
          password: Deno.env.get("SMTP_PASSWORD") ?? "",
        },
      },
    });

    console.log("Attempting to send deduction email to:", email);

    const emailConfig: {
      from: string;
      to: string;
      subject: string;
      content: string;
      html: string;
      cc?: string[];
    } = {
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: "إشعار خصم الحضور",
      content: "text/html; charset=utf-8",
      html: emailHtml,
    };

    if (ccEmails.length > 0) {
      emailConfig.cc = ccEmails;
      console.log(`Adding CC to HR managers: ${ccEmails.join(', ')}`);
    }

    await smtpClient.send(emailConfig);
    await smtpClient.close();
    console.log("Deduction email sent successfully to:", email);
  } catch (emailError) {
    console.error("Failed to send email to", email, ":", emailError);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    // Default to yesterday in KSA timezone
    const targetDate = body.target_date || getYesterdayKSA();

    console.log(`Sending deduction notifications for date: ${targetDate}`);

    // Fetch timesheet records with deduction rules that haven't been notified
    // Join with employees and deduction_rules tables
    const { data: records, error: recError } = await supabase
      .from('timesheets')
      .select(`
        id, work_date, employee_id, status, late_minutes, in_time, out_time,
        deduction_rule_id,
        deduction_rule:deduction_rules(id, rule_name, rule_name_ar, deduction_value, deduction_type),
        employee:employees!inner(
          id, first_name, last_name, first_name_ar, last_name_ar, email, user_id, zk_employee_code
        )
      `)
      .eq('work_date', targetDate)
      .eq('deduction_notification_sent', false)
      .not('deduction_rule_id', 'is', null)
      .neq('status', 'vacation');

    if (recError) throw recError;

    console.log(`Found ${records?.length || 0} timesheet records with deduction rules`);

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No deduction notifications to send', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter records where deduction_value > 0
    const recordsWithDeductions = records.filter(r => {
      const rule = r.deduction_rule as { deduction_value?: number } | null;
      return rule && rule.deduction_value && rule.deduction_value > 0;
    });

    console.log(`Found ${recordsWithDeductions.length} records with actual deductions (deduction_value > 0)`);

    if (recordsWithDeductions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No records with deductions > 0', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active HR managers to CC on deduction emails
    const { data: hrManagers, error: hrError } = await supabase
      .from('hr_managers')
      .select('user_id')
      .eq('is_active', true);

    if (hrError) {
      console.error('Error fetching HR managers:', hrError);
    }

    // Fetch HR manager emails from profiles
    let hrManagerEmails: string[] = [];
    if (hrManagers && hrManagers.length > 0) {
      const hrUserIds = hrManagers.map(hr => hr.user_id);
      const { data: hrProfiles } = await supabase
        .from('profiles')
        .select('email')
        .in('user_id', hrUserIds)
        .not('email', 'is', null);

      hrManagerEmails = (hrProfiles || [])
        .map(p => p.email)
        .filter((email): email is string => !!email);
      
      console.log(`Found ${hrManagerEmails.length} HR manager emails to CC`);
    }

    let notificationsSent = 0;

    for (const record of recordsWithDeductions) {
      const employee = record.employee as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        first_name_ar: string | null;
        last_name_ar: string | null;
        email: string | null;
        user_id: string | null;
        zk_employee_code: string | null;
      };
      
      const rule = record.deduction_rule as {
        id: string;
        rule_name: string | null;
        rule_name_ar: string | null;
        deduction_value: number;
        deduction_type: string | null;
      };

      if (!employee || !employee.user_id) {
        console.log(`Skipping record ${record.id}: No employee or user_id found`);
        continue;
      }

      const ruleName = rule?.rule_name_ar || rule?.rule_name || 'خصم';
      const employeeName = `${employee.first_name_ar || employee.first_name || ''} ${employee.last_name_ar || employee.last_name || ''}`.trim();
      
      // Calculate percentage - deduction_value is stored as decimal (0.5 = 50%)
      const percentage = rule.deduction_type === 'percentage' 
        ? `${(rule.deduction_value * 100).toFixed(0)}%`
        : `${rule.deduction_value}`;

      const notificationTitle = 'إشعار خصم الحضور';
      const notificationBody = `تم تسجيل خصم بنسبة ${percentage} بتاريخ ${targetDate}. السبب: ${ruleName}`;

      // Create internal notification
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: employee.user_id,
        title: notificationTitle,
        message: notificationBody,
        type: 'custom',
        is_read: false,
      });

      if (notifError) {
        console.error(`Error creating notification for employee ${employee.zk_employee_code}:`, notifError);
        continue;
      }

      // Update notification sent flag on timesheets table
      await supabase
        .from('timesheets')
        .update({
          deduction_notification_sent: true,
          deduction_notification_sent_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      // Send email if employee has email
      if (employee.email) {
        const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.8;
      color: #333;
      direction: rtl;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .info-box {
      background: #f8f9fa;
      border-right: 4px solid #e53e3e;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #495057;
    }
    .info-value {
      color: #212529;
    }
    .deduction-amount {
      color: #e53e3e;
      font-weight: bold;
      font-size: 18px;
    }
    h3 {
      color: #212529;
      font-size: 20px;
      margin: 0 0 10px 0;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
    }
    .note {
      background: #fff3cd;
      border-right: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 8px;
      color: #856404;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ إشعار خصم الحضور</h1>
    </div>
    <div class="content">
      <h3>عزيزي ${employeeName}،</h3>
      <p>نود إعلامك بتسجيل خصم على سجل الحضور الخاص بك. إليك التفاصيل:</p>
      
      <div class="info-box">
        <div class="info-row">
          <span class="info-label">الموظف:</span>
          <span class="info-value">${employeeName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">التاريخ:</span>
          <span class="info-value">${targetDate}</span>
        </div>
        <div class="info-row">
          <span class="info-label">وقت الدخول:</span>
          <span class="info-value">${record.in_time || 'غير مسجل'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">وقت الخروج:</span>
          <span class="info-value">${record.out_time || 'غير مسجل'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">نوع الخصم:</span>
          <span class="info-value">${ruleName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">نسبة الخصم:</span>
          <span class="info-value deduction-amount">${percentage}</span>
        </div>
      </div>
      
      <div class="note">
        <strong>ملاحظة:</strong> سيتم مراجعة واعتماد الخصومات في يوم 24 من كل شهر.
      </div>
      
      <p>في حال وجود أي استفسار، يرجى التواصل مع قسم الموارد البشرية.</p>
    </div>
    <div class="footer">
      <p>نظام إدارة الحضور - Edara HR</p>
    </div>
  </div>
</body>
</html>`;

        // Send email async in background (same pattern as shift notification)
        sendEmailInBackground(employee.email, emailHtml, hrManagerEmails);
      }

      notificationsSent++;
      console.log(`Sent notification to ${employeeName} (${employee.zk_employee_code}) - ${ruleName} (${percentage})`);
    }

    console.log(`Sent ${notificationsSent} deduction notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notificationsSent} deduction notifications`,
        count: notificationsSent,
        date: targetDate,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending deduction notifications:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
