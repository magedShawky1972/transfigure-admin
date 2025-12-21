import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert Excel serial date to ISO timestamp string
function convertExcelDate(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // If it's already a valid date string, return as-is
  if (typeof value === 'string') {
    // Check if it looks like an ISO date or common date format
    const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}[\/\-]\d{2}[\/\-]\d{4}/;
    if (datePattern.test(value)) {
      return value;
    }
    // Try to parse as number (Excel serial)
    const num = parseFloat(value);
    if (isNaN(num)) {
      return value; // Return original if not a number
    }
    value = num;
  }
  
  if (typeof value === 'number') {
    // Excel serial date: days since 1899-12-30 (Excel incorrectly treats 1900 as leap year)
    // Serial number 1 = January 1, 1900
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // December 30, 1899
    const days = Math.floor(value);
    const fraction = value - days;
    
    // Calculate the date
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    
    // Add the time portion (fraction of day)
    const totalSeconds = Math.round(fraction * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    date.setUTCHours(hours, minutes, seconds);
    
    return date.toISOString();
  }
  
  return String(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sheetId, data, brandTypeSelections, checkBrand = true, checkProduct = true } = await req.json();

    if (!sheetId || !data || !Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: 'Missing sheetId or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${data.length} rows for sheet ${sheetId}, checkBrand=${checkBrand}, checkProduct=${checkProduct}`);

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

    // Get the column mappings (including JSON config)
    const { data: mappings, error: mappingsError } = await supabase
      .from('excel_column_mappings')
      .select('excel_column, table_column, data_type, is_json_column, json_split_keys')
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
        is_json_column: m.is_json_column || false,
        json_split_keys: m.json_split_keys || [],
      }));

    // Find JSON columns that need to be split and parse their key->column mappings
    const jsonMappings = mappings
      .filter((m) => m.is_json_column && m.json_split_keys && m.json_split_keys.length > 0)
      .map((m) => {
        // Parse the key->column mappings from table_column (stored as JSON)
        let keyToColumnMap: Record<string, string> = {};
        try {
          const parsed = JSON.parse(m.table_column);
          if (typeof parsed === 'object' && parsed !== null) {
            keyToColumnMap = parsed;
          }
        } catch {
          // If not valid JSON, fall back to generating column names from keys
          (m.json_split_keys || []).forEach((key: string) => {
            const cleanColName = key
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/g, '');
            keyToColumnMap[key] = cleanColName;
          });
        }
        return {
          excel_column: m.excel_column,
          json_split_keys: m.json_split_keys || [],
          keyToColumnMap,
        };
      });
    
    console.log(`Prepared ${validMappings.length} column mappings, ${jsonMappings.length} JSON columns to split`);

    // Transform the data based on valid mappings
    const transformedData = data.map((row: any) => {
      const transformedRow: any = {};
      
      validMappings.forEach((mapping) => {
        const excelValue = row[mapping.excel_column];
        const targetColumn = (mapping.table_column || '').toLowerCase().trim();

        // Skip JSON columns that have split keys - they'll be handled separately
        if (mapping.is_json_column && mapping.json_split_keys && mapping.json_split_keys.length > 0) {
          return;
        }

        if (!targetColumn) return;
        
        if (excelValue !== undefined && excelValue !== null && excelValue !== '') {
          // If the destination column is a timestamp/date-like column, ensure Excel serial numbers are converted
          const targetLooksDateTime = targetColumn.includes('timestamp') || targetColumn.endsWith('_date') || targetColumn.endsWith('date');
          const valueIsNumericString = typeof excelValue === 'string' && /^\d+(\.\d+)?$/.test(excelValue.trim());
          const valueIsNumber = typeof excelValue === 'number' || valueIsNumericString;

          if (targetLooksDateTime && valueIsNumber) {
            transformedRow[targetColumn] = convertExcelDate(excelValue);
            return;
          }

          // Convert data types if needed
          const dtype = (mapping.data_type || '').toLowerCase();
          if (dtype.includes('numeric') || dtype.includes('integer') || dtype.includes('decimal') || dtype.includes('float')) {
            const num = typeof excelValue === 'string' ? parseFloat(excelValue.replace(/[,\s]/g, '')) : Number(excelValue);
            transformedRow[targetColumn] = isNaN(num) ? null : num;
          } else if (dtype.includes('timestamp') || dtype.includes('date')) {
            // Convert Excel serial date numbers to proper ISO timestamps
            transformedRow[targetColumn] = convertExcelDate(excelValue);
          } else {
            transformedRow[targetColumn] = typeof excelValue === 'string' ? excelValue : String(excelValue);
          }
        }
      });
      
      // Process JSON columns - split them into separate columns using the mapped column names
      jsonMappings.forEach((jsonMapping) => {
        const excelValue = row[jsonMapping.excel_column];
        if (excelValue && typeof excelValue === 'string') {
          try {
            const trimmed = excelValue.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              const parsed = JSON.parse(trimmed);
              
              // Extract each specified key into its own column using the mapped column name
              if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                jsonMapping.json_split_keys.forEach((key: string) => {
                  // Use the mapped column name, or generate one from the key
                  const targetColName = (jsonMapping.keyToColumnMap[key] || key)
                    .toLowerCase()
                    .trim();
                  
                  if (parsed[key] !== undefined && targetColName) {
                    // Store the value as string (or original type if needed)
                    const value = parsed[key];
                    transformedRow[targetColName] = typeof value === 'object' ? JSON.stringify(value) : String(value);
                  }
                });
              }
            }
          } catch (e) {
            // Not valid JSON, skip
            console.warn(`Failed to parse JSON from column ${jsonMapping.excel_column}:`, e);
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

    // For purpletransaction table, ensure brands and products exist BEFORE inserting transactions
    // Only if the respective check flags are enabled
    let productsUpserted = 0;
    let brandsUpserted = 0;
    
    if (tableName === 'purpletransaction' && (checkBrand || checkProduct)) {
      console.log('Pre-processing: Creating/updating brands and products before transaction insertion...');
      
      // Step 1: Extract and create brands FIRST (only if checkBrand is true)
      if (checkBrand) {
        console.log('Step 1: Processing brands...');
        const brandsToUpsert = validData
          .filter((row: any) => row.brand_name && row.brand_name.trim())
          .map((row: any) => ({
            brand_name: row.brand_name.trim(),
            brand_code: row.brand_code || null,
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
            .select('brand_name, brand_code')
            .in('brand_name', brandNames);

          const existingBrandMap = new Map(
            (existingBrands || []).map(b => [b.brand_name, b])
          );
          
          // Separate new brands from existing ones that need updates
          const newBrands = brandsToUpsert.filter(b => !existingBrandMap.has(b.brand_name));
          
          // If there are new brands and no brand type selections provided, return them for user selection
          if (newBrands.length > 0 && !brandTypeSelections) {
            console.log(`Found ${newBrands.length} new brands, requiring brand type selection`);
            return new Response(
              JSON.stringify({ 
                requiresBrandTypeSelection: true,
                newBrands: newBrands.map(b => ({ brand_name: b.brand_name }))
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // If brand type selections are provided, generate brand codes
          if (brandTypeSelections && Array.isArray(brandTypeSelections)) {
            console.log('Processing brand type selections and generating brand codes...');
            
            // Fetch brand types
            const brandTypeIds = [...new Set(brandTypeSelections.map(s => s.brand_type_id))];
            const { data: brandTypesData } = await supabase
              .from('brand_type')
              .select('id, type_code')
              .in('id', brandTypeIds);
            
            const brandTypeMap = new Map(
              (brandTypesData || []).map(bt => [bt.id, bt])
            );
            
            // Generate brand codes for new brands
            for (const newBrand of newBrands) {
              const selection = brandTypeSelections.find(s => s.brand_name === newBrand.brand_name);
              if (selection) {
                const brandType = brandTypeMap.get(selection.brand_type_id);
                if (brandType) {
                  // Count existing brands with this type_code
                  const { count } = await supabase
                    .from('brands')
                    .select('*', { count: 'exact', head: true })
                    .ilike('brand_code', `${brandType.type_code}%`);
                  
                  const nextNumber = (count || 0) + 1;
                  newBrand.brand_code = `${brandType.type_code}-${String(nextNumber).padStart(3, '0')}`;
                  
                  // Also update the brand_type_id
                  (newBrand as any).brand_type_id = selection.brand_type_id;
                  
                  console.log(`Generated brand_code: ${newBrand.brand_code} for ${newBrand.brand_name}`);
                }
              }
            }
          }
          
          const brandsToUpdate = brandsToUpsert.filter(b => {
            const existing = existingBrandMap.get(b.brand_name);
            // Update if brand exists but brand_code is missing and we have one
            return existing && !existing.brand_code && b.brand_code;
          });

          // Insert new brands
          if (newBrands.length > 0) {
            const { error: brandError } = await supabase
              .from('brands')
              .insert(newBrands);

            if (brandError) {
              console.error('Brand insert error:', brandError);
            } else {
              brandsUpserted = newBrands.length;
              console.log(`Successfully inserted ${newBrands.length} new brands with generated brand codes`);
            }
          }
          
          // Update existing brands with missing brand_codes
          if (brandsToUpdate.length > 0) {
            for (const brand of brandsToUpdate) {
              const { error: updateError } = await supabase
                .from('brands')
                .update({ brand_code: brand.brand_code })
                .eq('brand_name', brand.brand_name);
              
              if (updateError) {
                console.error(`Error updating brand_code for ${brand.brand_name}:`, updateError);
              }
            }
            console.log(`Updated ${brandsToUpdate.length} existing brands with brand_codes`);
          }
        }

        // Step 2: Now look up and fill in missing brand_codes in transaction data
        console.log('Step 2: Filling in missing brand_codes in transaction data...');
        
        const missingBrandCodes = validData
          .filter((row: any) => row.brand_name && !row.brand_code)
          .map((row: any) => row.brand_name);
        
        if (missingBrandCodes.length > 0) {
          const uniqueBrandNames = [...new Set(missingBrandCodes)];
          console.log(`Found ${missingBrandCodes.length} transactions with missing brand_code for ${uniqueBrandNames.length} brands`);
          
          // Lookup brand_codes from brands table (after we just created/updated them)
          const { data: brandData, error: brandLookupError } = await supabase
            .from('brands')
            .select('brand_name, brand_code')
            .in('brand_name', uniqueBrandNames);
          
          if (brandLookupError) {
            console.error('Error looking up brand codes:', brandLookupError);
          } else if (brandData && brandData.length > 0) {
            // Create a map of brand_name -> brand_code
            const brandCodeMap = new Map(
              brandData.map(b => [b.brand_name, b.brand_code])
            );
            
            // Update validData with the brand_codes
            let updatedCount = 0;
            for (const record of validData) {
              if (record.brand_name && !record.brand_code) {
                const foundCode = brandCodeMap.get(record.brand_name);
                if (foundCode) {
                  record.brand_code = foundCode;
                  updatedCount++;
                }
              }
            }
            console.log(`Filled in ${updatedCount} missing brand_codes from brands table`);
          }
        }
      } else {
        console.log('Step 1 & 2: Skipping brand processing (checkBrand=false)');
      }

      // Step 3: Extract and create products (only if checkProduct is true)
      if (checkProduct) {
        console.log('Step 3: Processing products...');
        
        const productsToUpsert = validData
          .filter((row: any) => row.product_name)
          .map((row: any) => ({
            product_id: row.product_id || null,
            product_name: row.product_name,
            product_price: row.unit_price || null,
            product_cost: row.cost_price || null,
            brand_name: row.brand_name || null,
            brand_code: row.brand_code || null,
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
      } else {
        console.log('Step 3: Skipping product processing (checkProduct=false)');
      }
      
      console.log('Pre-processing complete.');
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


    // After successful insert, handle ordertotals if this is the transaction table
    if (tableName === 'purpletransaction') {
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
