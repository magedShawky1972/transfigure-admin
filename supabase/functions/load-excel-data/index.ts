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
      .select('target_table, sheet_name')
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
      .select('excel_column, table_column, data_type, is_json_column, json_split_keys, is_pk, source_type, fixed_value')
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
    let pkColumns = mappings
      .filter((m) => m.is_pk && !m.is_json_column)
      .map((m) => (m.table_column || '').toLowerCase().trim())
      .filter((col) => col.length > 0);
    
    // Force upsert on order_number + product_id for purpletransaction table
    if (tableName === 'purpletransaction' && pkColumns.length === 0) {
      pkColumns = ['order_number', 'product_id'];
      console.log('Auto-detected PK columns for purpletransaction: order_number, product_id');
    }
    
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
        source_type: m.source_type || 'excel',
        fixed_value: m.fixed_value || null,
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
    // Note: Excel headers often have different casing/spaces vs stored mapping keys.
    // We support fuzzy header matching by normalizing both sides.
    const normalizeHeaderKey = (v: any) =>
      String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    const transformedData = data.map((row: any) => {
      const transformedRow: any = {};

      const rowKeyByNorm: Record<string, string> = {};
      Object.keys(row || {}).forEach((k) => {
        rowKeyByNorm[normalizeHeaderKey(k)] = k;
      });

      const getExcelValue = (excelColumn: string) => {
        // Exact key first
        if (row && Object.prototype.hasOwnProperty.call(row, excelColumn)) return row[excelColumn];
        // Fuzzy match (case/space/punct-insensitive)
        const fuzzyKey = rowKeyByNorm[normalizeHeaderKey(excelColumn)];
        return fuzzyKey ? row[fuzzyKey] : undefined;
      };

      validMappings.forEach((mapping) => {
        const targetColumn = (mapping.table_column || '').toLowerCase().trim();
        if (!targetColumn) return;

        // Skip JSON columns that have split keys - they'll be handled separately
        if (mapping.is_json_column && mapping.json_split_keys && mapping.json_split_keys.length > 0) {
          return;
        }

        // Handle fixed value source type
        if (mapping.source_type === 'fixed') {
          if (mapping.fixed_value !== null && mapping.fixed_value !== undefined) {
            transformedRow[targetColumn] = mapping.fixed_value;
          }
          return;
        }

        // Handle formula source type
        if (mapping.source_type === 'formula' && mapping.fixed_value) {
          try {
            // Replace {column_name} placeholders with actual values from the row
            let formulaStr = mapping.fixed_value;
            const placeholders = formulaStr.match(/\{([^}]+)\}/g) || [];
            let hasAllValues = true;
            
            placeholders.forEach((placeholder: string) => {
              const colName = placeholder.slice(1, -1); // Remove { and }
              const val = getExcelValue(colName);
              if (val === undefined || val === null || val === '') {
                hasAllValues = false;
              } else {
                const numVal = typeof val === 'string' ? parseFloat(val.replace(/[,\s]/g, '')) : Number(val);
                formulaStr = formulaStr.replace(placeholder, isNaN(numVal) ? '0' : String(numVal));
              }
            });

            if (hasAllValues) {
              // Safely evaluate simple math expressions (+, -, *, /)
              // Only allow numbers, operators, parentheses, spaces, and dots
              const sanitized = formulaStr.replace(/[^0-9+\-*/().e\s]/gi, '');
              if (sanitized.length > 0) {
                const result = Function('"use strict"; return (' + sanitized + ')')();
                if (typeof result === 'number' && isFinite(result)) {
                  transformedRow[targetColumn] = result;
                }
              }
            }
          } catch (e) {
            console.warn(`Formula evaluation failed for ${mapping.excel_column}: ${e}`);
          }
          return;
        }

        // Default: excel source type
        const excelValue = getExcelValue(mapping.excel_column);

        if (excelValue !== undefined && excelValue !== null && excelValue !== '') {
          // If the destination column is a timestamp/date-like column, ensure Excel serial numbers are converted
          const targetLooksDateTime =
            targetColumn.includes('timestamp') ||
            targetColumn.endsWith('_date') ||
            targetColumn.endsWith('date') ||
            targetColumn === 'created_at' ||
            targetColumn === 'updated_at' ||
            targetColumn.endsWith('_at');
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
    let validData = transformedData.filter((row: any) => 
      Object.keys(row).length > 0
    );

    // Calculate bank_fee for purpletransaction records
    if (tableName === 'purpletransaction') {
      console.log('Calculating bank_fee for transactions...');

      for (const record of validData) {
        record.source = 'EXCEL';
      }
      
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

      // Auto-generate order numbers for rows with empty order_number (M-sequence)
      const rowsNeedingOrderNumber = validData.filter((r: any) => !r.order_number || String(r.order_number).trim() === '');
      if (rowsNeedingOrderNumber.length > 0) {
        console.log(`Generating M-sequence order numbers for ${rowsNeedingOrderNumber.length} rows...`);
        // Find the max existing M-sequence number
        const { data: maxOrder } = await supabase
          .from('purpletransaction')
          .select('order_number')
          .like('order_number', 'M%')
          .order('order_number', { ascending: false })
          .limit(1);

        let lastSeq = 0;
        if (maxOrder && maxOrder.length > 0) {
          const match = String(maxOrder[0].order_number).match(/^M(\d+)$/);
          if (match) lastSeq = parseInt(match[1], 10);
        }

        for (const record of rowsNeedingOrderNumber) {
          lastSeq++;
          record.order_number = 'M' + String(lastSeq).padStart(6, '0');
        }
        console.log(`Generated order numbers M${String(lastSeq - rowsNeedingOrderNumber.length + 1).padStart(6, '0')} to M${String(lastSeq).padStart(6, '0')}`);
      }

      // For AsusTransaction sheet, prepend "A" to all order numbers to differentiate from Purple orders
      const currentSheetName = sheetConfig.sheet_name || '';
      if (currentSheetName.toLowerCase().includes('asus')) {
        console.log('AsusTransaction detected: Prepending "A" to all order numbers...');
        for (const record of validData) {
          if (record.order_number && !String(record.order_number).startsWith('A')) {
            record.order_number = 'A' + String(record.order_number);
          }
        }
        console.log(`Prefixed ${validData.length} order numbers with "A"`);

        // Map Asus brand names to system brand names using asus_brand_name field
        console.log('AsusTransaction: Mapping brand names to system brands...');
        const { data: brandMappings } = await supabase
          .from('brands')
          .select('brand_name, asus_brand_name, brand_code')
          .not('asus_brand_name', 'is', null)
          .neq('asus_brand_name', '');

        if (brandMappings && brandMappings.length > 0) {
          // Build a case-insensitive lookup map: asus_brand_name -> { brand_name, brand_code }
          const asusBrandMap = new Map<string, { brand_name: string; brand_code: string | null }>();
          for (const bm of brandMappings) {
            asusBrandMap.set((bm.asus_brand_name as string).toLowerCase().trim(), {
              brand_name: bm.brand_name,
              brand_code: bm.brand_code,
            });
          }

          let mappedCount = 0;
          for (const record of validData) {
            if (record.brand_name) {
              const mapped = asusBrandMap.get(String(record.brand_name).toLowerCase().trim());
              if (mapped) {
                record.brand_name = mapped.brand_name;
                if (mapped.brand_code) {
                  record.brand_code = mapped.brand_code;
                }
                mappedCount++;
              }
            }
          }
          console.log(`Mapped ${mappedCount} records from Asus brand names to system brand names`);
        }
      }

      // Auto-assign line_no for orders with multiple lines
      console.log('Assigning line_no for multi-line orders...');
      const orderLineCountMap = new Map<string, number>();
      for (const record of validData) {
        // Preserve preassigned line numbers from client when present
        const rawOrderNum = record.order_number || record.ordernumber;
        const existingLineNo = Number(record.line_no);

        if (rawOrderNum) {
          const orderNum = String(rawOrderNum).trim();
          record.ordernumber = orderNum;
          if (record.order_number) {
            record.order_number = orderNum;
          }

          if (Number.isFinite(existingLineNo) && existingLineNo > 0) {
            record.line_no = existingLineNo;
            orderLineCountMap.set(orderNum, Math.max(orderLineCountMap.get(orderNum) || 0, existingLineNo));
            continue;
          }

          const currentLine = (orderLineCountMap.get(orderNum) || 0) + 1;
          orderLineCountMap.set(orderNum, currentLine);
          record.line_no = currentLine;
        } else {
          record.line_no = 1;
        }
      }
      const multiLineOrders = Array.from(orderLineCountMap.entries()).filter(([_, count]) => count > 1).length;
      console.log(`Assigned line_no: ${multiLineOrders} orders have multiple lines`);
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
            status: 'active',
            creation_source: (sheetConfig.sheet_name || '').toLowerCase().includes('asus') ? 'Asus Excel' : 'Purple Excel'
          }))
          .filter((brand: any, index: number, self: any[]) => 
            // Remove duplicates by brand_name
            index === self.findIndex((b: any) => b.brand_name === brand.brand_name)
          );

        if (brandsToUpsert.length > 0) {
          // Check which brands already exist - check both brand_name and asus_brand_name
          const brandNames = brandsToUpsert.map(b => b.brand_name);
          const { data: existingBrands } = await supabase
            .from('brands')
            .select('brand_name, brand_code, asus_brand_name')
            .in('brand_name', brandNames);

          // Also check by asus_brand_name for Asus uploads (case-insensitive)
          const { data: allBrandsWithAsusName } = await supabase
            .from('brands')
            .select('brand_name, brand_code, asus_brand_name')
            .not('asus_brand_name', 'is', null)
            .neq('asus_brand_name', '');

          const existingBrandMap = new Map(
            (existingBrands || []).map(b => [b.brand_name, b])
          );
          
          // Also add brands found by asus_brand_name (case-insensitive match)
          if (allBrandsWithAsusName) {
            const brandNamesLower = brandNames.map(n => n.toLowerCase().trim());
            for (const b of allBrandsWithAsusName) {
              if (b.asus_brand_name && brandNamesLower.includes((b.asus_brand_name as string).toLowerCase().trim())) {
                // Map the original asus name (from Excel) to this brand
                const matchedExcelName = brandNames.find(n => n.toLowerCase().trim() === (b.asus_brand_name as string).toLowerCase().trim());
                if (matchedExcelName) {
                  existingBrandMap.set(matchedExcelName, b);
                }
              }
            }
          }
          
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

    // For purpletransaction: upsert mode
    // Update ALL fields from Excel on existing records, insert new records for missing ones
    let fillGapsUpdated = 0;
    let fillGapsInserted = 0;
    let fillGapsSkipped = 0;

    if (tableName === 'purpletransaction') {
      console.log('Upsert mode: updating existing records and inserting missing ones...');
      
      // Collect all unique order numbers from the Excel data
      const excelOrderNumbers = [...new Set(
        validData
          .map((r: any) => r.ordernumber || r.order_number)
          .filter((o: any) => o && String(o).trim())
          .map((o: any) => String(o).trim())
      )];
      
      if (excelOrderNumbers.length > 0) {
        // Check which order+line combinations already exist in the database
        const existingOrderLineSet = new Set<string>();
        
        const batchSize = 500;
        for (let i = 0; i < excelOrderNumbers.length; i += batchSize) {
          const batch = excelOrderNumbers.slice(i, i + batchSize);
          
          const { data: existingRows, error: existErr } = await supabase
            .from('purpletransaction')
            .select('ordernumber, line_no')
            .in('ordernumber', batch);
          
          if (existErr) {
            console.error('Error checking existing orders:', existErr);
          } else if (existingRows) {
            for (const row of existingRows) {
              existingOrderLineSet.add(`${String(row.ordernumber)}|${row.line_no || 1}`);
            }
          }
        }
        
        console.log(`Found ${existingOrderLineSet.size} existing order+line records out of ${validData.length} Excel rows`);
        
        // Separate into records to update vs records to insert
        const recordsToUpdate: any[] = [];
        const recordsToInsert: any[] = [];
        
        for (const row of validData) {
          const orderNum = row.ordernumber || row.order_number;
          const lineNo = row.line_no || 1;
          if (!orderNum) {
            recordsToInsert.push(row);
            continue;
          }
          const key = `${String(orderNum).trim()}|${lineNo}`;
          if (existingOrderLineSet.has(key)) {
            recordsToUpdate.push(row);
          } else {
            recordsToInsert.push(row);
          }
        }
        
        console.log(`Records to update: ${recordsToUpdate.length}, Records to insert: ${recordsToInsert.length}`);
        
        // Update existing records with ALL fields from Excel
        if (recordsToUpdate.length > 0) {
          console.log(`Updating ${recordsToUpdate.length} existing records with Excel data...`);
          
          for (const row of recordsToUpdate) {
            const orderNum = row.ordernumber || row.order_number;
            const lineNo = row.line_no || 1;
            
            // Build update object from all non-PK fields that have values
            const updates: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
              // Skip PK fields and empty values
              if (key === 'ordernumber' || key === 'order_number' || key === 'line_no') continue;
              if (value !== undefined && value !== null && value !== '') {
                updates[key] = value;
              }
            }
            
            if (Object.keys(updates).length > 0) {
              const { error: updateErr } = await supabase
                .from('purpletransaction')
                .update(updates)
                .eq('ordernumber', String(orderNum).trim())
                .eq('line_no', lineNo);
              
              if (!updateErr) {
                fillGapsUpdated++;
              } else {
                console.error(`Error updating record ${orderNum}/${lineNo}:`, updateErr);
              }
            }
          }
          
          console.log(`Updated ${fillGapsUpdated} existing records with Excel data`);
        }
        
        // Set validData to only the new records for insertion
        fillGapsSkipped = recordsToUpdate.length;
        validData = recordsToInsert;
        
        // IMPORTANT: After the purpletransaction upsert pass, remaining records are genuinely NEW.
        // Force plain INSERT mode to avoid upsert conflicts when multiple lines share the same product_id.
        pkColumns = [];
        console.log(`Upsert summary: ${fillGapsUpdated} updated, ${validData.length} new records to insert (switching to plain INSERT mode)`);
        
        if (validData.length === 0) {
          console.log('No new records to insert - returning summary');
          
          const totalValue = transformedData.reduce((sum: number, row: any) => {
            const total = parseFloat((row.total || '0').toString().replace(/[,\s]/g, ''));
            return sum + (isNaN(total) ? 0 : total);
          }, 0);
          
          return new Response(
            JSON.stringify({
              success: true,
              count: 0,
              totalValue,
              productsUpserted,
              brandsUpserted,
              fillGapsSkipped,
              fillGapsUpdated,
              message: `Updated ${fillGapsUpdated} existing records. No new records to insert.`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    console.log(`Inserting ${validData.length} rows into ${tableName}`);

    // Insert or upsert data with retry logic that removes unknown columns if necessary
    let rowsToInsert = validData;
    const useUpsert = pkColumns.length > 0;
    
    // Deduplicate rows by PK columns to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    let inFileDuplicateCount = 0;
    const inFileDuplicateKeys: string[] = [];
    
    if (useUpsert && pkColumns.length > 0) {
      const pkKey = (row: any) => pkColumns.map(col => row[col] ?? '').join('|');
      const uniqueRowsMap = new Map<string, any>();
      const duplicateKeysSet = new Set<string>();
      
      // Iterate through rows - later occurrences will overwrite earlier ones
      for (const row of rowsToInsert) {
        const key = pkKey(row);
        if (key && key !== pkColumns.map(() => '').join('|')) { // Skip rows with empty PK values
          if (uniqueRowsMap.has(key)) {
            // Track duplicate keys
            duplicateKeysSet.add(key);
          }
          uniqueRowsMap.set(key, row);
        }
      }
      
      const originalCount = rowsToInsert.length;
      rowsToInsert = Array.from(uniqueRowsMap.values());
      inFileDuplicateCount = originalCount - rowsToInsert.length;
      
      // Get first 10 duplicate keys for display
      inFileDuplicateKeys.push(...Array.from(duplicateKeysSet).slice(0, 10));
      
      if (inFileDuplicateCount > 0) {
        console.log(`Found ${inFileDuplicateCount} duplicate rows within file by PK columns: ${pkColumns.join(', ')}`);
        console.log(`Duplicate keys (first 10): ${inFileDuplicateKeys.join(', ')}`);
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
        // For composite keys, batch check using OR filters
        // Process in batches to avoid URL length limits
        const batchSize = 50;
        for (let i = 0; i < values.length; i += batchSize) {
          const batch = values.slice(i, i + batchSize);
          
          // Build OR filter: or=(and(order_number.eq.X,product_id.eq.Y),and(...))
          const orClauses = batch.map(item => {
            const andParts = pkCols.map(c => `${c}.eq.${item[c]}`).join(',');
            return `and(${andParts})`;
          }).join(',');
          
          try {
            const response = await fetch(
              `${supabaseUrl}/rest/v1/${tbl}?select=${pkCols.join(',')}&or=(${encodeURIComponent(orClauses)})&limit=${batchSize}`,
              {
                headers: {
                  'apikey': supabaseServiceKey,
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
              }
            );
            
            if (response.ok) {
              const existing = await response.json();
              existing.forEach((row: any) => {
                existingSet.add(pkKeyFn(row));
              });
            } else {
              console.error('Error checking composite key batch:', await response.text());
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
        console.log(`Found ${duplicateCount} duplicate records, fetching field-level diffs...`);
        
        const pkColumnName = pkColumns.length === 1 ? pkColumns[0] : pkColumns.join(', ');
        
        // Build a map of Excel rows by their PK key
        const excelByKey = new Map<string, any>();
        for (const row of rowsToInsert) {
          const key = pkKeyFn(row);
          if (existingKeys.has(key)) {
            excelByKey.set(key, row);
          }
        }
        
        // Fetch full existing records for duplicates to compare field-by-field
        const fieldChanges: Array<{
          key: string;
          keyParts: Record<string, string>;
          changes: Array<{ field: string; dbValue: any; excelValue: any }>;
        }> = [];
        
        const duplicateKeysList = Array.from(existingKeys);
        const fetchBatchSize = 20; // Fetch full records in small batches
        
        for (let i = 0; i < duplicateKeysList.length && fieldChanges.length < 100; i += fetchBatchSize) {
          const batch = duplicateKeysList.slice(i, i + fetchBatchSize);
          
          // Build OR filter to fetch full records
          const orClauses = batch.map(key => {
            if (pkColumns.length === 1) {
              return `${pkColumns[0]}.eq.${key}`;
            }
            const parts = key.split('|');
            const andParts = pkColumns.map((c, idx) => `${c}.eq.${parts[idx]}`).join(',');
            return `and(${andParts})`;
          }).join(',');
          
          try {
            const response = await fetch(
              `${supabaseUrl}/rest/v1/${tableName}?select=*&or=(${encodeURIComponent(orClauses)})&limit=${fetchBatchSize}`,
              {
                headers: {
                  'apikey': supabaseServiceKey,
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
              }
            );
            
            if (response.ok) {
              const existingRows = await response.json();
              for (const dbRow of existingRows) {
                const dbKey = pkKeyFn(dbRow);
                const excelRow = excelByKey.get(dbKey);
                if (!excelRow) continue;
                
                // Compare field by field - find fields that will change
                const changes: Array<{ field: string; dbValue: any; excelValue: any }> = [];
                for (const [field, excelVal] of Object.entries(excelRow)) {
                  // Skip PK fields and internal fields
                  if (pkColumns.includes(field) || field === 'id' || field === 'created_at') continue;
                  if (excelVal === undefined || excelVal === null || excelVal === '') continue;
                  
                  const dbVal = dbRow[field];
                  // Only show if DB value is different from Excel value
                  const dbStr = String(dbVal ?? '');
                  const excelStr = String(excelVal);
                  
                  // Numeric comparison with tolerance
                  const dbNum = parseFloat(dbStr);
                  const excelNum = parseFloat(excelStr);
                  if (!isNaN(dbNum) && !isNaN(excelNum)) {
                    if (Math.abs(dbNum - excelNum) < 0.001) continue;
                  } else if (dbStr === excelStr) {
                    continue;
                  }
                  
                  changes.push({
                    field,
                    dbValue: dbVal,
                    excelValue: excelVal,
                  });
                }
                
                if (changes.length > 0) {
                  const keyParts: Record<string, string> = {};
                  const keyVals = dbKey.split('|');
                  pkColumns.forEach((col, idx) => { keyParts[col] = keyVals[idx]; });
                  
                  fieldChanges.push({
                    key: dbKey,
                    keyParts,
                    changes,
                  });
                }
              }
            }
          } catch (e) {
            console.error('Error fetching existing records for diff:', e);
          }
        }
        
        console.log(`Found ${fieldChanges.length} records with field-level changes out of ${duplicateCount} duplicates`);
        
        return new Response(
          JSON.stringify({
            requiresDuplicateDecision: true,
            totalRecords: rowsToInsert.length,
            duplicateCount,
            newRecordCount: rowsToInsert.length - duplicateCount,
            duplicateKeyColumn: pkColumnName,
            fieldChanges,
            duplicateMessage: `Found ${duplicateCount} existing records. ${fieldChanges.length} will have field updates.`
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
        // Try upsert with onConflict for PK columns - batch in chunks of 500
        const chunkSize = 500;
        let firstError: any = null;
        for (let ci = 0; ci < rowsToInsert.length; ci += chunkSize) {
          const chunk = rowsToInsert.slice(ci, ci + chunkSize);
          console.log(`Upserting chunk ${Math.floor(ci / chunkSize) + 1} of ${Math.ceil(rowsToInsert.length / chunkSize)} (${chunk.length} rows)...`);
          const { error } = await supabase
            .from(tableName)
            .upsert(chunk, {
              onConflict: pkColumns.join(','),
              ignoreDuplicates: false
            });
          if (error) {
            firstError = error;
            break;
          }
        }
        insertError = firstError;
        
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
        // Regular insert - batch in chunks of 500 to avoid timeouts
        const chunkSize = 500;
        let chunkErrors: any[] = [];
        for (let ci = 0; ci < rowsToInsert.length; ci += chunkSize) {
          const chunk = rowsToInsert.slice(ci, ci + chunkSize);
          console.log(`Inserting chunk ${Math.floor(ci / chunkSize) + 1} of ${Math.ceil(rowsToInsert.length / chunkSize)} (${chunk.length} rows)...`);
          const { error } = await supabase
            .from(tableName)
            .insert(chunk);
          if (error) {
            chunkErrors.push(error);
            break; // Stop on first error
          }
        }
        insertError = chunkErrors.length > 0 ? chunkErrors[0] : null;
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
        // Batch upsert ordertotals in chunks of 500
        const otBatchSize = 500;
        for (let i = 0; i < orderTotalsClean.length; i += otBatchSize) {
          const batch = orderTotalsClean.slice(i, i + otBatchSize);
          const { error: orderTotalsError } = await supabase
            .from('ordertotals')
            .upsert(batch, {
              onConflict: 'order_number',
              ignoreDuplicates: false
            });

          if (orderTotalsError) {
            console.error(`Error upserting order totals batch ${Math.floor(i / otBatchSize) + 1}:`, orderTotalsError);
          }
        }
        console.log(`Successfully upserted ${orderTotalsToUpsert.length} order totals`);
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

    const fillGapsSummary = (fillGapsSkipped > 0 || fillGapsUpdated > 0)
      ? `, ${fillGapsUpdated} existing updated, ${validData.length} new inserted`
      : '';

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
        inFileDuplicateCount,
        inFileDuplicateKeys,
        fillGapsSkipped,
        fillGapsUpdated,
        message: `Successfully loaded ${validData.length} records${brandsUpserted > 0 ? ` (${brandsUpserted} new brands added)` : ''}${inFileDuplicateCount > 0 ? ` (${inFileDuplicateCount} duplicates merged)` : ''}${fillGapsSummary}`
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
