import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCALATION_DAYS = 3;
const MD_EMAIL = 'nawaf@asuscards.com';

function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

function buildRawEmail(
  from: string,
  to: string,
  cc: string[],
  subject: string,
  htmlBody: string
): string {
  const encodedSubject = encodeSubject(subject);
  
  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    '',
  ].filter(Boolean).join('\r\n');
  
  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(htmlBody);
  const htmlBase64 = btoa(String.fromCharCode(...htmlBytes));
  const lines = htmlBase64.match(/.{1,76}/g) || [];
  
  return headers + '\r\n' + lines.join('\r\n');
}

async function sendRawEmail(
  host: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  cc: string[],
  rawMessage: string
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function read(): Promise<string> {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    return n ? decoder.decode(buffer.subarray(0, n)) : '';
  }

  async function write(cmd: string): Promise<void> {
    await conn.write(encoder.encode(cmd + '\r\n'));
  }

  try {
    await read();
    await write(`EHLO localhost`);
    await read();
    await write(`AUTH LOGIN`);
    await read();
    await write(btoa(username));
    await read();
    await write(btoa(password));
    const authResponse = await read();
    if (!authResponse.startsWith('235')) {
      throw new Error('SMTP Authentication failed');
    }
    await write(`MAIL FROM:<${username}>`);
    await read();
    await write(`RCPT TO:<${to}>`);
    await read();
    for (const ccEmail of cc) {
      await write(`RCPT TO:<${ccEmail}>`);
      await read();
    }
    await write(`DATA`);
    await read();
    await conn.write(encoder.encode(rawMessage + '\r\n.\r\n'));
    await read();
    await write(`QUIT`);
    console.log('Escalation email sent successfully');
  } finally {
    conn.close();
  }
}

