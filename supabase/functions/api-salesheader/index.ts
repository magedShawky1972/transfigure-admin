import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Table configuration for test vs production mode
const TABLE_CONFIG = {
  test: {
    salesheader: 'testsalesheader',
  },
  production: {
    salesheader: 'purpletransaction',
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

    // Prepare data based on mode
    let upsertData: Record<string, any>;
    
    if (apiMode === 'production') {
      // Map to purpletransaction columns
      upsertData = {
        ordernumber: body.Order_Number,
        customer_phone: body.Customer_Phone,
        created_at: body.Order_date,
        payment_term: body.Payment_Term,
        user_name: body.Sales_person,
        transaction_type: body.Transaction_Type,
        media: body.Media,
        profit_center: body.Profit_Center,
        company: body.Company,
        status: body.Status,
        status_description: body.Status_Description,
        customer_ip: body.Customer_IP,
        device_fingerprint: body.Device_Fingerprint,
        transaction_location: body.Transaction_Location,
        register_user_id: body.Register_User_ID,
        player_id: body.Player_Id,
        is_point: body.Point === 1 || body.Point === '1' || body.Point === true,
        point_value: body.Point_Value !== undefined ? parseFloat(body.Point_Value) : null,
      };
    } else {
      // Map to testsalesheader columns
      upsertData = {
        order_number: body.Order_Number,
        customer_phone: body.Customer_Phone,
        order_date: body.Order_date,
        payment_term: body.Payment_Term,
        sales_person: body.Sales_person,
        transaction_type: body.Transaction_Type,
        media: body.Media,
        profit_center: body.Profit_Center,
        company: body.Company,
        status: body.Status,
        status_description: body.Status_Description,
        customer_ip: body.Customer_IP,
        device_fingerprint: body.Device_Fingerprint,
        transaction_location: body.Transaction_Location,
        register_user_id: body.Register_User_ID,
        player_id: body.Player_Id,
        is_point: body.Point === 1 || body.Point === '1' || body.Point === true,
        point_value: body.Point_Value !== undefined ? parseFloat(body.Point_Value) : null,
      };
    }

    // Upsert to sales header table based on mode
    const conflictColumn = apiMode === 'production' ? 'ordernumber' : 'order_number';
    const { data: resultData, error: upsertError } = await supabase
      .from(tables.salesheader)
      .upsert(upsertData, {
        onConflict: conflictColumn
      })
      .select()
      .single();

    if (upsertError) {
      console.error(`Error upserting to ${tables.salesheader}:`, upsertError);
      responseStatus = 400;
      responseMessage = upsertError.message;
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully upserted to ${tables.salesheader}:`, resultData);
    responseMessage = `Sales header saved to ${tables.salesheader} table (${apiMode} mode)`;
    await logApiCall();

    return new Response(JSON.stringify({ 
      success: true, 
      message: responseMessage,
      mode: apiMode,
      data: resultData 
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
