import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const normalizePhone = (raw: string) => (raw || '').replace(/[\s\-()]/g, '').trim();

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
        endpoint: 'api-crm-customer-info',
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

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
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

    if (keyError || !apiKey || !apiKey.allow_crm) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied (allow_crm required)';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    // Accept phone from POST body or GET query param
    let phoneRaw = '';
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      requestBody = body;
      phoneRaw = body.customer_phone || body.Customer_Phone || body.phone || '';
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      phoneRaw = url.searchParams.get('customer_phone') || url.searchParams.get('phone') || '';
      requestBody = { customer_phone: phoneRaw };
    } else {
      responseStatus = 405;
      responseMessage = 'Method not allowed. Use POST or GET.';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      responseStatus = 400;
      responseMessage = 'customer_phone is required';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    // Customer master data
    const { data: customer } = await supabase
      .from('customers')
      .select('customer_name, customer_phone, email, creation_date, last_transaction, status, is_blocked, customer_group')
      .eq('customer_phone', phone)
      .maybeSingle();

    // Transactions (latest first). Pull enough rows to cover last 10 orders + 2 months totals.
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const { data: txRows, error: txError } = await supabase
      .from('purpletransaction')
      .select('order_number, ordernumber, created_at_date, product_name, brand_name, brand_code, qty, coins_number, unit_price, total, payment_method, payment_brand, order_status, customer_name, payment_card_number, payment_reference, customer_ip, device_fingerprint, profit_center, status_description, register_user_id, player_id')
      .eq('customer_phone', phone)
      .or('is_deleted.is.null,is_deleted.eq.false')
      .order('created_at_date', { ascending: false })
      .limit(3000);

    if (txError) {
      responseStatus = 500;
      responseMessage = txError.message;
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage });
    }

    const rows = txRows ?? [];

    if (!customer && rows.length === 0) {
      responseStatus = 404;
      responseMessage = 'Customer not found';
      success = false;
      await logApiCall();
      return jsonResponse(responseStatus, { error: responseMessage, customer_phone: phone });
    }

    // Group into orders preserving latest-first order
    const orderMap = new Map<string, any>();
    for (const r of rows) {
      const key = (r.order_number || r.ordernumber || `${r.created_at_date}`) as string;
      if (!orderMap.has(key)) {
        orderMap.set(key, {
          order_number: r.order_number || r.ordernumber || null,
          order_date: r.created_at_date,
          payment_method: r.payment_method,
          payment_brand: r.payment_brand,
          payment_card_number: r.payment_card_number ?? null,
          payment_reference: r.payment_reference ?? null,
          customer_ip: r.customer_ip ?? null,
          customer_ip_country: null as string | null,
          device_fingerprint: r.device_fingerprint ?? null,
          profit_center: r.profit_center ?? null,
          status_description: r.status_description ?? null,
          register_user_id: r.register_user_id ?? null,
          player_id: r.player_id ?? null,
          order_status: r.order_status,
          order_total: 0,
          total_qty: 0,
          lines: [] as any[],
        });
      }
      const o = orderMap.get(key);
      const qty = Number(r.qty) || 0;
      const total = Number(r.total) || 0;
      o.order_total += total;
      o.total_qty += qty;
      if (!o.payment_card_number && r.payment_card_number) o.payment_card_number = r.payment_card_number;
      if (!o.payment_reference && r.payment_reference) o.payment_reference = r.payment_reference;
      if (!o.customer_ip && r.customer_ip) o.customer_ip = r.customer_ip;
      if (!o.device_fingerprint && r.device_fingerprint) o.device_fingerprint = r.device_fingerprint;
      if (!o.profit_center && r.profit_center) o.profit_center = r.profit_center;
      if (!o.status_description && r.status_description) o.status_description = r.status_description;
      if (!o.register_user_id && r.register_user_id) o.register_user_id = r.register_user_id;
      if (!o.player_id && r.player_id) o.player_id = r.player_id;
      o.lines.push({
        product_name: r.product_name,
        brand_name: r.brand_name,
        brand_code: r.brand_code,
        qty,
        coins_number: r.coins_number != null ? Number(r.coins_number) : null,
        unit_price: r.unit_price != null ? Number(r.unit_price) : null,
        total,
        player_id: r.player_id ?? null,
        profit_center: r.profit_center ?? null,
        status_description: r.status_description ?? null,
      });
    }

    const allOrders = Array.from(orderMap.values());
    const last10 = allOrders.slice(0, 10).map((o) => ({
      ...o,
      order_total: Math.round(o.order_total * 100) / 100,
    }));

    // Resolve country for the IPs used in the returned orders (cached per IP)
    const uniqueIps = Array.from(new Set(last10.map((o) => o.customer_ip).filter(Boolean))) as string[];
    const ipCountry = new Map<string, string | null>();
    await Promise.all(
      uniqueIps.slice(0, 10).map(async (ip) => {
        try {
          const resp = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`);
          const geo = await resp.json();
          ipCountry.set(ip, geo?.status === 'success' ? (geo.country || geo.countryCode || null) : null);
        } catch (_e) {
          ipCountry.set(ip, null);
        }
      })
    );
    for (const o of last10) {
      if (o.customer_ip) o.customer_ip_country = ipCountry.get(o.customer_ip) ?? null;
    }


    const totalLast10 = last10.reduce((s, o) => s + o.order_total, 0);
    const totalLast2Months = rows
      .filter((r) => r.created_at_date && new Date(r.created_at_date as string) >= twoMonthsAgo)
      .reduce((s, r) => s + (Number(r.total) || 0), 0);

    const lastTransDate = rows.length > 0 ? rows[0].created_at_date : (customer?.last_transaction ?? null);

    responseMessage = `Customer info returned (${last10.length} orders)`;
    await logApiCall();

    return jsonResponse(200, {
      success: true,
      customer: {
        customer_phone: phone,
        customer_name: customer?.customer_name || rows[0]?.customer_name || null,
        email: customer?.email ?? null,
        creation_date: customer?.creation_date ?? null,
        last_transaction_date: lastTransDate,
        status: customer?.status ?? null,
        is_blocked: customer?.is_blocked ?? false,
        customer_group: customer?.customer_group ?? null,
        total_orders_count: allOrders.length,
        total_value_last_orders: Math.round(totalLast10 * 100) / 100,
        total_value_last_2_months: Math.round(totalLast2Months * 100) / 100,
      },
      orders_count: last10.length,
      orders: last10,
    });
  } catch (error) {
    console.error('Error in api-crm-customer-info:', error);
    responseStatus = 500;
    responseMessage = error instanceof Error ? error.message : 'Unknown error';
    success = false;
    await logApiCall();
    return jsonResponse(responseStatus, { error: responseMessage });
  }
});
