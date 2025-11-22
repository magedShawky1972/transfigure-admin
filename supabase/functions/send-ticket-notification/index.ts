import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "ticket_created" | "ticket_approved" | "ticket_assigned";
  ticketId: string;
  recipientUserId: string;
  ticketNumber: string;
  subject: string;
}

interface BatchNotificationRequest {
  type: "ticket_created" | "ticket_approved" | "ticket_assigned";
  ticketId: string;
  recipientUserIds: string[];
  ticketNumber: string;
  subject: string;
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
    const requestBody = await req.json();

    // Check if this is a batch request or single request
    const isBatch = 'recipientUserIds' in requestBody;
    const isSequentialApproval = 'adminOrder' in requestBody;

    if (isSequentialApproval) {
      // Handle sequential approval notification - only notify admins at specific order level
      const { type, ticketId, adminOrder, ticketNumber, subject }: any = requestBody;
      
      console.log("Processing sequential approval notification:", { type, ticketId, adminOrder, ticketNumber });

      // Get ticket's department
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("department_id")
        .eq("id", ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new Error("Failed to fetch ticket department");
      }

      // Get admins at the specified order level for this department
      const { data: adminData, error: adminError } = await supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id)
        .eq("admin_order", adminOrder);

      if (adminError || !adminData || adminData.length === 0) {
        throw new Error(`No admins found at order level ${adminOrder} for this department`);
      }

      const recipientUserIds = adminData.map(admin => admin.user_id);

      // Get all recipient profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, user_name")
        .in("user_id", recipientUserIds);

      if (profilesError || !profiles) {
        throw new Error("Failed to fetch recipient profiles");
      }

      // Prepare notification data
      const { emailSubject, emailHtml, notificationTitle, notificationMessage } = 
        getNotificationContent(type, ticketNumber, subject, "", ticketId);

      // Create all in-app notifications at once
      const notifications = profiles.map(profile => ({
        user_id: profile.user_id,
        ticket_id: ticketId,
        title: notificationTitle,
        message: notificationMessage,
        type: type,
      }));

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Failed to create notifications:", notificationError);
        throw notificationError;
      }

      // Send emails in parallel in background (non-blocking)
      profiles.forEach(profile => {
        const personalizedHtml = emailHtml.replace(
          "<p>Hello ,</p>",
          `<p>Hello ${profile.user_name},</p>`
        );
        sendEmailInBackground(profile.email, profile.user_name, emailSubject, personalizedHtml);
      });

      return new Response(
        JSON.stringify({ success: true, notificationsSent: profiles.length }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (isBatch) {
      // Handle batch notifications (all admins at once - backward compatibility)
      const { type, ticketId, recipientUserIds, ticketNumber, subject }: BatchNotificationRequest = requestBody;
      
      console.log("Processing batch notification:", { type, ticketId, recipientCount: recipientUserIds.length, ticketNumber });

      // Get all recipient profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, user_name")
        .in("user_id", recipientUserIds);

      if (profilesError || !profiles) {
        throw new Error("Failed to fetch recipient profiles");
      }

      // Prepare notification data
      const { emailSubject, emailHtml, notificationTitle, notificationMessage } = 
        getNotificationContent(type, ticketNumber, subject, "", ticketId);

      // Create all in-app notifications at once
      const notifications = profiles.map(profile => ({
        user_id: profile.user_id,
        ticket_id: ticketId,
        title: notificationTitle,
        message: notificationMessage,
        type: type,
      }));

      const { error: notificationError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notificationError) {
        console.error("Failed to create notifications:", notificationError);
        throw notificationError;
      }

      // Send emails in parallel in background (non-blocking)
      profiles.forEach(profile => {
        const personalizedHtml = emailHtml.replace(
          "<p>Hello ,</p>",
          `<p>Hello ${profile.user_name},</p>`
        );
        // Fire and forget - emails sent in background
        sendEmailInBackground(profile.email, profile.user_name, emailSubject, personalizedHtml);
      });

      return new Response(
        JSON.stringify({ success: true, notificationsSent: profiles.length }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      // Handle single notification (backward compatibility)
      const { type, ticketId, recipientUserId, ticketNumber, subject }: NotificationRequest = requestBody;

      console.log("Processing single notification:", { type, ticketId, recipientUserId, ticketNumber });

      // Get recipient profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, user_name")
        .eq("user_id", recipientUserId)
        .single();

      if (profileError || !profile) {
        console.error("Failed to fetch recipient profile:", profileError);
        throw new Error("Recipient not found");
      }

      // Get notification content
      const { emailSubject, emailHtml, notificationTitle, notificationMessage } = 
        getNotificationContent(type, ticketNumber, subject, profile.user_name, ticketId);

      // Create in-app notification first
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          user_id: recipientUserId,
          ticket_id: ticketId,
          title: notificationTitle,
          message: notificationMessage,
          type: type,
        });

      if (notificationError) {
        console.error("Failed to create notification:", notificationError);
        throw notificationError;
      }

      // Send email in background (non-blocking)
      sendEmailInBackground(profile.email, profile.user_name, emailSubject, emailHtml);

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in send-ticket-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function getNotificationContent(
  type: string,
  ticketNumber: string,
  subject: string,
  userName: string,
  ticketId: string
) {
  let emailSubject = "";
  let emailHtml = "";
  let notificationTitle = "";
  let notificationMessage = "";
  
  const appUrl = "https://edaraasus.com";
  const ticketLink = `${appUrl}/tickets/${ticketId}`;

  switch (type) {
    case "ticket_created":
      emailSubject = `New Ticket Created: ${ticketNumber}`;
      emailHtml = `
        <h2>New Ticket Created</h2>
        <p>Hello ${userName},</p>
        <p>A new ticket has been created in your department:</p>
        <ul>
          <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
          <li><strong>Subject:</strong> ${subject}</li>
        </ul>
        <p>Please review and take appropriate action.</p>
        <div style="margin: 20px 0;">
          <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View & Approve Ticket</a>
        </div>
      `;
      notificationTitle = "New Ticket Created";
      notificationMessage = `Ticket ${ticketNumber}: ${subject}`;
      break;

    case "ticket_approved":
      emailSubject = `Ticket Approved: ${ticketNumber}`;
      emailHtml = `
        <h2>Ticket Approved</h2>
        <p>Hello ${userName},</p>
        <p>Your ticket has been approved:</p>
        <ul>
          <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
          <li><strong>Subject:</strong> ${subject}</li>
        </ul>
        <p>Your ticket is now being processed.</p>
        <div style="margin: 20px 0;">
          <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Ticket</a>
        </div>
      `;
      notificationTitle = "Ticket Approved";
      notificationMessage = `Your ticket ${ticketNumber} has been approved`;
      break;

    case "ticket_assigned":
      emailSubject = `Ticket Assigned to You: ${ticketNumber}`;
      emailHtml = `
        <h2>Ticket Assigned</h2>
        <p>Hello ${userName},</p>
        <p>A ticket has been assigned to you:</p>
        <ul>
          <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
          <li><strong>Subject:</strong> ${subject}</li>
        </ul>
        <p>Please review and work on this ticket.</p>
        <div style="margin: 20px 0;">
          <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open Ticket</a>
        </div>
      `;
      notificationTitle = "Ticket Assigned to You";
      notificationMessage = `Ticket ${ticketNumber} has been assigned to you`;
      break;
  }

  return { emailSubject, emailHtml, notificationTitle, notificationMessage };
}

serve(handler);
