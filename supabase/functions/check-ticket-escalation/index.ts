import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESCALATION_DAYS = 3;
const MD_EMAIL = 'nawaf@asuscards.com';

function encodeSubj(s: string): string {
  const b = btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return `=?UTF-8?B?${b}?=`;
}

function buildRaw(from: string, to: string, cc: string[], subject: string, html: string): string {
  const hdrs = [`From: ${from}`, `To: ${to}`, cc.length ? `Cc: ${cc.join(', ')}` : '', `Subject: ${encodeSubj(subject)}`, 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', ''].filter(Boolean).join('\r\n');
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(html)));
  return hdrs + '\r\n' + (b64.match(/.{1,76}/g) || []).join('\r\n');
}

async function sendMail(to: string, cc: string[], raw: string): Promise<void> {
  const conn = await Deno.connectTls({ hostname: 'smtp.hostinger.com', port: 465 });
  const enc = new TextEncoder(), dec = new TextDecoder();
  const rd = async () => { const b = new Uint8Array(1024); const n = await conn.read(b); return n ? dec.decode(b.subarray(0, n)) : ''; };
  const wr = async (c: string) => { await conn.write(enc.encode(c + '\r\n')); };
  try {
    await rd(); await wr('EHLO localhost'); await rd();
    await wr('AUTH LOGIN'); await rd();
    await wr(btoa('edara@asuscards.com')); await rd();
    await wr(btoa(Deno.env.get('SMTP_PASSWORD') ?? '')); 
    const a = await rd(); if (!a.startsWith('235')) throw new Error('SMTP auth failed');
    await wr(`MAIL FROM:<edara@asuscards.com>`); await rd();
    await wr(`RCPT TO:<${to}>`); await rd();
    for (const c of cc) { await wr(`RCPT TO:<${c}>`); await rd(); }
    await wr('DATA'); await rd();
    await conn.write(enc.encode(raw + '\r\n.\r\n')); await rd();
    await wr('QUIT');
  } finally { conn.close(); }
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function buildHtml(tickets: any[]): string {
  const rows = tickets.map(t => `<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:12px;text-align:right;font-size:14px">${t.ticket_number}</td><td style="padding:12px;text-align:right;font-size:14px">${t.subject||'بدون عنوان'}</td><td style="padding:12px;text-align:right;font-size:14px">${t.creator_name||'غير محدد'}</td><td style="padding:12px;text-align:right;font-size:14px">${t.department_name||'غير محدد'}</td><td style="padding:12px;text-align:right;font-size:14px">${t.approver_name||'غير محدد'}</td><td style="padding:12px;text-align:right;font-size:14px">${t.priority||'-'}</td><td style="padding:12px;text-align:right;font-size:14px">${formatDate(t.created_at)}</td><td style="padding:12px;text-align:right;font-size:14px;color:#dc2626;font-weight:bold">${t.days_pending} يوم</td></tr>`).join('');
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Arial,sans-serif"><div style="max-width:850px;margin:0 auto;padding:20px"><div style="background:linear-gradient(135deg,#7c2d12,#ea580c);border-radius:12px 12px 0 0;padding:30px;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">تنبيه تصعيد - تذاكر معلقة بدون إجراء</h1><p style="color:#fed7aa;margin:10px 0 0;font-size:16px">تذاكر لم يتم اعتمادها أو رفضها لأكثر من ${ESCALATION_DAYS} أيام</p></div><div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,.1)"><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px"><p style="margin:0;color:#991b1b;font-size:15px;font-weight:600">تنبيه: التذاكر التالية معلقة في مرحلة الاعتماد ولم يتم الموافقة عليها أو رفضها خلال ${ESCALATION_DAYS} أيام عمل.</p></div><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb"><thead><tr style="background:#f8fafc"><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">رقم التذكرة</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">الموضوع</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">مقدم التذكرة</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">القسم</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">المعتمد الحالي</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">الأولوية</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">تاريخ الإنشاء</th><th style="padding:14px 12px;text-align:right;font-size:13px;font-weight:700;color:#374151;border-bottom:2px solid #e5e7eb">أيام الانتظار</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;padding:16px;background:#fff7ed;border-radius:8px"><p style="margin:0;color:#9a3412;font-size:14px">يرجى متابعة هذه التذاكر مع المعتمدين المعنيين لاتخاذ الإجراء المناسب في أسرع وقت.</p></div><div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center"><p style="color:#9ca3af;font-size:12px;margin:0">نظام إدارة - تنبيه تصعيد تذاكر تلقائي</p></div></div></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let body: any = {}; try { body = await req.json(); } catch (_) {}
    const from = 'Edara Support <edara@asuscards.com>';

    if (body?.test) {
      const sample = [{ ticket_number: 'TKT-TEST-0001', subject: 'طلب شراء تجريبي', creator_name: 'أحمد', department_name: 'التقنية', approver_name: 'خالد', priority: 'High', created_at: new Date(Date.now() - 5*86400000).toISOString(), days_pending: 5 }];
      const raw = buildRaw(from, body.test_email || MD_EMAIL, [], `[تجربة] تصعيد - تذكرة معلقة`, buildHtml(sample));
      await sendMail(body.test_email || MD_EMAIL, [], raw);
      return new Response(JSON.stringify({ message: 'Test sent', test: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - ESCALATION_DAYS);

    const { data: stale, error: fe } = await supabase.from('tickets')
      .select('id, ticket_number, subject, user_id, department_id, priority, status, created_at, next_admin_order, is_purchase_ticket, returned_for_clarification')
      .is('approved_at', null).is('ticket_escalation_sent_at', null).eq('is_deleted', false)
      .not('status', 'in', '("Cancelled","Closed","Rejected")')
      .lte('created_at', cutoff.toISOString());
    if (fe) throw fe;

    const pending = (stale || []).filter(t => !t.returned_for_clarification);
    if (!pending.length) return new Response(JSON.stringify({ message: 'No stale tickets', count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const uids = [...new Set(pending.map(t => t.user_id))];
    const dids = [...new Set(pending.map(t => t.department_id).filter(Boolean))];

    const [{ data: creators }, { data: depts }, { data: admins }] = await Promise.all([
      supabase.from('profiles').select('user_id, user_name, email').in('user_id', uids),
      supabase.from('departments').select('id, department_name').in('id', dids),
      supabase.from('department_admins').select('department_id, user_id, admin_order, is_purchase_admin').in('department_id', dids),
    ]);

    const adminUids = [...new Set((admins || []).map(a => a.user_id))];
    const [{ data: adminProfs }, { data: hrMgrs }, { data: nawafP }] = await Promise.all([
      supabase.from('profiles').select('user_id, user_name, email').in('user_id', adminUids),
      supabase.from('hr_managers').select('user_id').eq('is_active', true),
      supabase.from('profiles').select('user_id').eq('email', MD_EMAIL).limit(1),
    ]);

    const hrUids = (hrMgrs || []).map(h => h.user_id);
    const { data: hrProfs } = await supabase.from('profiles').select('user_id, email').in('user_id', hrUids);
    const hrEmails = (hrProfs || []).map(p => p.email).filter(Boolean);

    const enriched = pending.map(t => {
      const cr = (creators || []).find(p => p.user_id === t.user_id);
      const dp = (depts || []).find(d => d.id === t.department_id);
      const no = t.next_admin_order ?? 0;
      const da = (admins || []).filter(a => a.department_id === t.department_id);
      let appr: any = null;
      if (t.is_purchase_ticket) {
        const reg = da.filter(a => !a.is_purchase_admin && a.admin_order === no);
        appr = reg.length ? (adminProfs || []).find(p => p.user_id === reg[0].user_id) : (adminProfs || []).find(p => p.user_id === (da.filter(a => a.is_purchase_admin && a.admin_order === no)[0]?.user_id));
      } else {
        const at = da.filter(a => !a.is_purchase_admin && a.admin_order === no);
        if (at.length) appr = (adminProfs || []).find(p => p.user_id === at[0].user_id);
      }
      return { ...t, creator_name: cr?.user_name || 'غير محدد', department_name: dp?.department_name || 'غير محدد', approver_name: appr?.user_name || 'غير محدد', approver_email: appr?.email, days_pending: Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000) };
    });

    const cc = hrEmails.filter(e => e !== MD_EMAIL);
    const raw = buildRaw(from, MD_EMAIL, cc, `تصعيد - ${enriched.length} تذكرة معلقة لأكثر من ${ESCALATION_DAYS} أيام`, buildHtml(enriched));
    await sendMail(MD_EMAIL, cc, raw);

    // In-app notifications
    const notifyIds = [...new Set([...(nawafP || []).map(p => p.user_id), ...hrUids, ...(adminProfs || []).filter(p => enriched.some(t => t.approver_email === p.email)).map(p => p.user_id)])];
    const nums = enriched.map(t => t.ticket_number).join('، ');
    if (notifyIds.length) {
      await supabase.from('notifications').insert(notifyIds.map(uid => ({ user_id: uid, title: `تصعيد - ${enriched.length} تذكرة معلقة`, message: `التذاكر التالية معلقة لأكثر من ${ESCALATION_DAYS} أيام: ${nums}`, type: 'ticket_update', is_read: false })));
    }

    await supabase.from('tickets').update({ ticket_escalation_sent_at: new Date().toISOString(), ticket_escalation_count: 1 }).in('id', pending.map(t => t.id));

    return new Response(JSON.stringify({ message: `Escalated ${enriched.length} tickets`, count: enriched.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Ticket escalation error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
