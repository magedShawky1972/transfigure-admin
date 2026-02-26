import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskNotificationRequest {
  type: "task_completed";
  taskId: string;
  taskTitle: string;
  departmentId: string;
  completedByUserId: string;
  completedByUserName: string;
}

// Encode subject to Base64 for proper UTF-8 handling
function encodeSubject(subject: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
}

// Build raw email message with proper encoding for Arabic
function buildRawEmail(
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): string {
  const encodedSubject = encodeSubject(subject);

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
  ].join("\r\n");

  const encoder = new TextEncoder();
  const htmlBytes = encoder.encode(htmlBody);
  const htmlBase64 = btoa(String.fromCharCode(...htmlBytes));
  const lines = htmlBase64.match(/.{1,76}/g) || [];

  return headers + "\r\n" + lines.join("\r\n");
}

// Raw SMTP client for proper Arabic email delivery
async function sendRawEmail(
  host: string,
  port: number,
  username: string,
  password: string,
  from: string,
  to: string,
  rawMessage: string
): Promise<void> {
  const conn = await Deno.connectTls({ hostname: host, port });
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  async function read(): Promise<string> {
    const buffer = new Uint8Array(1024);
    const n = await conn.read(buffer);
    return n ? decoder.decode(buffer.subarray(0, n)) : "";
  }

  async function write(cmd: string): Promise<void> {
    await conn.write(encoder.encode(cmd + "\r\n"));
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
    if (!authResponse.startsWith("235")) {
      throw new Error("SMTP Authentication failed");
    }
    await write(`MAIL FROM:<${username}>`);
    await read();
    await write(`RCPT TO:<${to}>`);
    await read();
    await write(`DATA`);
    await read();
    await conn.write(encoder.encode(rawMessage + "\r\n.\r\n"));
    await read();
    await write(`QUIT`);
    console.log("Task notification email sent successfully via raw SMTP to:", to);
  } finally {
    conn.close();
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData: TaskNotificationRequest = await req.json();
    
    console.log("Task notification request:", requestData);

    const { type, taskId, taskTitle, departmentId, completedByUserId, completedByUserName } = requestData;

    if (type === "task_completed") {
      const { data: departmentAdmins, error: adminsError } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", departmentId);

      if (adminsError) {
        console.error("Error fetching department admins:", adminsError);
        throw adminsError;
      }

      const adminUserIds = (departmentAdmins || []).map((a: any) => a.user_id);
      const { data: adminProfiles } = adminUserIds.length > 0
        ? await supabase.from("profiles").select("user_id, user_name, email").in("user_id", adminUserIds)
        : { data: [] };

      const adminsWithProfiles = (departmentAdmins || []).map((a: any) => ({
        ...a,
        profile: (adminProfiles || []).find((p: any) => p.user_id === a.user_id),
      }));

      console.log("Department admins found:", adminsWithProfiles.length);

      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", departmentId)
        .single();

      const departmentName = department?.department_name || "Unknown Department";

      const now = new Date();
      const ksaTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      const formattedTime = ksaTime.toLocaleString('ar-SA', { 
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const smtpHost = "smtp.hostinger.com";
      const smtpPort = 465;
      const smtpUsername = "edara@asuscards.com";
      const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? "";
      const fromAddress = "Edara Support <edara@asuscards.com>";

      for (const admin of adminsWithProfiles) {
        if (admin.user_id === completedByUserId) continue;
        
        const profile = admin.profile;
        if (!profile?.email) continue;

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: "مهمة مكتملة",
          message: `تم إكمال المهمة "${taskTitle}" بواسطة ${completedByUserName}`,
          type: "task_completed",
          is_read: false,
        });

        // Send email notification via raw SMTP
        const emailSubject = "إشعار إكمال مهمة";
        const emailHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">تم إكمال مهمة</h1>
    </div>
    <div style="padding: 30px;">
      <p style="font-size: 16px; line-height: 1.8; margin: 10px 0;">
        <strong>عنوان المهمة:</strong> ${taskTitle}
      </p>
      <p style="font-size: 16px; line-height: 1.8; margin: 10px 0;">
        <strong>القسم:</strong> ${departmentName}
      </p>
      <p style="font-size: 16px; line-height: 1.8; margin: 10px 0;">
        <strong>تم الإكمال بواسطة:</strong> ${completedByUserName}
      </p>
      <p style="font-size: 16px; line-height: 1.8; margin: 10px 0;">
        <strong>وقت الإكمال:</strong> ${formattedTime}
      </p>
    </div>
    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p style="margin: 0;">هذا إشعار تلقائي من نظام إدارة المهام - Edara</p>
    </div>
  </div>
</body>
</html>`;

        try {
          const rawMessage = buildRawEmail(fromAddress, profile.email, emailSubject, emailHtml);
          await sendRawEmail(smtpHost, smtpPort, smtpUsername, smtpPassword, fromAddress, profile.email, rawMessage);
        } catch (emailError) {
          console.error("Failed to send email to", profile.email, ":", emailError);
        }

        // Send push notification
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: admin.user_id,
              title: "مهمة مكتملة",
              body: `تم إكمال المهمة "${taskTitle}" بواسطة ${completedByUserName}`,
              data: { type: 'task_completed', taskId }
            }
          });
        } catch (pushErr) {
          console.error('Push notification error:', pushErr);
        }

        console.log(`Notification sent to admin: ${profile.user_name}`);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Task completion notifications sent" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown notification type" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-task-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
