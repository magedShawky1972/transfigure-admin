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
  type: "ticket_created" | "ticket_approved" | "ticket_assigned" | "extra_approval_request";
  ticketId: string;
  recipientUserId: string;
  senderName?: string;
}

interface BatchNotificationRequest {
  type: "ticket_created" | "ticket_approved" | "ticket_assigned" | "extra_approval_request";
  ticketId: string;
  recipientUserIds: string[];
}

interface EmailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
  encoding: "binary";
}

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

async function sendEmailInBackground(
  supabase: any,
  recipientUserId: string,
  email: string,
  userName: string,
  emailSubject: string,
  emailHtml: string,
  ticketId: string | null = null,
  attachments: EmailAttachment[] = []
): Promise<string | null> {
  let emailId: string | null = null;
  
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

    console.log("Attempting to send email to:", email, "with", attachments.length, "attachments");
    await smtpClient.send({
      from: "Edara Support <edara@asuscards.com>",
      to: email,
      subject: emailSubject,
      content: "auto",
      html: emailHtml,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    await smtpClient.close();
    console.log("Email sent successfully to:", email);

    // Store email in database for the recipient
    const messageId = `ticket-${ticketId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const { data: insertedEmail, error: emailError } = await supabase.from("emails").insert({
      user_id: recipientUserId,
      message_id: messageId,
      folder: "inbox",
      subject: emailSubject,
      from_address: "edara@asuscards.com",
      from_name: "Edara Support",
      to_addresses: [email],
      body_html: emailHtml,
      body_text: emailSubject,
      is_read: false,
      is_starred: false,
      is_draft: false,
      has_attachments: attachments.length > 0,
      email_date: new Date().toISOString(),
      linked_ticket_id: ticketId,
    }).select("id").single();
    
    if (!emailError && insertedEmail) {
      emailId = insertedEmail.id;
      console.log("Email stored in database for user:", recipientUserId, "with id:", emailId);
    } else {
      console.error("Failed to store email:", emailError);
    }
  } catch (emailError) {
    console.error("Failed to send email to", email, ":", emailError);
  }
  
  return emailId;
}

async function fetchTicketAttachments(supabase: any, ticketId: string): Promise<EmailAttachment[]> {
  const attachments: EmailAttachment[] = [];
  
  try {
    // Get attachment records from database
    const { data: attachmentRecords, error } = await supabase
      .from("ticket_attachments")
      .select("file_name, file_path, mime_type")
      .eq("ticket_id", ticketId);

    if (error || !attachmentRecords || attachmentRecords.length === 0) {
      console.log("No attachments found for ticket:", ticketId);
      return attachments;
    }

    console.log("Found", attachmentRecords.length, "attachments for ticket:", ticketId);

    // Download each file from storage
    for (const record of attachmentRecords) {
      try {
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from("ticket-attachments")
          .download(record.file_path);

        if (downloadError || !fileData) {
          console.error("Failed to download attachment:", record.file_name, downloadError);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        attachments.push({
          filename: record.file_name,
          content: new Uint8Array(arrayBuffer),
          contentType: record.mime_type || "application/octet-stream",
          encoding: "binary",
        });
        console.log("Successfully loaded attachment:", record.file_name);
      } catch (fileError) {
        console.error("Error processing attachment:", record.file_name, fileError);
      }
    }
  } catch (err) {
    console.error("Error fetching ticket attachments:", err);
  }

  return attachments;
}

// Helper function to fetch purchase details for a ticket
async function fetchPurchaseDetails(
  supabase: any,
  ticket: any
): Promise<{ itemName: string | null; currencyName: string | null }> {
  let itemName: string | null = null;
  let currencyName: string | null = null;

  if (ticket.item_id) {
    const { data: itemData } = await supabase
      .from("purchase_items")
      .select("item_name")
      .eq("id", ticket.item_id)
      .single();
    itemName = itemData?.item_name || null;
  }

  if (ticket.currency_id) {
    const { data: currencyData } = await supabase
      .from("currencies")
      .select("currency_code, currency_name")
      .eq("id", ticket.currency_id)
      .single();
    currencyName = currencyData?.currency_code || currencyData?.currency_name || null;
  }

  return { itemName, currencyName };
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
      const { type, ticketId, adminOrder, isPurchasePhase }: any = requestBody;
      
      console.log("Processing sequential approval notification:", { type, ticketId, adminOrder, isPurchasePhase });

      // Get ticket's full details including department and creator
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("department_id, ticket_number, subject, description, is_purchase_ticket, created_at, user_id, external_link, budget_value, qty, uom, item_id, currency_id")
        .eq("id", ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new Error("Failed to fetch ticket details");
      }

      // Get department name
      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", ticket.department_id)
        .single();

      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", ticket.user_id)
        .single();

      // Get admins at the specified order level for this department
      // Filter by is_purchase_admin based on the current phase
      let adminQuery = supabase
        .from("department_admins")
        .select("user_id")
        .eq("department_id", ticket.department_id)
        .eq("admin_order", adminOrder);
      
      // If isPurchasePhase is provided, filter by it
      if (typeof isPurchasePhase === 'boolean') {
        adminQuery = adminQuery.eq("is_purchase_admin", isPurchasePhase);
      }

      const { data: adminData, error: adminError } = await adminQuery;

      if (adminError || !adminData || adminData.length === 0) {
        throw new Error(`No admins found at order level ${adminOrder} (purchase phase: ${isPurchasePhase}) for this department`);
      }

      // Filter out the ticket creator from recipients - don't send approval notification to sender
      const recipientUserIds = adminData
        .map(admin => admin.user_id)
        .filter(userId => userId !== ticket.user_id);

      console.log(`Filtered recipients: ${recipientUserIds.length} (excluded creator: ${ticket.user_id})`);

      // If all admins at this level are the ticket creator, skip notification
      if (recipientUserIds.length === 0) {
        console.log("All admins at this level are the ticket creator, skipping notification");
        return new Response(
          JSON.stringify({ success: true, notificationsSent: 0, message: "Creator is the only admin at this level" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Get all recipient profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, user_name")
        .in("user_id", recipientUserIds);

      if (profilesError || !profiles) {
        throw new Error("Failed to fetch recipient profiles");
      }

      // Fetch purchase details if needed
      const purchaseDetails = ticket.is_purchase_ticket 
        ? await fetchPurchaseDetails(supabase, ticket)
        : { itemName: null, currencyName: null };

      const ticketDetails: TicketDetails = {
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        departmentName: department?.department_name || "",
        createdBy: creatorProfile?.user_name || "",
        createdAt: ticket.created_at,
        isPurchaseTicket: ticket.is_purchase_ticket,
        externalLink: ticket.external_link,
        itemName: purchaseDetails.itemName,
        qty: ticket.qty,
        uom: ticket.uom,
        budgetValue: ticket.budget_value,
        currencyName: purchaseDetails.currencyName
      };

      // Prepare notification data
      const { emailSubject, emailHtml, notificationTitle, notificationMessage } = 
        getNotificationContent(type, ticketDetails, "", ticketId);

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

      // Fetch ticket attachments for email
      const emailAttachments = await fetchTicketAttachments(supabase, ticketId);

      // Send emails in parallel in background (non-blocking)
      profiles.forEach(profile => {
        const personalizedHtml = emailHtml.replace(
          `<p>مرحباً ,</p>`,
          `<p>مرحباً ${profile.user_name},</p>`
        );
        sendEmailInBackground(supabase, profile.user_id, profile.email, profile.user_name, emailSubject, personalizedHtml, ticketId, emailAttachments);
        
        // Log email sent activity
        logTicketActivity(
          supabase,
          ticketId,
          "email_sent",
          null,
          null,
          profile.user_id,
          profile.user_name,
          `تم إرسال بريد إلكتروني إلى ${profile.user_name} (المستوى ${adminOrder})`
        );
      });

      // Log notification activity for sequential approval
      logTicketActivity(
        supabase,
        ticketId,
        type === "ticket_created" ? "notification_sent" : type,
        null,
        creatorProfile?.user_name || null,
        null,
        profiles.map(p => p.user_name).join(", "),
        `تم إرسال إشعار للمسؤولين في المستوى ${adminOrder}`
      );

      // Send push notifications to all recipients
      profiles.forEach(profile => {
        supabase.functions.invoke("send-push-notification", {
          body: {
            userId: profile.user_id,
            title: notificationTitle,
            body: notificationMessage,
            data: {
              url: `/tickets/${ticketId}`,
              ticketId: ticketId,
              tag: `ticket-${ticketId}`,
            },
          },
        }).catch(error => console.error('Failed to send push notification:', error));
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
      const { type, ticketId, recipientUserIds }: BatchNotificationRequest = requestBody;
      
      console.log("Processing batch notification:", { type, ticketId, recipientCount: recipientUserIds.length });

      // Get ticket's full details including department and creator
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("department_id, ticket_number, subject, description, is_purchase_ticket, created_at, user_id, external_link, budget_value, qty, uom, item_id, currency_id")
        .eq("id", ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new Error("Failed to fetch ticket details");
      }

      // Get department name
      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", ticket.department_id)
        .single();

      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", ticket.user_id)
        .single();

      // Filter out the ticket creator from recipients - don't send approval notification to sender
      const filteredRecipientUserIds = recipientUserIds.filter(userId => userId !== ticket.user_id);
      console.log(`Filtered batch recipients: ${filteredRecipientUserIds.length} (excluded creator: ${ticket.user_id})`);

      // If all recipients are the ticket creator, skip notification
      if (filteredRecipientUserIds.length === 0) {
        console.log("All recipients are the ticket creator, skipping notification");
        return new Response(
          JSON.stringify({ success: true, notificationsSent: 0, message: "Creator is the only recipient" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Get all recipient profiles at once
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, user_name")
        .in("user_id", filteredRecipientUserIds);

      if (profilesError || !profiles) {
        throw new Error("Failed to fetch recipient profiles");
      }

      // Fetch purchase details if needed
      const purchaseDetails = ticket.is_purchase_ticket 
        ? await fetchPurchaseDetails(supabase, ticket)
        : { itemName: null, currencyName: null };

      const ticketDetails: TicketDetails = {
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        departmentName: department?.department_name || "",
        createdBy: creatorProfile?.user_name || "",
        createdAt: ticket.created_at,
        isPurchaseTicket: ticket.is_purchase_ticket,
        externalLink: ticket.external_link,
        itemName: purchaseDetails.itemName,
        qty: ticket.qty,
        uom: ticket.uom,
        budgetValue: ticket.budget_value,
        currencyName: purchaseDetails.currencyName
      };

      // Prepare notification data
      const { emailSubject, emailHtml, notificationTitle, notificationMessage } = 
        getNotificationContent(type, ticketDetails, "", ticketId);

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

      // Fetch ticket attachments for email
      const emailAttachments = await fetchTicketAttachments(supabase, ticketId);

      // Send emails in parallel in background (non-blocking)
      profiles.forEach(profile => {
        const personalizedHtml = emailHtml.replace(
          `<p>مرحباً ,</p>`,
          `<p>مرحباً ${profile.user_name},</p>`
        );
        // Fire and forget - emails sent in background
        sendEmailInBackground(supabase, profile.user_id, profile.email, profile.user_name, emailSubject, personalizedHtml, ticketId, emailAttachments);
        
        // Log email sent activity
        logTicketActivity(
          supabase,
          ticketId,
          "email_sent",
          null,
          null,
          profile.user_id,
          profile.user_name,
          `تم إرسال بريد إلكتروني إلى ${profile.user_name}`
        );
      });

      // Log notification activity
      logTicketActivity(
        supabase,
        ticketId,
        type === "ticket_created" ? "notification_sent" : type,
        null,
        creatorProfile?.user_name || null,
        null,
        profiles.map(p => p.user_name).join(", "),
        `تم إرسال إشعار بخصوص التذكرة`
      );

      // Send push notifications to all recipients
      profiles.forEach(profile => {
        supabase.functions.invoke("send-push-notification", {
          body: {
            userId: profile.user_id,
            title: notificationTitle,
            body: notificationMessage,
            data: {
              url: `/tickets/${ticketId}`,
              ticketId: ticketId,
              tag: `ticket-${ticketId}`,
            },
          },
        }).catch(error => console.error('Failed to send push notification:', error));
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
      const { type, ticketId, recipientUserId }: NotificationRequest = requestBody;

      console.log("Processing single notification:", { type, ticketId, recipientUserId });

      // Get ticket's full details including department and creator
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("department_id, ticket_number, subject, description, is_purchase_ticket, created_at, user_id, external_link, budget_value, qty, uom, item_id, currency_id")
        .eq("id", ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new Error("Failed to fetch ticket details");
      }

      // Get department name
      const { data: department } = await supabase
        .from("departments")
        .select("department_name")
        .eq("id", ticket.department_id)
        .single();

      // Get creator profile
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("user_id", ticket.user_id)
        .single();

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

      // Fetch purchase details if needed
      const purchaseDetails = ticket.is_purchase_ticket 
        ? await fetchPurchaseDetails(supabase, ticket)
        : { itemName: null, currencyName: null };

      const ticketDetails: TicketDetails = {
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        departmentName: department?.department_name || "",
        createdBy: creatorProfile?.user_name || "",
        createdAt: ticket.created_at,
        isPurchaseTicket: ticket.is_purchase_ticket,
        externalLink: ticket.external_link,
        itemName: purchaseDetails.itemName,
        qty: ticket.qty,
        uom: ticket.uom,
        budgetValue: ticket.budget_value,
        currencyName: purchaseDetails.currencyName
      };

      // Get notification content
      const { emailSubject, emailHtml, notificationTitle, notificationMessage } = 
        getNotificationContent(type, ticketDetails, profile.user_name, ticketId);

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

      // Fetch ticket attachments for email
      const emailAttachments = await fetchTicketAttachments(supabase, ticketId);

      // Send email in background (non-blocking)
      sendEmailInBackground(supabase, recipientUserId, profile.email, profile.user_name, emailSubject, emailHtml, ticketId, emailAttachments);

      // Log the activity
      let activityType = type;
      let activityDescription = "";
      
      if (type === "ticket_approved") {
        activityType = "ticket_approved";
        activityDescription = `تمت الموافقة على التذكرة وتم إرسال إشعار إلى ${profile.user_name}`;
      } else if (type === "ticket_assigned") {
        activityType = "ticket_assigned";
        activityDescription = `تم تعيين التذكرة إلى ${profile.user_name}`;
      } else {
        activityDescription = `تم إرسال إشعار إلى ${profile.user_name}`;
      }

      await logTicketActivity(
        supabase,
        ticketId,
        activityType,
        null,
        creatorProfile?.user_name || null,
        recipientUserId,
        profile.user_name,
        activityDescription
      );

      // Log email sent activity
      await logTicketActivity(
        supabase,
        ticketId,
        "email_sent",
        null,
        null,
        recipientUserId,
        profile.user_name,
        `تم إرسال بريد إلكتروني إلى ${profile.user_name}`
      );

      // Send push notification
      supabase.functions.invoke("send-push-notification", {
        body: {
          userId: recipientUserId,
          title: notificationTitle,
          body: notificationMessage,
          data: {
            url: `/tickets/${ticketId}`,
            ticketId: ticketId,
            tag: `ticket-${ticketId}`,
          },
        },
      }).catch(error => console.error('Failed to send push notification:', error));

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

interface TicketDetails {
  ticketNumber: string;
  subject: string;
  description: string;
  departmentName: string;
  createdBy: string;
  createdAt: string;
  isPurchaseTicket: boolean;
  externalLink?: string | null;
  // Purchase ticket fields
  itemName?: string | null;
  qty?: number | null;
  uom?: string | null;
  budgetValue?: number | null;
  currencyName?: string | null;
}

function getNotificationContent(
  type: string,
  ticketDetails: TicketDetails,
  userName: string,
  ticketId: string
) {
  let emailSubject = "";
  let emailHtml = "";
  let notificationTitle = "";
  let notificationMessage = "";
  
const appUrl = "https://edaraasus.com";
  const ticketLink = `${appUrl}/tickets/${ticketId}`;
  
  // Determine email subject based on purchase ticket status
  const ticketTypeSubject = ticketDetails.isPurchaseTicket ? "طلب شراء" : "تذكرة دعم";
  
  // Generate action tokens for email buttons
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.substring(0, 32);
  
  function generateToken(tid: string, action: string): string {
    const data = `${tid}-${action}-${secret}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  const approveToken = generateToken(ticketId, "approve");
  const rejectToken = generateToken(ticketId, "reject");
  const approveLink = `${supabaseUrl}/functions/v1/handle-ticket-action?ticketId=${ticketId}&action=approve&token=${approveToken}`;
  const rejectLink = `${supabaseUrl}/functions/v1/handle-ticket-action?ticketId=${ticketId}&action=reject&token=${rejectToken}`;
  
  // Format creation date in Arabic
  const creationDate = new Date(ticketDetails.createdAt).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // External link HTML (conditionally shown)
  const externalLinkHtml = ticketDetails.externalLink 
    ? `<li style="margin: 10px 0;"><strong>رابط خارجي:</strong> <a href="${ticketDetails.externalLink}" target="_blank" style="color: #4F46E5;">${ticketDetails.externalLink}</a></li>`
    : '';

  // Purchase details HTML (only for purchase tickets)
  const purchaseDetailsHtml = ticketDetails.isPurchaseTicket ? `
    ${ticketDetails.itemName ? `<li style="margin: 10px 0;"><strong>الصنف:</strong> ${ticketDetails.itemName}</li>` : ''}
    ${ticketDetails.qty ? `<li style="margin: 10px 0;"><strong>الكمية:</strong> ${ticketDetails.qty}</li>` : ''}
    ${ticketDetails.uom ? `<li style="margin: 10px 0;"><strong>وحدة القياس:</strong> ${ticketDetails.uom}</li>` : ''}
    ${ticketDetails.budgetValue ? `<li style="margin: 10px 0;"><strong>المبلغ:</strong> ${ticketDetails.budgetValue}${ticketDetails.currencyName ? ` ${ticketDetails.currencyName}` : ''}</li>` : ''}
    ${ticketDetails.budgetValue && ticketDetails.qty ? `<li style="margin: 10px 0;"><strong>الإجمالي:</strong> ${(ticketDetails.budgetValue * ticketDetails.qty).toFixed(2)}${ticketDetails.currencyName ? ` ${ticketDetails.currencyName}` : ''}</li>` : ''}
  ` : '';

switch (type) {
    case "ticket_created":
      emailSubject = ticketTypeSubject;
      emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>${ticketTypeSubject} جديدة</h2>
          <p>مرحباً ${userName},</p>
          <p>تم إنشاء ${ticketTypeSubject} جديدة في قسمك:</p>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>رقم التذكرة:</strong> ${ticketDetails.ticketNumber}</li>
            <li style="margin: 10px 0;"><strong>الموضوع:</strong> ${ticketDetails.subject}</li>
            <li style="margin: 10px 0;"><strong>الوصف:</strong> ${ticketDetails.description}</li>
            <li style="margin: 10px 0;"><strong>القسم:</strong> ${ticketDetails.departmentName}</li>
            <li style="margin: 10px 0;"><strong>تم الإنشاء بواسطة:</strong> ${ticketDetails.createdBy}</li>
            <li style="margin: 10px 0;"><strong>تاريخ الإنشاء:</strong> ${creationDate}</li>
            ${externalLinkHtml}
            ${purchaseDetailsHtml}
          </ul>
          <p>يرجى المراجعة واتخاذ الإجراء المناسب.</p>
          <div style="margin: 20px 0; display: flex; gap: 10px; justify-content: flex-start;">
            <a href="${approveLink}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">موافقة</a>
            <a href="${rejectLink}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">رفض</a>
          </div>
          <div style="margin: 10px 0;">
            <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">عرض التذكرة</a>
          </div>
        </div>
      `;
      notificationTitle = ticketTypeSubject;
      notificationMessage = `${ticketDetails.ticketNumber} - ${ticketDetails.subject} - ${ticketDetails.departmentName} - ${ticketDetails.createdBy}`;
      break;

    case "ticket_approved":
      emailSubject = ticketTypeSubject;
      emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>تمت الموافقة على ${ticketTypeSubject}</h2>
          <p>مرحباً ${userName},</p>
          <p>تمت الموافقة على ${ticketTypeSubject} الخاصة بك:</p>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>رقم التذكرة:</strong> ${ticketDetails.ticketNumber}</li>
            <li style="margin: 10px 0;"><strong>الموضوع:</strong> ${ticketDetails.subject}</li>
            <li style="margin: 10px 0;"><strong>الوصف:</strong> ${ticketDetails.description}</li>
            <li style="margin: 10px 0;"><strong>القسم:</strong> ${ticketDetails.departmentName}</li>
            <li style="margin: 10px 0;"><strong>تم الإنشاء بواسطة:</strong> ${ticketDetails.createdBy}</li>
            <li style="margin: 10px 0;"><strong>تاريخ الإنشاء:</strong> ${creationDate}</li>
            ${externalLinkHtml}
            ${purchaseDetailsHtml}
          </ul>
          <p>جاري معالجة التذكرة الآن.</p>
          <div style="margin: 20px 0;">
            <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">عرض التذكرة</a>
          </div>
        </div>
      `;
      notificationTitle = ticketTypeSubject;
      notificationMessage = `تمت الموافقة على ${ticketDetails.ticketNumber} - ${ticketDetails.subject}`;
      break;

    case "ticket_assigned":
      emailSubject = ticketTypeSubject;
      emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>تم تعيين ${ticketTypeSubject} لك</h2>
          <p>مرحباً ${userName},</p>
          <p>تم تعيين ${ticketTypeSubject} لك:</p>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>رقم التذكرة:</strong> ${ticketDetails.ticketNumber}</li>
            <li style="margin: 10px 0;"><strong>الموضوع:</strong> ${ticketDetails.subject}</li>
            <li style="margin: 10px 0;"><strong>الوصف:</strong> ${ticketDetails.description}</li>
            <li style="margin: 10px 0;"><strong>القسم:</strong> ${ticketDetails.departmentName}</li>
            <li style="margin: 10px 0;"><strong>تم الإنشاء بواسطة:</strong> ${ticketDetails.createdBy}</li>
            <li style="margin: 10px 0;"><strong>تاريخ الإنشاء:</strong> ${creationDate}</li>
            ${externalLinkHtml}
            ${purchaseDetailsHtml}
          </ul>
          <p>يرجى المراجعة والعمل على هذه التذكرة.</p>
          <div style="margin: 20px 0;">
            <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">فتح التذكرة</a>
          </div>
        </div>
      `;
      notificationTitle = ticketTypeSubject;
      notificationMessage = `تم تعيين ${ticketDetails.ticketNumber} لك - ${ticketDetails.subject}`;
      break;

    case "extra_approval_request":
      emailSubject = "طلب موافقة إضافية";
      emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; text-align: right;">
          <h2>طلب موافقة إضافية</h2>
          <p>مرحباً ${userName},</p>
          <p>تم طلب موافقتك على ${ticketTypeSubject} التالية:</p>
          <ul style="list-style: none; padding: 0;">
            <li style="margin: 10px 0;"><strong>رقم التذكرة:</strong> ${ticketDetails.ticketNumber}</li>
            <li style="margin: 10px 0;"><strong>الموضوع:</strong> ${ticketDetails.subject}</li>
            <li style="margin: 10px 0;"><strong>الوصف:</strong> ${ticketDetails.description}</li>
            <li style="margin: 10px 0;"><strong>القسم:</strong> ${ticketDetails.departmentName}</li>
            <li style="margin: 10px 0;"><strong>تم الإنشاء بواسطة:</strong> ${ticketDetails.createdBy}</li>
            <li style="margin: 10px 0;"><strong>تاريخ الإنشاء:</strong> ${creationDate}</li>
            ${externalLinkHtml}
            ${purchaseDetailsHtml}
          </ul>
          <p>يرجى مراجعة التذكرة والموافقة عليها.</p>
          <div style="margin: 20px 0; display: flex; gap: 10px; justify-content: flex-start;">
            <a href="${approveLink}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">موافقة</a>
            <a href="${rejectLink}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">رفض</a>
          </div>
          <div style="margin: 10px 0;">
            <a href="${ticketLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">عرض التذكرة</a>
          </div>
        </div>
      `;
      notificationTitle = "طلب موافقة إضافية";
      notificationMessage = `طُلبت موافقتك على ${ticketDetails.ticketNumber} - ${ticketDetails.subject}`;
      break;
  }

  return { emailSubject, emailHtml, notificationTitle, notificationMessage };
}

serve(handler);
