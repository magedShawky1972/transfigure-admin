import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const smtpClient = new SMTPClient({
  connection: {
    hostname: "smtp.hostinger.com",
    port: 465,
    tls: true,
    auth: {
      username: "info@asuscards.com",
      password: Deno.env.get("SMTP_PASSWORD") ?? "",
    },
  },
});

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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { type, ticketId, recipientUserId, ticketNumber, subject }: NotificationRequest = await req.json();

    console.log("Sending notification:", { type, ticketId, recipientUserId, ticketNumber });

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

    // Prepare email content based on type
    let emailSubject = "";
    let emailHtml = "";
    let notificationTitle = "";
    let notificationMessage = "";

    switch (type) {
      case "ticket_created":
        emailSubject = `New Ticket Created: ${ticketNumber}`;
        emailHtml = `
          <h2>New Ticket Created</h2>
          <p>Hello ${profile.user_name},</p>
          <p>A new ticket has been created in your department:</p>
          <ul>
            <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
            <li><strong>Subject:</strong> ${subject}</li>
          </ul>
          <p>Please review and take appropriate action.</p>
        `;
        notificationTitle = "New Ticket Created";
        notificationMessage = `Ticket ${ticketNumber}: ${subject}`;
        break;

      case "ticket_approved":
        emailSubject = `Ticket Approved: ${ticketNumber}`;
        emailHtml = `
          <h2>Ticket Approved</h2>
          <p>Hello ${profile.user_name},</p>
          <p>Your ticket has been approved:</p>
          <ul>
            <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
            <li><strong>Subject:</strong> ${subject}</li>
          </ul>
          <p>Your ticket is now being processed.</p>
        `;
        notificationTitle = "Ticket Approved";
        notificationMessage = `Your ticket ${ticketNumber} has been approved`;
        break;

      case "ticket_assigned":
        emailSubject = `Ticket Assigned to You: ${ticketNumber}`;
        emailHtml = `
          <h2>Ticket Assigned</h2>
          <p>Hello ${profile.user_name},</p>
          <p>A ticket has been assigned to you:</p>
          <ul>
            <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
            <li><strong>Subject:</strong> ${subject}</li>
          </ul>
          <p>Please review and work on this ticket.</p>
        `;
        notificationTitle = "Ticket Assigned to You";
        notificationMessage = `Ticket ${ticketNumber} has been assigned to you`;
        break;
    }

    // Send email
    try {
      console.log("Attempting to send email to:", profile.email);
      await smtpClient.send({
        from: "Edara Support <info@asuscards.com>",
        to: profile.email,
        subject: emailSubject,
        content: "auto",
        html: emailHtml,
      });
      await smtpClient.close();
      console.log("Email sent successfully");
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // Don't throw - we still want to create the in-app notification
    }

    // Create in-app notification
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

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
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

serve(handler);
