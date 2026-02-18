import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// KSA timezone offset (UTC+3)
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
    // Convert to KSA time
    const ksaTime = new Date(d.getTime() + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
    const year = ksaTime.getUTCFullYear();
    const month = String(ksaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(ksaTime.getUTCDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
  } catch {
    return null;
  }
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

    // Verify API key and permissions
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

    // Validate required fields
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

    // Parse order_date as KSA time
    const orderDateRaw = body.Order_Date || body.order_date || body.Order_date || body.created_at_date;
    const parsedOrderDate = parseToKSATimestamp(orderDateRaw);
    const dateInt = computeDateInt(parsedOrderDate || orderDateRaw);

    // Parse status
    let statusValue = body.Status || body.status;
    if (typeof statusValue === 'string') {
      const statusMap: Record<string, number> = {
        'pending': 0, 'processing': 1, 'completed': 2, 'cancelled': 3, 'refunded': 4,
      };
      statusValue = statusMap[statusValue.toLowerCase()] ?? (parseInt(statusValue, 10) || 0);
    }

    const insertData: Record<string, any> = {
      order_number: body.Order_Number || body.order_number,
      customer_phone: body.Customer_Phone || body.customer_phone,
      customer_name: body.Customer_Name || body.customer_name,
      created_at_date: parsedOrderDate || orderDateRaw,
      created_at_date_int: dateInt,
      brand_name: body.Brand_Name || body.brand_name,
      brand_code: body.Brand_Code || body.brand_code,
      product_name: body.Product_Name || body.product_name,
      product_id: body.Product_Id || body.product_id,
      coins_number: body.Coins_Number || body.coins_number,
      unit_price: body.Unit_Price || body.unit_price,
      cost_price: body.Cost_Price || body.cost_price,
      qty: body.Quantity || body.qty || body.quantity,
      cost_sold: body.Cost_Sold || body.cost_sold,
      total: body.Total || body.total,
      profit: body.Profit || body.profit,
      payment_method: body.Payment_Method || body.payment_method,
      payment_type: body.Payment_Type || body.payment_type,
      payment_brand: body.Payment_Brand || body.payment_brand,
      company: body.Company || body.company || 'Purple',
      status: statusValue,
      status_description: body.Status_Description || body.status_description,
      user_name: body.Sales_Person || body.user_name || body.sales_person,
      transaction_type: body.Transaction_Type || body.transaction_type,
      media: body.Media || body.media,
      profit_center: body.Profit_Center || body.profit_center || 'Salla',
      customer_ip: body.Customer_IP || body.customer_ip,
      device_fingerprint: body.Device_Fingerprint || body.device_fingerprint,
      transaction_location: body.Transaction_Location || body.transaction_location,
      payment_term: body.Payment_Term || body.payment_term,
      player_id: body.Player_Id || body.player_id,
      is_point: body.Point !== undefined ? body.Point : (body.is_point ?? false),
      point_value: body.Point_Value || body.point_value,
      vendor_name: body.Vendor_Name || body.vendor_name,
      order_status: body.Order_Status || body.order_status,
      ordernumber: body.Order_Number || body.order_number,
      created_at: getKSATimestamp(),
    };

    // Remove undefined values
    Object.keys(insertData).forEach(key => {
      if (insertData[key] === undefined) delete insertData[key];
    });

    // Upsert with order_number as conflict key
    const { data: insertedData, error: insertError } = await supabase
      .from('purpletransaction_temp')
      .upsert(insertData, { 
        onConflict: 'order_number',
        ignoreDuplicates: false 
      })
      .select('id, created_at')
      .single();

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
    responseMessage = 'Salla transaction created/updated successfully';
    await logApiCall();

    return new Response(JSON.stringify({ 
      success: true, 
      data: {
        id: insertedData.id,
        created_at: insertedData.created_at
      }
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
