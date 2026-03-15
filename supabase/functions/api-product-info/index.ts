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
  let sku = '';

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
        endpoint: 'api-product-info',
        method: req.method,
        request_body: { sku },
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

    // Parse URL to get SKU from query params
    const url = new URL(req.url);
    sku = url.searchParams.get('sku') || '';

    if (!sku) {
      responseStatus = 400;
      responseMessage = 'Missing required parameter: sku';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        usage: 'GET /api-product-info?sku=<product_sku>'
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Looking up product by SKU: ${sku}`);

    // Query product by SKU - return required fields including brand_code
    const { data, error } = await supabase
      .from(tables.products)
      .select('product_name, product_price, brand_code')
      .eq('sku', sku)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        responseStatus = 404;
        responseMessage = 'Product not found';
        success = false;
        await logApiCall();
        return new Response(JSON.stringify({ 
          error: responseMessage,
          sku 
        }), {
          status: responseStatus,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.error('Error looking up product:', error);
      responseStatus = 500;
      responseMessage = error.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      responseStatus = 404;
      responseMessage = 'Product not found';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        sku 
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    responseMessage = 'Product found';
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      sku,
      product_name: data.product_name,
      product_price: data.product_price,
      mode: apiMode,
      message: responseMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in api-product-info:', error);
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
