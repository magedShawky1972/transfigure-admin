import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShiftOpenRequest {
  shiftId: string;
  userId: string;
  shiftSessionId: string;
}

async function sendEmailInBackground(email: string, emailHtml: string, subject: string) {
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

    console.log("Attempting to send email to:", email);

    await smtpClient.send({
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: subject,
      content: "text/html; charset=utf-8",
      html: emailHtml,
    });

    await smtpClient.close();
    console.log("Email sent successfully to:", email);
  } catch (emailError) {
    console.error("Failed to send email to", email, ":", emailError);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { shiftId, userId, shiftSessionId }: ShiftOpenRequest = await req.json();

    console.log("Processing shift open notification for:", { shiftId, userId });

    // Get shift details
    const { data: shift } = await supabase
      .from("shifts")
      .select("shift_name, shift_start_time, shift_end_time")
      .eq("id", shiftId)
      .single();

    // Get user profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("user_name, email")
      .eq("user_id", userId)
      .single();

    // Get shift admins
    const { data: shiftAdmins } = await supabase
      .from("shift_admins")
      .select("user_id")
      .eq("shift_id", shiftId)
      .order("admin_order");

    if (!shiftAdmins || shiftAdmins.length === 0) {
      console.log("No shift admins found for shift:", shiftId);
      return new Response(JSON.stringify({ message: "No admins to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminUserIds = shiftAdmins.map((admin) => admin.user_id);

    // Get admin profiles
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id, user_name, email")
      .in("user_id", adminUserIds);

    if (!adminProfiles) {
      throw new Error("Could not fetch admin profiles");
    }

    const now = new Date();
    const hijriDate = now.toLocaleDateString('ar-SA-u-ca-islamic');
    const gregorianDate = now.toLocaleDateString('ar-SA');
    const weekday = now.toLocaleDateString('ar-SA', { weekday: 'long' });
    const time = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    // Create notifications for each admin
    const notifications = adminProfiles.map((admin) => ({
      user_id: admin.user_id,
      title: "تم فتح وردية جديدة",
      message: `قام ${userProfile?.user_name} بفتح وردية ${shift?.shift_name}`,
      type: "shift_open",
    }));

    const { error: notifError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (notifError) {
      console.error("Error creating notifications:", notifError);
    }

    // Send emails to admins
    let emailsSent = 0;
    for (const admin of adminProfiles) {
      if (!admin.email) continue;

      const emailHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.8;
              color: #333;
              direction: rtl;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .info-box {
              background: #f8f9fa;
              border-right: 4px solid #667eea;
              padding: 20px;
              margin: 20px 0;
              border-radius: 8px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 12px 0;
              border-bottom: 1px solid #e9ecef;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #495057;
            }
            .info-value {
              color: #212529;
            }
            h3 {
              color: #212529;
              font-size: 20px;
              margin: 0 0 10px 0;
            }
            .footer {
              background: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #6c757d;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 إشعار فتح وردية</h1>
            </div>
            <div class="content">
              <h3>مرحباً ${admin.user_name}،</h3>
              <p>تم فتح وردية جديدة. إليك التفاصيل:</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">اسم الموظف:</span>
                  <span class="info-value">${userProfile?.user_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">اسم الوردية:</span>
                  <span class="info-value">${shift?.shift_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">اليوم:</span>
                  <span class="info-value">${weekday}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">التاريخ الهجري:</span>
                  <span class="info-value">${hijriDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">التاريخ الميلادي:</span>
                  <span class="info-value">${gregorianDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">وقت الفتح:</span>
                  <span class="info-value">${time}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">موعد الوردية:</span>
                  <span class="info-value">${shift?.shift_start_time} - ${shift?.shift_end_time}</span>
                </div>
              </div>
              
              <p>يرجى متابعة الوردية والتأكد من سير العمل بشكل صحيح.</p>
            </div>
            <div class="footer">
              <p>نظام إدارة الورديات - Edara</p>
            </div>
          </div>
        </body>
        </html>
      `;

      sendEmailInBackground(admin.email, emailHtml, "Shift Opened - تم فتح وردية");
      emailsSent++;
    }

    console.log(`Sent ${notifications.length} notifications and ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: adminProfiles.length,
        emailsSent: emailsSent
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-shift-open-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
