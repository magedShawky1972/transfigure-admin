import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
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
        endpoint: 'api-brand-abc-a-stock',
        method: req.method,
        request_body: null,
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

    // Fetch all ABC class A brands
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, brand_name, brand_code, supplier_hub_code, abc_analysis, reorder_point, safety_stock, average_consumption_per_day, status')
      .eq('abc_analysis', 'A')
      .eq('status', 'active');

    if (brandsError) {
      responseStatus = 500;
      responseMessage = brandsError.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For each brand fetch latest closing balance from shift_brand_balances (joined with closed shift_sessions)
    const results = await Promise.all((brands || []).map(async (b: any) => {
      const { data: latest } = await supabase
        .from('shift_brand_balances')
        .select('closing_balance, updated_at, shift_session_id, shift_sessions!inner(closed_at, status)')
        .eq('brand_id', b.id)
        .not('closing_balance', 'is', null)
        .eq('shift_sessions.status', 'closed')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        brand_id: b.id,
        brand_name: b.brand_name,
        brand_code: b.brand_code,
        supplier_hub_code: b.supplier_hub_code,
        abc_class: b.abc_analysis,
        reorder_point: Number(b.reorder_point ?? 0),
        average_consumption_per_day: Number(b.average_consumption_per_day ?? 0),
        safety_stock: Number(b.safety_stock ?? 0),
        current_balance: latest ? Number(latest.closing_balance) : null,
        last_shift_closed_at: latest?.shift_sessions?.closed_at ?? null,
      };
    }));

    responseMessage = `Returned ${results.length} ABC Class A brands`;
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      count: results.length,
      data: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-brand-abc-a-stock:', error);
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
