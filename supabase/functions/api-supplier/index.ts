import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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

    if (keyError || !apiKey || !apiKey.allow_supplier) {
      return new Response(JSON.stringify({ error: 'Invalid API key or permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    console.log('Received supplier data:', JSON.stringify(body));

    // Fetch required fields from configuration
    const { data: fieldConfigs, error: configError } = await supabase
      .from('api_field_configs')
      .select('field_name, is_required')
      .eq('api_endpoint', '/api/supplier')
      .eq('is_required', true);

    if (configError) {
      console.error('Error fetching field configs:', configError);
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields based on configuration
    const requiredFields = fieldConfigs.map((config: any) => config.field_name);
    const missingFields = requiredFields.filter((field: string) => !body[field]);
    
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields', 
        missing: missingFields 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert to testsuppliers table (for testing purposes)
    const { data: testData, error: testError } = await supabase
      .from('testsuppliers')
      .upsert({
        supplier_code: body.Supplier_code,
        supplier_name: body.Supplier_name,
        supplier_email: body.Supplier_email,
        supplier_phone: body.Supplier_phone,
        status: body.Status || 1,
      }, {
        onConflict: 'supplier_code'
      })
      .select()
      .single();

    if (testError) {
      console.error('Error upserting to testsuppliers:', testError);
      return new Response(JSON.stringify({ error: testError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully upserted to testsuppliers:', testData);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Supplier saved to testsuppliers table',
      data: testData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-supplier:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
