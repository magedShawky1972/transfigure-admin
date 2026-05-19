import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const { action, token, password } = body || {};
    if (!token) throw new Error("Missing token");

    const { data: invite, error: invErr } = await supaAdmin
      .from("project_guests")
      .select("id, project_id, email, role, accepted_at, user_id, projects(name)")
      .eq("invite_token", token)
      .maybeSingle();
    if (invErr) throw invErr;
    if (!invite) {
      return new Response(JSON.stringify({ error: "Invalid invite" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "lookup") {
      return new Response(JSON.stringify({
        email: invite.email,
        role: invite.role,
        project_id: invite.project_id,
        project_name: (invite as any).projects?.name || null,
        accepted: !!invite.accepted_at,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "accept") {
      if (!password || String(password).length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (invite.accepted_at) {
        return new Response(JSON.stringify({ error: "Invitation already used" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auto-confirmed user (or reuse if email exists)
      let userId: string | null = null;
      const { data: created, error: createErr } = await supaAdmin.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { user_name: invite.email.split("@")[0], external_guest: true },
      });
      if (createErr) {
        // Maybe user already exists - try to find
        if (String(createErr.message || "").toLowerCase().includes("already")) {
          const { data: list } = await supaAdmin.auth.admin.listUsers();
          const found = list?.users?.find(u => (u.email || "").toLowerCase() === invite.email.toLowerCase());
          if (found) userId = found.id;
          else throw createErr;
        } else {
          throw createErr;
        }
      } else {
        userId = created.user?.id || null;
      }
      if (!userId) throw new Error("Could not create user");

      // Mark profile as external guest
      await supaAdmin.from("profiles").update({ is_external_guest: true }).eq("user_id", userId);

      // Link invite
      await supaAdmin.from("project_guests").update({
        user_id: userId,
        accepted_at: new Date().toISOString(),
      }).eq("id", invite.id);

      return new Response(JSON.stringify({
        ok: true,
        project_id: invite.project_id,
        email: invite.email,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("accept-project-guest error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
