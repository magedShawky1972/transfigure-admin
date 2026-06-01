import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function buildHtml(recipientName: string, senderName: string, url: string, note: string, context: {
  projectName?: string; departmentName?: string; groupBy?: string;
}): { subject: string; html: string } {
  const subject = `${senderName || "Edara"} shared a Projects & Tasks view with you`;
  const ctxRows: string[] = [];
  if (context.projectName) ctxRows.push(`<tr><td style="padding:6px 10px;color:#555;">Project</td><td style="padding:6px 10px;"><b>${context.projectName}</b></td></tr>`);
  if (context.departmentName) ctxRows.push(`<tr><td style="padding:6px 10px;color:#555;">Department</td><td style="padding:6px 10px;"><b>${context.departmentName}</b></td></tr>`);
  if (context.groupBy) ctxRows.push(`<tr><td style="padding:6px 10px;color:#555;">Group By</td><td style="padding:6px 10px;"><b>${context.groupBy}</b></td></tr>`);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;background:#f4f4f4;margin:0;padding:0;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#2563eb;color:#fff;padding:18px 22px;">
      <h2 style="margin:0;font-size:18px;">Projects &amp; Tasks — Shared View</h2>
    </div>
    <div style="padding:22px;color:#111;line-height:1.6;">
      <p>Hi ${recipientName || "there"},</p>
      <p><b>${senderName || "A colleague"}</b> shared a Projects &amp; Tasks view with you.</p>
      ${note ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:12px;margin:12px 0;color:#374151;"><b>Note:</b> ${note.replace(/</g, "&lt;")}</div>` : ""}
      ${ctxRows.length ? `<table style="border-collapse:collapse;margin:12px 0;width:100%;">${ctxRows.join("")}</table>` : ""}
      <p style="margin-top:18px;">
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Open the view</a>
      </p>
      <p style="font-size:12px;color:#6b7280;margin-top:24px;word-break:break-all;">${url}</p>
    </div>
  </div>
</body></html>`;
  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json().catch(() => ({}));
    const recipients: string[] = Array.isArray(body.recipientUserIds) ? body.recipientUserIds : [];
    const url: string = body.url || "";
    const note: string = body.note || "";
    const senderUserId: string | undefined = body.senderUserId;
    const projectName: string | undefined = body.projectName;
    const departmentName: string | undefined = body.departmentName;
    const groupBy: string | undefined = body.groupBy;

    if (!recipients.length || !url) {
      return new Response(JSON.stringify({ error: "recipientUserIds and url are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    let senderName = "A colleague";
    if (senderUserId) {
      const { data: s } = await supabase.from("profiles").select("user_name").eq("user_id", senderUserId).maybeSingle();
      if (s?.user_name) senderName = s.user_name;
    }

    const { data: profiles } = await supabase
      .from("profiles").select("user_id, user_name, email").in("user_id", recipients);

    const smtpHost = "smtp.hostinger.com";
    const smtpPort = 465;
    const smtpUser = "edara@asuscards.com";
    const smtpPass = Deno.env.get("SMTP_PASSWORD") ?? "";
    const fromAddr = "Edara Support <edara@asuscards.com>";

    let sent = 0;
    for (const uid of recipients) {
      const p = (profiles || []).find((x: any) => x.user_id === uid);
      if (!p) continue;
      const ctx = projectName || departmentName ? ` (${[projectName, departmentName].filter(Boolean).join(" · ")})` : "";
      const title = `${senderName} shared a view with you${ctx}`;
      const message = `${note ? note + "\n\n" : ""}Open: ${url}`;

      await supabase.from("notifications").insert({
        user_id: uid,
        title,
        message,
        type: "task_update",
        is_read: false,
        sender_id: senderUserId ?? null,
        sender_name: senderName,
      });

      if (p.email && smtpPass) {
        try {
          const { subject, html } = buildHtml(p.user_name || "", senderName, url, note, { projectName, departmentName, groupBy });
          const raw = buildRawEmail(fromAddr, p.email, subject, html);
          await sendSmtp(smtpHost, smtpPort, smtpUser, smtpPass, fromAddr, p.email, raw);
        } catch (e) { console.error("Email failed for", p.email, e); }
      }

      try {
        await supabase.functions.invoke("send-push-notification", {
          body: { userId: uid, title, body: message, data: { type: "shared_view", url } },
        });
      } catch (e) { console.error("Push failed:", e); }

      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error("share-projects-view error:", e);
    return new Response(JSON.stringify({ error: e.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
