import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const PAGE_SIZE = 1000;

const toDateInt = (s: string): number | null => {
  const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return parseInt(`${m[1]}${m[2]}${m[3]}`, 10);
};

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
        endpoint: 'api-purple-transaction',
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
      console.error('log error', e);
    }
  };

  const json = (status: number, body: any) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    responseStatus = 405; responseMessage = 'Method not allowed. Use POST.'; success = false;
    await logApiCall();
    return json(405, { error: responseMessage });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key') || '';
    const apiKeyValue = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!apiKeyValue) {
      responseStatus = 401; responseMessage = 'Missing API key'; success = false;
      await logApiCall();
      return json(401, { error: responseMessage });
    }

    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', apiKeyValue)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_purple_transaction) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied for Purple Transaction';
      success = false;
      await logApiCall();
      return json(403, { error: responseMessage });
    }

    const body = await req.json().catch(() => ({}));
    requestBody = body;

    const from = body.from_date || body.start_date || body.From_Date;
    const to = body.to_date || body.end_date || body.To_Date;

    if (!from || !to) {
      responseStatus = 400;
      responseMessage = 'Missing required fields: from_date, to_date (YYYY-MM-DD)';
      success = false;
      await logApiCall();
      return json(400, { error: responseMessage });
    }

    const fromInt = toDateInt(from);
    const toInt = toDateInt(to);
    if (!fromInt || !toInt || fromInt > toInt) {
      responseStatus = 400;
      responseMessage = 'Invalid date range. Use YYYY-MM-DD with from_date <= to_date.';
      success = false;
      await logApiCall();
      return json(400, { error: responseMessage });
    }

    const company = body.company as string | undefined;
    const paymentMethod = body.payment_method as string | undefined;
    const limit = Math.min(Number(body.limit) || 100000, 100000);

    // Paginate (PostgREST capped at 1000 per request)
    let allRows: any[] = [];
    let offset = 0;
    while (allRows.length < limit) {
      const remaining = limit - allRows.length;
      const pageSize = Math.min(PAGE_SIZE, remaining);
      let q = supabase
        .from('purpletransaction')
        .select('*')
        .gte('created_at_date_int', fromInt)
        .lte('created_at_date_int', toInt)
        .eq('is_deleted', false)
        .order('created_at_date_int', { ascending: true })
        .order('order_number', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (company) q = q.eq('company', company);
      if (paymentMethod) q = q.eq('payment_method', paymentMethod);

      const { data, error } = await q;
      if (error) {
        responseStatus = 500;
        responseMessage = `Query failed: ${error.message}`;
        success = false;
        await logApiCall();
        return json(500, { error: responseMessage });
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    responseMessage = `Returned ${allRows.length} purple transaction record(s)`;
    await logApiCall();

    return json(200, {
      success: true,
      from_date: from,
      to_date: to,
      count: allRows.length,
      data: allRows,
    });
  } catch (error) {
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return json(500, { error: responseMessage });
  }
});
