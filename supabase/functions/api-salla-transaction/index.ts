import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const KSA_OFFSET_HOURS = 3;

const getKSATimestamp = (): string => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const ksaTime = new Date(utcTime + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
  return ksaTime.toISOString();
};

const parseToKSATimestamp = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  try {
    let date: Date;
    if (dateStr.includes('T')) {
      date = new Date(dateStr);
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00+03:00`);
      } else return null;
    } else if (dateStr.includes('-') && dateStr.includes(' ')) {
      const isoStr = dateStr.replace(' ', 'T') + '+03:00';
      date = new Date(isoStr);
    } else if (dateStr.includes('-')) {
      date = new Date(`${dateStr}T00:00:00+03:00`);
    } else return null;
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
};

const computeDateInt = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const ksaTime = new Date(d.getTime() + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
    const year = ksaTime.getUTCFullYear();
    const month = String(ksaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(ksaTime.getUTCDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
  } catch {
    return null;
  }
};

const getField = (obj: Record<string, any>, ...keys: string[]): any => {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
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
        endpoint: 'api-salla-transaction',
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

    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_salla_transaction) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or permission denied for Salla Transaction';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    requestBody = body;
    console.log('Received Salla transaction data:', JSON.stringify(body));

    // Fetch required fields from configuration
    const { data: fieldConfigs, error: configError } = await supabase
      .from('api_field_configs')
      .select('field_name, is_required')
      .eq('api_endpoint', '/api/salla-transaction')
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

    // Validate required fields (check header-level fields only, exclude line-level fields)
    const lineFieldNames = ['Product_Name', 'product_name', 'Total', 'total', 'Quantity', 'quantity', 'qty', 'Coins_Number', 'coins_number'];
    const requiredFields = (fieldConfigs || []).map((config: any) => config.field_name);
    const headerRequiredFields = requiredFields.filter((field: string) => !lineFieldNames.includes(field));
    const missingFields = headerRequiredFields.filter((field: string) => !body[field]);
    
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

    // Parse order_date as KSA time
    const orderDateRaw = getField(body, 'Order_Date', 'order_date', 'Order_date', 'created_at_date');
    const parsedOrderDate = parseToKSATimestamp(orderDateRaw);
    const dateInt = computeDateInt(parsedOrderDate || orderDateRaw);

    // Parse status
    let statusValue = getField(body, 'Status', 'status');
    if (typeof statusValue === 'string') {
      const statusMap: Record<string, number> = {
        'pending': 0, 'processing': 1, 'completed': 2, 'cancelled': 3, 'refunded': 4,
      };
      statusValue = statusMap[statusValue.toLowerCase()] ?? (parseInt(statusValue, 10) || 0);
    }

    // Build shared header data
    const headerData: Record<string, any> = {
      order_number: getField(body, 'Order_Number', 'order_number'),
      customer_phone: getField(body, 'Customer_Phone', 'customer_phone'),
      customer_name: getField(body, 'Customer_Name', 'customer_name'),
      created_at_date: parsedOrderDate || orderDateRaw,
      created_at_date_int: dateInt,
      brand_name: getField(body, 'Brand_Name', 'brand_name'),
      brand_code: getField(body, 'Brand_Code', 'brand_code'),
      payment_method: getField(body, 'Payment_Method', 'payment_method'),
      payment_type: getField(body, 'Payment_Type', 'payment_type'),
      payment_brand: getField(body, 'Payment_Brand', 'payment_brand'),
      company: getField(body, 'Company', 'company') || 'Purple',
      status: statusValue,
      status_description: getField(body, 'Status_Description', 'status_description'),
      user_name: getField(body, 'Sales_Person', 'user_name', 'sales_person'),
      transaction_type: getField(body, 'Transaction_Type', 'transaction_type'),
      media: getField(body, 'Media', 'media'),
      profit_center: getField(body, 'Profit_Center', 'profit_center') || 'Salla',
      customer_ip: getField(body, 'Customer_IP', 'customer_ip'),
      device_fingerprint: getField(body, 'Device_Fingerprint', 'device_fingerprint'),
      transaction_location: getField(body, 'Transaction_Location', 'transaction_location'),
      payment_term: getField(body, 'Payment_Term', 'payment_term'),
      is_point: body.Point !== undefined ? body.Point : (body.is_point ?? false),
      point_value: getField(body, 'Point_Value', 'point_value'),
      vendor_name: getField(body, 'Vendor_Name', 'vendor_name'),
      order_status: getField(body, 'Order_Status', 'order_status'),
      created_at: getKSATimestamp(),
    };

    // Determine lines: support both array "lines" and flat single-product body
    const rawLines: any[] = body.lines || body.Lines || [];
    
    let lines: any[];
    if (rawLines.length > 0) {
      // Multi-line: use the lines array
      lines = rawLines;
    } else {
      // Backward-compatible: treat the body itself as a single line
      lines = [body];
    }

    const insertRows: Record<string, any>[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineOrderNumber = rawLines.length > 0
        ? `${headerData.order_number}-${i + 1}`
        : headerData.order_number;

      const row: Record<string, any> = {
        ...headerData,
        order_number: lineOrderNumber,
        ordernumber: headerData.order_number, // original order number for grouping
        product_name: getField(line, 'Product_Name', 'product_name'),
        product_id: getField(line, 'Product_Id', 'product_id'),
        coins_number: getField(line, 'Coins_Number', 'coins_number'),
        unit_price: getField(line, 'Unit_Price', 'unit_price'),
        cost_price: getField(line, 'Cost_Price', 'cost_price'),
        qty: getField(line, 'Quantity', 'qty', 'quantity'),
        cost_sold: getField(line, 'Cost_Sold', 'cost_sold'),
        total: getField(line, 'Total', 'total'),
        profit: getField(line, 'Profit', 'profit'),
        player_id: getField(line, 'Player_Id', 'player_id'),
      };

      // Remove undefined values
      Object.keys(row).forEach(key => {
        if (row[key] === undefined) delete row[key];
      });

      insertRows.push(row);
    }

    // Upsert all rows
    const { data: insertedData, error: insertError } = await supabase
      .from('purpletransaction_temp')
      .upsert(insertRows, { 
        onConflict: 'order_number',
        ignoreDuplicates: false 
      })
      .select('id, order_number, created_at');

    if (insertError) {
      console.error('Error inserting Salla transaction:', insertError);
      responseStatus = 500;
      responseMessage = `Failed to insert Salla transaction: ${insertError.message}`;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ 
        error: responseMessage,
        details: insertError.message 
      }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Salla transaction inserted successfully:', insertedData);
    responseMessage = `Salla transaction created/updated successfully (${insertRows.length} line(s))`;
    await logApiCall();

    return new Response(JSON.stringify({ 
      success: true, 
      lines_count: insertRows.length,
      data: insertedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-salla-transaction:', error);
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
