import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, brand_code, brand_name, status } = await req.json();

    console.log('Syncing brand as product to Odoo:', { brand_id, brand_code, brand_name, status });

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

    const isProductionMode = odooConfig.is_production_mode !== false;
    const productApiUrl = isProductionMode ? odooConfig.product_api_url : odooConfig.product_api_url_test;
    const odooApiKey = isProductionMode ? odooConfig.api_key : odooConfig.api_key_test;

    console.log('Using environment:', isProductionMode ? 'Production' : 'Test');

    if (!productApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Product API URL not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: PUT to check if product (using brand_code as SKU) exists in Odoo
    console.log('Checking if brand-product exists in Odoo via PUT:', `${productApiUrl}/${brand_code}`);

    const putResponse = await fetch(`${productApiUrl}/${brand_code}`, {
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

    let putResult: any;
    try {
      putResult = JSON.parse(putText);
    } catch {
      putResult = { success: false, error: putText };
    }

    if (putResponse.ok && putResult?.success === true && putResult?.product_id) {
      if (brand_id) {
        await supabase
          .from('brands')
          .update({ odoo_category_id: putResult.product_id })
          .eq('id', brand_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Brand-product exists in Odoo (updated)',
          odoo_product_id: putResult.product_id,
          odoo_response: putResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Doesn't exist, create as product via POST
    console.log('Brand-product not found, creating via POST:', productApiUrl);

    const postResponse = await fetch(productApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify({
        sku: brand_code,
        name: brand_name,
        cost_price: 0,
        sales_price: 0,
      }),
    });

    const postText = await postResponse.text();
    console.log('POST response status:', postResponse.status);
    console.log('POST response:', postText);

    let postResult: any;
    try {
      postResult = JSON.parse(postText);
    } catch {
      postResult = { success: false, error: postText };
    }

    if (postResponse.ok && postResult?.product_id) {
      if (brand_id) {
        await supabase
          .from('brands')
          .update({ odoo_category_id: postResult.product_id })
          .eq('id', brand_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Brand created as product in Odoo',
          odoo_product_id: postResult.product_id,
          odoo_response: postResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (postResult?.existing_product_id) {
      if (brand_id) {
        await supabase
          .from('brands')
          .update({ odoo_category_id: postResult.existing_product_id })
          .eq('id', brand_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Brand-product already exists in Odoo',
          odoo_product_id: postResult.existing_product_id,
          odoo_response: postResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: postResult?.error || postResult?.message || putResult?.error || putResult?.message || 'Failed to sync brand-product to Odoo',
        odoo_response: { put: putResult, post: postResult },
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
