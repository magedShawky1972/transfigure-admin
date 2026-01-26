import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing env vars", {
        hasUrl: Boolean(supabaseUrl),
        hasAnon: Boolean(anonKey),
        hasService: Boolean(serviceRoleKey),
      });
      return new Response(JSON.stringify({ error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const serviceClient = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    console.log("void-expense-payment: auth header present:", Boolean(authHeader));

    // Validate token and fetch user (manual auth when verify_jwt=false)
    let userDataRes = await anonClient.auth.getUser();
    if (userDataRes.error || !userDataRes.data?.user?.id) {
      console.warn("getUser() via header failed, retrying with explicit token");
      userDataRes = await anonClient.auth.getUser(token);
    }

    const userErr = userDataRes.error;
    const userData = userDataRes.data;
    if (userErr || !userData?.user?.id) {
      console.error("Auth getUser failed", { message: userErr?.message, status: (userErr as any)?.status });
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const expenseRequestId = body.expense_request_id;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!isUuid(expenseRequestId)) {
      return new Response(JSON.stringify({ error: "invalid_expense_request_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reason.length < 2 || reason.length > 500) {
      return new Response(JSON.stringify({ error: "invalid_reason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: require admin role
    const { data: isAdmin, error: roleErr } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load request
    const { data: request, error: reqErr } = await serviceClient
      .from("expense_requests")
      .select(
        "id, request_number, description, amount, base_currency_amount, status, paid_at, paid_by, treasury_id, currency_id",
      )
      .eq("id", expenseRequestId)
      .maybeSingle();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "request_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.status !== "paid") {
      return new Response(JSON.stringify({ error: "request_not_paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all linked treasury entries
    const { data: treasuryEntries, error: teErr } = await serviceClient
      .from("treasury_entries")
      .select("id, entry_number, converted_amount")
      .eq("expense_request_id", expenseRequestId);

    if (teErr) {
      return new Response(JSON.stringify({ error: "failed_to_fetch_treasury_entries" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const treasuryEntryIds = (treasuryEntries ?? []).map((e) => e.id);
    const treasuryAmountTotal = (treasuryEntries ?? []).reduce(
      (sum, e) => sum + (Number(e.converted_amount) || 0),
      0,
    );
    const treasuryEntryNumber = treasuryEntries?.[0]?.entry_number ?? null;

    // Fetch expense entry (linked by expense_reference)
    const { data: expenseEntry, error: eeErr } = await serviceClient
      .from("expense_entries")
      .select("id")
      .eq("expense_reference", request.request_number)
      .maybeSingle();

    if (eeErr) {
      return new Response(JSON.stringify({ error: "failed_to_fetch_expense_entry" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_name")
      .eq("user_id", userId)
      .maybeSingle();

    // Insert void history
    const { error: vhErr } = await serviceClient.from("void_payment_history").insert({
      expense_request_id: request.id,
      request_number: request.request_number,
      description: request.description,
      original_amount: request.amount,
      treasury_amount: treasuryEntries?.length ? treasuryAmountTotal : null,
      // currency codes are optional in history; frontend prints from history
      currency_code: null,
      treasury_currency_code: null,
      treasury_id: request.treasury_id,
      treasury_name: null,
      treasury_entry_number: treasuryEntryNumber,
      original_paid_at: request.paid_at,
      voided_by: userId,
      voided_by_name: profile?.user_name ?? userEmail ?? null,
      reason,
    } as unknown as Record<string, Json>);

    if (vhErr) {
      return new Response(JSON.stringify({ error: "failed_to_insert_void_history", details: vhErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete treasury entries (service role => real delete)
    let deletedCount = 0;
    if (treasuryEntryIds.length > 0) {
      const { data: deletedRows, error: delErr } = await serviceClient
        .from("treasury_entries")
        .delete()
        .in("id", treasuryEntryIds)
        .select("id");

      if (delErr) {
        return new Response(JSON.stringify({ error: "failed_to_delete_treasury_entries", details: delErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      deletedCount = deletedRows?.length ?? 0;
    }

    // Reopen expense entry
    if (expenseEntry?.id) {
      const { error: updEeErr } = await serviceClient
        .from("expense_entries")
        .update({ status: "approved", paid_by: null, paid_at: null })
        .eq("id", expenseEntry.id);
      if (updEeErr) {
        return new Response(JSON.stringify({ error: "failed_to_update_expense_entry", details: updEeErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Reopen expense request
    const { error: updReqErr } = await serviceClient
      .from("expense_requests")
      .update({ status: "approved", paid_by: null, paid_at: null })
      .eq("id", request.id);

    if (updReqErr) {
      return new Response(JSON.stringify({ error: "failed_to_update_request", details: updReqErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log (best effort)
    await serviceClient.from("audit_logs").insert({
      user_id: userId,
      action: "VOID_PAYMENT",
      table_name: "expense_requests",
      record_id: request.id,
      old_data: {
        status: "paid",
        treasury_entry_ids: treasuryEntryIds,
      },
      new_data: {
        status: "approved",
        void_reason: reason,
        deleted_entries_count: deletedCount,
      },
    } as unknown as Record<string, Json>);

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        treasuryEntryIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("void-expense-payment error:", error);
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: "server_error", details: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
