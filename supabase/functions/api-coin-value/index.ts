import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;
  let supplierHubCode = '';

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
        endpoint: 'api-coin-value',
        method: req.method,
        request_body: { supplier_hub_code: supplierHubCode },
        response_status: responseStatus,
        response_message: responseMessage,
        success,
        execution_time_ms: Date.now() - startTime,
        api_key_id: apiKeyData?.id || null,
        api_key_description: apiKeyData?.description || null,
      });
    } catch (e) {
      console.error('Error logging API call:', e);
    }
  };

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

    const url = new URL(req.url);
    supplierHubCode = (url.searchParams.get('supplier_hub_code') || '').trim();

    if (!supplierHubCode) {
      responseStatus = 400;
      responseMessage = 'Missing required parameter: supplier_hub_code';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({
        error: responseMessage,
        usage: 'GET /api-coin-value?supplier_hub_code=<code>',
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find brand by supplier_hub_code (case-insensitive)
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('brand_name, brand_code, supplier_hub_code, usd_value_for_coins, one_usd_to_coins')
      .ilike('supplier_hub_code', supplierHubCode)
      .maybeSingle();

    if (brandError) {
      responseStatus = 500;
      responseMessage = brandError.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!brand) {
      responseStatus = 404;
      responseMessage = 'Brand not found for supplier_hub_code';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({
        error: responseMessage,
        supplier_hub_code: supplierHubCode,
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const usdValuePerCoin = Number(brand.usd_value_for_coins ?? 0);
    if (!usdValuePerCoin || usdValuePerCoin <= 0) {
      responseStatus = 422;
      responseMessage = 'Brand has no USD value per coin configured';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({
        error: responseMessage,
        supplier_hub_code: supplierHubCode,
        brand_name: brand.brand_name,
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get USD currency rate (rate_to_base where base is SAR)
    const { data: usdCurrency, error: usdErr } = await supabase
      .from('currencies')
      .select('id, currency_code, is_base')
      .eq('currency_code', 'USD')
      .maybeSingle();

    if (usdErr || !usdCurrency) {
      responseStatus = 500;
      responseMessage = 'USD currency not configured';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rateRow } = await supabase
      .from('currency_rates')
      .select('rate_to_base, conversion_operator')
      .eq('currency_id', usdCurrency.id)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const usdRate = Number(rateRow?.rate_to_base ?? 0);
    const operator = (rateRow?.conversion_operator ?? 'multiply') as 'multiply' | 'divide';

    if (!usdRate || usdRate <= 0) {
      responseStatus = 500;
      responseMessage = 'USD to SAR rate not configured';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // One Coin in SAR = USD value per coin (operator) USD rate to SAR
    const oneCoinSarRaw = operator === 'multiply'
      ? usdValuePerCoin * usdRate
      : usdValuePerCoin / usdRate;
    const oneCoinSar = Math.round(oneCoinSarRaw * 100) / 100;

    responseMessage = 'Coin value computed';
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      supplier_hub_code: brand.supplier_hub_code,
      brand_name: brand.brand_name,
      brand_code: brand.brand_code,
      usd_value_per_coin: usdValuePerCoin,
      usd_to_sar_rate: usdRate,
      conversion_operator: operator,
      one_coin_sar: oneCoinSar,
      base_currency: 'SAR',
      message: responseMessage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in api-coin-value:', error);
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
