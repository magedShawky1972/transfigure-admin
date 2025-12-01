import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, brand_code, brand_name, status } = await req.json();

    console.log('Syncing brand to Odoo:', { brand_id, brand_code, brand_name, status });

    if (!brand_code || !brand_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand code and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Odoo API configuration
    const { data: odooConfig, error: configError } = await supabase
      .from('odoo_api_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !odooConfig) {
      console.error('Error fetching Odoo config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Odoo API configuration not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!odooConfig.brand_api_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand API URL not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const odooApiKey = odooConfig.api_key;
    const brandApiUrl = odooConfig.brand_api_url;

    // First, try PUT to check if brand exists (update existing)
    console.log('Checking if brand exists in Odoo with PUT:', `${brandApiUrl}/${brand_code}`);
    
    const putResponse = await fetch(`${brandApiUrl}/${brand_code}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'api-key': odooApiKey,
      },
      body: JSON.stringify({
        name: brand_name,
        cat_code: brand_code,
      }),
    });

    const putResult = await putResponse.json();
    console.log('PUT response:', putResult);

    if (putResult.success) {
      // Brand exists and was updated
      console.log('Brand updated in Odoo:', putResult);
      
      // Update local brand with odoo_category_id
      if (putResult.category_id && brand_id) {
        await supabase
          .from('brands')
          .update({ odoo_category_id: putResult.category_id })
          .eq('id', brand_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Brand updated in Odoo',
          odoo_category_id: putResult.category_id,
          odoo_response: putResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If PUT failed (brand doesn't exist), try POST to create
    console.log('Brand not found, creating with POST:', brandApiUrl);
    
    const postResponse = await fetch(brandApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': odooApiKey,
      },
      body: JSON.stringify({
        name: brand_name,
        cat_code: brand_code,
        status: status === 'active' ? 'active' : 'suspended',
      }),
    });

    const postResult = await postResponse.json();
    console.log('POST response:', postResult);

    if (postResult.success) {
      // Brand created successfully
      console.log('Brand created in Odoo:', postResult);
      
      // Update local brand with odoo_category_id
      if (postResult.category_id && brand_id) {
        await supabase
          .from('brands')
          .update({ odoo_category_id: postResult.category_id })
          .eq('id', brand_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Brand created in Odoo',
          odoo_category_id: postResult.category_id,
          odoo_response: postResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Both PUT and POST failed
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: postResult.message || 'Failed to sync brand to Odoo',
        odoo_response: postResult 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-brand-to-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
