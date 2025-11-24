import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShiftCloseNotificationRequest {
  shiftId: string;
  userId: string;
  shiftSessionId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shiftId, userId, shiftSessionId }: ShiftCloseNotificationRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Fetch shift details
    const shiftResponse = await fetch(`${supabaseUrl}/rest/v1/shifts?id=eq.${shiftId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const shifts = await shiftResponse.json();
    const shift = shifts[0];

    // Fetch user profile who closed the shift
    const userResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const users = await userResponse.json();
    const userProfile = users[0];

    // Fetch shift session details
    const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/shift_sessions?id=eq.${shiftSessionId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    const sessions = await sessionResponse.json();
    const session = sessions[0];

    // Fetch brand balances for this shift session
    const balancesResponse = await fetch(
      `${supabaseUrl}/rest/v1/shift_brand_balances?shift_session_id=eq.${shiftSessionId}&select=*,brands(brand_name,short_name)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    const brandBalances = await balancesResponse.json();

    // Fetch shift admins
    const adminsResponse = await fetch(
      `${supabaseUrl}/rest/v1/shift_admins?shift_id=eq.${shiftId}&select=user_id`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    const adminAssignments = await adminsResponse.json();

    // Fetch admin profiles
    const adminIds = adminAssignments.map((a: any) => a.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ message: 'No admins found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const adminProfilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=in.(${adminIds.join(',')})&select=*`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    const adminProfiles = await adminProfilesResponse.json();

    // Format dates
    const closedAt = new Date(session.closed_at);
    const hijriDate = closedAt.toLocaleDateString('ar-SA-u-ca-islamic');
    const gregorianDate = closedAt.toLocaleDateString('ar-SA');
    const weekday = closedAt.toLocaleDateString('ar-SA', { weekday: 'long' });
    const time = closedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    // Create brand balances table HTML
    let balancesTableRows = '';
    brandBalances.forEach((balance: any) => {
      const brandName = balance.brands?.short_name || balance.brands?.brand_name || 'غير معروف';
      balancesTableRows += `
        <tr>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${brandName}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${balance.closing_balance.toFixed(2)}</td>
          <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">${balance.receipt_image_path ? '✓' : '✗'}</td>
        </tr>
      `;
    });

    const emailBody = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #dc2626; margin-top: 0; text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 15px;">
            إغلاق وردية
          </h2>
          
          <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border-right: 4px solid #dc2626; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #991b1b;">تفاصيل الوردية</h3>
            <p style="margin: 5px 0;"><strong>اسم الوردية:</strong> ${shift.shift_name}</p>
            <p style="margin: 5px 0;"><strong>الموظف:</strong> ${userProfile.user_name}</p>
          </div>

          <div style="margin: 20px 0; padding: 15px; background-color: #f0f9ff; border-right: 4px solid #0284c7; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #075985;">التاريخ والوقت</h3>
            <p style="margin: 5px 0;"><strong>اليوم:</strong> ${weekday}</p>
            <p style="margin: 5px 0;"><strong>التاريخ الهجري:</strong> ${hijriDate}</p>
            <p style="margin: 5px 0;"><strong>التاريخ الميلادي:</strong> ${gregorianDate}</p>
            <p style="margin: 5px 0;"><strong>وقت الإغلاق:</strong> ${time}</p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #059669; margin-bottom: 10px;">أرصدة العلامات التجارية عند الإغلاق</h3>
            <table style="width: 100%; border-collapse: collapse; background-color: white;">
              <thead>
                <tr style="background-color: #059669; color: white;">
                  <th style="padding: 12px; border: 1px solid #059669; text-align: right;">العلامة التجارية</th>
                  <th style="padding: 12px; border: 1px solid #059669; text-align: center;">الرصيد النهائي</th>
                  <th style="padding: 12px; border: 1px solid #059669; text-align: center;">صورة الإيصال</th>
                </tr>
              </thead>
              <tbody>
                ${balancesTableRows}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
            <p>هذا إشعار تلقائي من نظام إدارة الورديات</p>
          </div>
        </div>
      </div>
    `;

    // Send notifications and emails to all admins
    const smtpHostname = Deno.env.get('SMTP_HOSTNAME') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpUsername = Deno.env.get('SMTP_USERNAME');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    for (const admin of adminProfiles) {
      // Create in-app notification
      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          user_id: admin.user_id,
          title: 'إغلاق وردية',
          message: `تم إغلاق وردية ${shift.shift_name} بواسطة ${userProfile.user_name}`,
          type: 'shift_close',
        }),
      });

      // Send email if admin has email and SMTP is configured
      if (admin.email && smtpUsername && smtpPassword) {
        try {
          const client = new SMTPClient({
            connection: {
              hostname: smtpHostname,
              port: smtpPort,
              tls: true,
              auth: {
                username: smtpUsername,
                password: smtpPassword,
              },
            },
          });

          // Encode subject as Base64 UTF-8 for proper Arabic display
          const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent('إغلاق وردية - Shift Closed')))}?=`;

          await client.send({
            from: smtpUsername,
            to: admin.email,
            subject: encodedSubject,
            content: 'text/html; charset=utf-8',
            html: emailBody,
          });

          await client.close();
          console.log(`Email sent to ${admin.email}`);
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: 'Notifications sent successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-shift-close-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
