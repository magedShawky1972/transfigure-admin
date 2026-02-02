import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { data: records, error: recError } = await supabase
      .from('saved_attendance')
      .select('*')
      .eq('attendance_date', targetDate)
      .eq('has_issues', true)
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

      // Create internal notification
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: employee.user_id,
        title: notificationTitle,
        body: notificationBody,
        type: 'deduction',
        is_read: false,
        data: {
          date: targetDate,
          in_time: record.in_time,
          out_time: record.out_time,
          deduction_amount: record.deduction_amount,
          deduction_rule: ruleName,
        },
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

      // Send email if configured
      if (employee.email) {
        try {
          await supabase.functions.invoke('send-email-smtp', {
            body: {
              to: employee.email,
              subject: notificationTitle,
              html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2 style="color: #e53e3e;">${notificationTitle}</h2>
                  <p>${notificationBody}</p>
                  <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
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
              `,
            },
          });
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
