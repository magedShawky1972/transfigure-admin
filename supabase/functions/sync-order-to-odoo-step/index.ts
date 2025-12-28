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
  company?: string;
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

    const firstTx = Array.isArray(transactions) && transactions.length > 0 ? (transactions[0] as Transaction) : null;
    console.log(
      `[sync-order-to-odoo-step] incoming`,
      JSON.stringify({
        step,
        order_number: firstTx?.order_number,
        customer_phone: firstTx?.customer_phone,
        brand_code: firstTx?.brand_code,
        products: Array.isArray(transactions) ? transactions.length : 0,
        nonStockProducts: Array.isArray(nonStockProducts) ? nonStockProducts.length : 0,
      })
    );

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
          requestBody: createBody,
        };

        try {
          // Step 1: Check if customer has Odoo ID in local database
          const { data: existingCustomer, error: customerError } = await supabase
            .from("customers")
            .select("partner_profile_id, res_partner_id")
            .eq("customer_phone", firstTransaction.customer_phone)
            .maybeSingle();

          if (customerError) {
            console.log("Error checking local customer:", customerError.message);
          }

          // If customer has Odoo ID locally, skip creation
          if (existingCustomer?.partner_profile_id) {
            result.success = true;
            result.message = `Customer already exists in Odoo (from local DB): ${firstTransaction.customer_name || firstTransaction.customer_phone}`;
            result.details = {
              partner_profile_id: existingCustomer.partner_profile_id,
              res_partner_id: existingCustomer.res_partner_id,
              source: "local_database"
            };
            result.method = "SKIP";
            result.fullUrl = "N/A - Customer already has Odoo ID";
            break;
          }

          // Step 2: Check if customer exists in Odoo via PUT request
          console.log(`Checking if customer exists in Odoo: ${customerApiUrl}/${firstTransaction.customer_phone}`);
          const checkResponse = await fetch(`${customerApiUrl}/${firstTransaction.customer_phone}`, {
            method: "PUT",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
          });

          const checkText = await checkResponse.text();
          console.log("Check response status:", checkResponse.status);
          console.log("Check response:", checkText);

          let checkData: any = null;
          try {
            checkData = JSON.parse(checkText);
          } catch (e) {
            checkData = null;
          }

          // If customer exists in Odoo (success: true with partner_profile_id), don't create
          if (checkResponse.ok && checkData?.success === true && checkData?.partner_profile_id) {
            result.success = true;
            result.message = `Customer already exists in Odoo: ${firstTransaction.customer_name || firstTransaction.customer_phone}`;
            result.details = {
              partner_profile_id: checkData.partner_profile_id,
              res_partner_id: checkData.res_partner_id,
              message: checkData.message,
              source: "odoo_api"
            };
            result.method = "PUT (Check)";
            result.fullUrl = `${customerApiUrl}/${firstTransaction.customer_phone}`;

            // Update local customer record with Odoo IDs
            const { error: updateError } = await supabase
              .from("customers")
              .update({
                partner_profile_id: checkData.partner_profile_id,
                res_partner_id: checkData.res_partner_id,
              })
              .eq("customer_phone", firstTransaction.customer_phone);

            if (updateError) {
              console.log("Error updating local customer with Odoo IDs:", updateError.message);
            } else {
              console.log("Updated local customer with Odoo IDs");
            }
            break;
          }

          // Step 3: Customer doesn't exist, create new customer
          console.log("Customer not found in Odoo, creating new customer...");
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

            // Update local customer record with new Odoo IDs
            if (data.partner_profile_id) {
              const { error: updateError } = await supabase
                .from("customers")
                .update({
                  partner_profile_id: data.partner_profile_id,
                  res_partner_id: data.res_partner_id,
                })
                .eq("customer_phone", firstTransaction.customer_phone);

              if (updateError) {
                console.log("Error updating local customer with new Odoo IDs:", updateError.message);
              }
            }
          } else {
            const errorText = await createResponse.text();
            
            // Check if customer already exists (Odoo returns existing_partner_profile_id)
            try {
              const errorData = JSON.parse(errorText);
              if (errorData.existing_partner_profile_id) {
                result.success = true;
                result.message = `Customer already exists in Odoo: ${firstTransaction.customer_name || firstTransaction.customer_phone}`;
                result.details = {
                  partner_profile_id: errorData.existing_partner_profile_id,
                  res_partner_id: errorData.existing_res_partner_id,
                  source: "odoo_create_response"
                };

                // Update local customer record with Odoo IDs
                const { error: updateError } = await supabase
                  .from("customers")
                  .update({
                    partner_profile_id: errorData.existing_partner_profile_id,
                    res_partner_id: errorData.existing_res_partner_id,
                  })
                  .eq("customer_phone", firstTransaction.customer_phone);

                if (updateError) {
                  console.log("Error updating local customer with existing Odoo IDs:", updateError.message);
                }
                break;
              }
            } catch (e) {
              // Not JSON, continue with error
            }
            
            result.success = false;
            result.error = `Failed to create customer: ${errorText}`;
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
          method: "PUT (Check) / POST (Create)",
        };

        for (const brandCode of uniqueBrands) {
          const transaction = transactions.find((t: Transaction) => t.brand_code === brandCode);
          const brandResult: any = { brand_code: brandCode, brand_name: transaction?.brand_name };

          try {
            // Step 1: Check if brand has Odoo category_id in local database
            const { data: existingBrand, error: brandError } = await supabase
              .from("brands")
              .select("odoo_category_id, brand_code")
              .eq("brand_code", brandCode)
              .maybeSingle();

            if (brandError) {
              console.log("Error checking local brand:", brandError.message);
            }

            // If brand has Odoo category_id locally, skip creation
            if (existingBrand?.odoo_category_id) {
              brandResult.status = "exists";
              brandResult.message = `Brand already exists in Odoo (from local DB): category_id=${existingBrand.odoo_category_id}`;
              brandResult.category_id = existingBrand.odoo_category_id;
              brandResult.source = "local_database";
              result.brands.push(brandResult);
              continue;
            }

            // Step 2: Check if brand exists in Odoo via PUT request using brand_code as cat_code
            console.log(`Checking if brand exists in Odoo: ${brandApiUrl}/${brandCode}`);
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

            const checkText = await checkResponse.text();
            console.log("Brand check response status:", checkResponse.status);
            console.log("Brand check response:", checkText);

            let checkData: any = null;
            try {
              checkData = JSON.parse(checkText);
            } catch (e) {
              checkData = null;
            }

            // If brand exists in Odoo (success: true with category_id), don't create
            if (checkResponse.ok && checkData?.success === true && checkData?.category_id) {
              brandResult.status = "exists";
              brandResult.message = `Brand already exists in Odoo: ${checkData.category_name || brandCode}`;
              brandResult.category_id = checkData.category_id;
              brandResult.category_code = checkData.category_code;
              brandResult.category_name = checkData.category_name;
              brandResult.source = "odoo_api";

              // Update local brand record with Odoo category_id
              const { error: updateError } = await supabase
                .from("brands")
                .update({ odoo_category_id: checkData.category_id })
                .eq("brand_code", brandCode);

              if (updateError) {
                console.log("Error updating local brand with Odoo category_id:", updateError.message);
              } else {
                console.log(`Updated local brand ${brandCode} with Odoo category_id: ${checkData.category_id}`);
              }

              result.brands.push(brandResult);
              continue;
            }

            // Step 3: Brand doesn't exist, create new brand
            console.log(`Brand ${brandCode} not found in Odoo, creating new brand...`);
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
              const createData = await createResponse.json();
              brandResult.status = "created";
              brandResult.message = "New brand created";
              brandResult.category_id = createData.category_id;
              brandResult.category_code = createData.category_code;

              // Update local brand record with new Odoo category_id
              if (createData.category_id) {
                const { error: updateError } = await supabase
                  .from("brands")
                  .update({ odoo_category_id: createData.category_id })
                  .eq("brand_code", brandCode);

                if (updateError) {
                  console.log("Error updating local brand with new Odoo category_id:", updateError.message);
                }
              }
            } else {
              const errorText = await createResponse.text();
              
              // Check if brand already exists (Odoo returns existing_category_id)
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.existing_category_id) {
                  brandResult.status = "exists";
                  brandResult.message = `Brand already exists in Odoo: category_id=${errorData.existing_category_id}`;
                  brandResult.category_id = errorData.existing_category_id;
                  brandResult.source = "odoo_create_response";

                  // Update local brand record with Odoo category_id
                  const { error: updateError } = await supabase
                    .from("brands")
                    .update({ odoo_category_id: errorData.existing_category_id })
                    .eq("brand_code", brandCode);

                  if (updateError) {
                    console.log("Error updating local brand with existing Odoo category_id:", updateError.message);
                  }
                  result.brands.push(brandResult);
                  continue;
                }
              } catch (e) {
                // Not JSON, continue with error
              }
              
              brandResult.status = "failed";
              brandResult.message = errorText;
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
        
        // Fetch actual SKUs and odoo_product_id from products table
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select("product_id, sku, product_name, product_price, product_cost, brand_code, odoo_product_id")
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
          method: "PUT (Check) / POST (Create)",
        };

        for (const productId of uniqueProductIds) {
          const product = productsData?.find((p: any) => p.product_id === productId);
          const transaction = transactions.find((t: Transaction) => t.product_id === productId);
          
          const actualSku = product?.sku || productId;
          const productResult: any = { sku: actualSku, product_name: transaction?.product_name };

          try {
            // Step 1: Check if product has Odoo product_id in local database
            if (product?.odoo_product_id) {
              productResult.status = "exists";
              productResult.message = `Product already exists in Odoo (from local DB): product_id=${product.odoo_product_id}`;
              productResult.odoo_product_id = product.odoo_product_id;
              productResult.source = "local_database";
              result.products.push(productResult);
              continue;
            }

            // Step 2: Check if product exists in Odoo via PUT request using SKU
            console.log(`Checking if product exists in Odoo: ${productApiUrl}/${actualSku}`);
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

            const checkText = await checkResponse.text();
            console.log("Product check response status:", checkResponse.status);
            console.log("Product check response:", checkText);

            let checkData: any = null;
            try {
              checkData = JSON.parse(checkText);
            } catch (e) {
              checkData = null;
            }

            // If product exists in Odoo (success: true with product_id), don't create
            if (checkResponse.ok && checkData?.success === true && checkData?.product_id) {
              productResult.status = "exists";
              productResult.message = `Product already exists in Odoo: ${checkData.sku || actualSku}`;
              productResult.odoo_product_id = checkData.product_id;
              productResult.product_master_id = checkData.product_master_id;
              productResult.sku = checkData.sku;
              productResult.source = "odoo_api";

              // Update local product record with Odoo product_id
              const { error: updateError } = await supabase
                .from("products")
                .update({ odoo_product_id: checkData.product_id })
                .eq("product_id", productId);

              if (updateError) {
                console.log("Error updating local product with Odoo product_id:", updateError.message);
              } else {
                console.log(`Updated local product ${actualSku} with Odoo product_id: ${checkData.product_id}`);
              }

              result.products.push(productResult);
              continue;
            }

            // Step 3: Product doesn't exist, create new product
            console.log(`Product ${actualSku} not found in Odoo, creating new product...`);
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
              const createData = await createResponse.json();
              productResult.status = "created";
              productResult.message = "New product created";
              productResult.odoo_product_id = createData.product_id;
              productResult.sku = createData.sku || actualSku;

              // Update local product record with new Odoo product_id
              if (createData.product_id) {
                const { error: updateError } = await supabase
                  .from("products")
                  .update({ odoo_product_id: createData.product_id })
                  .eq("product_id", productId);

                if (updateError) {
                  console.log("Error updating local product with new Odoo product_id:", updateError.message);
                }
              }
            } else {
              const errorText = await createResponse.text();
              
              // Check if product already exists (Odoo returns existing_product_id)
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.existing_product_id) {
                  productResult.status = "exists";
                  productResult.message = `Product already exists in Odoo: product_id=${errorData.existing_product_id}`;
                  productResult.odoo_product_id = errorData.existing_product_id;
                  productResult.source = "odoo_create_response";

                  // Update local product record with Odoo product_id
                  const { error: updateError } = await supabase
                    .from("products")
                    .update({ odoo_product_id: errorData.existing_product_id })
                    .eq("product_id", productId);

                  if (updateError) {
                    console.log("Error updating local product with existing Odoo product_id:", updateError.message);
                  }
                  result.products.push(productResult);
                  continue;
                }
              } catch (e) {
                // Not JSON, continue with error
              }
              
              productResult.status = "failed";
              productResult.message = errorText;
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
          company: firstTransaction.company || "Purple",
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
          console.log(
            `[sync-order-to-odoo-step] ORDER POST -> ${salesOrderApiUrl} for order ${firstTransaction.order_number}`
          );
          console.log(`[sync-order-to-odoo-step] ORDER payload:`, JSON.stringify(orderPayload));

          const orderResponse = await fetch(salesOrderApiUrl, {
            method: "POST",
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderPayload),
          });

          const orderText = await orderResponse.text();
          console.log(`[sync-order-to-odoo-step] ORDER response status: ${orderResponse.status}`);
          console.log(`[sync-order-to-odoo-step] ORDER response body: ${orderText}`);

          let data: any = null;
          try {
            data = JSON.parse(orderText);
          } catch {
            data = { raw: orderText };
          }

          // Check if Odoo returned an error in the response body (even with HTTP 200)
          if (data?.error || data?.success === false) {
            result.success = false;
            result.error = data.error?.error || data.error || data.message || `Failed to create order: ${orderText}`;
            result.details = data;
          } else if (orderResponse.ok) {
            result.success = true;
            result.message = `Order ${firstTransaction.order_number} created successfully in Odoo!`;
            result.details = data;
          } else {
            result.success = false;
            result.error = `Failed to create order: ${orderText}`;
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
          company: firstTransaction.company || "Purple",
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
