import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

async function sendEmailInBackground(
  email: string,
  userName: string,
  emailSubject: string,
  emailHtml: string
) {
  try {
    const smtpClient = new SMTPClient({
      connection: {
        hostname: "smtp.hostinger.com",
        port: 465,
        tls: true,
        auth: {
          username: "edara@asuscards.com",
          password: Deno.env.get("SMTP_PASSWORD") ?? "",
        },
      },
    });

    console.log("Attempting to send task notification email to:", email);
    await smtpClient.send({
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: emailSubject,
      content: "auto",
      html: emailHtml,
    });
    await smtpClient.close();
    console.log("Email sent successfully to:", email);
  } catch (emailError) {
    console.error("Failed to send email to", email, ":", emailError);
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requestData: TaskNotificationRequest = await req.json();
    
    console.log("Task notification request:", requestData);

    const { type, taskId, taskTitle, departmentId, completedByUserId, completedByUserName } = requestData;

    if (type === "task_completed") {
      // Get department admins
      const { data: departmentAdmins, error: adminsError } = await supabase
        .from("department_admins")
        .select(`
          user_id,
          profiles:user_id (
            user_name,
            email
          )
        `)
        .eq("department_id", departmentId);

      if (adminsError) {
        console.error("Error fetching department admins:", adminsError);
        throw adminsError;
      }

      console.log("Department admins found:", departmentAdmins?.length);

      // Get department name
      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", departmentId)
        .single();

      const departmentName = department?.department_name || "Unknown Department";

      // Current time in KSA
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

      // Send notifications to each department admin (except the one who completed the task)
      for (const admin of departmentAdmins || []) {
        if (admin.user_id === completedByUserId) continue; // Skip the user who completed the task
        
        const profile = admin.profiles as any;
        if (!profile?.email) continue;

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id: admin.user_id,
          title: "مهمة مكتملة",
          message: `تم إكمال المهمة "${taskTitle}" بواسطة ${completedByUserName}`,
          type: "task_completed",
          is_read: false,
        });

        // Send email notification
        const emailSubject = "إشعار إكمال مهمة";
        const emailHtml = `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h3 style="color: #22c55e;">تم إكمال مهمة</h3>
            <p style="font-size: 16px;">
              <strong>عنوان المهمة:</strong> ${taskTitle}
            </p>
            <p style="font-size: 16px;">
              <strong>القسم:</strong> ${departmentName}
            </p>
            <p style="font-size: 16px;">
              <strong>تم الإكمال بواسطة:</strong> ${completedByUserName}
            </p>
            <p style="font-size: 16px;">
              <strong>وقت الإكمال:</strong> ${formattedTime}
            </p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
              هذا إشعار تلقائي من نظام إدارة المهام.
            </p>
          </div>
        `;

        await sendEmailInBackground(profile.email, profile.user_name, emailSubject, emailHtml);

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