function getRequestTypeName(type: string): string {
  const types: Record<string, string> = {
    'vacation': 'طلب إجازة',
    'early_leave': 'طلب مغادرة مبكرة',
    'delay': 'طلب تأخير',
    'expense_refund': 'طلب استرداد مصروفات',
    'business_trip': 'طلب رحلة عمل',
    'work_from_home': 'طلب عمل من المنزل',
    'overtime': 'طلب عمل إضافي',
  };
  return types[type] || type;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildEscalationEmail(requests: any[]): string {
  const requestRows = requests.map(r => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: right; font-size: 14px;">${r.request_number}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${r.employee_name || 'غير محدد'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${getRequestTypeName(r.request_type)}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${r.department_name || 'غير محدد'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${r.manager_name || 'غير محدد'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${formatDate(r.request_date)}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px; color: #dc2626; font-weight: bold;">${r.days_pending} يوم</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
  <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">تنبيه تصعيد - طلبات موظفين معلقة</h1>
      <p style="color: #bfdbfe; margin: 10px 0 0; font-size: 16px;">طلبات لم يتم اتخاذ إجراء عليها لأكثر من ${ESCALATION_DAYS} أيام</p>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #991b1b; font-size: 15px; font-weight: 600;">
          تنبيه: الطلبات التالية معلقة في مرحلة اعتماد مدير القسم ولم يتم الموافقة عليها أو رفضها خلال ${ESCALATION_DAYS} أيام عمل.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">رقم الطلب</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">الموظف</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">نوع الطلب</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">القسم</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">مدير القسم</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">تاريخ الطلب</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">أيام الانتظار</th>
          </tr>
        </thead>
        <tbody>
          ${requestRows}
        </tbody>
      </table>

      <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px;">
        <p style="margin: 0; color: #1e40af; font-size: 14px;">
          يرجى متابعة هذه الطلبات مع مديري الأقسام المعنيين لاتخاذ الإجراء المناسب في أسرع وقت.
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">نظام إدارة - تنبيه تصعيد تلقائي</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a test request
    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const isTest = body?.test === true;
    const testEmail = body?.test_email || MD_EMAIL;

    console.log('Checking for stale employee requests in manager phase...');

    if (isTest) {
      console.log(`TEST MODE: Sending sample escalation email to ${testEmail}`);
      
      const sampleRequests = [
        {
          request_number: 'ER-20260307-0001',
          employee_name: 'أحمد محمد',
          request_type: 'vacation',
          department_name: 'قسم المبيعات',
          manager_name: 'خالد العتيبي',
          request_date: '2026-03-05T00:00:00',
          days_pending: 5,
        },
        {
          request_number: 'ER-20260306-0003',
          employee_name: 'سارة أحمد',
          request_type: 'early_leave',
          department_name: 'قسم التقنية',
          manager_name: 'فهد السعيد',
          request_date: '2026-03-04T00:00:00',
          days_pending: 6,
        },
        {
          request_number: 'ER-20260307-0005',
          employee_name: 'عبدالله الشهري',
          request_type: 'expense_refund',
          department_name: 'قسم المالية',
          manager_name: 'محمد القحطاني',
          request_date: '2026-03-06T00:00:00',
          days_pending: 4,
        },
      ];

      const emailHtml = buildEscalationEmail(sampleRequests);
      const subject = `[تجربة] تصعيد - ${sampleRequests.length} طلب موظفين معلق لأكثر من ${ESCALATION_DAYS} أيام`;

      const smtpHost = 'smtp.hostinger.com';
      const smtpPort = 465;
      const smtpUsername = 'edara@asuscards.com';
      const smtpPassword = Deno.env.get('SMTP_PASSWORD') ?? '';
      const fromAddress = 'Edara Support <edara@asuscards.com>';

      const rawMessage = buildRawEmail(fromAddress, testEmail, [], subject, emailHtml);
      await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, testEmail, [], rawMessage);

      console.log(`Test escalation email sent to ${testEmail}`);
      return new Response(
        JSON.stringify({ message: `Test escalation email sent to ${testEmail}`, test: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find requests stuck in manager phase for more than 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - ESCALATION_DAYS);

    const { data: staleRequests, error: fetchError } = await supabase
      .from('employee_requests')
      .select(`
        id,
        request_number,
        request_type,
        request_date,
        department_id,
        employee_id,
        current_phase,
        escalation_sent_at,
        escalation_count
      `)
      .eq('current_phase', 'manager')
      .eq('status', 'pending')
      .lte('request_date', threeDaysAgo.toISOString())
      .is('escalation_sent_at', null);

    if (fetchError) {
      throw new Error(`Error fetching requests: ${fetchError.message}`);
    }

    if (!staleRequests || staleRequests.length === 0) {
      console.log('No stale requests found');
      return new Response(
        JSON.stringify({ message: 'No stale requests to escalate', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${staleRequests.length} stale requests`);

    // Get employee details
    const employeeIds = [...new Set(staleRequests.map(r => r.employee_id))];
    const { data: employees } = await supabase
      .from('employees')
      .select('id, first_name_ar, last_name_ar, first_name, last_name, department_id')
      .in('id', employeeIds);

    // Get department details
    const departmentIds = [...new Set(staleRequests.map(r => r.department_id).filter(Boolean))];
    const { data: departments } = await supabase
      .from('departments')
      .select('id, department_name')
      .in('id', departmentIds);

    // Get department managers
    const { data: deptAdmins } = await supabase
      .from('department_admins')
      .select('department_id, user_id')
      .in('department_id', departmentIds)
      .eq('is_department_manager', true)
      .eq('approve_employee_request', true);

    // Get manager profiles
    const managerUserIds = [...new Set((deptAdmins || []).map(a => a.user_id))];
    const { data: managerProfiles } = await supabase
      .from('profiles')
      .select('user_id, user_name, email')
      .in('user_id', managerUserIds);

    // Get HR manager emails for CC
    const { data: hrManagers } = await supabase
      .from('hr_managers')
      .select('user_id')
      .eq('is_active', true);

    const hrUserIds = (hrManagers || []).map(h => h.user_id);
    const { data: hrProfiles } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('user_id', hrUserIds);

    const hrEmails = (hrProfiles || []).map(p => p.email).filter(Boolean);

    // Build enriched request data
    const enrichedRequests = staleRequests.map(r => {
      const emp = (employees || []).find(e => e.id === r.employee_id);
      const dept = (departments || []).find(d => d.id === r.department_id);
      const admin = (deptAdmins || []).find(a => a.department_id === r.department_id);
      const manager = admin ? (managerProfiles || []).find(p => p.user_id === admin.user_id) : null;

      const now = new Date();
      const reqDate = new Date(r.request_date);
      const daysPending = Math.floor((now.getTime() - reqDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...r,
        employee_name: emp ? `${emp.first_name_ar || emp.first_name || ''} ${emp.last_name_ar || emp.last_name || ''}`.trim() : 'غير محدد',
        department_name: dept?.department_name || 'غير محدد',
        manager_name: manager?.user_name || 'غير محدد',
        days_pending: daysPending,
      };
    });

    // Build and send escalation email
    const emailHtml = buildEscalationEmail(enrichedRequests);
    const subject = `تصعيد - ${enrichedRequests.length} طلب موظفين معلق لأكثر من ${ESCALATION_DAYS} أيام`;

    const smtpHost = 'smtp.hostinger.com';
    const smtpPort = 465;
    const smtpUsername = 'edara@asuscards.com';
    const smtpPassword = Deno.env.get('SMTP_PASSWORD') ?? '';
    const fromAddress = 'Edara Support <edara@asuscards.com>';

    // Send to MD with HR managers as CC
    const ccList = [...hrEmails.filter(e => e !== MD_EMAIL)];
    const rawMessage = buildRawEmail(fromAddress, MD_EMAIL, ccList, subject, emailHtml);

    await sendRawEmail(
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      fromAddress,
      MD_EMAIL,
      ccList,
      rawMessage
    );

    console.log(`Escalation email sent to ${MD_EMAIL}, CC: ${ccList.join(', ')}`);

    // Mark requests as escalated
    const requestIds = staleRequests.map(r => r.id);
    const { error: updateError } = await supabase
      .from('employee_requests')
      .update({
        escalation_sent_at: new Date().toISOString(),
        escalation_count: 1,
      })
      .in('id', requestIds);

    if (updateError) {
      console.error('Error updating escalation status:', updateError);
    }

    return new Response(
      JSON.stringify({
        message: `Escalation email sent for ${enrichedRequests.length} requests`,
        count: enrichedRequests.length,
        sentTo: MD_EMAIL,
        cc: ccList,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Escalation check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
