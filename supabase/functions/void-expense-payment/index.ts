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
    const expenseEntryId = body.expense_entry_id;
    const sourceType = body.source_type as string || "expense_request";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    // Validate IDs based on source type
    if (sourceType === "expense_request" && !isUuid(expenseRequestId)) {
      return new Response(JSON.stringify({ error: "invalid_expense_request_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (sourceType === "expense_entry" && !isUuid(expenseEntryId)) {
      return new Response(JSON.stringify({ error: "invalid_expense_entry_id" }), {
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

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_name")
      .eq("user_id", userId)
      .maybeSingle();

    let reversalCount = 0;
    let requestNumber = "";
    let description = "";
    let amount = 0;
    let treasuryAmountTotal = 0;
    let treasuryEntryNumber: string | null = null;
    let treasuryId: string | null = null;
    let paidAt: string | null = null;

    // Helper function to create reversal entry for treasury
    const createTreasuryReversalEntry = async (originalEntry: any, voidReason: string) => {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const reversalEntryNumber = `VR-${dateStr}-${randomSuffix}`;
      const reversalEntry = {
        treasury_id: originalEntry.treasury_id,
        entry_date: now.toISOString().split('T')[0],
        entry_type: "void_reversal",
        entry_number: reversalEntryNumber,
        amount: originalEntry.amount,
        converted_amount: originalEntry.converted_amount,
        description: `Void of ${originalEntry.entry_number}: ${voidReason}`,
        reference_type: "void",
        reference_id: originalEntry.id,
        status: "posted",
        created_by: userId,
        posted_by: userId,
        posted_at: new Date().toISOString(),
        from_currency_id: originalEntry.from_currency_id,
        to_currency_id: originalEntry.to_currency_id,
        exchange_rate: originalEntry.exchange_rate,
        expense_request_id: originalEntry.expense_request_id,
        cost_center_id: originalEntry.cost_center_id,
      };

      const { error: insertErr } = await serviceClient.from("treasury_entries").insert(reversalEntry);
      if (insertErr) {
        console.error("Failed to create treasury reversal entry:", insertErr);
        throw new Error(`Failed to create reversal entry: ${insertErr.message}`);
      }

      // Mark original entry as voided
      const { error: updateErr } = await serviceClient
        .from("treasury_entries")
        .update({ status: "voided" })
        .eq("id", originalEntry.id);
      
      if (updateErr) {
        console.error("Failed to mark treasury entry as voided:", updateErr);
        throw new Error(`Failed to mark entry as voided: ${updateErr.message}`);
      }

      return true;
    };

    // Helper function to create reversal entry for bank
    const createBankReversalEntry = async (originalEntry: any, voidReason: string) => {
      const now = new Date();
      const dateStr = now.toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const reversalEntryNumber = `VR-${dateStr}-${randomSuffix}`;
      const reversalEntry = {
        bank_id: originalEntry.bank_id,
        entry_date: now.toISOString().split('T')[0],
        entry_type: "void_reversal",
        entry_number: reversalEntryNumber,
        amount: originalEntry.amount,
        converted_amount: originalEntry.converted_amount,
        description: `Void of ${originalEntry.entry_number}: ${voidReason}`,
        reference_type: "void",
        reference_id: originalEntry.id,
        status: "posted",
        created_by: userId,
        posted_by: userId,
        posted_at: new Date().toISOString(),
        from_currency_id: originalEntry.from_currency_id,
        to_currency_id: originalEntry.to_currency_id,
        exchange_rate: originalEntry.exchange_rate,
        expense_request_id: originalEntry.expense_request_id,
      };

      const { error: insertErr } = await serviceClient.from("bank_entries").insert(reversalEntry);
      if (insertErr) {
        console.error("Failed to create bank reversal entry:", insertErr);
        throw new Error(`Failed to create bank reversal entry: ${insertErr.message}`);
      }

      // Mark original entry as voided
      const { error: updateErr } = await serviceClient
        .from("bank_entries")
        .update({ status: "voided" })
        .eq("id", originalEntry.id);
      
      if (updateErr) {
        console.error("Failed to mark bank entry as voided:", updateErr);
        throw new Error(`Failed to mark bank entry as voided: ${updateErr.message}`);
      }

      // Update bank balance (add back the amount since this was a payment)
      const totalAmount = originalEntry.converted_amount || originalEntry.amount;
      const { data: bank } = await serviceClient
        .from("banks")
        .select("current_balance")
        .eq("id", originalEntry.bank_id)
        .single();
      
      if (bank) {
        await serviceClient
          .from("banks")
          .update({ current_balance: (bank.current_balance || 0) + totalAmount })
          .eq("id", originalEntry.bank_id);
      }

      return true;
    };

    if (sourceType === "expense_request") {
      // Handle expense_request void
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

      requestNumber = request.request_number;
      description = request.description;
      amount = request.amount;
      treasuryId = request.treasury_id;
      paidAt = request.paid_at;

      // Fetch all linked treasury entries
      const { data: treasuryEntries, error: teErr } = await serviceClient
        .from("treasury_entries")
        .select("*")
        .eq("expense_request_id", expenseRequestId)
        .eq("status", "posted");

      if (teErr) {
        return new Response(JSON.stringify({ error: "failed_to_fetch_treasury_entries" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      treasuryAmountTotal = (treasuryEntries ?? []).reduce(
        (sum, e) => sum + (Number(e.converted_amount) || 0),
        0,
      );
      treasuryEntryNumber = treasuryEntries?.[0]?.entry_number ?? null;

      // Create reversal entries instead of deleting
      for (const entry of (treasuryEntries ?? [])) {
        await createTreasuryReversalEntry(entry, reason);
        reversalCount++;
      }

      // Fetch expense entry (linked by expense_reference)
      const { data: expenseEntry } = await serviceClient
        .from("expense_entries")
        .select("id")
        .eq("expense_reference", request.request_number)
        .maybeSingle();

      // Mark expense entry as voided
      if (expenseEntry?.id) {
        await serviceClient
          .from("expense_entries")
          .update({ status: "voided" })
          .eq("id", expenseEntry.id);
      }

      // Mark expense request as voided
      const { error: updReqErr } = await serviceClient
        .from("expense_requests")
        .update({ status: "voided" })
        .eq("id", request.id);

      if (updReqErr) {
        return new Response(JSON.stringify({ error: "failed_to_update_request", details: updReqErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

    } else if (sourceType === "expense_entry") {
      // Handle expense_entry void (manual entries)
      const { data: entry, error: entryErr } = await serviceClient
        .from("expense_entries")
        .select(
          "id, entry_number, expense_reference, grand_total, status, paid_at, paid_by, treasury_id, bank_id, payment_method, currency_id",
        )
        .eq("id", expenseEntryId)
        .maybeSingle();

      if (entryErr || !entry) {
        return new Response(JSON.stringify({ error: "entry_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (entry.status !== "paid") {
        return new Response(JSON.stringify({ error: "entry_not_paid" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      requestNumber = entry.entry_number;
      description = entry.expense_reference || "Manual Entry";
      amount = entry.grand_total;
      treasuryId = entry.treasury_id;
      paidAt = entry.paid_at;

      // Fetch treasury entries linked to this expense_entry
      const { data: treasuryEntries } = await serviceClient
        .from("treasury_entries")
        .select("*")
        .eq("reference_type", "expense_entry")
        .eq("reference_id", expenseEntryId)
        .eq("status", "posted");

      // Fetch bank entries linked to this expense_entry
      const { data: bankEntries } = await serviceClient
        .from("bank_entries")
        .select("*")
        .eq("reference_type", "expense_entry")
        .eq("reference_id", expenseEntryId)
        .eq("status", "posted");

      treasuryAmountTotal = (treasuryEntries ?? []).reduce(
        (sum, e) => sum + (Number(e.converted_amount) || 0),
        0,
      ) + (bankEntries ?? []).reduce(
        (sum, e) => sum + (Number(e.converted_amount) || 0),
        0,
      );
      treasuryEntryNumber = treasuryEntries?.[0]?.entry_number || bankEntries?.[0]?.entry_number || null;

      // Create reversal entries for treasury entries
      for (const treasuryEntry of (treasuryEntries ?? [])) {
        await createTreasuryReversalEntry(treasuryEntry, reason);
        reversalCount++;
      }

      // Create reversal entries for bank entries
      for (const bankEntry of (bankEntries ?? [])) {
        await createBankReversalEntry(bankEntry, reason);
        reversalCount++;
      }

      // Delete treasury_ledger entries for this expense_entry (these don't need reversal tracking)
      await serviceClient
        .from("treasury_ledger")
        .delete()
        .eq("reference_type", "expense_entry")
        .eq("reference_id", expenseEntryId);

      // Mark expense entry as voided
      const { error: updEntryErr } = await serviceClient
        .from("expense_entries")
        .update({ status: "voided" })
        .eq("id", entry.id);

      if (updEntryErr) {
        return new Response(JSON.stringify({ error: "failed_to_update_expense_entry", details: updEntryErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert void history
    const { error: vhErr } = await serviceClient.from("void_payment_history").insert({
      expense_request_id: sourceType === "expense_request" ? expenseRequestId : expenseEntryId,
      request_number: requestNumber,
      description: description,
      original_amount: amount,
      treasury_amount: treasuryAmountTotal || null,
      currency_code: null,
      treasury_currency_code: null,
      treasury_id: treasuryId,
      treasury_name: null,
      treasury_entry_number: treasuryEntryNumber,
      original_paid_at: paidAt,
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

    // Audit log (best effort)
    await serviceClient.from("audit_logs").insert({
      user_id: userId,
      action: "VOID_PAYMENT",
      table_name: sourceType === "expense_request" ? "expense_requests" : "expense_entries",
      record_id: sourceType === "expense_request" ? expenseRequestId : expenseEntryId,
      old_data: {
        status: "paid",
        source_type: sourceType,
      },
      new_data: {
        status: "voided",
        void_reason: reason,
        reversal_entries_count: reversalCount,
      },
    } as unknown as Record<string, Json>);

    return new Response(
      JSON.stringify({
        success: true,
        reversalCount,
        sourceType,
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
