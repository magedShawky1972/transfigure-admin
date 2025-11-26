import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const twilioWhatsAppFrom = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

  try {
    const { to, message, conversationId, messageId } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending WhatsApp message:", { to, message: message.substring(0, 50) });

    // Format phone number for WhatsApp
    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const formattedFrom = twilioWhatsAppFrom.startsWith("whatsapp:") 
      ? twilioWhatsAppFrom 
      : `whatsapp:${twilioWhatsAppFrom}`;

    // Send via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", formattedTo);
    formData.append("From", formattedFrom);
    formData.append("Body", message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio API error:", twilioResult);
      
      // Update message status to failed
      if (messageId) {
        await supabase
          .from("whatsapp_messages")
          .update({ message_status: "failed" })
          .eq("id", messageId);
      }

      return new Response(
        JSON.stringify({ error: twilioResult.message || "Failed to send message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Twilio response:", twilioResult);

    // Update message with Twilio SID and status
    if (messageId) {
      await supabase
        .from("whatsapp_messages")
        .update({ 
          twilio_sid: twilioResult.sid,
          message_status: twilioResult.status || "sent"
        })
        .eq("id", messageId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: twilioResult.sid,
        status: twilioResult.status 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Send WhatsApp error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
