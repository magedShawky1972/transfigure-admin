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
  order_sync_failed: boolean | null;
  purchase_sync_failed: boolean | null;
  order_error_message: string | null;
  purchase_error_message: string | null;
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

    const { detailId, retryType, supplierCode } = await req.json();
    if (!detailId) {
      return new Response(JSON.stringify({ success: false, error: "Missing detailId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // retryType can be: 'all' (default), 'order', or 'purchase'
    // supplierCode is optional - passed from UI when user selects a supplier from dropdown
    const retry = retryType || 'all';
    
    if (supplierCode) {
      console.log(`[retry-odoo-sync-detail] Received supplierCode from UI: ${supplierCode}`);
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

    // Determine what to retry based on the retryType and current state
    const orderFailed = row.order_sync_failed === true;
    const purchaseFailed = row.purchase_sync_failed === true;
    
    // If retry is 'purchase' only, skip order steps
    const shouldRetryOrder = retry === 'all' || retry === 'order' || orderFailed;
    const shouldRetryPurchase = retry === 'all' || retry === 'purchase';

    const steps = ["customer", "brand", "product", "order"] as const;
    let lastError: string | null = null;
    let orderError: string | null = null;
    let purchaseError: string | null = null;
    const stepStatuses: Record<string, string> = {};

    // Only run order steps if needed
    if (shouldRetryOrder) {
      for (const step of steps) {
        const { data: result, error: stepError } = await supabase.functions.invoke("sync-order-to-odoo-step", {
          body: { step, transactions: formattedTransactions },
        });

        if (stepError) {
          lastError = stepError.message;
          orderError = stepError.message;
          stepStatuses[`step_${step}`] = "failed";
          break;
        }

        const resultData = result as any;
        
        // Check for "already exists" - this is SUCCESS for order step, not failure!
        if (step === "order" && resultData?.error) {
          const errorMsg = String(resultData.error).toLowerCase();
          if (errorMsg.includes("already exists") || errorMsg.includes("already sent")) {
            // Order already exists in Odoo - treat as success
            console.log(`[retry-odoo-sync-detail] Order already exists, treating as success`);
            stepStatuses[`step_${step}`] = "sent";
            continue;
          }
        }

        if (!resultData?.success) {
          lastError = resultData?.error || `${step} step failed`;
          orderError = lastError;
          stepStatuses[`step_${step}`] = "failed";
          break;
        }

        stepStatuses[`step_${step}`] = resultData?.skipped ? "skipped" : resultData?.method === "SKIP" ? "found" : "sent";
      }
    } else {
      // Mark order steps as their previous state (not retrying them)
      stepStatuses.step_customer = "found";
      stepStatuses.step_brand = "found";
      stepStatuses.step_product = "found";
      stepStatuses.step_order = "sent";
    }

    // Purchase step (non-stock) - only if order succeeded (or we're only retrying purchase)
    const orderSucceeded = !orderError;
    if (orderSucceeded && shouldRetryPurchase) {
      const productIds = formattedTransactions.map((t) => t.product_id).filter(Boolean);
      const { data: nonStockData } = await supabase
        .from("products")
        .select("product_id, non_stock")
        .in("product_id", productIds);

      const nonStockItems = (nonStockData as any[])?.filter((p: any) => p.non_stock === true) || [];

      if (nonStockItems.length > 0) {
        const nonStockProductIds = nonStockItems.map((p: any) => p.product_id);
        let nonStockProducts = formattedTransactions.filter((t) => nonStockProductIds.includes(t.product_id));

        // If supplierCode was passed from UI, add it to non-stock products
        if (supplierCode) {
          console.log(`[retry-odoo-sync-detail] Using supplier code from UI: ${supplierCode}`);
          nonStockProducts = nonStockProducts.map((t) => ({
            ...t,
            supplier_code: supplierCode,
          }));
        }

        const { data: purchaseResult, error: purchaseStepError } = await supabase.functions.invoke("sync-order-to-odoo-step", {
          body: { step: "purchase", transactions: formattedTransactions, nonStockProducts },
        });

        if (purchaseStepError) {
          purchaseError = purchaseStepError.message;
          if (!lastError) lastError = purchaseError;
          stepStatuses.step_purchase = "failed";
        } else if ((purchaseResult as any)?.success === false) {
          purchaseError = (purchaseResult as any)?.error || "Purchase step failed";
          if (!lastError) lastError = purchaseError;
          stepStatuses.step_purchase = "failed";
        } else {
          stepStatuses.step_purchase = (purchaseResult as any)?.skipped ? "skipped" : "sent";
        }
      } else {
        stepStatuses.step_purchase = "skipped";
      }
    } else if (!orderSucceeded) {
      stepStatuses.step_purchase = "pending";
    }

    // Determine final status
    let finalStatus = 'success';
    if (orderError) {
      finalStatus = 'failed';
    } else if (purchaseError) {
      finalStatus = 'partial';
    }

    // Build combined error message
    let combinedError: string | null = null;
    if (orderError && purchaseError) {
      combinedError = `Order: ${orderError} | Purchase: ${purchaseError}`;
    } else if (orderError) {
      combinedError = `Order: ${orderError}`;
    } else if (purchaseError) {
      combinedError = `Purchase: ${purchaseError}`;
    }

    await supabase
      .from("odoo_sync_run_details")
      .update({
        sync_status: finalStatus,
        error_message: combinedError,
        order_sync_failed: !!orderError,
        purchase_sync_failed: !!purchaseError,
        order_error_message: orderError,
        purchase_error_message: purchaseError,
        ...stepStatuses,
      })
      .eq("id", row.id);

    // Update the background_sync_jobs counts if this detail's status changed
    // First, find the background job linked to this sync run
    const { data: bgJob } = await supabase
      .from("background_sync_jobs")
      .select("id")
      .eq("sync_run_id", row.run_id)
      .maybeSingle();

    if (bgJob?.id || row.run_id) {
      // Recalculate counts from odoo_sync_run_details
      const { data: allDetails } = await supabase
        .from("odoo_sync_run_details")
        .select("sync_status")
        .eq("run_id", row.run_id);

      if (allDetails) {
        const successCount = allDetails.filter(d => d.sync_status === "success").length;
        const failedCount = allDetails.filter(d => d.sync_status === "failed" || d.sync_status === "partial").length;
        const skippedCount = allDetails.filter(d => d.sync_status === "skipped").length;

        // Update background_sync_jobs if exists
        if (bgJob?.id) {
          await supabase
            .from("background_sync_jobs")
            .update({
              successful_orders: successCount,
              failed_orders: failedCount,
              skipped_orders: skippedCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", bgJob.id);

          console.log(`[retry-odoo-sync-detail] Updated job ${bgJob.id} counts: success=${successCount}, failed=${failedCount}, skipped=${skippedCount}`);
        }

        // ALSO update odoo_sync_runs table (this is what the history dialog reads from)
        await supabase
          .from("odoo_sync_runs")
          .update({
            successful_orders: successCount,
            failed_orders: failedCount,
            skipped_orders: skippedCount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.run_id);

        console.log(`[retry-odoo-sync-detail] Updated odoo_sync_runs ${row.run_id} counts: success=${successCount}, failed=${failedCount}, skipped=${skippedCount}`);
      }
    }

    return new Response(
      JSON.stringify({ success: finalStatus === 'success', finalStatus, error: combinedError }),
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
