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
    console.log('Ticket escalation email sent successfully');
  } finally {
    conn.close();
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildEscalationEmail(tickets: any[]): string {
  const ticketRows = tickets.map(t => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: right; font-size: 14px;">${t.ticket_number}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${t.subject || 'بدون عنوان'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${t.creator_name || 'غير محدد'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${t.department_name || 'غير محدد'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${t.approver_name || 'غير محدد'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${t.priority || '-'}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px;">${formatDate(t.created_at)}</td>
      <td style="padding: 12px; text-align: right; font-size: 14px; color: #dc2626; font-weight: bold;">${t.days_pending} يوم</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
  <div style="max-width: 850px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #7c2d12 0%, #ea580c 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">تنبيه تصعيد - تذاكر معلقة بدون إجراء</h1>
      <p style="color: #fed7aa; margin: 10px 0 0; font-size: 16px;">تذاكر لم يتم اعتمادها أو رفضها لأكثر من ${ESCALATION_DAYS} أيام</p>
    </div>
    
    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; color: #991b1b; font-size: 15px; font-weight: 600;">
          تنبيه: التذاكر التالية معلقة في مرحلة الاعتماد ولم يتم الموافقة عليها أو رفضها خلال ${ESCALATION_DAYS} أيام عمل.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">رقم التذكرة</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">الموضوع</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">مقدم التذكرة</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">القسم</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">المعتمد الحالي</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">الأولوية</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">تاريخ الإنشاء</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb;">أيام الانتظار</th>
          </tr>
        </thead>
        <tbody>
          ${ticketRows}
        </tbody>
      </table>

      <div style="margin-top: 24px; padding: 16px; background: #fff7ed; border-radius: 8px;">
        <p style="margin: 0; color: #9a3412; font-size: 14px;">
          يرجى متابعة هذه التذاكر مع المعتمدين المعنيين لاتخاذ الإجراء المناسب في أسرع وقت.
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">نظام إدارة - تنبيه تصعيد تذاكر تلقائي</p>
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

    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const isTest = body?.test === true;
    const testEmail = body?.test_email || MD_EMAIL;

    console.log('Checking for stale tickets pending approval...');

    if (isTest) {
      console.log(`TEST MODE: Sending sample ticket escalation email to ${testEmail}`);
      
      const sampleTickets = [
        {
          ticket_number: 'TKT-20260307-0001',
          subject: 'طلب شراء أجهزة حاسب',
          creator_name: 'أحمد محمد',
          department_name: 'قسم التقنية',
          approver_name: 'خالد العتيبي',
          priority: 'High',
          created_at: '2026-03-05T00:00:00',
          days_pending: 5,
        },
        {
          ticket_number: 'TKT-20260306-0003',
          subject: 'طلب صيانة طابعة',
          creator_name: 'سارة أحمد',
          department_name: 'قسم المبيعات',
          approver_name: 'فهد السعيد',
          priority: 'Medium',
          created_at: '2026-03-04T00:00:00',
          days_pending: 6,
        },
      ];

      const emailHtml = buildEscalationEmail(sampleTickets);
      const subject = `[تجربة] تصعيد - ${sampleTickets.length} تذكرة معلقة لأكثر من ${ESCALATION_DAYS} أيام`;

      const smtpHost = 'smtp.hostinger.com';
      const smtpPort = 465;
      const smtpUsername = 'edara@asuscards.com';
      const smtpPassword = Deno.env.get('SMTP_PASSWORD') ?? '';
      const fromAddress = 'Edara Support <edara@asuscards.com>';

      const rawMessage = buildRawEmail(fromAddress, testEmail, [], subject, emailHtml);
      await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, testEmail, [], rawMessage);

      return new Response(
        JSON.stringify({ message: `Test ticket escalation email sent to ${testEmail}`, test: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find tickets pending approval for more than ESCALATION_DAYS
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - ESCALATION_DAYS);

    // Get tickets that are not yet fully approved and not cancelled/closed/rejected
    const { data: staleTickets, error: fetchError } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject, user_id, department_id, priority, status, created_at, next_admin_order, is_purchase_ticket, approved_at, ticket_escalation_sent_at, returned_for_clarification')
      .is('approved_at', null)
      .is('ticket_escalation_sent_at', null)
      .eq('is_deleted', false)
      .not('status', 'in', '("Cancelled","Closed","Rejected")')
      .lte('created_at', threeDaysAgo.toISOString());

    if (fetchError) {
      throw new Error(`Error fetching tickets: ${fetchError.message}`);
    }

    // Filter out tickets returned for clarification (waiting on creator, not approver)
    const pendingTickets = (staleTickets || []).filter(t => !t.returned_for_clarification);

    if (pendingTickets.length === 0) {
      console.log('No stale tickets found');
      return new Response(
        JSON.stringify({ message: 'No stale tickets to escalate', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingTickets.length} stale tickets`);

    // Get creator profiles
    const creatorIds = [...new Set(pendingTickets.map(t => t.user_id))];
    const { data: creatorProfiles } = await supabase
      .from('profiles')
      .select('user_id, user_name, email')
      .in('user_id', creatorIds);

    // Get department details
    const departmentIds = [...new Set(pendingTickets.map(t => t.department_id).filter(Boolean))];
    const { data: departments } = await supabase
      .from('departments')
      .select('id, department_name')
      .in('id', departmentIds);

    // Get department admins to find current approvers
    const { data: allDeptAdmins } = await supabase
      .from('department_admins')
      .select('department_id, user_id, admin_order, is_purchase_admin')
      .in('department_id', departmentIds);

    // Get admin profiles
    const adminUserIds = [...new Set((allDeptAdmins || []).map(a => a.user_id))];
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('user_id, user_name, email')
      .in('user_id', adminUserIds);

    // Get HR manager emails
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

    // Build enriched ticket data
    const enrichedTickets = pendingTickets.map(t => {
      const creator = (creatorProfiles || []).find(p => p.user_id === t.user_id);
      const dept = (departments || []).find(d => d.id === t.department_id);
      const nextOrder = t.next_admin_order ?? 0;
      
      // Find the current approver
      const deptAdmins = (allDeptAdmins || []).filter(a => a.department_id === t.department_id);
      let currentApprover: any = null;
      
      if (t.is_purchase_ticket) {
        const regularAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
        if (regularAtOrder.length > 0) {
          currentApprover = (adminProfiles || []).find(p => p.user_id === regularAtOrder[0].user_id);
        } else {
          const purchaseAtOrder = deptAdmins.filter(a => a.is_purchase_admin && a.admin_order === nextOrder);
          if (purchaseAtOrder.length > 0) {
            currentApprover = (adminProfiles || []).find(p => p.user_id === purchaseAtOrder[0].user_id);
          }
        }
      } else {
        const adminsAtOrder = deptAdmins.filter(a => !a.is_purchase_admin && a.admin_order === nextOrder);
        if (adminsAtOrder.length > 0) {
          currentApprover = (adminProfiles || []).find(p => p.user_id === adminsAtOrder[0].user_id);
        }
      }

      const now = new Date();
      const createdAt = new Date(t.created_at);
      const daysPending = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...t,
        creator_name: creator?.user_name || 'غير محدد',
        department_name: dept?.department_name || 'غير محدد',
        approver_name: currentApprover?.user_name || 'غير محدد',
        approver_email: currentApprover?.email || null,
        days_pending: daysPending,
      };
    });

    // Send escalation email to MD + HR
    const emailHtml = buildEscalationEmail(enrichedTickets);
    const subject = `تصعيد - ${enrichedTickets.length} تذكرة معلقة لأكثر من ${ESCALATION_DAYS} أيام`;

    const smtpHost = 'smtp.hostinger.com';
    const smtpPort = 465;
    const smtpUsername = 'edara@asuscards.com';
    const smtpPassword = Deno.env.get('SMTP_PASSWORD') ?? '';
    const fromAddress = 'Edara Support <edara@asuscards.com>';

    const ccList = [...hrEmails.filter(e => e !== MD_EMAIL)];
    const rawMessage = buildRawEmail(fromAddress, MD_EMAIL, ccList, subject, emailHtml);

    await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, MD_EMAIL, ccList, rawMessage);

    console.log(`Ticket escalation email sent to ${MD_EMAIL}, CC: ${ccList.join(', ')}`);

    // Send in-app notifications to nawaf and HR managers
    const notificationRecipients = [...new Set([
      // Find nawaf's user_id
      ...(creatorProfiles || []).filter(p => p.email === MD_EMAIL).map(p => p.user_id),
      ...(adminProfiles || []).filter(p => p.email === MD_EMAIL).map(p => p.user_id),
      ...hrUserIds,
    ])];

    // If nawaf not found in existing profiles, search separately
    const { data: nawafProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', MD_EMAIL)
      .limit(1);
    
    if (nawafProfile && nawafProfile.length > 0) {
      notificationRecipients.push(nawafProfile[0].user_id);
    }

    const uniqueRecipients = [...new Set(notificationRecipients)];
    
    // Also notify the current approvers who are delaying
    const approverEmails = [...new Set(enrichedTickets.map(t => t.approver_email).filter(Boolean))];
    const { data: approverProfilesFull } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('email', approverEmails);

    const allNotifyIds = [...new Set([
      ...uniqueRecipients,
      ...(approverProfilesFull || []).map(p => p.user_id),
    ])];

    // Insert notifications
    const ticketNumbers = enrichedTickets.map(t => t.ticket_number).join('، ');
    const notificationInserts = allNotifyIds.map(userId => ({
      user_id: userId,
      title: `تصعيد - ${enrichedTickets.length} تذكرة معلقة`,
      message: `التذاكر التالية معلقة لأكثر من ${ESCALATION_DAYS} أيام بدون إجراء: ${ticketNumbers}`,
      type: 'ticket_update',
      is_read: false,
    }));

    if (notificationInserts.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notificationInserts);
      
      if (notifError) {
        console.error('Error inserting notifications:', notifError);
      } else {
        console.log(`Sent ${notificationInserts.length} in-app notifications`);
      }
    }

    // Mark tickets as escalated
    const ticketIds = pendingTickets.map(t => t.id);
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        ticket_escalation_sent_at: new Date().toISOString(),
        ticket_escalation_count: 1,
      })
      .in('id', ticketIds);

    if (updateError) {
      console.error('Error updating ticket escalation status:', updateError);
    }

    return new Response(
      JSON.stringify({
        message: `Ticket escalation sent for ${enrichedTickets.length} tickets`,
        count: enrichedTickets.length,
        sentTo: MD_EMAIL,
        cc: ccList,
        notified: allNotifyIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Ticket escalation check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
