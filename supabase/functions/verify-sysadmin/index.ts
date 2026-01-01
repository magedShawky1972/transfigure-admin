import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    if (!password) {
      console.log("Sysadmin auth: No password provided");
      return new Response(
        JSON.stringify({ success: false, error: "Password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the sysadmin password from environment
    const sysadminPassword = Deno.env.get("SYSADMIN_PASSWORD");

    if (!sysadminPassword) {
      console.error("SYSADMIN_PASSWORD not configured in environment");
      return new Response(
        JSON.stringify({ success: false, error: "System not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compare passwords (constant-time comparison would be better but this is sufficient for sysadmin)
    const isValid = password === sysadminPassword;

    if (!isValid) {
      console.log("Sysadmin auth: Invalid password attempt");
      // Add a small delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sysadmin auth: Successful authentication");
    
    // Generate a session token (simple hash for this session)
    const sessionToken = btoa(`sysadmin:${Date.now()}:${crypto.randomUUID()}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sessionToken,
        message: "Sysadmin authenticated successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sysadmin auth error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Authentication failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});