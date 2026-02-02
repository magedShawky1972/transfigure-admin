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
    // Only filter by deduction_amount > 0 (not has_issues, since deductions can exist without issues flag)
    const { data: records, error: recError } = await supabase
      .from('saved_attendance')
      .select('*')
      .eq('attendance_date', targetDate)
      .eq('deduction_notification_sent', false)
      .gt('deduction_amount', 0);

    if (recError) throw recError;

    console.log(`Found ${records?.length || 0} records with deductions to notify`);

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
          const emailHtml = `
                <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2 style="color: #e53e3e;">${notificationTitle}</h2>
                  <p>${notificationBody}</p>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>الموظف:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${employee.first_name_ar || employee.first_name} ${employee.last_name_ar || employee.last_name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>التاريخ:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${targetDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>وقت الدخول:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${record.in_time || 'غير مسجل'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>وقت الخروج:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${record.out_time || 'غير مسجل'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>مبلغ الخصم:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd; color: #e53e3e;">${record.deduction_amount?.toFixed(2)} ر.س</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #ddd;"><strong>السبب:</strong></td>
                      <td style="padding: 8px; border: 1px solid #ddd;">${ruleName}</td>
                    </tr>
                  </table>
                  <p style="margin-top: 20px; color: #666; font-size: 12px;">
                    ملاحظة: سيتم مراجعة واعتماد الخصومات في يوم 24 من كل شهر.
                  </p>
                </div>
              `;

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
            subject: notificationTitle,
            content: "auto",
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
