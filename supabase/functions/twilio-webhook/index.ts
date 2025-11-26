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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Handle POST - Incoming WhatsApp messages from Twilio
    if (req.method === "POST") {
      const formData = await req.formData();
      
      const from = formData.get("From") as string; // e.g., whatsapp:+1234567890
      const to = formData.get("To") as string;
      const body = formData.get("Body") as string;
      const messageSid = formData.get("MessageSid") as string;
      const profileName = formData.get("ProfileName") as string;

      console.log("Incoming WhatsApp message:", { from, to, body, messageSid, profileName });

      // Extract phone number from WhatsApp format
      const customerPhone = from?.replace("whatsapp:", "") || "";
      const customerName = profileName || null;

      if (!customerPhone || !body) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if conversation exists
      let { data: conversation, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("customer_phone", customerPhone)
        .maybeSingle();

      if (convError) {
        console.error("Error fetching conversation:", convError);
        throw convError;
      }

      // Create new conversation if doesn't exist
      if (!conversation) {
        const { data: newConv, error: createError } = await supabase
          .from("whatsapp_conversations")
          .insert({
            customer_phone: customerPhone,
            customer_name: customerName,
            unread_count: 1,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating conversation:", createError);
          throw createError;
        }
        conversation = newConv;
      } else {
        // Update existing conversation
        await supabase
          .from("whatsapp_conversations")
          .update({
            customer_name: customerName || conversation.customer_name,
            last_message_at: new Date().toISOString(),
            unread_count: (conversation.unread_count || 0) + 1,
          })
          .eq("id", conversation.id);
      }

      // Insert the message
      const { error: msgError } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: conversation.id,
          sender_type: "customer",
          message_text: body,
          message_status: "received",
          twilio_sid: messageSid,
        });

      if (msgError) {
        console.error("Error inserting message:", msgError);
        throw msgError;
      }

      console.log("Message saved successfully for conversation:", conversation.id);

      // Return TwiML response (empty response to acknowledge)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/xml" 
          } 
        }
      );
    }

    // Handle GET - Status callback
    if (req.method === "GET") {
      const url = new URL(req.url);
      const messageSid = url.searchParams.get("MessageSid");
      const messageStatus = url.searchParams.get("MessageStatus");

      console.log("Status callback:", { messageSid, messageStatus });

      if (messageSid && messageStatus) {
        // Update message status
        const { error } = await supabase
          .from("whatsapp_messages")
          .update({ message_status: messageStatus })
          .eq("twilio_sid", messageSid);

        if (error) {
          console.error("Error updating message status:", error);
        }
      }

      return new Response(
        JSON.stringify({ success: true, status: messageStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Twilio webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
