import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  let requestBody: any = null;
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;

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
        endpoint: 'api-brand-balance',
        method: req.method,
        request_body: requestBody,
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
    // Auth via API key
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

    if (keyError || !apiKey || !apiKey.allow_brand) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied (allow_brand required)';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const body = await req.json();
    requestBody = body;

    const supplierHubCode = String(body.supplier_hub_code ?? body.Supplier_Hub_Code ?? '').trim();
    const balanceRaw = body.balance ?? body.Balance ?? body.coins_balance ?? body.Coins_Balance;
    const notes = body.notes ?? body.Notes ?? null;

    if (!supplierHubCode) {
      responseStatus = 400;
      responseMessage = 'Missing required field: supplier_hub_code';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (balanceRaw === undefined || balanceRaw === null || isNaN(Number(balanceRaw))) {
      responseStatus = 400;
      responseMessage = 'Missing or invalid required field: balance (must be a number)';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const balance = Number(balanceRaw);

    // Lookup brand by supplier_hub_code
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, brand_name, brand_code, supplier_hub_code, reorder_point')
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

    const reorderPoint = Number(brand.reorder_point ?? 0);
    const isLowStock = reorderPoint > 0 && balance <= reorderPoint;

    // Save snapshot
    const { data: inserted, error: insertError } = await supabase
      .from('brand_coin_balances')
      .insert({
        brand_id: brand.id,
        balance,
        reorder_point_at_report: reorderPoint,
        source: 'api',
        api_key_id: apiKey.id,
        notes,
        triggered_alert: isLowStock,
      })
      .select()
      .single();

    if (insertError) {
      responseStatus = 500;
      responseMessage = insertError.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Trigger reorder notification if balance is low
    let alertSent = false;
    let alertError: string | null = null;
    if (isLowStock) {
      try {
        const invokeResult = await supabase.functions.invoke('send-reorder-notification', {
          body: {
            brandId: brand.id,
            brandName: brand.brand_name,
            currentBalance: balance,
            reorderPoint,
            type: 'closing',
            userId: apiKey.id,
            userName: `API: ${apiKey.description}`,
          },
        });
        if (invokeResult.error) {
          alertError = invokeResult.error.message;
          console.error('Reorder notification error:', invokeResult.error);
        } else {
          alertSent = true;
        }
      } catch (e) {
        alertError = e instanceof Error ? e.message : 'Unknown error';
        console.error('Failed to invoke reorder notification:', e);
      }
    }

    responseMessage = isLowStock
      ? `Balance saved. Low-stock alert ${alertSent ? 'sent' : 'attempted'}.`
      : 'Balance saved successfully';
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      message: responseMessage,
      record_id: inserted.id,
      brand_id: brand.id,
      brand_name: brand.brand_name,
      brand_code: brand.brand_code,
      supplier_hub_code: brand.supplier_hub_code,
      balance,
      reorder_point: reorderPoint,
      low_stock: isLowStock,
      alert_sent: alertSent,
      alert_error: alertError,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in api-brand-balance:', error);
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
