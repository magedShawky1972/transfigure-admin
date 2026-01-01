import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertConfig {
  id: string;
  alert_type: string;
  threshold: number;
  time_window_minutes: number;
  is_enabled: boolean;
  alert_recipients: string[];
}

interface BulkAccessResult {
  user_id: string;
  user_email: string;
  access_count: number;
  first_access: string;
  last_access: string;
}

interface NewUserAccessResult {
  user_id: string;
  user_email: string;
  access_count: number;
  user_created_at: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("Starting password access anomaly detection...");

    // Get alert configurations
    const { data: configs, error: configError } = await supabase
      .from("security_alert_config")
      .select("*")
      .eq("is_enabled", true);

    if (configError) {
      console.error("Error fetching configs:", configError);
      throw configError;
    }

    const alertConfigs = configs as AlertConfig[];
    const alertsSent: { type: string; count: number; details: string }[] = [];

    // Check for bulk access
    const bulkConfig = alertConfigs.find(c => c.alert_type === "bulk_access");
    if (bulkConfig && bulkConfig.alert_recipients.length > 0) {
      console.log(`Checking bulk access: threshold=${bulkConfig.threshold}, window=${bulkConfig.time_window_minutes}min`);
      
      const { data: bulkResults, error: bulkError } = await supabase
        .rpc("detect_bulk_password_access", {
          p_threshold: bulkConfig.threshold,
          p_time_window_minutes: bulkConfig.time_window_minutes
        });

      if (bulkError) {
        console.error("Error detecting bulk access:", bulkError);
      } else if (bulkResults && bulkResults.length > 0) {
        const results = bulkResults as BulkAccessResult[];
        console.log(`Found ${results.length} users with bulk password access`);

        // Check if we already sent an alert for these users recently
        for (const result of results) {
          const { data: recentAlert } = await supabase
            .from("security_alerts_sent")
            .select("id")
            .eq("alert_type", "bulk_access")
            .eq("user_id", result.user_id)
            .gt("sent_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
            .single();

          if (!recentAlert) {
            // Send alert
            await sendBulkAccessAlert(resendApiKey, bulkConfig.alert_recipients, result);
            
            // Record that we sent an alert
            await supabase.from("security_alerts_sent").insert({
              alert_type: "bulk_access",
              user_id: result.user_id,
              details: result
            });

            alertsSent.push({
              type: "bulk_access",
              count: 1,
              details: `User ${result.user_email} accessed ${result.access_count} passwords`
            });
          }
        }
      }
    }

    // Check for new user access
    const newUserConfig = alertConfigs.find(c => c.alert_type === "new_user_access");
    if (newUserConfig && newUserConfig.alert_recipients.length > 0) {
      console.log(`Checking new user access: window=${newUserConfig.time_window_minutes}min`);
      
      const { data: newUserResults, error: newUserError } = await supabase
        .rpc("detect_new_user_password_access", {
          p_time_window_minutes: newUserConfig.time_window_minutes
        });

      if (newUserError) {
        console.error("Error detecting new user access:", newUserError);
      } else if (newUserResults && newUserResults.length > 0) {
        const results = newUserResults as NewUserAccessResult[];
        console.log(`Found ${results.length} new users accessing passwords`);

        for (const result of results) {
          const { data: recentAlert } = await supabase
            .from("security_alerts_sent")
            .select("id")
            .eq("alert_type", "new_user_access")
            .eq("user_id", result.user_id)
            .gt("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .single();

          if (!recentAlert) {
            await sendNewUserAccessAlert(resendApiKey, newUserConfig.alert_recipients, result);
            
            await supabase.from("security_alerts_sent").insert({
              alert_type: "new_user_access",
              user_id: result.user_id,
              details: result
            });

            alertsSent.push({
              type: "new_user_access",
              count: 1,
              details: `New user ${result.user_email} accessed passwords`
            });
          }
        }
      }
    }

    console.log(`Anomaly detection complete. Alerts sent: ${alertsSent.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Anomaly detection complete`,
        alerts_sent: alertsSent 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in detect-password-anomalies:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

async function sendBulkAccessAlert(
  resendApiKey: string | undefined,
  recipients: string[],
  data: BulkAccessResult
) {
  if (!resendApiKey || recipients.length === 0) {
    console.log("Skipping email - no API key or recipients configured");
    return;
  }

  const resend = new Resend(resendApiKey);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">⚠️ Security Alert</h1>
        <p style="margin: 10px 0 0 0;">Unusual Password Access Detected</p>
      </div>
      
      <div style="padding: 20px; background: #f9fafb;">
        <h2 style="color: #dc2626;">Bulk Password Access Pattern</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">User</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${data.user_email}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Password Accesses</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${data.access_count}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">First Access</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(data.first_access).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Last Access</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(data.last_access).toLocaleString()}</td>
          </tr>
        </table>
        
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px;">
          <p style="margin: 0; color: #991b1b;">
            <strong>Recommended Action:</strong> Review the user's activity and verify this access is legitimate.
            Consider temporarily restricting the user's access if suspicious.
          </p>
        </div>
      </div>
      
      <div style="padding: 20px; background: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p>This is an automated security alert from Edara System</p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Edara Security <onboarding@resend.dev>",
      to: recipients,
      subject: `🚨 Security Alert: Bulk Password Access by ${data.user_email}`,
      html
    });
    console.log(`Bulk access alert sent to ${recipients.join(", ")}`);
  } catch (error) {
    console.error("Failed to send bulk access alert:", error);
  }
}

async function sendNewUserAccessAlert(
  resendApiKey: string | undefined,
  recipients: string[],
  data: NewUserAccessResult
) {
  if (!resendApiKey || recipients.length === 0) {
    console.log("Skipping email - no API key or recipients configured");
    return;
  }

  const resend = new Resend(resendApiKey);
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f59e0b; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">🆕 Security Alert</h1>
        <p style="margin: 10px 0 0 0;">New User Accessing Passwords</p>
      </div>
      
      <div style="padding: 20px; background: #f9fafb;">
        <h2 style="color: #f59e0b;">New User Password Access</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">User</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${data.user_email}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Account Created</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(data.user_created_at).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Password Accesses</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #f59e0b; font-weight: bold;">${data.access_count}</td>
          </tr>
        </table>
        
        <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 15px; border-radius: 8px;">
          <p style="margin: 0; color: #92400e;">
            <strong>Note:</strong> A newly created user account has accessed email password credentials.
            Verify this user was properly authorized to access these credentials.
          </p>
        </div>
      </div>
      
      <div style="padding: 20px; background: #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
        <p>This is an automated security alert from Edara System</p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: "Edara Security <onboarding@resend.dev>",
      to: recipients,
      subject: `🆕 Security Alert: New User ${data.user_email} Accessed Passwords`,
      html
    });
    console.log(`New user access alert sent to ${recipients.join(", ")}`);
  } catch (error) {
    console.error("Failed to send new user access alert:", error);
  }
}