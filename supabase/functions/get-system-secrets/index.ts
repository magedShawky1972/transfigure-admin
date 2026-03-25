import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: claimsData.user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the requested secret type from the request body
    const { secretType } = await req.json();

    let secretData: Record<string, string> = {};

    switch (secretType) {
      case "vapid":
        secretData = {
          VAPID_PUBLIC_KEY: Deno.env.get("VAPID_PUBLIC_KEY") || "Not configured",
          VAPID_PRIVATE_KEY: Deno.env.get("VAPID_PRIVATE_KEY") || "Not configured",
        };
        break;
      case "smtp":
        secretData = {
          SMTP_PASSWORD: Deno.env.get("SMTP_PASSWORD") || "Not configured",
        };
        break;
      case "resend":
        secretData = {
          RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") || "Not configured",
        };
        break;
      case "supabase":
        secretData = {
          SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "Not configured",
          SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") || "Not configured",
          SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "Not configured",
        };
        break;
      case "twilio":
        secretData = {
          TWILIO_ACCOUNT_SID: Deno.env.get("TWILIO_ACCOUNT_SID") || "Not configured",
          TWILIO_AUTH_TOKEN: Deno.env.get("TWILIO_AUTH_TOKEN") || "Not configured",
          TWILIO_WHATSAPP_FROM: Deno.env.get("TWILIO_WHATSAPP_FROM") || "Not configured",
        };
        break;
      case "odoo":
        secretData = {
          ODOO_URL: Deno.env.get("ODOO_URL") || "Not configured",
          ODOO_API_KEY: Deno.env.get("ODOO_API_KEY") || "Not configured",
        };
        break;
      case "cloudinary":
        secretData = {
          CLOUDINARY_CLOUD_NAME: Deno.env.get("CLOUDINARY_CLOUD_NAME") || "Not configured",
          CLOUDINARY_API_KEY: Deno.env.get("CLOUDINARY_API_KEY") || "Not configured",
          CLOUDINARY_API_SECRET: Deno.env.get("CLOUDINARY_API_SECRET") || "Not configured",
        };
        break;
      case "cto_email":
        secretData = {
          CTO_EMAIL: "cto@asuscards.com",
          CTO_EMAIL_PASSWORD: Deno.env.get("CTO_EMAIL_PASSWORD") || "Not configured",
        };
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid secret type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ secrets: secretData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching secrets:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
