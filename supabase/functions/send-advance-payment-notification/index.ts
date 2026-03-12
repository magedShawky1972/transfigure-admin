import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdvancePaymentNotificationRequest {
  type: "phase_transition" | "delay_alert";
  userId: string;
  userName?: string;
  supplierName?: string;
  phase?: string;
  phaseLabel?: string;
  paymentId?: string;
  transactionAmount?: number;
  currencyCode?: string;
  delayDays?: number;
  responsibleUserName?: string;
}

const phaseLabelsAr: Record<string, string> = {
  entry: "الإدخال",
  receiving: "الاستلام",
  accounting: "المحاسبة",
};

function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

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
    if (!authResponse.startsWith('235')) throw new Error('SMTP Authentication failed');
    await write(`MAIL FROM:<${username}>`);
    await read();
    await write(`RCPT TO:<${to}>`);
    await read();
    await write(`DATA`);
    await read();
    await conn.write(encoder.encode(rawMessage + '\r\n.\r\n'));
    await read();
    await write(`QUIT`);
    console.log('Advance payment notification email sent to:', to);
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

async function sendPushNotification(userId: string, title: string, body: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ userId, title, body }),
    });
  } catch (err) {
    console.error("Push notification failed:", err);
  }
}

function buildPhaseTransitionHtml(displayName: string, supplierName: string, arPhaseLabel: string, amount: string) {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0;">مهمة جديدة - دفعات مقدمة للموردين</h2>
        <p style="margin: 5px 0 0;">New Supplier Advance Payment Task</p>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p>مرحبا ${displayName},</p>
        <p>لديك مهمة جديدة في سير عمل دفعات الموردين المقدمة:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المورد / Supplier:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${supplierName || "-"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${arPhaseLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المبلغ / Amount:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${amount}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
      </div>
    </div>`;
}

function buildDelayAlertHtml(displayName: string, supplierName: string, arPhaseLabel: string, delayDays: number, responsibleUserName: string, isSupervisor: boolean) {
  const title = isSupervisor
    ? "تنبيه تأخير - دفعات الموردين - إشعار مشرف"
    : "تنبيه تأخير - مهمتك متأخرة في دفعات الموردين";
  const message = isSupervisor
    ? `يوجد تأخير في سير عمل دفعات الموردين لمدة ${delayDays} يوم:`
    : `مهمتك في دفعات الموردين متأخرة لمدة ${delayDays} يوم. يرجى المتابعة:`;

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0;">${title}</h2>
        <p style="margin: 5px 0 0;">Supplier Advance Payment Delay Alert</p>
      </div>
      <div style="background: #fef2f2; padding: 20px; border: 1px solid #fecaca; border-radius: 0 0 8px 8px;">
        <p>مرحبا ${displayName},</p>
        <p style="color: #dc2626; font-weight: bold;">${message}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">المورد / Supplier:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${supplierName || "-"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">المرحلة المتأخرة / Delayed Phase:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${arPhaseLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">مدة التأخير / Delay:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca; color: #dc2626; font-weight: bold;">${delayDays} يوم / ${delayDays} day(s)</td></tr>
          ${isSupervisor ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">المسؤول / Responsible:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${responsibleUserName || "-"}</td></tr>` : ""}
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
      </div>
    </div>`;
}

async function getSupervisors(supabase: any) {
  const { data: supervisors } = await supabase
    .from("coins_workflow_supervisors")
    .select("user_id, user_name")
    .eq("is_active", true);

  if (!supervisors || supervisors.length === 0) return [];

  const result: { user_id: string; user_name: string; email?: string }[] = [];
  for (const s of supervisors) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, user_name")
      .eq("user_id", s.user_id)
      .maybeSingle();
    result.push({
      user_id: s.user_id,
      user_name: s.user_name || profile?.user_name || "",
      email: profile?.email,
    });
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data: AdvancePaymentNotificationRequest = await req.json();
    console.log("Advance payment notification request:", data);

    const { type, userId, userName, supplierName, phase, phaseLabel, paymentId, transactionAmount, currencyCode, delayDays, responsibleUserName } = data;

    const arPhaseLabel = phaseLabel || phaseLabelsAr[phase || ""] || phase || "-";
    const amountDisplay = transactionAmount ? `${transactionAmount} ${currencyCode || ""}` : "-";

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, user_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userEmail = profile?.email;
    const displayName = userName || profile?.user_name || "User";

    const supervisors = await getSupervisors(supabase);

    if (type === "phase_transition") {
      // In-app notification
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "مهمة جديدة - دفعات الموردين",
        message: `لديك مهمة جديدة في مرحلة ${arPhaseLabel} للمورد ${supplierName || ""}`,
        type: "advance_payment_phase",
        is_read: false,
      });

      // Email
      const subject = `Edara - مهمة جديدة في دفعات الموردين | New Supplier Advance Payment Task`;
      const html = buildPhaseTransitionHtml(displayName, supplierName || "", arPhaseLabel, amountDisplay);
      if (userEmail) await sendEmail(userEmail, subject, html);

      // Push
      await sendPushNotification(userId, "مهمة جديدة - دفعات الموردين", `${supplierName || ""} - ${arPhaseLabel}`);

      // Notify supervisors
      for (const sup of supervisors) {
        if (sup.user_id === userId) continue;
        await supabase.from("notifications").insert({
          user_id: sup.user_id,
          title: "تحديث دفعات الموردين - مشرف",
          message: `تم انتقال دفعة مورد ${supplierName || ""} إلى مرحلة ${arPhaseLabel}`,
          type: "advance_payment_phase",
          is_read: false,
        });
        if (sup.email) {
          const supHtml = `
            <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #d97706; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                <h2 style="margin: 0;">تحديث دفعات الموردين - إشعار مشرف</h2>
                <p style="margin: 5px 0 0;">Supplier Advance Payment Update - Supervisor</p>
              </div>
              <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <p>مرحبا ${sup.user_name},</p>
                <p>تم انتقال دفعة مورد إلى مرحلة جديدة:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                  <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المورد / Supplier:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${supplierName || "-"}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${arPhaseLabel}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المبلغ / Amount:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${amountDisplay}</td></tr>
                  <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المسؤول / Assigned To:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${displayName}</td></tr>
                </table>
                <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة - إشعار مشرف</p>
              </div>
            </div>`;
          await sendEmail(sup.email, subject, supHtml);
        }
        await sendPushNotification(sup.user_id, "تحديث دفعات الموردين", `${supplierName || ""} - ${arPhaseLabel}`);
      }

    } else if (type === "delay_alert") {
      const days = delayDays || 1;

      // In-app notification
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "تنبيه تأخير - دفعات الموردين",
        message: `دفعة المورد ${supplierName || ""} متأخرة ${days} يوم في مرحلة ${arPhaseLabel}`,
        type: "advance_payment_delay",
        is_read: false,
      });

      // Email to responsible
      const subject = `Edara - تنبيه تأخير دفعات الموردين | Supplier Payment Delay Alert`;
      const html = buildDelayAlertHtml(displayName, supplierName || "", arPhaseLabel, days, "", false);
      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(userId, "تنبيه تأخير - دفعات الموردين", `متأخر ${days} يوم في مرحلة ${arPhaseLabel}`);

      // Supervisors
      for (const sup of supervisors) {
        if (sup.user_id === userId) continue;
        await supabase.from("notifications").insert({
          user_id: sup.user_id,
          title: "تنبيه تأخير - دفعات الموردين (مشرف)",
          message: `دفعة المورد ${supplierName || ""} متأخرة ${days} يوم - المسؤول: ${responsibleUserName || displayName}`,
          type: "advance_payment_delay",
          is_read: false,
        });
        if (sup.email) {
          const supHtml = buildDelayAlertHtml(sup.user_name, supplierName || "", arPhaseLabel, days, responsibleUserName || displayName, true);
          await sendEmail(sup.email, subject, supHtml);
        }
        await sendPushNotification(sup.user_id, "تنبيه تأخير - دفعات الموردين", `${supplierName || ""} متأخر ${days} يوم`);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
