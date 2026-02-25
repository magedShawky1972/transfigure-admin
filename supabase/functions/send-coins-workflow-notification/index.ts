import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CoinsNotificationRequest {
  type: "phase_transition" | "assignment_added" | "assignment_removed" | "delay_alert";
  userId: string;
  userName?: string;
  brandName?: string;
  brandNames?: string[];
  phase?: string;
  phaseLabel?: string;
  orderNumber?: string;
  orderId?: string;
  link?: string;
  delayDays?: number;
  responsibleUserName?: string;
}

const phaseLabelsAr: Record<string, string> = {
  creation: "الإنشاء",
  sending: "التوجيه",
  receiving: "الاستلام",
  coins_entry: "إدخال الكوينز",
  completed: "مكتمل",
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

async function sendPushNotification(supabase: any, userId: string, title: string, body: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ userId, title, body }),
    });
    const result = await response.text();
    console.log("Push notification result:", result);
  } catch (err) {
    console.error("Push notification failed:", err);
  }
}

async function getSupervisors(supabase: any): Promise<{ user_id: string; user_name: string; email?: string }[]> {
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

function buildPhaseTransitionHtml(displayName: string, brandDisplayHtml: string, arPhaseLabel: string, orderNumber: string) {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0;">مهمة جديدة في سير عمل الكوينز</h2>
        <p style="margin: 5px 0 0;">New Coins Workflow Task</p>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p>مرحبا ${displayName},</p>
        <p>لديك مهمة جديدة في سير عمل الكوينز:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandDisplayHtml}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${arPhaseLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">رقم الطلب / Order #:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${orderNumber || "-"}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
      </div>
    </div>`;
}

function buildSupervisorPhaseHtml(displayName: string, brandDisplayHtml: string, arPhaseLabel: string, orderNumber: string, responsibleUser: string) {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #d97706; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0;">تحديث سير عمل الكوينز - إشعار مشرف</h2>
        <p style="margin: 5px 0 0;">Coins Workflow Update - Supervisor Notification</p>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <p>مرحبا ${displayName},</p>
        <p>تم انتقال طلب كوينز إلى مرحلة جديدة:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandDisplayHtml}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة الحالية / Current Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${arPhaseLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">رقم الطلب / Order #:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${orderNumber || "-"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المسؤول / Assigned To:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${responsibleUser || "-"}</td></tr>
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة - إشعار مشرف</p>
      </div>
    </div>`;
}

function buildDelayAlertHtml(displayName: string, brandDisplayHtml: string, arPhaseLabel: string, orderNumber: string, delayDays: number, responsibleUserName: string, isSupervisor: boolean) {
  const headerColor = "#dc2626";
  const title = isSupervisor
    ? "تنبيه تأخير في سير عمل الكوينز - إشعار مشرف"
    : "تنبيه تأخير - مهمتك متأخرة في سير عمل الكوينز";
  const subtitle = isSupervisor
    ? "Coins Workflow Delay Alert - Supervisor"
    : "Coins Workflow Delay Alert - Your Task is Overdue";
  const message = isSupervisor
    ? `يوجد تأخير في سير عمل الكوينز لمدة ${delayDays} يوم:`
    : `مهمتك في سير عمل الكوينز متأخرة لمدة ${delayDays} يوم. يرجى المتابعة:`;

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${headerColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0;">${title}</h2>
        <p style="margin: 5px 0 0;">${subtitle}</p>
      </div>
      <div style="background: #fef2f2; padding: 20px; border: 1px solid #fecaca; border-radius: 0 0 8px 8px;">
        <p>مرحبا ${displayName},</p>
        <p style="color: #dc2626; font-weight: bold;">${message}</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${brandDisplayHtml}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">المرحلة المتأخرة / Delayed Phase:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${arPhaseLabel}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">رقم الطلب / Order #:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${orderNumber || "-"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">مدة التأخير / Delay:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca; color: #dc2626; font-weight: bold;">${delayDays} يوم / ${delayDays} day(s)</td></tr>
          ${isSupervisor ? `<tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #fecaca;">المسؤول المتأخر / Responsible:</td><td style="padding: 8px; border-bottom: 1px solid #fecaca;">${responsibleUserName || "-"}</td></tr>` : ""}
        </table>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
      </div>
    </div>`;
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

    const { type, userId, userName, brandName, brandNames, phase, phaseLabel, orderNumber, orderId, delayDays, responsibleUserName } = data;

    // Resolve brand display names
    let resolvedBrandNames: string[] = [];
    if (brandNames && brandNames.length > 0) {
      resolvedBrandNames = brandNames;
    } else if (brandName) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(brandName)) {
        const { data: brand } = await supabase.from("brands").select("brand_name").eq("id", brandName).maybeSingle();
        resolvedBrandNames = [brand?.brand_name || brandName];
      } else {
        resolvedBrandNames = [brandName];
      }
    }

    const brandDisplayHtml = resolvedBrandNames.length > 0
      ? resolvedBrandNames.map(n => `<div style="padding: 2px 0;">${n}</div>`).join("")
      : "-";

    const arPhaseLabel = phaseLabel || phaseLabelsAr[phase || ""] || phase || "-";

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, user_name")
      .eq("user_id", userId)
      .maybeSingle();

    const userEmail = profile?.email;
    const displayName = userName || profile?.user_name || "User";

    // Get supervisors for notification
    const supervisors = await getSupervisors(supabase);

    if (type === "phase_transition") {
      const subject = `Edara - مهمة جديدة في سير عمل الكوينز | New Coins Workflow Task`;
      const html = buildPhaseTransitionHtml(displayName, brandDisplayHtml, arPhaseLabel, orderNumber || "-");

      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(supabase, userId, "مهمة جديدة في سير عمل الكوينز", `${resolvedBrandNames.join(", ") || ""} - ${arPhaseLabel}`);

      // Notify supervisors
      const supervisorSubject = `Edara - تحديث سير عمل الكوينز | Coins Workflow Update`;
      for (const sup of supervisors) {
        if (sup.user_id === userId) continue; // Don't double-notify if supervisor is the assignee
        const supHtml = buildSupervisorPhaseHtml(sup.user_name || "مشرف", brandDisplayHtml, arPhaseLabel, orderNumber || "-", displayName);
        if (sup.email) await sendEmail(sup.email, supervisorSubject, supHtml);
        await sendPushNotification(supabase, sup.user_id, "تحديث سير عمل الكوينز", `${resolvedBrandNames.join(", ") || ""} - ${arPhaseLabel} - ${displayName}`);
      }

    } else if (type === "assignment_added") {
      const subject = `Edara - تم تعيينك في سير عمل الكوينز | Coins Workflow Assignment`;
      const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">تم تعيينك في سير عمل الكوينز</h2>
            <p style="margin: 5px 0 0;">Coins Workflow Assignment</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>مرحبا ${displayName},</p>
            <p>تم تعيينك كمسؤول في سير عمل الكوينز:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandDisplayHtml}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${arPhaseLabel}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
          </div>
        </div>`;

      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(supabase, userId, "تم تعيينك في سير عمل الكوينز", `${resolvedBrandNames.join(", ") || ""} - ${arPhaseLabel}`);

    } else if (type === "assignment_removed") {
      const subject = `Edara - تم ازالة تعيينك من سير عمل الكوينز | Coins Workflow Unassignment`;
      const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">تم ازالة تعيينك من سير عمل الكوينز</h2>
            <p style="margin: 5px 0 0;">Coins Workflow Unassignment</p>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <p>مرحبا ${displayName},</p>
            <p>تم ازالة تعيينك من سير عمل الكوينز:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">العلامة التجارية / Brand:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${brandDisplayHtml}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">المرحلة / Phase:</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${arPhaseLabel}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">هذه رسالة تلقائية من نظام ادارة</p>
          </div>
        </div>`;

      if (userEmail) await sendEmail(userEmail, subject, html);
      await sendPushNotification(supabase, userId, "تم ازالة تعيينك من سير عمل الكوينز", `${resolvedBrandNames.join(", ") || ""} - ${arPhaseLabel}`);

    } else if (type === "delay_alert") {
      const days = delayDays || 1;

      // Send to the responsible user
      const responsibleSubject = `Edara - تنبيه تأخير في سير عمل الكوينز | Coins Workflow Delay Alert`;
      const responsibleHtml = buildDelayAlertHtml(displayName, brandDisplayHtml, arPhaseLabel, orderNumber || "-", days, "", false);
      if (userEmail) await sendEmail(userEmail, responsibleSubject, responsibleHtml);
      await sendPushNotification(supabase, userId, "تنبيه تأخير - سير عمل الكوينز", `طلب ${orderNumber || ""} متأخر ${days} يوم في مرحلة ${arPhaseLabel}`);

      // Send to supervisors
      const supervisorSubject = `Edara - تنبيه تأخير في سير عمل الكوينز | Coins Workflow Delay Alert`;
      for (const sup of supervisors) {
        const supHtml = buildDelayAlertHtml(sup.user_name || "مشرف", brandDisplayHtml, arPhaseLabel, orderNumber || "-", days, responsibleUserName || displayName, true);
        if (sup.email) await sendEmail(sup.email, supervisorSubject, supHtml);
        await sendPushNotification(supabase, sup.user_id, "تنبيه تأخير - سير عمل الكوينز", `طلب ${orderNumber || ""} متأخر ${days} يوم - المسؤول: ${responsibleUserName || displayName}`);
      }
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
