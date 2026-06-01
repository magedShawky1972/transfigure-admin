import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Mode = "daily_due" | "end_of_day_overdue" | "all_scheduled";

function encodeSubject(s: string): string {
  const b = btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return `=?UTF-8?B?${b}?=`;
}

function buildRawEmail(from: string, to: string, subject: string, html: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
  ].join("\r\n");
  const b = btoa(String.fromCharCode(...new TextEncoder().encode(html)));
  return headers + "\r\n" + (b.match(/.{1,76}/g) || []).join("\r\n");
}

async function sendSmtp(host: string, port: number, user: string, pass: string, from: string, to: string, raw: string) {
  const conn = await Deno.connectTls({ hostname: host, port });
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const read = async () => {
    const buf = new Uint8Array(2048);
    const n = await conn.read(buf);
    return n ? dec.decode(buf.subarray(0, n)) : "";
  };
  const write = async (s: string) => { await conn.write(enc.encode(s + "\r\n")); };
  try {
    await read();
    await write("EHLO localhost"); await read();
    await write("AUTH LOGIN"); await read();
    await write(btoa(user)); await read();
    await write(btoa(pass));
    const r = await read();
    if (!r.startsWith("235")) throw new Error("SMTP auth failed");
    await write(`MAIL FROM:<${user}>`); await read();
    await write(`RCPT TO:<${to}>`); await read();
    await write("DATA"); await read();
    await conn.write(enc.encode(raw + "\r\n.\r\n")); await read();
    await write("QUIT");
  } finally {
    conn.close();
  }
}

function buildHtml(userName: string, mode: Mode, tasks: any[]): { subject: string; html: string } {
  const isOverdue = mode === "end_of_day_overdue";
  const title = isOverdue ? "مهام متأخرة تحتاج إلى متابعة" : "تذكير بالمهام المستحقة اليوم";
  const headerColor = isOverdue ? "#dc2626" : "#2563eb";
  const subject = isOverdue ? `لديك ${tasks.length} مهمة متأخرة` : `لديك ${tasks.length} مهمة مستحقة اليوم`;

  const rows = tasks.map(t => {
    const due = t.deadline ? new Date(t.deadline).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" }) : "-";
    const priority = ({ urgent: "عاجل", high: "مرتفع", medium: "متوسط", low: "منخفض" } as any)[t.priority] || t.priority;
    const project = t.project_name || "-";
    return `<tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${t.title}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${project}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${priority}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;color:${isOverdue ? '#dc2626' : '#111'};">${due}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <div style="max-width:680px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <div style="background:${headerColor};color:#fff;padding:24px 30px;">
      <h1 style="margin:0;font-size:22px;">${title}</h1>
      <p style="margin:6px 0 0;opacity:.9;">مرحباً ${userName}</p>
    </div>
    <div style="padding:24px 30px;">
      <p style="font-size:15px;color:#333;">فيما يلي قائمة المهام:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="padding:10px;text-align:right;">المهمة</th>
          <th style="padding:10px;text-align:right;">المشروع</th>
          <th style="padding:10px;text-align:right;">الأولوية</th>
          <th style="padding:10px;text-align:right;">الموعد النهائي</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:#f8f9fa;padding:16px;text-align:center;color:#6c757d;font-size:13px;">
      نظام إدارة المهام - Edara
    </div>
  </div>
</body></html>`;
  return { subject, html };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const mode: Mode = body.mode || "daily_due";
    const targetUserId: string | undefined = body.userId;

    const now = new Date();
    const ksaNow = new Date(now.getTime() + 3 * 3600 * 1000);
    const ksaDateStr = ksaNow.toISOString().slice(0, 10);
    const startOfDayUtc = new Date(`${ksaDateStr}T00:00:00+03:00`).toISOString();
    const endOfDayUtc = new Date(`${ksaDateStr}T23:59:59+03:00`).toISOString();

    let query = supabase
      .from("tasks")
      .select("id, title, deadline, priority, status, assigned_to, project_id, is_archived")
      .eq("is_archived", false)
      .neq("status", "done");

    if (mode === "daily_due") {
      query = query.gte("deadline", startOfDayUtc).lte("deadline", endOfDayUtc);
    } else {
      query = query.lt("deadline", now.toISOString());
    }

    const { data: tasks, error: taskErr } = await query;
    if (taskErr) throw taskErr;

    // Collect assignees from task_assignees + primary assigned_to
    const taskIds = (tasks || []).map(t => t.id);
    const { data: assignees } = taskIds.length
      ? await supabase.from("task_assignees").select("task_id, user_id").in("task_id", taskIds)
      : { data: [] as any[] };

    // Build map: user_id -> tasks[]
    const userTasks = new Map<string, any[]>();
    for (const t of tasks || []) {
      const userIds = new Set<string>();
      if (t.assigned_to) userIds.add(t.assigned_to);
      for (const a of assignees || []) if (a.task_id === t.id) userIds.add(a.user_id);
      for (const uid of userIds) {
        if (targetUserId && uid !== targetUserId) continue;
        if (!userTasks.has(uid)) userTasks.set(uid, []);
        userTasks.get(uid)!.push(t);
      }
    }

    if (userTasks.size === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No matching tasks" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Fetch project names
    const projectIds = Array.from(new Set((tasks || []).map(t => t.project_id).filter(Boolean)));
    const { data: projects } = projectIds.length
      ? await supabase.from("projects").select("id, name").in("id", projectIds as string[])
      : { data: [] as any[] };
    const projectName = new Map((projects || []).map((p: any) => [p.id, p.name]));

    // Fetch user profiles
    const userIds = Array.from(userTasks.keys());
    const { data: profiles } = await supabase.from("profiles").select("user_id, user_name, email").in("user_id", userIds);

    const smtpHost = "smtp.hostinger.com";
    const smtpPort = 465;
    const smtpUser = "edara@asuscards.com";
    const smtpPass = Deno.env.get("SMTP_PASSWORD") ?? "";
    const fromAddr = "Edara Support <edara@asuscards.com>";

    let sent = 0;
    for (const [uid, uTasks] of userTasks) {
      const profile = (profiles || []).find((p: any) => p.user_id === uid);
      if (!profile) continue;
      const enriched = uTasks.map(t => ({ ...t, project_name: projectName.get(t.project_id) || "-" }));
      const { subject, html } = buildHtml(profile.user_name || "", mode, enriched);

      // In-app notification
      await supabase.from("notifications").insert({
        user_id: uid,
        title: mode === "end_of_day_overdue" ? "مهام متأخرة" : "مهام مستحقة اليوم",
        message: `لديك ${enriched.length} ${mode === "end_of_day_overdue" ? "مهمة متأخرة" : "مهمة مستحقة اليوم"}`,
        type: "task_update",
        is_read: false,
      });

      // Email
      if (profile.email && smtpPass) {
        try {
          const raw = buildRawEmail(fromAddr, profile.email, subject, html);
          await sendSmtp(smtpHost, smtpPort, smtpUser, smtpPass, fromAddr, profile.email, raw);
        } catch (e) {
          console.error("Email failed for", profile.email, e);
        }
      }

      // Push
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: uid,
            title: mode === "end_of_day_overdue" ? "مهام متأخرة" : "مهام مستحقة اليوم",
            body: `لديك ${enriched.length} ${mode === "end_of_day_overdue" ? "مهمة متأخرة" : "مهمة مستحقة اليوم"}`,
            data: { type: "task_reminder", mode },
          },
        });
      } catch (e) { console.error("Push failed:", e); }

      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent, mode }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error("send-task-reminders error:", e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
