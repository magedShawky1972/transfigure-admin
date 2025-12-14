import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface OrderLine {
  order_number: string;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  brand_code: string | null;
  brand_name: string | null;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  cost_price: number | null;
  cost_sold: number | null;
  coins_number: number | null;
  customer_phone: string | null;
  customer_name: string | null;
  created_at_date: string | null;
  payment_method: string | null;
  payment_type: string | null;
  payment_brand: string | null;
  user_name: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactions } = await req.json() as { transactions: OrderLine[] };

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No transactions provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Syncing orders to Odoo:', transactions.length, 'lines');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Odoo API configuration
    const { data: odooConfig, error: configError } = await supabase
      .from('odoo_api_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !odooConfig) {
      console.error('Error fetching Odoo config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Odoo API configuration not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which URLs and API key to use based on is_production_mode
    const isProductionMode = odooConfig.is_production_mode !== false;
    const customerApiUrl = isProductionMode ? odooConfig.customer_api_url : odooConfig.customer_api_url_test;
    const brandApiUrl = isProductionMode ? odooConfig.brand_api_url : odooConfig.brand_api_url_test;
    const productApiUrl = isProductionMode ? odooConfig.product_api_url : odooConfig.product_api_url_test;
    const salesOrderApiUrl = isProductionMode ? odooConfig.sales_order_api_url : odooConfig.sales_order_api_url_test;
    const odooApiKey = isProductionMode ? odooConfig.api_key : odooConfig.api_key_test;

    console.log('Using environment:', isProductionMode ? 'Production' : 'Test');

    if (!salesOrderApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Sales Order API URL not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Group transactions by order_number
    const orderGroups = new Map<string, OrderLine[]>();
    for (const tx of transactions) {
      if (!tx.order_number) continue;
      const existing = orderGroups.get(tx.order_number) || [];
      existing.push(tx);
      orderGroups.set(tx.order_number, existing);
    }

    console.log('Processing', orderGroups.size, 'orders');

    // Process each order
    for (const [orderNumber, orderLines] of orderGroups) {
      try {
        const firstLine = orderLines[0];
        console.log('Processing order:', orderNumber, 'with', orderLines.length, 'lines');

        // Step 1: Sync Customer
        let customerResult = null;
        if (firstLine.customer_phone && customerApiUrl) {
          console.log('Checking/creating customer:', firstLine.customer_phone);
          
          // First check if customer exists with PUT
          try {
            const checkResponse = await fetch(`${customerApiUrl}/${firstLine.customer_phone}`, {
              method: 'PUT',
              headers: {
                'Authorization': odooApiKey,
                'Content-Type': 'application/json',
              },
            });
            
            const checkText = await checkResponse.text();
            let checkData;
            try { checkData = JSON.parse(checkText); } catch { checkData = null; }
            
            if (checkResponse.ok && checkData?.success) {
              customerResult = checkData;
              console.log('Customer already exists:', checkData);
            }
          } catch (e) {
            console.log('Customer check failed, will try to create');
          }

          // If customer doesn't exist, create it
          if (!customerResult) {
            const createResponse = await fetch(customerApiUrl, {
              method: 'POST',
              headers: {
                'Authorization': odooApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                partner_type: "customer",
                phone: firstLine.customer_phone,
                name: firstLine.customer_name || 'Unknown Customer',
                email: "",
                status: "active",
              }),
            });
            
            const createText = await createResponse.text();
            try { customerResult = JSON.parse(createText); } catch { customerResult = { message: createText }; }
            console.log('Customer create result:', customerResult);
          }
        }

        // Step 2: Sync Brand(s)
        const brandCodes = [...new Set(orderLines.map(l => l.brand_code).filter(Boolean))];
        for (const brandCode of brandCodes) {
          const brandLine = orderLines.find(l => l.brand_code === brandCode);
          if (!brandCode || !brandApiUrl) continue;

          console.log('Checking/creating brand:', brandCode);
          
          // Try PUT first (update)
          const putResponse = await fetch(`${brandApiUrl}/${brandCode}`, {
            method: 'PUT',
            headers: {
              'Authorization': odooApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: brandLine?.brand_name || brandCode,
            }),
          });
          
          const putText = await putResponse.text();
          let putResult;
          try { putResult = JSON.parse(putText); } catch { putResult = { success: false }; }
          
          if (!putResult.success) {
            // Brand doesn't exist, create it
            const postResponse = await fetch(brandApiUrl, {
              method: 'POST',
              headers: {
                'Authorization': odooApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: brandLine?.brand_name || brandCode,
                cat_code: brandCode,
                status: 'active',
              }),
            });
            
            const postText = await postResponse.text();
            console.log('Brand create result:', postText);
          } else {
            console.log('Brand already exists:', brandCode);
          }
        }

        // Step 3: Sync Product(s)
        const skus = [...new Set(orderLines.map(l => l.sku || l.product_id).filter(Boolean))];
        for (const sku of skus) {
          const productLine = orderLines.find(l => (l.sku || l.product_id) === sku);
          if (!sku || !productApiUrl) continue;

          console.log('Checking/creating product:', sku);
          
          // Try PUT first (update)
          const putResponse = await fetch(`${productApiUrl}/${sku}`, {
            method: 'PUT',
            headers: {
              'Authorization': odooApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: productLine?.product_name || sku,
            }),
          });
          
          const putText = await putResponse.text();
          let putResult;
          try { putResult = JSON.parse(putText); } catch { putResult = { success: false }; }
          
          if (!putResult.success && !putText.includes('success')) {
            // Product doesn't exist, create it
            const postResponse = await fetch(productApiUrl, {
              method: 'POST',
              headers: {
                'Authorization': odooApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sku: sku,
                name: productLine?.product_name || sku,
                cat_code: productLine?.brand_code || undefined,
                cost_price: productLine?.cost_price || 0,
                sales_price: productLine?.unit_price || 0,
              }),
            });
            
            const postText = await postResponse.text();
            console.log('Product create result:', postText);
          } else {
            console.log('Product already exists:', sku);
          }
        }

        // Step 4: Create Order Header + Lines
        console.log('Creating order in Odoo:', orderNumber);
        
        const orderPayload = {
          order_number: orderNumber,
          customer_phone: firstLine.customer_phone,
          order_date: firstLine.created_at_date,
          payment_term: "immediate",
          sales_person: firstLine.user_name || null,
          transaction_type: firstLine.user_name ? "manual" : "automatic",
          company: "Asus",
          status: 1,
          status_description: "completed",
          lines: orderLines.map((line, idx) => ({
            line_number: idx + 1,
            line_status: 1,
            product_sku: line.sku || line.product_id,
            quantity: line.qty || 1,
            unit_price: line.unit_price || 0,
            total: line.total || 0,
            coins_number: line.coins_number || 0,
            cost_price: line.cost_price || 0,
            total_cost: line.cost_sold || 0,
          })),
          payment: {
            payment_method: firstLine.payment_method,
            payment_brand: firstLine.payment_brand,
            payment_amount: orderLines.reduce((sum, l) => sum + (l.total || 0), 0),
          },
        };

        console.log('Order payload:', JSON.stringify(orderPayload));

        const orderResponse = await fetch(salesOrderApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': odooApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderPayload),
        });

        const orderText = await orderResponse.text();
        console.log('Order response status:', orderResponse.status);
        console.log('Order response:', orderText);

        let orderResult;
        try { orderResult = JSON.parse(orderText); } catch { orderResult = { message: orderText }; }

        if (orderResponse.ok || orderResult.success) {
          results.push({
            order_number: orderNumber,
            success: true,
            message: 'Order synced successfully',
            odoo_response: orderResult,
          });
        } else {
          errors.push({
            order_number: orderNumber,
            success: false,
            error: orderResult.error || orderResult.message || 'Failed to create order',
            odoo_response: orderResult,
          });
        }

      } catch (orderError) {
        console.error('Error processing order:', orderNumber, orderError);
        errors.push({
          order_number: orderNumber,
          success: false,
          error: orderError instanceof Error ? orderError.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        total_orders: orderGroups.size,
        synced: results.length,
        failed: errors.length,
        results,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-order-to-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});