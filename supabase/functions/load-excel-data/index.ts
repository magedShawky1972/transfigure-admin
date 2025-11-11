import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetId, data } = await req.json();

    if (!sheetId || !data || !Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: 'Missing sheetId or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${data.length} rows for sheet ${sheetId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the sheet configuration
    const { data: sheetConfig, error: sheetError } = await supabase
      .from('excel_sheets')
      .select('target_table')
      .eq('id', sheetId)
      .single();

    if (sheetError || !sheetConfig) {
      console.error('Sheet config error:', sheetError);
      return new Response(
        JSON.stringify({ error: 'Sheet configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the column mappings
    const { data: mappings, error: mappingsError } = await supabase
      .from('excel_column_mappings')
      .select('excel_column, table_column, data_type')
      .eq('sheet_id', sheetId);

    if (mappingsError || !mappings || mappings.length === 0) {
      console.error('Mappings error:', mappingsError);
      return new Response(
        JSON.stringify({ error: 'Column mappings not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert table name to lowercase for Supabase
    const tableName = sheetConfig.target_table.toLowerCase();
    console.log(`Found ${mappings.length} column mappings for table ${tableName}`);

    // Skip database schema validation (information_schema isn't exposed via REST)
    // Assume mappings are correct and normalize target column names
    const validMappings = mappings
      .filter((m) => (m.table_column || '').trim().length > 0)
      .map((m) => ({
        excel_column: m.excel_column,
        table_column: (m.table_column || '').toLowerCase().trim(),
        data_type: (m.data_type || '').toLowerCase().trim(),
      }));

    console.log(`Prepared ${validMappings.length} column mappings (schema validation skipped)`);

    // Transform the data based on valid mappings
    const transformedData = data.map((row: any) => {
      const transformedRow: any = {};
      
      validMappings.forEach((mapping) => {
        const excelValue = row[mapping.excel_column];
        const targetColumn = (mapping.table_column || '').toLowerCase().trim();

        if (!targetColumn) return;
        
        if (excelValue !== undefined && excelValue !== null && excelValue !== '') {
          // Convert data types if needed
          const dtype = (mapping.data_type || '').toLowerCase();
          if (dtype.includes('numeric') || dtype.includes('integer') || dtype.includes('decimal') || dtype.includes('float')) {
            const num = typeof excelValue === 'string' ? parseFloat(excelValue.replace(/[,\s]/g, '')) : Number(excelValue);
            transformedRow[targetColumn] = isNaN(num) ? null : num;
          } else if (dtype.includes('timestamp') || dtype.includes('date')) {
            // Keep as provided; Edge Function relies on database to parse string timestamps
            transformedRow[targetColumn] = excelValue;
          } else {
            transformedRow[targetColumn] = typeof excelValue === 'string' ? excelValue : String(excelValue);
          }
        }
      });

      return transformedRow;
    });

    // Filter out empty rows
    const validData = transformedData.filter((row: any) => 
      Object.keys(row).length > 0
    );

    // Calculate bank_fee for purpletransaction records
    if (tableName === 'purpletransaction') {
      console.log('Calculating bank_fee for transactions...');
      
      // Fetch all active payment methods
      const { data: paymentMethods, error: pmError } = await supabase
        .from('payment_methods')
        .select('payment_method, gateway_fee, fixed_value, vat_fee')
        .eq('is_active', true);

      if (pmError) {
        console.error('Error fetching payment methods:', pmError);
      }

      const paymentMethodMap = new Map(
        (paymentMethods || []).map(pm => [pm.payment_method?.toLowerCase(), pm])
      );

      // Calculate bank_fee for each record - match on payment_brand
      for (const record of validData) {
        // Skip if payment_method is 'point'
        if (record.payment_method === 'point') {
          record.bank_fee = 0;
          continue;
        }

        // Match on payment_brand (not payment_method)
        if (record.payment_brand) {
          const pm = paymentMethodMap.get(record.payment_brand.toLowerCase());
          if (pm && record.total) {
            const total = parseFloat(record.total) || 0;
            const gatewayFee = (total * (pm.gateway_fee || 0)) / 100;
            const fixed = pm.fixed_value || 0;
            
            // Calculate: ((total * percentage/100) + fixed_fee) * 1.15 for VAT
            record.bank_fee = (gatewayFee + fixed) * 1.15;
          } else {
            record.bank_fee = 0;
          }
        } else {
          record.bank_fee = 0;
        }
      }
      
      console.log('Bank fee calculation completed');
    }

    console.log(`Inserting ${validData.length} rows into ${tableName}`);

    // Insert data with retry logic that removes unknown columns if necessary
    let rowsToInsert = validData;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(rowsToInsert);

      if (!insertError) {
        console.log(`Successfully upserted ${rowsToInsert.length} rows on attempt ${attempt + 1}`);
        break;
      }

      console.error('Insert error:', insertError);

      // Handle undefined column error (Postgres code 42703)
      const message = (insertError as any).message || '';
      const match = message.match(/column \"([^\"]+)\"/i);
      if (match && match[1]) {
        const badColumn = match[1];
        console.warn(`Retrying after removing unknown column: ${badColumn}`);
        rowsToInsert = rowsToInsert.map((r: any) => {
          const { [badColumn]: _, ...rest } = r;
          return rest;
        });
        // Continue loop to retry
        continue;
      }

      // Other errors: return immediately
      return new Response(
        JSON.stringify({ error: `Failed to insert data: ${message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // After successful insert, upsert products and brands if this is the transaction table
    let productsUpserted = 0;
    let brandsUpserted = 0;
    
    if (tableName === 'purpletransaction') {
      console.log('Checking for new products from transaction data...');
      
      // Extract unique products from the inserted data
      const productsToUpsert = validData
        .filter((row: any) => row.product_name)
        .map((row: any) => ({
          product_id: row.product_id || null,
          product_name: row.product_name,
          product_price: row.unit_price || null,
          product_cost: row.cost_price || null,
          brand_name: row.brand_name || null,
          status: 'active'
        }))
        .filter((product: any, index: number, self: any[]) => 
          // Remove duplicates by product_id or product_name
          index === self.findIndex((p: any) => 
            (product.product_id && p.product_id === product.product_id) ||
            (!product.product_id && p.product_name === product.product_name)
          )
        );

      if (productsToUpsert.length > 0) {
        // Check which products already exist
        const productIds = productsToUpsert.map(p => p.product_id).filter(id => id);
        const { data: existingProducts } = await supabase
          .from('products')
          .select('product_id')
          .in('product_id', productIds.length > 0 ? productIds : ['']);

        const existingProductIds = new Set(existingProducts?.map(p => p.product_id) || []);
        
        // Count only new products (not existing ones)
        const newProducts = productsToUpsert.filter(p => 
          p.product_id ? !existingProductIds.has(p.product_id) : true
        );

        const { error: productError } = await supabase
          .from('products')
          .upsert(productsToUpsert, {
            onConflict: 'product_id',
            ignoreDuplicates: false
          });

        if (productError) {
          console.error('Product upsert error:', productError);
        } else {
          productsUpserted = newProducts.length;
          console.log(`Successfully processed ${productsToUpsert.length} products (${productsUpserted} new)`);
        }
      }

      // Extract and upsert brands
      console.log('Checking for new brands from transaction data...');
      
      const brandsToUpsert = validData
        .filter((row: any) => row.brand_name && row.brand_name.trim())
        .map((row: any) => ({
          brand_name: row.brand_name.trim(),
          status: 'active'
        }))
        .filter((brand: any, index: number, self: any[]) => 
          // Remove duplicates by brand_name
          index === self.findIndex((b: any) => b.brand_name === brand.brand_name)
        );

      if (brandsToUpsert.length > 0) {
        // Check which brands already exist
        const brandNames = brandsToUpsert.map(b => b.brand_name);
        const { data: existingBrands } = await supabase
          .from('brands')
          .select('brand_name')
          .in('brand_name', brandNames);

        const existingBrandNames = new Set(existingBrands?.map(b => b.brand_name) || []);
        
        // Filter only new brands
        const newBrands = brandsToUpsert.filter(b => !existingBrandNames.has(b.brand_name));

        if (newBrands.length > 0) {
          const { error: brandError } = await supabase
            .from('brands')
            .insert(newBrands);

          if (brandError) {
            console.error('Brand insert error:', brandError);
          } else {
            brandsUpserted = newBrands.length;
            console.log(`Successfully inserted ${brandsUpserted} new brands`);
          }
        } else {
          console.log('No new brands to insert');
        }
      }

      // Group transactions by order_number and create ordertotals
      console.log('Calculating order totals and bank fees...');
      const orderTotalsMap = new Map();
      
      validData.forEach((row: any) => {
        // Skip orders paid with points - don't add to ordertotals
        if (row.order_number && row.payment_method !== 'point') {
          const orderNum = row.order_number;
          if (!orderTotalsMap.has(orderNum)) {
            orderTotalsMap.set(orderNum, {
              order_number: orderNum,
              total: 0,
              order_date: row.created_at_date,
              payment_method: row.payment_method,
              payment_type: row.payment_type,
              payment_brand: row.payment_brand
            });
          }
          const order = orderTotalsMap.get(orderNum);
          order.total += Number(row.total) || 0;
          // Keep the earliest date for this order if multiple transactions
          if (row.created_at_date && (!order.order_date || row.created_at_date < order.order_date)) {
            order.order_date = row.created_at_date;
          }
        }
      });

      // Fetch payment methods for bank fee calculation
      const { data: paymentMethods, error: pmError } = await supabase
        .from('payment_methods')
        .select('payment_method, gateway_fee, fixed_value, vat_fee')
        .eq('is_active', true);

      if (pmError) {
        console.error('Error fetching payment methods:', pmError);
      }

      // Calculate bank fees for each order
      const orderTotalsToUpsert = Array.from(orderTotalsMap.values()).map((order: any) => {
        let bankFee = 0;
        if (order.payment_method !== 'point' && paymentMethods) {
          const brand = (order.payment_brand || '').trim().toLowerCase();
          const paymentMethod = paymentMethods.find((pm: any) => 
            (pm.payment_method || '').trim().toLowerCase() === brand
          );
          
          if (paymentMethod) {
            const totalNum = Number(order.total) || 0;
            const gatewayPct = Number(paymentMethod.gateway_fee) || 0;
            const fixed = Number(paymentMethod.fixed_value) || 0;
            const gatewayFee = (totalNum * gatewayPct) / 100;
            bankFee = (gatewayFee + fixed) * 1.15;
          }
        }
        
        return {
          ...order,
          bank_fee: bankFee
        };
      });

      console.log(`Upserting ${orderTotalsToUpsert.length} order totals...`);

      // Upsert order totals
      if (orderTotalsToUpsert.length > 0) {
        const { error: orderTotalsError } = await supabase
          .from('ordertotals')
          .upsert(orderTotalsToUpsert, {
            onConflict: 'order_number',
            ignoreDuplicates: false
          });

        if (orderTotalsError) {
          console.error('Error upserting order totals:', orderTotalsError);
        } else {
          console.log(`Successfully upserted ${orderTotalsToUpsert.length} order totals`);
        }
      }
    }

    // Calculate summary statistics
    const totalValue = validData.reduce((sum: number, row: any) => {
      const total = parseFloat((row.total || '0').toString().replace(/[,\s]/g, ''));
      return sum + (isNaN(total) ? 0 : total);
    }, 0);

    const uniqueDates = [...new Set(validData
      .map((row: any) => row.created_at_date)
      .filter((date: any) => date)
    )].sort();

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: validData.length,
        totalValue,
        dateRange: {
          from: uniqueDates[0] || null,
          to: uniqueDates[uniqueDates.length - 1] || null
        },
        productsUpserted,
        brandsUpserted,
        message: `Successfully loaded ${validData.length} records${brandsUpserted > 0 ? ` (${brandsUpserted} new brands added)` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
