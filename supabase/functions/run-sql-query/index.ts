import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the requesting user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let query: string = (body.query || "").trim();
    if (!query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip trailing semicolons
    query = query.replace(/;\s*$/g, "").trim();

    // Safety: only allow a single SELECT/WITH statement
    const lowered = query.toLowerCase();
    const startsOk = lowered.startsWith("select") || lowered.startsWith("with");
    if (!startsOk) {
      return new Response(JSON.stringify({ error: "Only SELECT / WITH queries are allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Block multiple statements
    if (query.includes(";")) {
      return new Response(JSON.stringify({ error: "Multiple statements are not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Block dangerous keywords
    const forbidden = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|vacuum|comment|reindex|lock|do|call|merge)\b/i;
    if (forbidden.test(lowered)) {
      return new Response(JSON.stringify({ error: "Only read-only SELECT queries are allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client to execute raw SQL via JSON-returning subquery
    const admin = createClient(supabaseUrl, serviceKey);

    // Wrap so postgres aggregates rows into a JSON array
    const wrapped = `select coalesce(json_agg(_q), '[]'::json) as data from (${query}) _q`;

    const { data, error } = await admin.rpc("exec_select_json", { p_sql: wrapped });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // exec_select_json returns to_jsonb({data: [...]}) -> { data: [...] }
    const rows = (data && typeof data === "object" && "data" in data)
      ? (data as { data: unknown[] }).data
      : (Array.isArray(data) ? data : []);
    return new Response(
      JSON.stringify({ rows, count: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
