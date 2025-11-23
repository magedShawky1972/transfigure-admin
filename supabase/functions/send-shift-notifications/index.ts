import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Attempting to send email to:", email);
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { startDate, endDate } = await req.json();

    console.log("Processing shift notifications for date range:", { startDate, endDate });

    // Get all shift assignments in the date range
    const { data: assignments, error: assignmentsError } = await supabase
      .from("shift_assignments")
      .select(`
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
      `)
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
        }
      );
    }

    // Group assignments by user
    const userAssignments = new Map<string, any[]>();
    assignments.forEach(assignment => {
      if (!userAssignments.has(assignment.user_id)) {
        userAssignments.set(assignment.user_id, []);
      }
      userAssignments.get(assignment.user_id)!.push(assignment);
    });

    // Get user profiles
    const userIds = Array.from(userAssignments.keys());
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, email, user_name")
      .in("user_id", userIds);

    if (profilesError || !profiles) {
      throw new Error("Failed to fetch user profiles");
    }

    let successCount = 0;

    // Send notifications to each user
    for (const profile of profiles) {
      const userShifts = userAssignments.get(profile.user_id) || [];
      
      if (userShifts.length === 0) continue;

      // Sort shifts by date
      userShifts.sort((a, b) => 
        new Date(a.assignment_date).getTime() - new Date(b.assignment_date).getTime()
      );

      // Create email content
      const emailSubject = `جدول مناوباتك - ${userShifts.length} مناوبة`;
      
      const shiftsText = userShifts.map(shift => {
        const date = new Date(shift.assignment_date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const shiftName = shift.shift?.shift_name || 'غير محدد';
        const startTime = shift.shift?.shift_start_time || 'غير محدد';
        const endTime = shift.shift?.shift_end_time || 'غير محدد';
        const zone = shift.shift?.shift_type?.zone_name || 'غير محدد';
        const notes = shift.notes ? `\nملاحظات: ${shift.notes}` : '';
        
        return `يوم ${date}\n${shiftName} - من الساعة ${startTime} إلى الساعة ${endTime}\nالمنطقة: ${zone}${notes}`;
      }).join('\n\n');

      const emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f2937;">مرحباً ${profile.user_name}،</h2>
          <p style="color: #4b5563; font-size: 16px;">
            تم إسناد الورديات لك كالتالي:
          </p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; margin: 0;">${shiftsText}</pre>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            يرجى مراجعة جدول المناوبات والتأكد من توفرك في المواعيد المحددة.
          </p>
        </div>
      `;

      // Send email in background
      sendEmailInBackground(profile.email, profile.user_name, emailSubject, emailHtml);

      // Create in-app notification
      const notificationMessage = `تم تعيين ${userShifts.length} مناوبة لك من ${new Date(startDate).toLocaleDateString('ar-EG')} إلى ${new Date(endDate).toLocaleDateString('ar-EG')}`;
      
      await supabase
        .from("notifications")
        .insert({
          user_id: profile.user_id,
          title: "جدول المناوبات",
          message: notificationMessage,
          type: "shift_assigned",
        });

      // Send push notification
      supabase.functions.invoke("send-push-notification", {
        body: {
          userId: profile.user_id,
          title: "جدول المناوبات",
          body: notificationMessage,
          data: {
            url: "/shift-calendar",
            tag: "shift-schedule",
          },
        },
      }).catch(error => console.error('Failed to send push notification:', error));

      successCount++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `تم إرسال الإشعارات بنجاح`,
        notificationsSent: successCount,
        totalAssignments: assignments.length
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-shift-notifications:", error);
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
