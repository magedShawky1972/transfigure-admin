import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    // Default to yesterday's date for deduction notifications
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = body.target_date || yesterday.toISOString().split('T')[0];

    console.log(`Sending deduction notifications for date: ${targetDate}`);

    // Fetch attendance records with deductions that haven't been notified
    // Exclude records with vacation_type set (employees on vacation)
    const { data: records, error: recError } = await supabase
      .from('saved_attendance')
      .select('*')
      .eq('attendance_date', targetDate)
      .eq('deduction_notification_sent', false)
      .gt('deduction_amount', 0)
      .is('vacation_type', null);

    if (recError) throw recError;

    console.log(`Found ${records?.length || 0} records with deductions to notify (excluding vacations)`);

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No deduction notifications to send', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee codes
    const employeeCodes = [...new Set(records.map(r => r.employee_code))];

    // Fetch employees with their user info
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, first_name_ar, last_name_ar, zk_employee_code, email, user_id, basic_salary')
      .in('zk_employee_code', employeeCodes);

    if (empError) throw empError;

    // Fetch deduction rules for context
    const { data: deductionRules, error: drError } = await supabase
      .from('deduction_rules')
      .select('id, rule_name, rule_name_ar');

    if (drError) throw drError;

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

    const rulesMap = new Map((deductionRules || []).map(r => [r.id, r]));
    const employeesMap = new Map((employees || []).map(e => [e.zk_employee_code, e]));

    let notificationsSent = 0;

    for (const record of records) {
      const employee = employeesMap.get(record.employee_code);
      if (!employee || !employee.user_id) continue;

      const rule = record.deduction_rule_id ? rulesMap.get(record.deduction_rule_id) : null;
      const ruleName = rule?.rule_name_ar || rule?.rule_name || 'خصم';
      const employeeName = `${employee.first_name_ar || employee.first_name} ${employee.last_name_ar || employee.last_name}`;

      const notificationTitle = 'إشعار خصم الحضور';
      const notificationBody = `تم تسجيل خصم بمبلغ ${record.deduction_amount?.toFixed(2)} ر.س بتاريخ ${targetDate}. السبب: ${ruleName}`;

      // Create internal notification (using 'custom' type as 'deduction' is not in allowed list)
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: employee.user_id,
        title: notificationTitle,
        message: notificationBody,
        type: 'custom',
        is_read: false,
      });

      if (notifError) {
        console.error(`Error creating notification for ${employee.zk_employee_code}:`, notifError);
        continue;
      }

      // Update notification sent flag
      await supabase
        .from('saved_attendance')
        .update({
          deduction_notification_sent: true,
          deduction_notification_sent_at: new Date().toISOString(),
        })
        .eq('id', record.id);

      // Send email if configured - CC HR managers when deduction > 0
      if (employee.email) {
        try {
          // Professional styled email template matching other system emails
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
          <span class="info-label">السبب:</span>
          <span class="info-value">${ruleName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">مبلغ الخصم:</span>
          <span class="info-value deduction-amount">${record.deduction_amount?.toFixed(2)} ر.س</span>
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

          const emailConfig: any = {
            from: "Edara HR <edara@asuscards.com>",
            to: employee.email,
            subject: "إشعار خصم الحضور",
            content: "text/html; charset=utf-8",
            html: emailHtml,
          };

          // Add CC to HR managers if deduction amount > 0 and there are HR managers
          if (record.deduction_amount > 0 && hrManagerEmails.length > 0) {
            emailConfig.cc = hrManagerEmails;
            console.log(`Adding CC to HR managers for employee ${employee.zk_employee_code}: ${hrManagerEmails.join(', ')}`);
          }

          await smtpClient.send(emailConfig);
          await smtpClient.close();
          console.log(`Deduction email sent to ${employee.email}`);
        } catch (emailError) {
          console.error('Error sending email:', emailError);
        }
      }

      notificationsSent++;
    }

    console.log(`Sent ${notificationsSent} deduction notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notificationsSent} deduction notifications`,
        count: notificationsSent,
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