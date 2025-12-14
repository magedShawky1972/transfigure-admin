import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { step, transactions } = await req.json();

    if (!step || !transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing step or transactions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Odoo config
    const { data: config, error: configError } = await supabase
      .from("odoo_api_config")
      .select("*")
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "No active Odoo API configuration found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const isProduction = config.is_production_mode;
    const apiKey = isProduction ? config.api_key : config.api_key_test;
    const firstTransaction = transactions[0] as Transaction;

    let result: any = { success: false };

    switch (step) {
      case "customer": {
        const customerApiUrl = isProduction ? config.customer_api_url : config.customer_api_url_test;
        
        result = {
          step: "customer",
          mode: isProduction ? "Production" : "Test",
          apiUrl: customerApiUrl,
        };

        try {
          // Try to update existing customer
          const checkResponse = await fetch(`${customerApiUrl}/${firstTransaction.customer_phone}`, {
            method: "PUT",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: firstTransaction.customer_name || "Customer",
              phone: firstTransaction.customer_phone,
            }),
          });

          if (checkResponse.ok) {
            const data = await checkResponse.json();
            result.success = true;
            result.message = `Customer found/updated: ${firstTransaction.customer_name || firstTransaction.customer_phone}`;
            result.details = data;
          } else {
            // Create new customer
            const createResponse = await fetch(customerApiUrl, {
              method: "POST",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: firstTransaction.customer_name || "Customer",
                phone: firstTransaction.customer_phone,
              }),
            });

            if (createResponse.ok) {
              const data = await createResponse.json();
              result.success = true;
              result.message = `New customer created: ${firstTransaction.customer_name || firstTransaction.customer_phone}`;
              result.details = data;
            } else {
              const errorText = await createResponse.text();
              result.success = false;
              result.error = `Failed to create customer: ${errorText}`;
            }
          }
        } catch (err: any) {
          result.success = false;
          result.error = `Customer API error: ${err.message}`;
        }
        break;
      }

      case "brand": {
        const brandApiUrl = isProduction ? config.brand_api_url : config.brand_api_url_test;
        const uniqueBrands = [...new Set(transactions.map((t: Transaction) => t.brand_code))];
        
        result = {
          step: "brand",
          mode: isProduction ? "Production" : "Test",
          apiUrl: brandApiUrl,
          brands: [],
        };

        for (const brandCode of uniqueBrands) {
          const transaction = transactions.find((t: Transaction) => t.brand_code === brandCode);
          const brandResult: any = { brand_code: brandCode, brand_name: transaction?.brand_name };

          try {
            const checkResponse = await fetch(`${brandApiUrl}/${brandCode}`, {
              method: "PUT",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: transaction?.brand_name || brandCode,
              }),
            });

            if (checkResponse.ok) {
              brandResult.status = "updated";
              brandResult.message = "Brand found and updated";
            } else {
              const createResponse = await fetch(brandApiUrl, {
                method: "POST",
                headers: {
                  Authorization: apiKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  cat_code: brandCode,
                  name: transaction?.brand_name || brandCode,
                }),
              });

              if (createResponse.ok) {
                brandResult.status = "created";
                brandResult.message = "New brand created";
              } else {
                brandResult.status = "failed";
                brandResult.message = await createResponse.text();
              }
            }
          } catch (err: any) {
            brandResult.status = "error";
            brandResult.message = err.message;
          }

          result.brands.push(brandResult);
        }

        result.success = result.brands.every((b: any) => b.status !== "failed" && b.status !== "error");
        result.message = `Processed ${result.brands.length} brand(s)`;
        break;
      }

      case "product": {
        const productApiUrl = isProduction ? config.product_api_url : config.product_api_url_test;
        const uniqueProducts = [...new Set(transactions.map((t: Transaction) => t.product_id))];
        
        result = {
          step: "product",
          mode: isProduction ? "Production" : "Test",
          apiUrl: productApiUrl,
          products: [],
        };

        for (const sku of uniqueProducts) {
          const transaction = transactions.find((t: Transaction) => t.product_id === sku);
          const productResult: any = { sku, product_name: transaction?.product_name };

          try {
            const checkResponse = await fetch(`${productApiUrl}/${sku}`, {
              method: "PUT",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: transaction?.product_name || sku,
                list_price: parseFloat(String(transaction?.unit_price)) || 0,
              }),
            });

            if (checkResponse.ok) {
              productResult.status = "updated";
              productResult.message = "Product found and updated";
            } else {
              const createResponse = await fetch(productApiUrl, {
                method: "POST",
                headers: {
                  Authorization: apiKey,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  default_code: sku,
                  name: transaction?.product_name || sku,
                  list_price: parseFloat(String(transaction?.unit_price)) || 0,
                  cat_code: transaction?.brand_code,
                }),
              });

              if (createResponse.ok) {
                productResult.status = "created";
                productResult.message = "New product created";
              } else {
                productResult.status = "failed";
                productResult.message = await createResponse.text();
              }
            }
          } catch (err: any) {
            productResult.status = "error";
            productResult.message = err.message;
          }

          result.products.push(productResult);
        }

        result.success = result.products.every((p: any) => p.status !== "failed" && p.status !== "error");
        result.message = `Processed ${result.products.length} product(s)`;
        break;
      }

      case "order": {
        const salesOrderApiUrl = isProduction ? config.sales_order_api_url : config.sales_order_api_url_test;
        
        result = {
          step: "order",
          mode: isProduction ? "Production" : "Test",
          apiUrl: salesOrderApiUrl,
        };

        const orderPayload = {
          order_number: firstTransaction.order_number,
          customer_phone: firstTransaction.customer_phone,
          order_date: firstTransaction.created_at_date,
          payment_method: firstTransaction.payment_method,
          lines: transactions.map((t: Transaction, index: number) => ({
            line_number: index + 1,
            product_sku: t.product_id,
            quantity: t.qty || 1,
            unit_price: parseFloat(String(t.unit_price)) || 0,
            total: parseFloat(String(t.total)) || 0,
          })),
        };

        try {
          const orderResponse = await fetch(salesOrderApiUrl, {
            method: "POST",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderPayload),
          });

          if (orderResponse.ok) {
            const data = await orderResponse.json();
            result.success = true;
            result.message = `Order ${firstTransaction.order_number} created successfully in Odoo!`;
            result.details = data;
          } else {
            const errorText = await orderResponse.text();
            result.success = false;
            result.error = `Failed to create order: ${errorText}`;
          }
        } catch (err: any) {
          result.success = false;
          result.error = `Order API error: ${err.message}`;
        }
        break;
      }

      default:
        result = { success: false, error: "Unknown step" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in sync-order-to-odoo-step:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
