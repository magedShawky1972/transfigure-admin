import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmailInBackground(email: string, userName: string, emailSubject: string, emailHtml: string) {
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
      subject: emailSubject, // << No encoding — UTF-8 direct
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { startDate, endDate } = await req.json();

    console.log("Processing shift notifications for date range:", { startDate, endDate });

    const { data: assignments, error: assignmentsError } = await supabase
      .from("shift_assignments")
      .select(
        `
        id,
        assignment_date,
        notes,
        user_id,
        shift:shifts (
          shift_name,
          shift_start_time,
          shift_end_time,
          shift_type:shift_types (
            zone_name,
            type
          )
        )
      `,
      )
      .gte("assignment_date", startDate)
      .lte("assignment_date", endDate);

    if (assignmentsError) {
      throw new Error("Failed to fetch shift assignments");
    }

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No shift assignments found for the specified date range" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const userAssignments = new Map<string, any[]>();
    assignments.forEach((assignment) => {
      if (!userAssignments.has(assignment.user_id)) {
        userAssignments.set(assignment.user_id, []);
      }
      userAssignments.get(assignment.user_id)!.push(assignment);
    });

    const userIds = Array.from(userAssignments.keys());
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, user_name")
      .in("user_id", userIds);

    if (profilesError || !profiles) {
      throw new Error("Failed to fetch user profiles");
    }

    let successCount = 0;

    for (const profile of profiles) {
      const userShifts = userAssignments.get(profile.user_id) || [];
      if (userShifts.length === 0) continue;

      userShifts.sort((a, b) => new Date(a.assignment_date).getTime() - new Date(b.assignment_date).getTime());

      const emailSubject = `جدول مناوباتك - ${userShifts.length} مناوبة`;

      const shiftsList = userShifts
        .map((shift) => {
          const date = new Date(shift.assignment_date).toLocaleDateString("ar-EG", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          const shiftName = shift.shift?.shift_name || "غير محدد";
          const startTime = shift.shift?.shift_start_time || "غير محدد";
          const endTime = shift.shift?.shift_end_time || "غير محدد";

          return `يوم ${date} - ${shiftName} من الساعة ${startTime} إلى الساعة ${endTime}`;
        })
        .join("<br/>");

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
        </head>
        <body>
          <div style="font-family: Arial, sans-serif;">
            
            <h2 style="color:#333; margin-bottom:16px;">${emailSubject}</h2>

            <p>مرحباً ${profile.user_name}،</p>
            <p>تم إسناد الورديات لك كالتالي:</p>
            <p>${shiftsList}</p>
            <p>يرجى مراجعة جدول المناوبات والتأكد من توفرك في المواعيد المحددة.</p>
          </div>
        </body>
        </html>
      `;

      sendEmailInBackground(profile.email, profile.user_name, emailSubject, emailHtml);

      const notificationMessage = `تم تعيين ${userShifts.length} مناوبة لك من ${new Date(startDate).toLocaleDateString(
        "ar-EG",
      )} إلى ${new Date(endDate).toLocaleDateString("ar-EG")}`;

      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        title: "جدول المناوبات",
        message: notificationMessage,
        type: "shift_assigned",
      });

      supabase.functions
        .invoke("send-push-notification", {
          body: {
            userId: profile.user_id,
            title: "جدول المناوبات",
            body: notificationMessage,
            data: {
              url: "/shift-calendar",
              tag: "shift-schedule",
            },
          },
        })
        .catch((err) => console.error("Failed to send push notification:", err));

      successCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `تم إرسال الإشعارات بنجاح`,
        notificationsSent: successCount,
        totalAssignments: assignments.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error in send-shift-notifications:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
