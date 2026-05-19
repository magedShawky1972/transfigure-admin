import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supaAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, email: rawEmail, role } = body || {};
    const email = String(rawEmail || "").trim().toLowerCase();

    if (!project_id || !emailRegex.test(email) || !["editor", "viewer"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Permission check: admin / dept admin / project manager
    const { data: isAdmin } = await supaAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: isMgr } = await supaAdmin.rpc("is_project_manager", { p_project_id: project_id, p_user_id: user.id });
      allowed = !!isMgr;
    }
    if (!allowed) {
      const { data: proj } = await supaAdmin.from("projects").select("department_id").eq("id", project_id).maybeSingle();
      if (proj) {
        const { data: da } = await supaAdmin.from("department_admins").select("id").eq("user_id", user.id).eq("department_id", proj.department_id).maybeSingle();
        if (da) allowed = true;
      }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert invite (regenerate token if existed unaccepted)
    const { data: existing } = await supaAdmin
      .from("project_guests").select("id, accepted_at, invite_token")
      .eq("project_id", project_id).eq("email", email).maybeSingle();

    let invite_token: string;
    if (existing) {
      if (existing.accepted_at) {
        return new Response(JSON.stringify({ error: "Guest already accepted" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: upd, error: updErr } = await supaAdmin
        .from("project_guests")
        .update({ role, invited_by: user.id, invited_at: new Date().toISOString() })
        .eq("id", existing.id).select("invite_token").single();
      if (updErr) throw updErr;
      invite_token = upd.invite_token;
    } else {
      const { data: ins, error: insErr } = await supaAdmin
        .from("project_guests")
        .insert({ project_id, email, role, invited_by: user.id })
        .select("invite_token").single();
      if (insErr) throw insErr;
      invite_token = ins.invite_token;
    }

    const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/") || "";
    const signupUrl = `${origin}/guest-signup?token=${invite_token}`;

    // Get project info
    const { data: project } = await supaAdmin.from("projects").select("name").eq("id", project_id).maybeSingle();

    // Send email via enqueue_email (built-in email infra). Fallback: skip email but return link.
    let emailSent = false;
    try {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#111">You're invited to collaborate</h2>
          <p>You have been invited to access the project <strong>${project?.name || "a project"}</strong> as <strong>${role === "editor" ? "Editor" : "Viewer"}</strong>.</p>
          <p>Click the button below to create your account and access the project:</p>
          <p style="margin:24px 0">
            <a href="${signupUrl}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Accept Invitation</a>
          </p>
          <p style="color:#666;font-size:12px">If the button doesn't work, copy this link:<br/>${signupUrl}</p>
        </div>`;
      const { error: enqErr } = await supaAdmin.rpc("enqueue_email", {
        p_to: email,
        p_subject: `Invitation to project ${project?.name || ""}`.trim(),
        p_html: html,
      });
      if (!enqErr) emailSent = true;
    } catch (_) { /* email infra may not exist yet */ }

    return new Response(JSON.stringify({ ok: true, signupUrl, emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-project-guest error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
