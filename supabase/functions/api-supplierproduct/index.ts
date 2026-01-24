import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Table configuration for test vs production mode
const TABLE_CONFIG = {
  test: {
    supplierproducts: 'testsupplierproducts',
    suppliers: 'testsuppliers',
  },
  production: {
    supplierproducts: 'supplier_products',
    suppliers: 'suppliers',
  }
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  let requestBody: any = null;
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const logApiCall = async () => {
    try {
      await supabase.from('api_consumption_logs').insert({
        endpoint: 'api-supplierproduct',
        method: req.method,
        request_body: requestBody,
        response_status: responseStatus,
        response_message: responseMessage,
        success,
        execution_time_ms: Date.now() - startTime,
        api_key_id: apiKeyData?.id || null,
        api_key_description: apiKeyData?.description || null,
      });
    } catch (logError) {
      console.error('Error logging API call:', logError);
    }
  };

  // Only allow POST method
  if (req.method !== 'POST') {
    responseStatus = 405;
    responseMessage = 'Method not allowed. Use POST.';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      responseStatus = 401;
      responseMessage = 'Missing API key';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify API key and permissions
    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_supplier_product) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch API mode from settings
    const { data: modeData } = await supabase
      .from('api_integration_settings')
      .select('setting_value')
      .eq('setting_key', 'api_mode')
      .single();

    const apiMode = (modeData?.setting_value === 'production') ? 'production' : 'test';
    const tables = TABLE_CONFIG[apiMode];
    
    console.log(`API Mode: ${apiMode}, Using tables:`, tables);

    const body = await req.json();
    requestBody = body;
    console.log('Received supplier product data:', JSON.stringify(body));

    // Fetch required fields from configuration
    const { data: fieldConfigs, error: configError } = await supabase
      .from('api_field_configs')
      .select('field_name, is_required')
      .eq('api_endpoint', '/api/supplierproduct')
      .eq('is_required', true);

    if (configError) {
      console.error('Error fetching field configs:', configError);
      responseStatus = 500;
      responseMessage = 'Configuration error';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields based on configuration
    const requiredFields = fieldConfigs.map((config: any) => config.field_name);
    const missingFields = requiredFields.filter((field: string) => !body[field]);
    
    if (missingFields.length > 0) {
      responseStatus = 400;
      responseMessage = `Missing required fields: ${missingFields.join(', ')}`;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: 'Missing required fields', 
        missing: missingFields 
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate that the supplier exists in the appropriate table
    const { data: supplierData, error: supplierError } = await supabase
      .from(tables.suppliers)
      .select('supplier_code')
      .eq('supplier_code', body.Supplier_code)
      .single();

    if (supplierError || !supplierData) {
      responseStatus = 400;
      responseMessage = `Supplier with code '${body.Supplier_code}' not found in ${apiMode} mode. Please create the supplier first.`;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        mode: apiMode,
        supplier_code: body.Supplier_code
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert to the appropriate supplierproducts table based on mode
    const { data: resultData, error: upsertError } = await supabase
      .from(tables.supplierproducts)
      .upsert({
        supplier_code: body.Supplier_code,
        sku: body.SKU,
        date_from: body.Date_From,
        date_to: body.Date_To,
        price: body.Price,
      }, {
        onConflict: 'supplier_code,sku,date_from'
      })
      .select()
      .single();

    if (upsertError) {
      console.error(`Error upserting to ${tables.supplierproducts}:`, upsertError);
      responseStatus = 400;
      responseMessage = upsertError.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully upserted to ${tables.supplierproducts}:`, resultData);
    responseMessage = `Supplier product saved to ${tables.supplierproducts} table (${apiMode} mode)`;
    await logApiCall();

    return new Response(JSON.stringify({ 
      success: true, 
      message: responseMessage,
      mode: apiMode,
      data: resultData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-supplierproduct:', error);
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
