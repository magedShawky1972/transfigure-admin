import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncDetailRow {
  id: string;
  run_id: string;
  order_number: string;
  order_date: string | null;
  customer_phone: string | null;
  product_names: string | null;
  total_amount: number | null;
  sync_status: string;
  error_message: string | null;
  payment_method: string | null;
  payment_brand: string | null;
}

interface Transaction {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  brand_code: string;
  brand_name: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  total: number;
  qty: number;
  created_at_date: string;
  payment_method: string;
  payment_brand?: string;
  user_name?: string;
  cost_price?: number;
  cost_sold?: number;
  vendor_name?: string;
  company?: string;
}

const parseProductNames = (raw: string | null) =>
  String(raw ?? "")
    .split(",")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user?.id) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { detailId } = await req.json();
    if (!detailId) {
      return new Response(JSON.stringify({ success: false, error: "Missing detailId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: detail, error: detailError } = await supabase
      .from("odoo_sync_run_details")
      .select("*")
      .eq("id", detailId)
      .single();

    if (detailError || !detail) {
      return new Response(JSON.stringify({ success: false, error: "Detail not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = detail as SyncDetailRow;

    // Make sure the caller owns this run (best-effort). We validate via background_sync_jobs.user_id if linked.
    // If there's no linkage available, we still proceed (this function is protected by auth, and IDs are UUIDs).
    try {
      const { data: run } = await supabase
        .from("odoo_sync_runs")
        .select("id,user_id")
        .eq("id", row.run_id)
        .maybeSingle();

      if (run?.user_id && run.user_id !== userRes.user.id) {
        return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // ignore ownership check errors
    }

    // Mark processing
    await supabase
      .from("odoo_sync_run_details")
      .update({ sync_status: "processing", error_message: null })
      .eq("id", row.id);

    // Build transactions
    let formattedTransactions: Transaction[] = [];

    const { data: purpleTx } = await supabase
      .from("purpletransaction")
      .select("*")
      .eq("order_number", row.order_number);

    if (purpleTx && purpleTx.length > 0) {
      formattedTransactions = purpleTx.map((t: any) => ({
        order_number: t.order_number,
        customer_name: t.customer_name ?? "Customer",
        customer_phone: t.customer_phone ?? row.customer_phone ?? "0000",
        brand_code: t.brand_code ?? "",
        brand_name: t.brand_name ?? "",
        product_id: String(t.product_id ?? ""),
        product_name: t.product_name ?? "",
        unit_price: Number(t.unit_price ?? 0) || 0,
        total: Number(t.total ?? 0) || 0,
        qty: Number(t.qty ?? 1) || 1,
        created_at_date: t.created_at_date ?? row.order_date ?? "",
        payment_method: t.payment_method ?? row.payment_method ?? "",
        payment_brand: t.payment_brand ?? row.payment_brand ?? "",
        user_name: t.user_name ?? "",
        cost_price: Number(t.cost_price ?? 0) || 0,
        cost_sold: Number(t.cost_sold ?? 0) || 0,
        vendor_name: t.vendor_name ?? "",
        company: t.company ?? "",
      }));
    } else {
      const { data: orderTotals } = await supabase
        .from("ordertotals")
        .select("*")
        .eq("order_number", row.order_number);

      if (orderTotals && orderTotals.length > 0) {
        formattedTransactions = orderTotals.map((t: any) => ({
          order_number: t.order_number,
          customer_name: t.customer_name ?? "Customer",
          customer_phone: t.phone ?? row.customer_phone ?? "0000",
          brand_code: t.brand_code ?? "",
          brand_name: t.brand_name ?? "",
          product_id: String(t.product_id ?? ""),
          product_name: t.product_name ?? "",
          unit_price: Number(t.unit_price ?? 0) || 0,
          total: Number(t.total ?? 0) || 0,
          qty: Number(t.qty ?? 1) || 1,
          created_at_date: t.created_at_date ?? row.order_date ?? "",
          payment_method: t.payment_method ?? row.payment_method ?? "",
          payment_brand: t.payment_brand ?? row.payment_brand ?? "",
          user_name: t.user_name ?? "",
          cost_price: Number(t.cost_price ?? 0) || 0,
          cost_sold: Number(t.cost_sold ?? 0) || 0,
          vendor_name: t.vendor_name ?? "",
          company: t.company ?? "",
        }));
      } else {
        const productNames = parseProductNames(row.product_names);
        const skuOrIdMatch = row.error_message?.match(/SKU:\s*([A-Za-z0-9_-]+)/i);
        const skuOrId = skuOrIdMatch?.[1] || null;
        const numericId = skuOrId && /^\d+$/.test(skuOrId) ? skuOrId : null;

        const productSelect =
          "product_id, product_name, brand_name, brand_code, sku, product_price, product_cost, supplier";

        let products: any[] = [];

        if (skuOrId) {
          const orParts: string[] = [];
          if (numericId) orParts.push(`product_id.eq.${numericId}`);
          orParts.push(`sku.eq.${skuOrId}`);
          const { data } = await supabase.from("products").select(productSelect).or(orParts.join(","));
          products = (data as any[]) || [];
        }

        if (products.length === 0 && productNames.length > 0) {
          const { data } = await supabase.from("products").select(productSelect).in("product_name", productNames);
          products = (data as any[]) || [];
        }

        if (products.length === 0 && productNames[0]) {
          const { data } = await supabase
            .from("products")
            .select(productSelect)
            .ilike("product_name", `%${productNames[0]}%`);
          products = (data as any[]) || [];
        }

        if (products.length === 0) {
          await supabase
            .from("odoo_sync_run_details")
            .update({
              sync_status: "failed",
              error_message: row.error_message ?? "Product information not found",
            })
            .eq("id", row.id);

          return new Response(
            JSON.stringify({ success: false, error: row.error_message ?? "Product information not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        formattedTransactions = products.map((p: any) => {
          const unitPrice = Number(p.product_price ?? 0) || Number(row.total_amount ?? 0) || 0;
          const costPrice = Number(p.product_cost ?? 0) || 0;

          return {
            order_number: row.order_number,
            customer_name: "Customer",
            customer_phone: row.customer_phone ?? "0000",
            brand_code: p.brand_code ?? "",
            brand_name: p.brand_name ?? "",
            product_id: String(p.product_id ?? ""),
            product_name: p.product_name ?? "",
            unit_price: unitPrice,
            total: Number(row.total_amount ?? unitPrice) || 0,
            qty: 1,
            created_at_date: row.order_date ?? "",
            payment_method: row.payment_method ?? "",
            payment_brand: row.payment_brand ?? "",
            user_name: "",
            cost_price: costPrice,
            cost_sold: costPrice,
            vendor_name: p.supplier ?? "",
            company: "",
          };
        });
      }
    }

    if (formattedTransactions.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No transactions for retry" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const steps = ["customer", "brand", "product", "order"] as const;
    let lastError: string | null = null;
    const stepStatuses: Record<string, string> = {};

    for (const step of steps) {
      const { data: result, error: stepError } = await supabase.functions.invoke("sync-order-to-odoo-step", {
        body: { step, transactions: formattedTransactions },
      });

      if (stepError) {
        lastError = stepError.message;
        stepStatuses[`step_${step}`] = "failed";
        break;
      }

      if (!(result as any)?.success) {
        lastError = (result as any)?.error || `${step} step failed`;
        stepStatuses[`step_${step}`] = "failed";
        break;
      }

      stepStatuses[`step_${step}`] = (result as any)?.skipped ? "skipped" : (result as any)?.method === "SKIP" ? "found" : "sent";
    }

    // Purchase step (non-stock)
    if (!lastError) {
      const productIds = formattedTransactions.map((t) => t.product_id).filter(Boolean);
      const { data: nonStockData } = await supabase
        .from("products")
        .select("product_id, non_stock")
        .in("product_id", productIds);

      const nonStockItems = (nonStockData as any[])?.filter((p: any) => p.non_stock === true) || [];

      if (nonStockItems.length > 0) {
        const nonStockProductIds = nonStockItems.map((p: any) => p.product_id);
        const nonStockProducts = formattedTransactions.filter((t) => nonStockProductIds.includes(t.product_id));

        const { data: purchaseResult, error: purchaseError } = await supabase.functions.invoke("sync-order-to-odoo-step", {
          body: { step: "purchase", transactions: formattedTransactions, nonStockProducts },
        });

        if (purchaseError) {
          lastError = purchaseError.message;
          stepStatuses.step_purchase = "failed";
        } else if ((purchaseResult as any)?.success === false) {
          lastError = (purchaseResult as any)?.error || "Purchase step failed";
          stepStatuses.step_purchase = "failed";
        } else {
          stepStatuses.step_purchase = (purchaseResult as any)?.skipped ? "skipped" : "sent";
        }
      } else {
        stepStatuses.step_purchase = "skipped";
      }
    }

    const finalStatus = lastError ? "failed" : "success";

    await supabase
      .from("odoo_sync_run_details")
      .update({
        sync_status: finalStatus,
        error_message: lastError,
        ...stepStatuses,
      })
      .eq("id", row.id);

    return new Response(
      JSON.stringify({ success: !lastError, finalStatus, error: lastError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("[retry-odoo-sync-detail] fatal", e);
    return new Response(JSON.stringify({ success: false, error: String((e as any)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
