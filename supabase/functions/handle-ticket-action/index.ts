import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to log ticket activities
async function logTicketActivity(
  supabase: any,
  ticketId: string,
  activityType: string,
  userId: string | null,
  userName: string | null,
  recipientId: string | null,
  recipientName: string | null,
  description: string | null
) {
  try {
    await supabase.from("ticket_activity_logs").insert({
      ticket_id: ticketId,
      activity_type: activityType,
      user_id: userId,
      user_name: userName,
      recipient_id: recipientId,
      recipient_name: recipientName,
      description: description,
    });
    console.log(`Activity logged: ${activityType} for ticket ${ticketId}`);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

// Simple token generation for verification
function generateToken(ticketId: string, action: string): string {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.substring(0, 32);
  const data = `${ticketId}-${action}-${secret}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function verifyToken(ticketId: string, action: string, token: string): boolean {
  return generateToken(ticketId, action) === token;
}

// HTML response template
function htmlResponse(title: string, message: string, success: boolean): Response {
  const bgColor = success ? "#10B981" : "#EF4444";
  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background-color: #f3f4f6;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 400px;
        }
        .icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background-color: ${bgColor};
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }
        .icon svg {
          width: 40px;
          height: 40px;
          fill: white;
        }
        h1 {
          color: #1f2937;
          margin-bottom: 10px;
        }
        p {
          color: #6b7280;
          line-height: 1.6;
        }
        a {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 24px;
          background-color: #4F46E5;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        }
        a:hover {
          background-color: #4338CA;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">
          ${success 
            ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
          }
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <a href="https://edaraasus.com">العودة إلى الصفحة الرئيسية</a>
      </div>
    </body>
    </html>
  `;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", ...corsHeaders },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticketId = url.searchParams.get("ticketId");
    const action = url.searchParams.get("action");
    const token = url.searchParams.get("token");

    if (!ticketId || !action || !token) {
      return htmlResponse("خطأ", "رابط غير صالح. يرجى المحاولة مرة أخرى.", false);
    }

    if (!verifyToken(ticketId, action, token)) {
      return htmlResponse("خطأ", "رابط غير صالح أو منتهي الصلاحية.", false);
    }

    if (action !== "approve" && action !== "reject") {
      return htmlResponse("خطأ", "إجراء غير معروف.", false);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("id, ticket_number, subject, description, status, user_id, department_id, is_purchase_ticket, approved_at")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error("Ticket not found:", ticketError);
      return htmlResponse("خطأ", "لم يتم العثور على التذكرة.", false);
    }

// Check if already processed
    if (ticket.approved_at) {
      return htmlResponse("تنبيه", "تمت الموافقة على هذه التذكرة بالفعل.", false);
    }
    
    if (ticket.status === "Rejected") {
      return htmlResponse("تنبيه", "هذه التذكرة مرفوضة بالفعل.", false);
    }

    const ticketType = ticket.is_purchase_ticket ? "طلب الشراء" : "تذكرة الدعم";

    if (action === "approve") {
      // Update ticket - set approved_at timestamp (not status)
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          approved_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (updateError) {
        console.error("Failed to approve ticket:", updateError);
        return htmlResponse("خطأ", "فشل في الموافقة على التذكرة. يرجى المحاولة مرة أخرى.", false);
      }

      // Log the approval activity
      await logTicketActivity(
        supabase,
        ticketId,
        "approved_by_email",
        null,
        null,
        null,
        null,
        `تمت الموافقة على التذكرة عبر البريد الإلكتروني`
      );

      // Notify the ticket creator
      await supabase.functions.invoke("send-ticket-notification", {
        body: {
          type: "ticket_approved",
          ticketId: ticketId,
          recipientUserId: ticket.user_id,
        },
      });

      return htmlResponse("تمت الموافقة", `تمت الموافقة على ${ticketType} رقم ${ticket.ticket_number} بنجاح.`, true);

    } else if (action === "reject") {
      // Update ticket status to Rejected
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "Rejected",
        })
        .eq("id", ticketId);

      if (updateError) {
        console.error("Failed to reject ticket:", updateError);
        return htmlResponse("خطأ", "فشل في رفض التذكرة. يرجى المحاولة مرة أخرى.", false);
      }

      // Log the rejection activity
      await logTicketActivity(
        supabase,
        ticketId,
        "rejected_by_email",
        null,
        null,
        null,
        null,
        `تم رفض التذكرة عبر البريد الإلكتروني`
      );

      // Get department name
      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", ticket.department_id)
        .single();

      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("email, user_name")
        .eq("user_id", ticket.user_id)
        .single();

      if (creatorProfile) {
        // Create in-app notification for rejection
        await supabase.from("notifications").insert({
          user_id: ticket.user_id,
          ticket_id: ticketId,
          title: ticket.is_purchase_ticket ? "طلب شراء" : "تذكرة دعم",
          message: `تم رفض ${ticket.ticket_number} - ${ticket.subject}`,
          type: "ticket_rejected",
        });

        // Send rejection email
        const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
        
        const creationDate = new Date().toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const emailHtml = `
          <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
            <h2>تم رفض ${ticketType}</h2>
            <p>مرحباً ${creatorProfile.user_name},</p>
            <p>نأسف لإبلاغك بأنه تم رفض ${ticketType} الخاصة بك:</p>
            <ul style="list-style: none; padding: 0;">
              <li style="margin: 10px 0;"><strong>رقم التذكرة:</strong> ${ticket.ticket_number}</li>
              <li style="margin: 10px 0;"><strong>الموضوع:</strong> ${ticket.subject}</li>
              <li style="margin: 10px 0;"><strong>الوصف:</strong> ${ticket.description}</li>
              <li style="margin: 10px 0;"><strong>القسم:</strong> ${department?.department_name || ""}</li>
            </ul>
            <p>يمكنك التواصل مع الإدارة للحصول على مزيد من المعلومات.</p>
            <div style="margin: 20px 0;">
              <a href="https://edaraasus.com/tickets/${ticketId}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">عرض التذكرة</a>
            </div>
          </div>
        `;

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

          await smtpClient.send({
            from: "Edara Support <edara@asuscards.com>",
            to: creatorProfile.email,
            subject: ticket.is_purchase_ticket ? "طلب شراء" : "تذكرة دعم",
            content: "auto",
            html: emailHtml,
          });
          await smtpClient.close();
        } catch (emailError) {
          console.error("Failed to send rejection email:", emailError);
        }

        // Send push notification
        await supabase.functions.invoke("send-push-notification", {
          body: {
            userId: ticket.user_id,
            title: ticket.is_purchase_ticket ? "طلب شراء" : "تذكرة دعم",
            body: `تم رفض ${ticket.ticket_number} - ${ticket.subject}`,
            data: {
              url: `/tickets/${ticketId}`,
              ticketId: ticketId,
              tag: `ticket-${ticketId}`,
            },
          },
        }).catch(error => console.error('Failed to send push notification:', error));
      }

      return htmlResponse("تم الرفض", `تم رفض ${ticketType} رقم ${ticket.ticket_number}.`, true);
    }

    return htmlResponse("خطأ", "حدث خطأ غير متوقع.", false);

  } catch (error: any) {
    console.error("Error in handle-ticket-action:", error);
    return htmlResponse("خطأ", "حدث خطأ في النظام. يرجى المحاولة لاحقاً.", false);
  }
};

serve(handler);

export { generateToken };
