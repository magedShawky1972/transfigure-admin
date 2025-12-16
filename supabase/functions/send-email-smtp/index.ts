import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  configId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  isHtml?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const {
      configId,
      to,
      cc,
      bcc,
      subject,
      body,
      fromName,
      fromEmail,
      isHtml = false,
    }: SendEmailRequest = await req.json();

    console.log(`Sending email from ${fromEmail} to ${to.join(", ")}`);

    // Get email config
    const { data: config, error: configError } = await supabase
      .from("user_email_configs")
      .select("*")
      .eq("id", configId)
      .eq("user_id", user.id)
      .single();

    if (configError || !config) {
      throw new Error("Email configuration not found");
    }

    console.log(`Using SMTP: ${config.smtp_host}:${config.smtp_port}`);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host,
        port: config.smtp_port,
        tls: config.smtp_secure,
        auth: {
          username: config.email_username,
          password: config.email_password,
        },
      },
    });

    // Send email
    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: to,
      cc: cc || [],
      bcc: bcc || [],
      subject: subject,
      content: isHtml ? undefined : body,
      html: isHtml ? body : undefined,
    });

    await client.close();

    console.log("Email sent successfully");

    // Store sent email in database
    const { error: insertError } = await supabase
      .from("emails")
      .insert({
        user_id: user.id,
        config_id: configId,
        message_id: `sent-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        folder: "SENT",
        subject: subject,
        from_address: fromEmail,
        from_name: fromName,
        to_addresses: to,
        cc_addresses: cc || [],
        body_text: isHtml ? null : body,
        body_html: isHtml ? body : null,
        is_read: true,
        email_date: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error storing sent email:", insertError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
