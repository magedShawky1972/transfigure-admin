import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find payments stuck in entry or receiving phase for > 1 day
    const delayThreshold = new Date();
    delayThreshold.setDate(delayThreshold.getDate() - 1);
    const thresholdISO = delayThreshold.toISOString();

    const { data: delayedPayments, error } = await supabase
      .from("supplier_advance_payments")
      .select("id, supplier_id, current_phase, transaction_amount, currency_id, created_by, created_by_name, updated_at, created_at")
      .in("current_phase", ["entry", "receiving"])
      .lt("updated_at", thresholdISO);

    if (error) {
      console.error("Error fetching delayed payments:", error);
      throw error;
    }

    if (!delayedPayments || delayedPayments.length === 0) {
      console.log("No delayed supplier advance payments found");
      return new Response(JSON.stringify({ success: true, delayed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Found ${delayedPayments.length} delayed supplier advance payments`);

    const phaseLabelsAr: Record<string, string> = {
      entry: "الإدخال",
      receiving: "الاستلام",
    };

    let alertsSent = 0;

    for (const payment of delayedPayments) {
      const updatedAt = new Date(payment.updated_at || payment.created_at);
      const now = new Date();
      const delayDays = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      if (delayDays < 1) continue;

      // Get supplier name
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("supplier_name")
        .eq("id", payment.supplier_id)
        .maybeSingle();

      // Get currency code
      let currencyCode = "";
      if (payment.currency_id) {
        const { data: currency } = await supabase
          .from("currencies")
          .select("currency_code")
          .eq("id", payment.currency_id)
          .maybeSingle();
        currencyCode = currency?.currency_code || "";
      }

      const arPhaseLabel = phaseLabelsAr[payment.current_phase] || payment.current_phase;

      // Find responsible users for this phase from workflow assignments
      const { data: assignments } = await supabase
        .from("advance_payment_workflow_assignments")
        .select("user_id, user_name")
        .eq("phase", payment.current_phase);

      const responsibleUsers = assignments || [];

      for (const responsible of responsibleUsers) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-advance-payment-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "delay_alert",
              userId: responsible.user_id,
              userName: responsible.user_name || "",
              supplierName: supplier?.supplier_name || "",
              phase: payment.current_phase,
              phaseLabel: arPhaseLabel,
              paymentId: payment.id,
              transactionAmount: payment.transaction_amount,
              currencyCode,
              delayDays,
              responsibleUserName: responsible.user_name || "",
            }),
          });
          alertsSent++;
        } catch (err) {
          console.error("Failed to send delay alert:", err);
        }
      }

      // If no assignees, send to creator
      if (responsibleUsers.length === 0) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-advance-payment-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "delay_alert",
              userId: payment.created_by || "",
              userName: payment.created_by_name || "",
              supplierName: supplier?.supplier_name || "",
              phase: payment.current_phase,
              phaseLabel: arPhaseLabel,
              paymentId: payment.id,
              transactionAmount: payment.transaction_amount,
              currencyCode,
              delayDays,
              responsibleUserName: payment.created_by_name || "",
            }),
          });
          alertsSent++;
        } catch (err) {
          console.error("Failed to send delay alert:", err);
        }
      }
    }

    console.log(`Sent ${alertsSent} supplier advance payment delay alerts`);

    return new Response(
      JSON.stringify({ success: true, delayed: delayedPayments.length, alertsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
