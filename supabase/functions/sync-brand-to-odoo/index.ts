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

    // Determine which URL and API key to use based on is_production_mode
    const isProductionMode = odooConfig.is_production_mode !== false;
    const brandApiUrl = isProductionMode ? odooConfig.brand_api_url : odooConfig.brand_api_url_test;
    const odooApiKey = isProductionMode ? odooConfig.api_key : odooConfig.api_key_test;

    console.log('Using environment:', isProductionMode ? 'Production' : 'Test');

    if (!brandApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Brand API URL not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, try PUT to update existing category (checks if exists)
    console.log('Trying to update brand in Odoo with PUT:', `${brandApiUrl}/${brand_code}`);
    
    const putResponse = await fetch(`${brandApiUrl}/${brand_code}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify({
        name: brand_name,
      }),
    });

    const putText = await putResponse.text();
    console.log('PUT response status:', putResponse.status);
    console.log('PUT response:', putText);

    let putResult;
    try {
      putResult = JSON.parse(putText);
    } catch (e) {
      putResult = { success: false, error: putText };
    }

    // If PUT succeeded, brand exists and was updated
    if (putResult.success && putResult.category_id) {
      console.log('Brand updated in Odoo:', putResult);
      
      // Update local brand with odoo_category_id
      if (brand_id) {
        const { error: updateError } = await supabase
          .from('brands')
          .update({ odoo_category_id: putResult.category_id })
          .eq('id', brand_id);
        
        if (updateError) {
          console.error('Error updating brand with odoo_category_id:', updateError);
        }
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
        'Authorization': odooApiKey,
      },
      body: JSON.stringify({
        name: brand_name,
        cat_code: brand_code,
        status: status === 'active' ? 'active' : 'suspended',
      }),
    });

    const postText = await postResponse.text();
    console.log('POST response status:', postResponse.status);
    console.log('POST response:', postText);

    let postResult;
    try {
      postResult = JSON.parse(postText);
    } catch (e) {
      postResult = { success: false, error: postText };
    }

    if (postResult.success && postResult.category_id) {
      // Brand created successfully
      console.log('Brand created in Odoo:', postResult);
      
      // Update local brand with odoo_category_id
      if (brand_id) {
        const { error: updateError } = await supabase
          .from('brands')
          .update({ odoo_category_id: postResult.category_id })
          .eq('id', brand_id);
        
        if (updateError) {
          console.error('Error updating brand with odoo_category_id:', updateError);
        }
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

    // POST failed - check if brand already exists (different error response format)
    // Odoo may return existing_category_id when trying to create a duplicate
    if (postResult.existing_category_id) {
      // Update local brand with existing odoo_category_id
      if (brand_id) {
        const { error: updateError } = await supabase
          .from('brands')
          .update({ odoo_category_id: postResult.existing_category_id })
          .eq('id', brand_id);
        
        if (updateError) {
          console.error('Error updating brand with existing odoo_category_id:', updateError);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Brand already exists in Odoo',
          odoo_category_id: postResult.existing_category_id,
          odoo_response: postResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Both PUT and POST failed
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: postResult.message || postResult.error || putResult.message || putResult.error || 'Failed to sync brand to Odoo',
        odoo_response: { put: putResult, post: postResult } 
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
