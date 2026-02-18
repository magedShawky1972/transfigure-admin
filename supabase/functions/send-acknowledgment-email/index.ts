import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  cc: string[],
  subject: string,
  htmlBody: string
): string {
  const encodedSubject = encodeSubject(subject);

  let headers = [
    `From: ${from}`,
    `To: ${to}`,
    cc.length > 0 ? `Cc: ${cc.join(", ")}` : "",
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
  ]
    .filter(Boolean)
    .join("\r\n");

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
  cc: string[],
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
    for (const ccEmail of cc) {
      await write(`RCPT TO:<${ccEmail}>`);
      await read();
    }
    await write(`DATA`);
    await read();
    await conn.write(encoder.encode(rawMessage + "\r\n.\r\n"));
    await read();
    await write(`QUIT`);
    console.log("Acknowledgment email sent successfully via raw SMTP to:", to);
  } finally {
    conn.close();
  }
}

function buildEmailHtml(title: string, content: string): string {
  const logoUrl = "https://ysqqnkbgkrjoxrzlejxy.supabase.co/storage/v1/object/public/email-assets/asus-card-logo.png";
  return `<!DOCTYPE html>
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
      max-width: 700px;
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
    .header img {
      width: 120px;
      height: auto;
      margin-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 600;
    }
    .content {
      padding: 30px;
    }
    .content h2 {
      color: #333;
      font-size: 22px;
      margin-bottom: 15px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .document-body {
      background: #f8f9fa;
      border-right: 4px solid #667eea;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      line-height: 2;
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
      <img src="${logoUrl}" alt="ASUS Card Logo" />
      <h1>📋 قرار إداري جديد</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      <div class="document-body">
        ${content}
      </div>
      <p>يرجى الاطلاع على القرار الإداري أعلاه والتوقيع عليه من خلال النظام.</p>
    </div>
    <div class="footer">
      <p>نظام إدارة - Edara</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { documentId, recipientEmails, isTest } = await req.json();

    if (!documentId) {
      throw new Error("documentId is required");
    }

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("acknowledgment_documents")
      .select("title, title_ar, content, content_ar")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      throw new Error("Document not found");
    }

    const subject = doc.title_ar || doc.title;
    const content = doc.content_ar || doc.content;
    const emailHtml = buildEmailHtml(subject, content);

    const smtpHost = "smtp.hostinger.com";
    const smtpPort = 465;
    const smtpUsername = "edara@asuscards.com";
    const smtpPassword = Deno.env.get("SMTP_PASSWORD") ?? "";
    const fromAddress = "Edara Support <edara@asuscards.com>";

    // Fixed recipients always receive
    const fixedRecipients = [
      "maged.shawky@asuscards.com",
      "nawaf@asuscards.com",
    ];

    let allEmails: string[] = [];

    if (isTest && recipientEmails && recipientEmails.length > 0) {
      // Test mode: only send to specified emails
      allEmails = recipientEmails;
    } else {
      // Normal mode: send to all recipients + fixed emails
      // Get recipients for this document
      const { data: recipients } = await supabase
        .from("acknowledgment_recipients")
        .select("user_id, job_position_id")
        .eq("document_id", documentId);

      const userIds: string[] = [];
      const jobPositionIds: string[] = [];

      if (recipients) {
        for (const r of recipients) {
          if (r.user_id) userIds.push(r.user_id);
          if (r.job_position_id) jobPositionIds.push(r.job_position_id);
        }
      }

      // Get emails from user_ids
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", userIds);
        if (profiles) {
          allEmails.push(
            ...profiles.map((p) => p.email).filter(Boolean)
          );
        }
      }

      // Get emails from job_position_ids (find users with those positions)
      if (jobPositionIds.length > 0) {
        const { data: jobProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("job_position_id", jobPositionIds);
        if (jobProfiles) {
          allEmails.push(
            ...jobProfiles.map((p) => p.email).filter(Boolean)
          );
        }
      }

      // Add fixed recipients
      allEmails.push(...fixedRecipients);
    }

    // Deduplicate
    allEmails = [...new Set(allEmails.filter(Boolean))];

    console.log(`Sending acknowledgment email to ${allEmails.length} recipients:`, allEmails);

    let sentCount = 0;
    for (const email of allEmails) {
      try {
        const rawMessage = buildRawEmail(fromAddress, email, [], subject, emailHtml);
        await sendRawEmail(
          smtpHost,
          smtpPort,
          smtpUsername,
          smtpPassword,
          fromAddress,
          email,
          [],
          rawMessage
        );
        sentCount++;
      } catch (emailError) {
        console.error("Failed to send to", email, ":", emailError);
      }
    }

    console.log(`Sent ${sentCount}/${allEmails.length} acknowledgment emails`);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        totalRecipients: allEmails.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-acknowledgment-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
