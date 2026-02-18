import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// KSA timezone offset (UTC+3)
const KSA_OFFSET_HOURS = 3;

/**
 * Get current KSA timestamp in ISO format
 */
const getKSATimestamp = (): string => {
  const now = new Date();
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const ksaTime = new Date(utcTime + (KSA_OFFSET_HOURS * 60 * 60 * 1000));
  return ksaTime.toISOString();
};

/**
 * Parse a date string and return it as-is (no timezone conversion).
 * The date from the API source is the correct local date — store it directly.
 * Handles formats: YYYY-MM-DD HH:MM:SS, YYYY-MM-DD, DD/MM/YYYY, ISO strings
 */
const parseDateDirect = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  
  try {
    // If it's "YYYY-MM-DD HH:MM:SS" format, just replace space with T — no timezone append
    if (dateStr.includes('-') && dateStr.includes(' ') && !dateStr.includes('T')) {
      return dateStr.replace(' ', 'T');
    }
    
    // If it's already an ISO string with T, return as-is
    if (dateStr.includes('T')) {
      return dateStr;
    }
    
    // DD/MM/YYYY format → convert to YYYY-MM-DD
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`;
      }
      return null;
    }
    
    // YYYY-MM-DD format (date only)
    if (dateStr.includes('-')) {
      return `${dateStr}T00:00:00`;
    }
    
    return null;
  } catch {
    return null;
  }
};

// Table configuration for test vs production mode
const TABLE_CONFIG = {
  test: {
    salesheader: 'testsalesheader',
  },
  production: {
    salesheader: 'sales_order_header',
  }
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  let requestBody: any = null;
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
        endpoint: 'api-salesheader',
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

  // Only allow POST method
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

    if (keyError || !apiKey || !apiKey.allow_sales_header) {
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
    
    console.log(`API Mode: ${apiMode}, Using tables:`, tables);

    const body = await req.json();
    requestBody = body;
    console.log('Received sales header data:', JSON.stringify(body));

    // Fetch required fields from configuration
    const { data: fieldConfigs, error: configError } = await supabase
      .from('api_field_configs')
      .select('field_name, is_required')
      .eq('api_endpoint', '/api/salesheader')
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

    // Validate required fields based on configuration
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

    // Insert data into the appropriate table based on mode
    const tableName = tables.salesheader;
    console.log(`Inserting sales header into table: ${tableName}`);

    // Parse status - convert string to integer if needed
    let statusValue = body.status;
    if (typeof statusValue === 'string') {
      // Map common status strings to integers
      const statusMap: Record<string, number> = {
        'pending': 0,
        'processing': 1,
        'completed': 2,
        'cancelled': 3,
        'refunded': 4,
      };
      statusValue = statusMap[statusValue.toLowerCase()] ?? (parseInt(statusValue, 10) || 0);
    }

    // Parse order_date as KSA time
    const orderDateRaw = body.Order_date || body.created_at_date || body.order_date;
    const parsedOrderDate = parseDateDirect(orderDateRaw);
    
    console.log(`Order date parsing: raw="${orderDateRaw}", stored as="${parsedOrderDate}" (no timezone conversion)`);

    // Build the insert object with all available fields
    // Map to sales_order_header columns - handle both PascalCase and snake_case inputs
    const insertData: Record<string, any> = {
      order_number: body.Order_Number || body.ordernumber || body.order_number,
      customer_phone: body.Customer_Phone || body.customer_phone,
      order_date: parsedOrderDate || orderDateRaw,
      status: statusValue,
      status_description: body.Status_Description || body.status_description,
      payment_term: body.Payment_Term || body.payment_term,
      sales_person: body.User_Name || body.user_name || body.sales_person,
      transaction_type: body.Transaction_Type || body.transaction_type,
      media: body.Media || body.media,
      profit_center: body.Profit_Center || body.profit_center,
      company: body.Company || body.company,
      customer_ip: body.Customer_IP || body.customer_ip,
      device_fingerprint: body.Device_Fingerprint || body.device_fingerprint,
      transaction_location: body.Transaction_Location || body.transaction_location,
      register_user_id: body.Register_User_ID || body.register_user_id,
      player_id: body.Player_ID || body.player_id,
      is_point: body.point !== undefined ? body.point : (body.is_point ?? false),
      point_value: body.Point_Value || body.point_value,
      // Set created_at to current KSA time for new records
      created_at: getKSATimestamp(),
    };

    // Remove undefined values
    Object.keys(insertData).forEach(key => {
      if (insertData[key] === undefined) {
        delete insertData[key];
      }
    });

    // Use upsert with order_number as the conflict key
    const { data: insertedData, error: insertError } = await supabase
      .from(tableName)
      .upsert(insertData, { 
        onConflict: 'order_number',
        ignoreDuplicates: false 
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('Error inserting sales header:', insertError);
      responseStatus = 500;
      responseMessage = `Failed to insert sales header: ${insertError.message}`;
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

    console.log('Sales header inserted successfully:', insertedData);
    
    responseMessage = `Sales header created/updated successfully (${apiMode} mode)`;
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
    console.error('Error in api-salesheader:', error);
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
