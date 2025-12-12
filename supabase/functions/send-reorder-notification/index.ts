import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReorderNotificationRequest {
  brandId: string;
  brandName: string;
  currentBalance: number;
  reorderPoint: number;
  type: "opening" | "closing";
  userId: string;
  userName: string;
}

async function sendEmailWithSMTP(
  email: string,
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

    console.log("Sending reorder notification email to:", email);
    
    await smtpClient.send({
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: "Reorder Request",
      content: "text/html; charset=utf-8",
      html: emailHtml,
    });
    await smtpClient.close();
    
    console.log("Reorder email sent successfully to:", email);
  } catch (emailError) {
    console.error("Failed to send reorder email to", email, ":", emailError);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload: ReorderNotificationRequest = await req.json();
    
    const { brandId, brandName, currentBalance, reorderPoint, type, userName } = payload;

    console.log("Reorder notification request:", {
      brandName,
      currentBalance,
      reorderPoint,
      type,
      userName,
    });

    // TEST MODE: Set to true to send only to test email, false for production
    const TEST_MODE = true;
    const TEST_EMAIL = "maged.shawky@asuscards.com";
    
    let profiles: Array<{ user_id: string; user_name: string; email: string }> = [];
    
    if (TEST_MODE) {
      console.log("TEST MODE: Sending reorder notification only to", TEST_EMAIL);
      profiles = [{ user_id: "test-user", user_name: "Test User", email: TEST_EMAIL }];
    } else {
      // Find "Coins Purchase" department
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("id, department_name")
        .eq("department_name", "Coins Purchase")
        .single();

      if (deptError || !department) {
        console.error("Coins Purchase department not found:", deptError);
        return new Response(
          JSON.stringify({ error: "Coins Purchase department not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Found department:", department.department_name);

      // Get all members of the Coins Purchase department
      const { data: members, error: membersError } = await supabase
        .from("department_members")
        .select("user_id")
        .eq("department_id", department.id);

      if (membersError) {
        console.error("Error fetching department members:", membersError);
        throw membersError;
      }

      if (!members || members.length === 0) {
        console.log("No members in Coins Purchase department");
        return new Response(
          JSON.stringify({ message: "No members in department" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userIds = members.map((m) => m.user_id);
      console.log("Department members:", userIds.length);

      // Get user profiles for emails
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, user_name, email")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }
      
      profiles = profilesData || [];
    }

    // Get current date in Arabic format
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
    const currentDate = dateFormatter.format(now);
    const timeFormatter = new Intl.DateTimeFormat("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    const currentTime = timeFormatter.format(now);

    const typeLabel = type === "opening" ? "فتح الوردية" : "إغلاق الوردية";

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; }
          h3 { color: #dc2626; font-size: 1.5em; margin: 15px 0; }
          p { font-size: 1.2em; line-height: 1.8; color: #333; margin: 10px 0; }
          .info-box { background-color: #fef3c7; border-right: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .warning { background-color: #fee2e2; border-right: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .value { font-weight: bold; color: #dc2626; font-size: 1.3em; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ تنبيه: رصيد منخفض</h1>
          </div>
          
          <h3>طلب شراء عملات</h3>
          
          <div class="warning">
            <p><strong>العلامة التجارية:</strong> <span class="value">${brandName}</span></p>
          </div>
          
          <div class="info-box">
            <p><strong>الرصيد الحالي:</strong> <span class="value">${currentBalance.toLocaleString("ar-SA")}</span></p>
            <p><strong>نقطة إعادة الطلب:</strong> ${reorderPoint.toLocaleString("ar-SA")}</p>
          </div>
          
          <p><strong>تم الإبلاغ عند:</strong> ${typeLabel}</p>
          <p><strong>بواسطة:</strong> ${userName}</p>
          <p><strong>التاريخ:</strong> ${currentDate}</p>
          <p><strong>الوقت:</strong> ${currentTime}</p>
          
          <div class="footer">
            <p>هذا إشعار تلقائي من نظام إدارة الورديات</p>
            <p>يرجى اتخاذ الإجراء اللازم لتجديد المخزون</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const notificationTitle = `${brandName} - طلب شراء`;
    const notificationMessage = `رصيد ${brandName} الحالي (${currentBalance.toLocaleString("ar-SA")}) أقل من أو يساوي نقطة إعادة الطلب (${reorderPoint.toLocaleString("ar-SA")}). تم الإبلاغ عند ${typeLabel} بواسطة ${userName}.`;

    // Send notifications to all department members
    for (const profile of profiles || []) {
      // Create in-app notification
      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: profile.user_id,
        title: notificationTitle,
        message: notificationMessage,
        type: "custom",
        is_read: false,
      });

      if (notifError) {
        console.error("Error creating notification for", profile.email, ":", notifError);
      } else {
        console.log("Notification created for:", profile.email);
      }

      // Send email using SMTP
      await sendEmailWithSMTP(profile.email, emailHtml);

      // Send push notification
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: profile.user_id,
            title: notificationTitle,
            body: notificationMessage,
            data: { type: "reorder_alert", brandId },
          },
        });
        console.log("Push notification sent to:", profile.email);
      } catch (pushError) {
        console.error("Error sending push notification:", pushError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications sent to ${profiles?.length || 0} members`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-reorder-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
