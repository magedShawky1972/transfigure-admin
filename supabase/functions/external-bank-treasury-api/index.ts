import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;
  let endpointLogged = 'external-bank-treasury-api';

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
        endpoint: endpointLogged,
        method: req.method,
        request_body: {},
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

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    if (req.method !== 'GET') {
      responseStatus = 405;
      responseMessage = 'Method not allowed. Use GET.';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    const url = new URL(req.url);
    // path after the function name, e.g. /bank-accounts or /treasuries
    const pathname = url.pathname.replace(/^.*\/external-bank-treasury-api/, '') || '/';
    const route = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    endpointLogged = `external-bank-treasury-api${route === '/' ? '' : route}`;

    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey') || '';
    if (!authHeader) {
      responseStatus = 401;
      responseMessage = 'Missing API key';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .maybeSingle();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_bank_treasury) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied (allow_bank_treasury required)';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    if (route === '/bank-accounts') {
      const { data, error } = await supabase
        .from('banks')
        .select('id, bank_code, bank_name, bank_name_ar, account_number, iban, swift_code, branch_name, currency_id, current_balance, opening_balance, allow_negative_balance, is_active')
        .eq('is_active', true)
        .order('bank_name');

      if (error) {
        responseStatus = 500;
        responseMessage = error.message;
        success = false;
        await logApiCall();
        return jsonResponse(responseStatus, { error: responseMessage });
      }

      responseMessage = 'Active bank accounts returned';
      await logApiCall();
      return jsonResponse(200, { success: true, count: data?.length ?? 0, data: data ?? [] });
    }

    if (route === '/treasuries') {
      const { data, error } = await supabase
        .from('treasuries')
        .select('*')
        .eq('is_active', true)
        .order('treasury_name');

      if (error) {
        responseStatus = 500;
        responseMessage = error.message;
        success = false;
        await logApiCall();
        return jsonResponse(responseStatus, { error: responseMessage });
      }

      responseMessage = 'Active treasuries returned';
      await logApiCall();
      return jsonResponse(200, { success: true, count: data?.length ?? 0, data: data ?? [] });
    }

    responseStatus = 404;
    responseMessage = 'Unknown route. Use /bank-accounts or /treasuries';
    success = false;
    await logApiCall();
    return jsonResponse(responseStatus, {
      error: responseMessage,
      available_routes: ['/bank-accounts', '/treasuries'],
    });
  } catch (error) {
    console.error('Error in external-bank-treasury-api:', error);
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return jsonResponse(responseStatus, { error: responseMessage });
  }
});
