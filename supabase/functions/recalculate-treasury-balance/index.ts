import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RecalculateRequest {
  treasury_id?: string; // Optional - if null, recalculate ALL treasuries
}

interface RecalculateResult {
  treasury_id: string;
  treasury_name: string;
  opening_balance: number;
  old_balance: number;
  new_balance: number;
  difference: number;
  receipts_sum: number;
  payments_sum: number;
  transfers_sum: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { treasury_id } = await req.json() as RecalculateRequest;

    console.log(`Recalculating treasury balance${treasury_id ? ` for treasury: ${treasury_id}` : ' for ALL treasuries'}`);

    // Get treasuries to process
    let treasuriesQuery = supabase
      .from("treasuries")
      .select("id, treasury_name, opening_balance, current_balance, currency_id");
    
    if (treasury_id) {
      treasuriesQuery = treasuriesQuery.eq("id", treasury_id);
    }

    const { data: treasuries, error: treasuriesError } = await treasuriesQuery;

    if (treasuriesError) {
      throw new Error(`Error fetching treasuries: ${treasuriesError.message}`);
    }

    if (!treasuries || treasuries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: treasury_id ? "Treasury not found" : "No treasuries found" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const results: RecalculateResult[] = [];

    for (const treasury of treasuries) {
      console.log(`Processing treasury: ${treasury.treasury_name} (${treasury.id})`);

      // Get all POSTED treasury entries for this treasury
      // Use converted_amount which is already in the treasury's base currency
      const { data: entries, error: entriesError } = await supabase
        .from("treasury_entries")
        .select("entry_type, converted_amount, bank_charges, other_charges")
        .eq("treasury_id", treasury.id)
        .eq("status", "posted");

      if (entriesError) {
        console.error(`Error fetching entries for treasury ${treasury.id}:`, entriesError);
        continue;
      }

      // Calculate sums by entry type using converted_amount (already in treasury's currency)
      let receiptsSum = 0;
      let paymentsSum = 0;
      let transfersSum = 0;

      for (const entry of entries || []) {
        // Use converted_amount directly - it's already in treasury's base currency
        const amountInTreasuryCurrency = entry.converted_amount || 0;
        const charges = (entry.bank_charges || 0) + (entry.other_charges || 0);

        switch (entry.entry_type) {
          case "receipt":
            receiptsSum += amountInTreasuryCurrency;
            break;
          case "payment":
            paymentsSum += amountInTreasuryCurrency + charges;
            break;
          case "transfer":
            transfersSum += amountInTreasuryCurrency + charges;
            break;
        }
      }

      // Calculate new balance
      const openingBalance = treasury.opening_balance || 0;
      const oldBalance = treasury.current_balance || 0;
      const newBalance = openingBalance + receiptsSum - paymentsSum - transfersSum;
      const difference = newBalance - oldBalance;

      console.log(`Treasury ${treasury.treasury_name}: opening=${openingBalance}, receipts=${receiptsSum}, payments=${paymentsSum}, transfers=${transfersSum}, new=${newBalance}, diff=${difference}`);

      // Update treasury balance if different
      if (Math.abs(difference) > 0.001) {
        const { error: updateError } = await supabase
          .from("treasuries")
          .update({ current_balance: newBalance })
          .eq("id", treasury.id);

        if (updateError) {
          console.error(`Error updating treasury ${treasury.id}:`, updateError);
        } else {
          console.log(`Updated treasury ${treasury.treasury_name} balance from ${oldBalance} to ${newBalance}`);
        }
      }

      results.push({
        treasury_id: treasury.id,
        treasury_name: treasury.treasury_name,
        opening_balance: openingBalance,
        old_balance: oldBalance,
        new_balance: newBalance,
        difference: difference,
        receipts_sum: receiptsSum,
        payments_sum: paymentsSum,
        transfers_sum: transfersSum,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: `Recalculated ${results.length} treasury balance(s)`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: unknown) {
    console.error("Error in recalculate-treasury-balance:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
