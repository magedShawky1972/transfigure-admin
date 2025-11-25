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

    if (keyError || !apiKey || !apiKey.allow_customer) {
      return new Response(JSON.stringify({ error: 'Invalid API key or permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Upsert customer (update if exists, insert if not)
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        customer_phone: body.Customer_Phone,
        customer_name: body.Customer_name,
        email: body.Customer_email,
        status: body.Status ? 'active' : 'suspended',
        is_blocked: body.Is_blocked || false,
        block_reason: body.Block_reason,
        creation_date: body.Register_date || new Date().toISOString(),
      }, {
        onConflict: 'customer_phone'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting customer:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-customer:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
