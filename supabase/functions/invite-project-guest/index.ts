import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function encodeSubject(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

function buildRawEmail(from: string, to: string, subject: string, htmlBody: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
  ].join("\r\n");
  const htmlBytes = new TextEncoder().encode(htmlBody);
  const htmlBase64 = btoa(String.fromCharCode(...htmlBytes));
  const lines = htmlBase64.match(/.{1,76}/g) || [];
  return headers + "\r\n" + lines.join("\r\n");
}

async function sendRawEmail(host: string, port: number, username: string, password: string, from: string, to: string, rawMessage: string) {
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const read = async () => {
    const buf = new Uint8Array(1024);
    const n = await conn.read(buf);
    return n ? decoder.decode(buf.subarray(0, n)) : "";
  };
  const write = async (cmd: string) => { await conn.write(encoder.encode(cmd + "\r\n")); };
  try {
    await read();
    await write(`EHLO localhost`); await read();
    await write(`AUTH LOGIN`); await read();
    await write(btoa(username)); await read();
    await write(btoa(password));
    const authRes = await read();
    if (!authRes.startsWith("235")) throw new Error("SMTP Authentication failed");
    await write(`MAIL FROM:<${username}>`); await read();
    await write(`RCPT TO:<${to}>`); await read();
    await write(`DATA`); await read();
    await conn.write(encoder.encode(rawMessage + "\r\n.\r\n")); await read();
    await write(`QUIT`);
  } finally { conn.close(); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, email: rawEmail, role } = body || {};
    const email = String(rawEmail || "").trim().toLowerCase();

    if (!project_id || !emailRegex.test(email) || !["editor", "viewer"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission check
    const { data: isAdmin } = await supaAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: isMgr } = await supaAdmin.rpc("is_project_manager", { p_project_id: project_id, p_user_id: user.id });
      allowed = !!isMgr;
    }
    if (!allowed) {
      const { data: proj } = await supaAdmin.from("projects").select("department_id").eq("id", project_id).maybeSingle();
      if (proj) {
        const { data: da } = await supaAdmin.from("department_admins").select("id").eq("user_id", user.id).eq("department_id", proj.department_id).maybeSingle();
        if (da) allowed = true;
      }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert invite
    const { data: existing } = await supaAdmin
      .from("project_guests").select("id, accepted_at, invite_token")
      .eq("project_id", project_id).eq("email", email).maybeSingle();

    let invite_token: string;
    if (existing) {
      if (existing.accepted_at) {
        return new Response(JSON.stringify({ error: "Guest already accepted" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: upd, error: updErr } = await supaAdmin
        .from("project_guests")
        .update({ role, invited_by: user.id, invited_at: new Date().toISOString() })
        .eq("id", existing.id).select("invite_token").single();
      if (updErr) throw updErr;
      invite_token = upd.invite_token;
    } else {
      const { data: ins, error: insErr } = await supaAdmin
        .from("project_guests")
        .insert({ project_id, email, role, invited_by: user.id })
        .select("invite_token").single();
      if (insErr) throw insErr;
      invite_token = ins.invite_token;
    }

    // Always use production URL for invitation links so guests land on the live app
    const PROD_URL = "https://edaraasus.com";
    const signupUrl = `${PROD_URL}/guest-signup?token=${invite_token}`;
    const { data: project } = await supaAdmin.from("projects").select("name").eq("id", project_id).maybeSingle();
    const projectName = project?.name || "a project";

    // Send email via project SMTP (Hostinger)
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? "";
      if (!smtpPassword) throw new Error("SMTP_PASSWORD not configured");
      const smtpHost = "smtp.hostinger.com";
      const smtpPort = 465;
      const smtpUsername = "edara@asuscards.com";
      const fromAddress = "Edara Support <edara@asuscards.com>";
      const roleLabel = role === "editor" ? "Editor (can edit, add tasks & chat)" : "Viewer (view only)";

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Tahoma,sans-serif;margin:0;padding:0;background:#f4f4f4;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);color:#fff;padding:30px;text-align:center;">
      <h1 style="margin:0;font-size:24px;">You're invited to collaborate</h1>
    </div>
    <div style="padding:30px;">
      <p style="font-size:16px;line-height:1.6;">You've been invited to join the project <strong>${projectName}</strong> on <strong>Edara</strong>.</p>
      <p style="font-size:16px;line-height:1.6;"><strong>Your access:</strong> ${roleLabel}</p>
      <p style="text-align:center;margin:30px 0;">
        <a href="${signupUrl}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Accept Invitation</a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.5;">Or copy this link into your browser:<br/><span style="word-break:break-all;color:#2563eb;">${signupUrl}</span></p>
    </div>
    <div style="background:#f8f9fa;padding:20px;text-align:center;color:#6c757d;font-size:13px;">
      <p style="margin:0;">This invitation was sent from Edara — Projects & Tasks</p>
    </div>
  </div>
</body></html>`;

      const raw = buildRawEmail(fromAddress, email, `Invitation to project: ${projectName}`, html);
      await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, email, raw);
      emailSent = true;
    } catch (e) {
      emailError = String((e as Error).message || e);
      console.error("Failed to send invite email:", emailError);
    }

    return new Response(JSON.stringify({ ok: true, signupUrl, emailSent, emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-project-guest error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
