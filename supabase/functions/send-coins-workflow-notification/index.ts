import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CoinsNotificationRequest {
  type: "phase_transition" | "assignment_added" | "assignment_removed";
  userId: string;
  userName?: string;
  brandName?: string;
  phase?: string;
  phaseLabel?: string;
  orderNumber?: string;
  orderId?: string;
  link?: string;
}

// Encode subject to Base64 for proper UTF-8 handling (RFC 2047)
function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

// Build raw email with Base64-encoded HTML body
function buildRawEmail(from: string, to: string, subject: string, htmlBody: string): string {
  const encodedSubject = encodeSubject(subject);

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    '',
  ].join('\r\n');

  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(htmlBody);
  const htmlBase64 = btoa(String.fromCharCode(...htmlBytes));
  const lines = htmlBase64.match(/.{1,76}/g) || [];

  return headers + '\r\n' + lines.join('\r\n');
}

// Raw SMTP client with TLS
async function sendRawEmail(host: string, port: number, username: string, password: string, to: string, rawMessage: string): Promise<void> {
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
    await write(`DATA`);
    await read();
    await conn.write(encoder.encode(rawMessage + '\r\n.\r\n'));
    await read();
    await write(`QUIT`);
    console.log('Email sent successfully via raw SMTP to:', to);
  } finally {
    conn.close();
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    const smtpHost = "smtp.hostinger.com";
    const smtpPort = 465;
    const smtpUsername = "edara@asuscards.com";
    const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? "";
    const fromAddress = "Edara Support <edara@asuscards.com>";

    const rawMessage = buildRawEmail(fromAddress, to, subject, html);
    await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, to, rawMessage);
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

async function sendPushNotification(
  supabase: any,
  userId: string,
  title: string,
  body: string
) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ userId, title, body }),
    });
    const result = await response.text();
    console.log("Push notification result:", result);
  } catch (err) {
    console.error("Push notification failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: CoinsNotificationRequest = await req.json();
    console.log("Coins workflow notification request:", data);

    const { type, userId, userName, brandName, phase, phaseLabel, orderNumber, orderId, link } = data;

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, user_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userEmail = profile?.email;
    const displayName = userName || profile?.user_name || "User";

    if (type === "phase_transition") {
      const subject = `Edara - مهمة جديدة في سير عمل العملات | New Coins Workflow Task`;
      const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">مهمة جديدة في سير عمل العملات</h2>
            <p style="margin: 5px 0 0;">New Coins Workflow Task</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>مرحبا ${displayName},</p>
            <p>لديك مهمة جديدة في سير عمل العملات:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandName || "-"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${phaseLabel || phase || "-"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">رقم الطلب / Order #:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${orderNumber || "-"}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
          </div>
        </div>
      `;

      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(supabase, userId, "مهمة جديدة في سير عمل العملات", `${brandName || ""} - ${phaseLabel || phase || ""}`);

    } else if (type === "assignment_added") {
      const subject = `Edara - تم تعيينك في سير عمل العملات | Coins Workflow Assignment`;
      const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">تم تعيينك في سير عمل العملات</h2>
            <p style="margin: 5px 0 0;">Coins Workflow Assignment</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>مرحبا ${displayName},</p>
            <p>تم تعيينك كمسؤول في سير عمل العملات:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandName || "-"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${phaseLabel || phase || "-"}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
          </div>
        </div>
      `;

      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(supabase, userId, "تم تعيينك في سير عمل العملات", `${brandName || ""} - ${phaseLabel || phase || ""}`);

    } else if (type === "assignment_removed") {
      const subject = `Edara - تم ازالة تعيينك من سير عمل العملات | Coins Workflow Unassignment`;
      const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">تم ازالة تعيينك من سير عمل العملات</h2>
            <p style="margin: 5px 0 0;">Coins Workflow Unassignment</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>مرحبا ${displayName},</p>
            <p>تم ازالة تعيينك من سير عمل العملات:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandName || "-"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${phaseLabel || phase || "-"}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
          </div>
        </div>
      `;

      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(supabase, userId, "تم ازالة تعيينك من سير عمل العملات", `${brandName || ""} - ${phaseLabel || phase || ""}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
