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
    const { 
      sheetId, 
      data, 
      brandTypeSelections, 
      checkBrand = true, 
      checkProduct = true,
      checkDuplicates = false, // New: check for duplicates before inserting
      duplicateAction = 'update' // New: 'update' | 'skip' - what to do with duplicates
    } = await req.json();

    if (!sheetId || !data || !Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: 'Missing sheetId or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${data.length} rows for sheet ${sheetId}, checkBrand=${checkBrand}, checkProduct=${checkProduct}, checkDuplicates=${checkDuplicates}, duplicateAction=${duplicateAction}`);

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

    // Get the column mappings (including JSON config and PK flag)
    const { data: mappings, error: mappingsError } = await supabase
      .from('excel_column_mappings')
      .select('excel_column, table_column, data_type, is_json_column, json_split_keys, is_pk')
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

    // Find PK columns for upsert
    const pkColumns = mappings
      .filter((m) => m.is_pk && !m.is_json_column)
      .map((m) => (m.table_column || '').toLowerCase().trim())
      .filter((col) => col.length > 0);
    
    console.log(`PK columns for upsert: ${pkColumns.length > 0 ? pkColumns.join(', ') : 'none (insert mode)'}`);

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
        is_pk: m.is_pk || false,
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

    // Insert or upsert data with retry logic that removes unknown columns if necessary
    let rowsToInsert = validData;
    const useUpsert = pkColumns.length > 0;
    
    // Deduplicate rows by PK columns to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    if (useUpsert && pkColumns.length > 0) {
      const pkKey = (row: any) => pkColumns.map(col => row[col] ?? '').join('|');
      const uniqueRowsMap = new Map<string, any>();
      
      // Iterate through rows - later occurrences will overwrite earlier ones
      for (const row of rowsToInsert) {
        const key = pkKey(row);
        if (key && key !== pkColumns.map(() => '').join('|')) { // Skip rows with empty PK values
          uniqueRowsMap.set(key, row);
        }
      }
      
      const originalCount = rowsToInsert.length;
      rowsToInsert = Array.from(uniqueRowsMap.values());
      
      if (originalCount !== rowsToInsert.length) {
        console.log(`Deduplicated ${originalCount} rows to ${rowsToInsert.length} unique rows by PK columns: ${pkColumns.join(', ')}`);
      }
    }
    
    // Helper function to check for existing records using direct fetch
    const checkExistingRecords = async (
      tbl: string, 
      pkCols: string[], 
      values: Array<Record<string, any>>
    ): Promise<Set<string>> => {
      const existingSet = new Set<string>();
      const pkKeyFn = (row: any) => pkCols.map(c => row[c] ?? '').join('|');
      
      if (pkCols.length === 1 && values.length > 0) {
        const pkCol = pkCols[0];
        const uniqueVals = [...new Set(values.map(v => v[pkCol]).filter(v => v != null))];
        
        // Check in batches using POST to REST API
        const batchSize = 500;
        for (let i = 0; i < uniqueVals.length; i += batchSize) {
          const batch = uniqueVals.slice(i, i + batchSize);
          const inClause = batch.map(v => typeof v === 'string' ? `"${v}"` : v).join(',');
          
          try {
            const response = await fetch(
              `${supabaseUrl}/rest/v1/${tbl}?select=${pkCol}&${pkCol}=in.(${encodeURIComponent(inClause)})`,
              {
                headers: {
                  'apikey': supabaseServiceKey,
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
              }
            );
            
            if (response.ok) {
              const existing = await response.json();
              existing.forEach((row: any) => existingSet.add(String(row[pkCol])));
            }
          } catch (e) {
            console.error('Error checking existing records:', e);
          }
        }
      } else if (pkCols.length > 1) {
        // For composite keys, sample check
        const sampleSize = Math.min(100, values.length);
        for (let i = 0; i < sampleSize; i++) {
          const item = values[i];
          const filters = pkCols.map(c => `${c}=eq.${encodeURIComponent(item[c])}`).join('&');
          
          try {
            const response = await fetch(
              `${supabaseUrl}/rest/v1/${tbl}?select=${pkCols.join(',')}&${filters}&limit=1`,
              {
                headers: {
                  'apikey': supabaseServiceKey,
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
              }
            );
            
            if (response.ok) {
              const existing = await response.json();
              if (existing && existing.length > 0) {
                existingSet.add(pkKeyFn(item));
              }
            }
          } catch (e) {
            console.error('Error checking composite key:', e);
          }
        }
      }
      
      return existingSet;
    };
    
    const pkKeyFn = (row: any) => pkColumns.map(col => row[col] ?? '').join('|');
    
    // Check for duplicates in database if checkDuplicates is enabled
    if (checkDuplicates && useUpsert && pkColumns.length > 0) {
      console.log('Checking for duplicate records in database...');
      
      const pkValuesFromData = rowsToInsert.map(row => 
        pkColumns.reduce((acc, col) => {
          acc[col] = row[col];
          return acc;
        }, {} as Record<string, any>)
      ).filter(item => pkKeyFn(item) !== pkColumns.map(() => '').join('|'));
      
      const existingKeys = await checkExistingRecords(tableName, pkColumns, pkValuesFromData);
      const duplicateCount = existingKeys.size;
      
      if (duplicateCount > 0) {
        console.log(`Found ${duplicateCount} duplicate records`);
        
        const duplicateInfo = Array.from(existingKeys).slice(0, 100).map(key => ({
          key,
          existingCount: 1,
          newCount: 1
        }));
        
        return new Response(
          JSON.stringify({
            requiresDuplicateDecision: true,
            totalRecords: rowsToInsert.length,
            duplicateCount,
            newRecordCount: rowsToInsert.length - duplicateCount,
            duplicates: duplicateInfo
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('No duplicates found, proceeding with insert');
    }
    
    // Handle duplicate action - if user chose to skip duplicates
    if (duplicateAction === 'skip' && useUpsert && pkColumns.length > 0) {
      console.log('User chose to skip duplicates - checking which records to insert...');
      
      const pkValuesFromData = rowsToInsert.map(row => ({
        row,
        pkValues: pkColumns.reduce((acc, col) => {
          acc[col] = row[col];
          return acc;
        }, {} as Record<string, any>)
      })).filter(item => pkKeyFn(item.pkValues) !== pkColumns.map(() => '').join('|'));
      
      const existingKeys = await checkExistingRecords(
        tableName, 
        pkColumns, 
        pkValuesFromData.map(i => i.pkValues)
      );
      
      // Filter out existing records
      const originalCount = rowsToInsert.length;
      rowsToInsert = pkValuesFromData
        .filter(item => {
          const key = pkColumns.length === 1 
            ? String(item.pkValues[pkColumns[0]]) 
            : pkKeyFn(item.pkValues);
          return !existingKeys.has(key);
        })
        .map(item => item.row);
      
      console.log(`Filtered ${originalCount} rows to ${rowsToInsert.length} new rows (skipped ${existingKeys.size} duplicates)`);
      
      if (rowsToInsert.length === 0) {
        console.log('All records are duplicates, nothing to insert');
        return new Response(
          JSON.stringify({
            count: 0,
            totalValue: 0,
            productsUpserted: productsUpserted,
            brandsUpserted: brandsUpserted,
            skippedDuplicates: existingKeys.size,
            message: 'All records already exist in database'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`${useUpsert ? 'Upserting' : 'Inserting'} ${rowsToInsert.length} rows into ${tableName}${useUpsert ? ` with conflict on: ${pkColumns.join(', ')}` : ''}`);
    
    // Track if we need to fallback to manual upsert
    let useManualUpsert = false;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      let insertError;
      
      if (useUpsert && !useManualUpsert) {
        // Try upsert with onConflict for PK columns
        const { error } = await supabase
          .from(tableName)
          .upsert(rowsToInsert, {
            onConflict: pkColumns.join(','),
            ignoreDuplicates: false
          });
        insertError = error;
        
        // Check if error is due to missing unique constraint
        const message = (insertError as any)?.message || '';
        if (message.includes('no unique or exclusion constraint matching')) {
          console.warn('No unique constraint found, falling back to manual upsert...');
          useManualUpsert = true;
          // Don't count this as an attempt, retry with manual approach
          attempt--;
          continue;
        }
      } else if (useUpsert && useManualUpsert) {
        // Manual upsert: check each record and update or insert using REST API
        console.log('Using manual upsert approach for records without unique constraint...');
        let successCount = 0;
        let updateCount = 0;
        let insertCount = 0;
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        for (const row of rowsToInsert) {
          // Build filter string for checking existence
          const filterParts: string[] = [];
          for (const col of pkColumns) {
            if (row[col] !== undefined && row[col] !== null) {
              filterParts.push(`${col}=eq.${encodeURIComponent(String(row[col]))}`);
            }
          }
          
          if (filterParts.length === 0) {
            // No PK values, just insert
            const { error: insertErr } = await supabase.from(tableName).insert(row);
            if (!insertErr) {
              insertCount++;
              successCount++;
            }
            continue;
          }
          
          // Check if record exists using REST API
          const checkUrl = `${supabaseUrl}/rest/v1/${tableName}?${filterParts.join('&')}&select=*&limit=1`;
          const checkResponse = await fetch(checkUrl, {
            method: 'GET',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'count=exact'
            }
          });
          
          const countHeader = checkResponse.headers.get('content-range');
          const existingCount = countHeader ? parseInt(countHeader.split('/')[1] || '0') : 0;
          
          if (existingCount > 0) {
            // Record exists - update it using REST API
            const updateUrl = `${supabaseUrl}/rest/v1/${tableName}?${filterParts.join('&')}`;
            const updateResponse = await fetch(updateUrl, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify(row)
            });
            
            if (updateResponse.ok) {
              updateCount++;
              successCount++;
            } else {
              const errText = await updateResponse.text();
              console.error('Update error:', errText);
            }
          } else {
            // Record doesn't exist - insert it
            const { error: insertErr } = await supabase.from(tableName).insert(row);
            if (!insertErr) {
              insertCount++;
              successCount++;
            } else {
              console.error('Insert error:', insertErr);
            }
          }
        }
        
        console.log(`Manual upsert completed: ${updateCount} updated, ${insertCount} inserted, ${successCount} total successful`);
        insertError = null; // Clear error since we handled it manually
      } else {
        // Regular insert
        const { error } = await supabase
          .from(tableName)
          .insert(rowsToInsert);
        insertError = error;
      }

      if (!insertError) {
        console.log(`Successfully ${useUpsert ? (useManualUpsert ? 'manually upserted' : 'upserted') : 'inserted'} ${rowsToInsert.length} rows on attempt ${attempt + 1}`);
        break;
      }

      console.error(`${useUpsert ? 'Upsert' : 'Insert'} error:`, insertError);

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
        JSON.stringify({ error: `Failed to ${useUpsert ? 'upsert' : 'insert'} data: ${message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // After successful insert, update bank_ledger with hyberpaystatement data if this is the hyberpaystatement table
    // Linking: bank_ledger.reference_number (order_number) -> order_payment.ordernumber -> order_payment.paymentrefrence -> hyberpaystatement.transactionid
    if (tableName === 'hyberpaystatement') {
      console.log('Matching hyberpaystatement with bank_ledger entries via order_payment bridge...');
      
      // Get all transactionid values from the inserted data (transactionid links to order_payment.paymentrefrence)
      const hyperpayRecords = validData
        .filter((row: any) => row.transactionid)
        .map((row: any) => ({
          transactionid: row.transactionid,
          transaction_receipt: row.transaction_receipt || null,
          result: row.result || null,
          customercountry: row.customercountry || null,
          riskfrauddescription: row.riskfrauddescription || null,
          clearinginstitutename: row.clearinginstitutename || null
        }));
      
      if (hyperpayRecords.length > 0) {
        console.log(`Found ${hyperpayRecords.length} hyberpay records with transactionid`);
        
        // Create a map of transactionid -> hyperpay data for quick lookup
        const transactionIdToHyperpay = new Map(
          hyperpayRecords.map(r => [r.transactionid, r])
        );
        const transactionIds = Array.from(transactionIdToHyperpay.keys());
        
        // Step 1: Find order_payment records where paymentrefrence matches transactionid
        // Process in batches to handle large datasets
        const batchSize = 500;
        let totalUpdated = 0;
        
        for (let i = 0; i < transactionIds.length; i += batchSize) {
          const batchTransactionIds = transactionIds.slice(i, i + batchSize);
          
          // Get order_payment records for this batch
          const { data: orderPayments, error: opError } = await supabase
            .from('order_payment')
            .select('ordernumber, paymentrefrence')
            .in('paymentrefrence', batchTransactionIds);
          
          if (opError) {
            console.error('Error fetching order_payment:', opError);
            continue;
          }
          
          if (!orderPayments || orderPayments.length === 0) {
            console.log(`No order_payment records found for batch ${Math.floor(i / batchSize) + 1}`);
            continue;
          }
          
          console.log(`Found ${orderPayments.length} order_payment records for batch ${Math.floor(i / batchSize) + 1}`);
          
          // Step 2: Create mapping: ordernumber -> hyperpay data
          const orderToHyperpay = new Map<string, any>();
          for (const op of orderPayments) {
            const hyperpayData = transactionIdToHyperpay.get(op.paymentrefrence);
            if (hyperpayData && op.ordernumber) {
              orderToHyperpay.set(op.ordernumber, hyperpayData);
            }
          }
          
          // Step 3: Update bank_ledger entries by reference_number (which is order_number)
          for (const [orderNumber, record] of orderToHyperpay) {
            // Get the paymentrefrence (transactionid from order_payment)
            const orderPayment = orderPayments.find(op => op.ordernumber === orderNumber);
            const paymentRefrence = orderPayment?.paymentrefrence || null;
            
            const { error: updateError, count } = await supabase
              .from('bank_ledger')
              .update({
                transactionid: record.transactionid,
                transaction_receipt: record.transaction_receipt,
                result: record.result,
                customercountry: record.customercountry,
                riskfrauddescription: record.riskfrauddescription,
                clearinginstitutename: record.clearinginstitutename,
                paymentrefrence: paymentRefrence
              })
              .eq('reference_number', orderNumber);
            
            if (updateError) {
              console.error(`Error updating bank_ledger for order ${orderNumber}:`, updateError);
            } else {
              totalUpdated++;
            }
          }
          
          console.log(`Batch ${Math.floor(i / batchSize) + 1} complete, updated ${totalUpdated} bank_ledger entries so far`);
        }
        
        console.log(`Finished matching: updated ${totalUpdated} bank_ledger entries with hyberpay data via order_payment bridge`);
      }
    }

    // After successful insert, update bank_ledger with riyadbankstatement data if this is the riyadbankstatement table
    // Linking: bank_ledger.reference_number (order_number) -> order_payment.ordernumber -> order_payment.paymentrefrence -> riyadbankstatement.acquirer_private_data
    if (tableName === 'riyadbankstatement') {
      console.log('Matching riyadbankstatement with bank_ledger entries via order_payment bridge...');
      
      // Get all acquirer_private_data values from the inserted data (acquirer_private_data links to order_payment.paymentrefrence)
      const riyadRecords = validData
        .filter((row: any) => row.acquirer_private_data && row.txn_number)
        .map((row: any) => ({
          acquirer_private_data: row.acquirer_private_data,
          txn_number: row.txn_number
        }));
      
      if (riyadRecords.length > 0) {
        console.log(`Found ${riyadRecords.length} riyad records with acquirer_private_data`);
        
        // Create a map of acquirer_private_data -> txn_number for quick lookup
        const acquirerToTxn = new Map(
          riyadRecords.map((r: any) => [r.acquirer_private_data, r.txn_number])
        );
        const acquirerIds = Array.from(acquirerToTxn.keys());
        
        // Process in batches to handle large datasets
        const batchSize = 500;
        let totalUpdated = 0;
        
        for (let i = 0; i < acquirerIds.length; i += batchSize) {
          const batchAcquirerIds = acquirerIds.slice(i, i + batchSize);
          
          // Get order_payment records where paymentrefrence matches acquirer_private_data
          const { data: orderPayments, error: opError } = await supabase
            .from('order_payment')
            .select('ordernumber, paymentrefrence')
            .in('paymentrefrence', batchAcquirerIds);
          
          if (opError) {
            console.error('Error fetching order_payment for riyad:', opError);
            continue;
          }
          
          if (!orderPayments || orderPayments.length === 0) {
            console.log(`No order_payment records found for riyad batch ${Math.floor(i / batchSize) + 1}`);
            continue;
          }
          
          console.log(`Found ${orderPayments.length} order_payment records for riyad batch ${Math.floor(i / batchSize) + 1}`);
          
          // Update bank_ledger entries by reference_number (which is order_number)
          for (const op of orderPayments) {
            const txnNumber = acquirerToTxn.get(op.paymentrefrence);
            if (txnNumber && op.ordernumber) {
              const { error: updateError } = await supabase
                .from('bank_ledger')
                .update({ transaction_receipt: txnNumber })
                .eq('reference_number', op.ordernumber);
              
              if (updateError) {
                console.error(`Error updating bank_ledger for order ${op.ordernumber}:`, updateError);
              } else {
                totalUpdated++;
              }
            }
          }
          
          console.log(`Riyad batch ${Math.floor(i / batchSize) + 1} complete, updated ${totalUpdated} bank_ledger entries so far`);
        }
        
        console.log(`Finished matching: updated ${totalUpdated} bank_ledger entries with riyad bank transaction_receipt`);
      }
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

      // Fetch payment methods for bank fee calculation (including bank_id)
      const { data: paymentMethods, error: pmError } = await supabase
        .from('payment_methods')
        .select('payment_method, gateway_fee, fixed_value, vat_fee, bank_id')
        .eq('is_active', true);

      if (pmError) {
        console.error('Error fetching payment methods:', pmError);
      }

      // Calculate bank fees for each order
      const orderTotalsToUpsert = Array.from(orderTotalsMap.values()).map((order: any) => {
        let bankFee = 0;
        let bankId = null;
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
            bankId = paymentMethod.bank_id;
          }
        }
        
        return {
          ...order,
          bank_fee: bankFee,
          _bank_id: bankId // temporary field for bank ledger processing
        };
      });

      console.log(`Upserting ${orderTotalsToUpsert.length} order totals...`);

      // Upsert order totals (without _bank_id)
      if (orderTotalsToUpsert.length > 0) {
        const orderTotalsClean = orderTotalsToUpsert.map(({ _bank_id, ...rest }) => rest);
        const { error: orderTotalsError } = await supabase
          .from('ordertotals')
          .upsert(orderTotalsClean, {
            onConflict: 'order_number',
            ignoreDuplicates: false
          });

        if (orderTotalsError) {
          console.error('Error upserting order totals:', orderTotalsError);
        } else {
          console.log(`Successfully upserted ${orderTotalsToUpsert.length} order totals`);
        }
      }

      // Post to bank_ledger for orders that have a bank_id
      console.log('Processing bank ledger entries...');
      const bankLedgerEntries: any[] = [];
      
      // Get current bank balances for all relevant banks
      const bankIds = [...new Set(orderTotalsToUpsert.map(o => o._bank_id).filter(id => id))];
      
      if (bankIds.length > 0) {
        // Fetch current bank balances
        const { data: banks, error: banksError } = await supabase
          .from('banks')
          .select('id, current_balance')
          .in('id', bankIds);
        
        if (banksError) {
          console.error('Error fetching bank balances:', banksError);
        }
        
        const bankBalanceMap = new Map(
          (banks || []).map(b => [b.id, Number(b.current_balance) || 0])
        );
        
        // Process each order and create ledger entries
        for (const order of orderTotalsToUpsert) {
          if (!order._bank_id) continue;
          
          const orderTotal = Number(order.total) || 0;
          const bankFee = Number(order.bank_fee) || 0;
          const currentBalance = bankBalanceMap.get(order._bank_id) || 0;
          
          // Sales In entry (In)
          const balanceAfterSalesIn = currentBalance + orderTotal;
          bankLedgerEntries.push({
            bank_id: order._bank_id,
            entry_date: order.order_date || new Date().toISOString(),
            reference_type: 'sales_in',
            reference_number: order.order_number,
            description: `Sales In - ${order.order_number}`,
            in_amount: orderTotal,
            out_amount: 0,
            balance_after: balanceAfterSalesIn
          });
          
          // Bank Fee entry (Out) - only if there's a fee
          if (bankFee > 0) {
            const balanceAfterFee = balanceAfterSalesIn - bankFee;
            bankLedgerEntries.push({
              bank_id: order._bank_id,
              entry_date: order.order_date || new Date().toISOString(),
              reference_type: 'bank_fee',
              reference_number: order.order_number,
              description: `Bank Fee - ${order.payment_brand || order.payment_method}`,
              in_amount: 0,
              out_amount: bankFee,
              balance_after: balanceAfterFee
            });
            
            // Update the tracked balance for subsequent entries
            bankBalanceMap.set(order._bank_id, balanceAfterFee);
          } else {
            bankBalanceMap.set(order._bank_id, balanceAfterSalesIn);
          }
        }
        
        // Insert bank ledger entries in batches
        if (bankLedgerEntries.length > 0) {
          console.log(`Inserting ${bankLedgerEntries.length} bank ledger entries...`);
          
          // Process in batches of 500
          const batchSize = 500;
          for (let i = 0; i < bankLedgerEntries.length; i += batchSize) {
            const batch = bankLedgerEntries.slice(i, i + batchSize);
            const { error: ledgerError } = await supabase
              .from('bank_ledger')
              .insert(batch);
            
            if (ledgerError) {
              console.error(`Error inserting bank ledger batch ${i / batchSize + 1}:`, ledgerError);
            }
          }
          
          console.log(`Successfully inserted ${bankLedgerEntries.length} bank ledger entries`);
          
          // Update bank current_balance with final balances
          for (const [bankId, finalBalance] of bankBalanceMap.entries()) {
            const { error: updateError } = await supabase
              .from('banks')
              .update({ current_balance: finalBalance })
              .eq('id', bankId);
            
            if (updateError) {
              console.error(`Error updating bank balance for ${bankId}:`, updateError);
            }
          }
          
          console.log('Bank balances updated successfully');
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
