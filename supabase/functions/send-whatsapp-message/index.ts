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
    const { to, message, conversationId, messageId, mediaUrl, mediaType } = await req.json();

    if (!to || (!message && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to and (message or mediaUrl)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending WhatsApp message:", { to, message: message?.substring(0, 50), hasMedia: !!mediaUrl });

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
    
    // Add message body if provided
    if (message) {
      formData.append("Body", message);
    }
    
    // Add media URL if provided (for attachments)
    if (mediaUrl) {
      formData.append("MediaUrl", mediaUrl);
    }

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

    // Update message with Twilio SID, status, and media info
    if (messageId) {
      const updateData: Record<string, unknown> = { 
        twilio_sid: twilioResult.sid,
        message_status: twilioResult.status || "sent"
      };
      
      if (mediaUrl) {
        updateData.media_url = mediaUrl;
        updateData.media_type = mediaType || 'file';
      }
      
      await supabase
        .from("whatsapp_messages")
        .update(updateData)
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
