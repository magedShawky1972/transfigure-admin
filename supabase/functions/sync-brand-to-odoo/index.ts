import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, brand_code, brand_name, debug } = await req.json();

    console.log('Syncing brand as product to Odoo:', { brand_id, brand_code, brand_name });

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

    // Fetch brand details
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*, brand_type:brand_type_id(type_code)')
      .eq('id', brand_id)
      .maybeSingle();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ success: false, error: 'Brand not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: odooConfig, error: configError } = await supabase
      .from('odoo_api_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !odooConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Odoo API configuration not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isProductionMode = odooConfig.is_production_mode !== false;
    const productApiUrl = isProductionMode ? odooConfig.product_api_url : odooConfig.product_api_url_test;
    const odooApiKey = isProductionMode ? odooConfig.api_key : odooConfig.api_key_test;

    if (!productApiUrl || !odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `Product API URL/key not configured for ${isProductionMode ? 'Production' : 'Test'}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compute reorder_point: (Safety + Daily × Lead) / 4
    const safety = Number(brand.safety_stock) || 0;
    const daily = Number(brand.average_consumption_per_day) || 0;
    const lead = Number(brand.leadtime) || 0;
    const reorderPoint = (safety + daily * lead) / 4;

    const isNonStock = (brand.abc_analysis || '').toUpperCase() !== 'A';
    const catCode = brand.brand_type?.type_code || '';
    const costPrice = Number(brand.usd_value_for_coins) || 0;
    const salesPrice = Number(brand.sales_usd_value_for_coins) || 0;

    const productPayload = {
      sku: brand_code,
      name: brand_name,
      uom: 'Units',
      cat_code: catCode,
      reorder_point: reorderPoint,
      minimum_order: 1,
      maximum_order: 999999999,
      cost_price: costPrice,
      sales_price: salesPrice,
      product_weight: 0,
      is_non_stock: isNonStock,
    };

    console.log('Product payload:', productPayload);

    if (debug) {
      return new Response(
        JSON.stringify({
          success: true,
          debug: true,
          put_url: `${productApiUrl}/${brand_code}`,
          post_url: productApiUrl,
          method_priority: ['PUT', 'POST'],
          headers: { 'Content-Type': 'application/json', 'Authorization': '***hidden***' },
          body: productPayload,
          environment: isProductionMode ? 'Production' : 'Test',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT first to update if exists
    const putResponse = await fetch(`${productApiUrl}/${brand_code}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify(productPayload),
    });

    const putText = await putResponse.text();
    console.log('PUT status:', putResponse.status, 'response:', putText);

    let putResult: any;
    try { putResult = JSON.parse(putText); } catch { putResult = { success: false, error: putText }; }

    if (putResponse.ok && putResult?.success === true && putResult?.product_id) {
      if (brand_id) {
        await supabase.from('brands').update({ odoo_category_id: putResult.product_id }).eq('id', brand_id);
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Brand-product updated in Odoo', odoo_product_id: putResult.product_id, odoo_response: putResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST to create
    const postResponse = await fetch(productApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify(productPayload),
    });

    const postText = await postResponse.text();
    console.log('POST status:', postResponse.status, 'response:', postText);

    let postResult: any;
    try { postResult = JSON.parse(postText); } catch { postResult = { success: false, error: postText }; }

    const newId = postResult?.product_id || postResult?.existing_product_id;
    if (postResponse.ok && newId) {
      if (brand_id) {
        await supabase.from('brands').update({ odoo_category_id: newId }).eq('id', brand_id);
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Brand created as product in Odoo', odoo_product_id: newId, odoo_response: postResult }),
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
