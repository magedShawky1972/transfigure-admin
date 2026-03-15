import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Table configuration for test vs production mode
const TABLE_CONFIG = {
  test: {
    products: 'testproducts',
  },
  production: {
    products: 'products',
  }
};

Deno.serve(async (req) => {
  const startTime = Date.now();
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
        endpoint: 'api-products-list',
        method: req.method,
        request_body: null,
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

  // Only allow GET method
  if (req.method !== 'GET') {
    responseStatus = 405;
    responseMessage = 'Method not allowed. Use GET.';
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

    if (keyError || !apiKey || !apiKey.allow_product) {
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
    
    console.log(`API Mode: ${apiMode}, Using table: ${tables.products}`);

    // Query all products - return required fields including brand_code
    const { data, error } = await supabase
      .from(tables.products)
      .select('sku, product_name, product_price, brand_code')
      .order('product_name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      responseStatus = 500;
      responseMessage = error.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data || data.length === 0) {
      responseStatus = 404;
      responseMessage = 'No products found';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    responseMessage = `${data.length} products found`;
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      count: data.length,
      mode: apiMode,
      products: data,
      message: responseMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in api-products-list:', error);
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
