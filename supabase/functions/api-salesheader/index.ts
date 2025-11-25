import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing API key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify API key and permissions
    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .single();

    if (keyError || !apiKey || !apiKey.allow_sales_header) {
      return new Response(JSON.stringify({ error: 'Invalid API key or permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Insert sales order header
    const { data, error } = await supabase
      .from('sales_order_header')
      .insert({
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
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting sales order header:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-salesheader:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
