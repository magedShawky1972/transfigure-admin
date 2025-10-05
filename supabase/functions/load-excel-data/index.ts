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

    // Transform the data based on mappings
    const transformedData = data.map((row: any) => {
      const transformedRow: any = {};
      
      mappings.forEach((mapping) => {
        const excelValue = row[mapping.excel_column];
        
        if (excelValue !== undefined && excelValue !== null && excelValue !== '') {
          // Convert data types if needed
          if (mapping.data_type.toLowerCase().includes('numeric') || 
              mapping.data_type.toLowerCase().includes('integer')) {
            transformedRow[mapping.table_column] = parseFloat(excelValue) || 0;
          } else if (mapping.data_type.toLowerCase().includes('timestamp') ||
                     mapping.data_type.toLowerCase().includes('date')) {
            // Handle Excel date formats
            transformedRow[mapping.table_column] = excelValue;
          } else {
            transformedRow[mapping.table_column] = excelValue.toString();
          }
        }
      });

      return transformedRow;
    });

    // Filter out empty rows
    const validData = transformedData.filter((row: any) => 
      Object.keys(row).length > 0
    );

    console.log(`Inserting ${validData.length} valid rows into ${tableName}`);

    // Insert the data
    const { error: insertError } = await supabase
      .from(tableName)
      .insert(validData);

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: `Failed to insert data: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully inserted ${validData.length} rows`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: validData.length,
        message: `Successfully loaded ${validData.length} records`
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
