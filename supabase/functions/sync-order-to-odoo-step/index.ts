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
  payment_brand?: string;
  user_name?: string;
  cost_price?: number;
  cost_sold?: number;
  vendor_name?: string;
}

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const splitVendorCandidates = (vendorName: unknown) => {
  const raw = String(vendorName ?? "").trim();
  if (!raw) return [] as string[];
  const parts = raw
    .split(/-|–|—/)
    .map((p) => p.trim())
    .filter(Boolean);
  return [raw, ...parts];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { step, transactions, nonStockProducts } = await req.json();

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
        
        // Prepare request bodies for display
        const updateBody = {
          name: firstTransaction.customer_name || "Customer",
          phone: firstTransaction.customer_phone,
        };
        
        const createBody = {
          partner_type: "customer",
          name: firstTransaction.customer_name || "Customer",
          phone: firstTransaction.customer_phone,
          email: "",
          customer_group: "Retail",
          status: "active",
          is_blocked: false,
          block_reason: "",
        };

        result = {
          step: "customer",
          mode: isProduction ? "Production" : "Test",
          apiUrl: customerApiUrl,
          requestBody: createBody, // Show the POST body by default
        };

        try {
          // Try to update existing customer
          const checkResponse = await fetch(`${customerApiUrl}/${firstTransaction.customer_phone}`, {
            method: "PUT",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(updateBody),
          });

          if (checkResponse.ok) {
            const data = await checkResponse.json();
            result.success = true;
            result.message = `Customer found/updated: ${firstTransaction.customer_name || firstTransaction.customer_phone}`;
            result.details = data;
            result.requestBody = updateBody;
            result.method = "PUT";
            result.fullUrl = `${customerApiUrl}/${firstTransaction.customer_phone}`;
          } else {
            // Create new customer - must include partner_type
            const createResponse = await fetch(customerApiUrl, {
              method: "POST",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(createBody),
            });

            result.method = "POST";
            result.fullUrl = customerApiUrl;

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
        
        // Build request bodies for each brand
        const brandBodies: any[] = [];
        for (const brandCode of uniqueBrands) {
          const transaction = transactions.find((t: Transaction) => t.brand_code === brandCode);
          brandBodies.push({
            cat_code: brandCode,
            name: transaction?.brand_name || brandCode,
          });
        }

        result = {
          step: "brand",
          mode: isProduction ? "Production" : "Test",
          apiUrl: brandApiUrl,
          brands: [],
          requestBody: brandBodies,
          method: "POST/PUT",
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
        const uniqueProductIds = [...new Set(transactions.map((t: Transaction) => t.product_id))];
        
        // Fetch actual SKUs from products table
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("product_id, sku, product_name, product_price, product_cost, brand_code")
          .in("product_id", uniqueProductIds);

        if (productsError) {
          result = {
            step: "product",
            mode: isProduction ? "Production" : "Test",
            apiUrl: productApiUrl,
            success: false,
            error: `Failed to fetch products: ${productsError.message}`,
          };
          break;
        }

        // Build request bodies for display
        const productBodies: any[] = [];
        for (const productId of uniqueProductIds) {
          const product = productsData?.find((p: any) => p.product_id === productId);
          const transaction = transactions.find((t: Transaction) => t.product_id === productId);
          const actualSku = product?.sku || productId;
          
          productBodies.push({
            default_code: actualSku,
            name: transaction?.product_name || actualSku,
            list_price: parseFloat(String(transaction?.unit_price)) || 0,
            cat_code: transaction?.brand_code,
          });
        }

        result = {
          step: "product",
          mode: isProduction ? "Production" : "Test",
          apiUrl: productApiUrl,
          products: [],
          requestBody: productBodies,
          method: "POST/PUT",
        };

        for (const productId of uniqueProductIds) {
          const product = productsData?.find((p: any) => p.product_id === productId);
          const transaction = transactions.find((t: Transaction) => t.product_id === productId);
          
          const actualSku = product?.sku || productId;
          const productResult: any = { sku: actualSku, product_name: transaction?.product_name };

          try {
            const checkResponse = await fetch(`${productApiUrl}/${actualSku}`, {
              method: "PUT",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: transaction?.product_name || actualSku,
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
                  default_code: actualSku,
                  name: transaction?.product_name || actualSku,
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
        
        // Fetch actual SKUs from products table for order lines
        const productIds = [...new Set(transactions.map((t: Transaction) => t.product_id))];
        const { data: productsData } = await supabase
          .from("products")
          .select("product_id, sku")
          .in("product_id", productIds);

        const skuMap = new Map();
        productsData?.forEach((p: any) => {
          skuMap.set(p.product_id, p.sku);
        });

        // Format order_date to YYYY-MM-DD HH:mm:ss format
        const formatOrderDate = (dateStr: string): string => {
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              // If it's already in the right format, return as-is
              return dateStr;
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
          } catch {
            return dateStr;
          }
        };

        const orderPayload = {
          order_number: firstTransaction.order_number,
          customer_phone: firstTransaction.customer_phone,
          order_date: formatOrderDate(firstTransaction.created_at_date),
          payment_method: firstTransaction.payment_method,
          payment_brand: firstTransaction.payment_brand || "",
          sales_person: firstTransaction.user_name || "",
          online_payment: "true",
          lines: transactions.map((t: Transaction, index: number) => ({
            line_number: index + 1,
            product_sku: skuMap.get(t.product_id) || t.product_id,
            quantity: parseFloat(String(t.qty)) || 1,
            uom: "Unit",
            unit_price: parseFloat(String(t.unit_price)) || 0,
            total: parseFloat(String(t.total)) || 0,
          })),
        };

        result = {
          step: "order",
          mode: isProduction ? "Production" : "Test",
          apiUrl: salesOrderApiUrl,
          requestBody: orderPayload,
          method: "POST",
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

      case "purchase": {
        // Check if there are non-stock products
        if (!nonStockProducts || nonStockProducts.length === 0) {
          result = {
            step: "purchase",
            mode: isProduction ? "Production" : "Test",
            skipped: true,
            success: true,
            message: "No non-stock products - purchase order step skipped",
          };
          break;
        }

        const purchaseApiUrl = isProduction ? config.purchase_order_api_url : config.purchase_order_api_url_test;

        if (!purchaseApiUrl) {
          result = {
            step: "purchase",
            mode: isProduction ? "Production" : "Test",
            success: false,
            error: "Purchase order API URL not configured",
          };
          break;
        }

        // Fetch actual SKUs from products table for purchase lines
        const nonStockProductIds = [...new Set(nonStockProducts.map((t: Transaction) => t.product_id))];
        const { data: productsData } = await supabase
          .from("products")
          .select("product_id, sku")
          .in("product_id", nonStockProductIds);

        const skuMap = new Map();
        productsData?.forEach((p: any) => {
          skuMap.set(p.product_id, p.sku);
        });

        // Collect vendor candidates and lookup supplier codes by name/code
        const vendorCandidates: string[] = [];
        nonStockProducts.forEach((t: Transaction) => {
          splitVendorCandidates(t.vendor_name).forEach((c) => vendorCandidates.push(c));
        });

        const uniqueCandidates = [...new Set(vendorCandidates.map((v) => v.trim()).filter(Boolean))];
        const supplierCodeMap = new Map<string, string>();

        if (uniqueCandidates.length > 0) {
          const [byName, byCode] = await Promise.all([
            supabase
              .from("suppliers")
              .select("supplier_name, supplier_code")
              .in("supplier_name", uniqueCandidates),
            supabase
              .from("suppliers")
              .select("supplier_name, supplier_code")
              .in("supplier_code", uniqueCandidates),
          ]);

          const suppliersData = [...(byName.data || []), ...(byCode.data || [])];
          suppliersData.forEach((s: any) => {
            const nameKey = normalizeKey(s.supplier_name);
            const codeKey = normalizeKey(s.supplier_code);
            if (nameKey) supplierCodeMap.set(nameKey, s.supplier_code);
            if (codeKey) supplierCodeMap.set(codeKey, s.supplier_code);
          });
        }

        // Format order_date to YYYY-MM-DD HH:mm:ss format
        const formatPurchaseDate = (dateStr: string): string => {
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              return dateStr;
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
          } catch {
            return dateStr;
          }
        };

        const headerSupplierCode =
          nonStockProducts
            .flatMap((t: Transaction) => splitVendorCandidates(t.vendor_name))
            .map((c: string) => supplierCodeMap.get(normalizeKey(c)))
            .find((v: string | undefined) => Boolean(v)) || "";

        const purchasePayload = {
          order_number: firstTransaction.order_number,
          order_date: formatPurchaseDate(firstTransaction.created_at_date),
          payment_method: firstTransaction.payment_method || "",
          payment_brand: firstTransaction.payment_brand || "",
          supplier_code: headerSupplierCode || String(nonStockProducts[0]?.vendor_name ?? ""),
          lines: nonStockProducts.map((t: Transaction, index: number) => ({
            line_number: index + 1,
            product_sku: skuMap.get(t.product_id) || t.product_id,
            product_name: t.product_name,
            quantity: parseFloat(String(t.qty)) || 1,
            uom: "Unit",
            unit_price: parseFloat(String(t.cost_price || t.unit_price)) || 0,
            total: parseFloat(String(t.cost_sold || t.total)) || 0,
          })),
        };

        result = {
          step: "purchase",
          mode: isProduction ? "Production" : "Test",
          apiUrl: purchaseApiUrl,
          requestBody: purchasePayload,
          method: "POST",
        };

        try {
          console.log("Creating purchase order with payload:", JSON.stringify(purchasePayload));
          
          const purchaseResponse = await fetch(purchaseApiUrl, {
            method: "POST",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(purchasePayload),
          });

          if (purchaseResponse.ok) {
            const data = await purchaseResponse.json();
            result.success = true;
            result.message = `Purchase order created for ${nonStockProducts.length} non-stock product(s)`;
            result.details = data;
          } else {
            const errorText = await purchaseResponse.text();
            result.success = false;
            result.error = `Failed to create purchase order: ${errorText}`;
          }
        } catch (err: any) {
          result.success = false;
          result.error = `Purchase order API error: ${err.message}`;
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
