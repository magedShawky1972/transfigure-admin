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

    // Find orders in sending, receiving, or coins_entry phase that have been stuck for > 1 day
    const delayThreshold = new Date();
    delayThreshold.setDate(delayThreshold.getDate() - 1);
    const thresholdISO = delayThreshold.toISOString();

    const { data: delayedOrders, error } = await supabase
      .from("coins_purchase_orders")
      .select("id, order_number, current_phase, brand_id, phase_updated_at, created_by, created_by_name")
      .in("current_phase", ["sending", "receiving", "coins_entry"])
      .eq("status", "active")
      .lt("phase_updated_at", thresholdISO);

    if (error) {
      console.error("Error fetching delayed orders:", error);
      throw error;
    }

    if (!delayedOrders || delayedOrders.length === 0) {
      console.log("No delayed orders found");
      return new Response(JSON.stringify({ success: true, delayed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Found ${delayedOrders.length} delayed orders`);

    const phaseLabelsAr: Record<string, string> = {
      sending: "التوجيه",
      receiving: "الاستلام",
      coins_entry: "إدخال الكوينز",
    };

    let alertsSent = 0;

    for (const order of delayedOrders) {
      const phaseUpdatedAt = new Date(order.phase_updated_at || order.created_at);
      const now = new Date();
      const delayDays = Math.floor((now.getTime() - phaseUpdatedAt.getTime()) / (1000 * 60 * 60 * 24));

      if (delayDays < 1) continue;

      // Get brand name
      const { data: brand } = await supabase
        .from("brands")
        .select("brand_name")
        .eq("id", order.brand_id)
        .maybeSingle();

      // Find responsible users for this phase and brand
      const { data: assignments } = await supabase
        .from("coins_workflow_assignments")
        .select("user_id, user_name")
        .eq("brand_id", order.brand_id)
        .eq("phase", order.current_phase);

      const responsibleUsers = assignments || [];
      const arPhaseLabel = phaseLabelsAr[order.current_phase] || order.current_phase;

      // Send delay alert to each responsible user and supervisors
      for (const responsible of responsibleUsers) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-coins-workflow-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "delay_alert",
              userId: responsible.user_id,
              userName: responsible.user_name || "",
              brandName: brand?.brand_name || "",
              phase: order.current_phase,
              phaseLabel: arPhaseLabel,
              orderNumber: order.order_number,
              orderId: order.id,
              delayDays,
              responsibleUserName: responsible.user_name || "",
            }),
          });
          alertsSent++;
        } catch (err) {
          console.error("Failed to send delay alert:", err);
        }
      }

      // If no specific assignees, send to supervisors only via the notification function
      if (responsibleUsers.length === 0) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-coins-workflow-notification`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: "delay_alert",
              userId: order.created_by || "",
              userName: order.created_by_name || "",
              brandName: brand?.brand_name || "",
              phase: order.current_phase,
              phaseLabel: arPhaseLabel,
              orderNumber: order.order_number,
              orderId: order.id,
              delayDays,
              responsibleUserName: order.created_by_name || "",
            }),
          });
          alertsSent++;
        } catch (err) {
          console.error("Failed to send delay alert:", err);
        }
      }
    }

    console.log(`Sent ${alertsSent} delay alerts`);

    return new Response(
      JSON.stringify({ success: true, delayed: delayedOrders.length, alertsSent }),
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
