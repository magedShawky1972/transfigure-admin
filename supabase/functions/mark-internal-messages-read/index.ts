import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface RequestBody {
  conversationId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header missing" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authData?.user;

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId }: RequestBody = await req.json();
    if (!conversationId) {
      return new Response(JSON.stringify({ error: "conversationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isParticipant, error: participantError } = await supabaseAdmin.rpc(
      "is_conversation_participant",
      {
        p_conversation_id: conversationId,
        p_user_id: user.id,
      }
    );

    if (participantError) {
      console.error("Participant check error:", participantError);
      return new Response(JSON.stringify({ error: "Failed to validate participant" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isParticipant) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark unread messages as read (only messages not sent by the current user)
    const { data: updatedMessages, error: updateMessagesError } = await supabaseAdmin
      .from("internal_messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .eq("is_read", false)
      .neq("sender_id", user.id)
      .select("id");

    if (updateMessagesError) {
      console.error("Update messages error:", updateMessagesError);
      return new Response(JSON.stringify({ error: "Failed to mark messages as read" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatedMessagesCount = updatedMessages?.length ?? 0;

    const nowIso = new Date().toISOString();
    const { error: updateParticipantError } = await supabaseAdmin
      .from("internal_conversation_participants")
      .update({ last_read_at: nowIso })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    if (updateParticipantError) {
      console.error("Update participant error:", updateParticipantError);
      return new Response(JSON.stringify({ error: "Failed to update last_read_at" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        updatedMessagesCount: updatedMessagesCount ?? 0,
        lastReadAt: nowIso,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("mark-internal-messages-read error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
