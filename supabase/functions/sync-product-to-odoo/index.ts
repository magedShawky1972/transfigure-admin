import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      product_id,
      sku,
      productName, 
      uom, 
      brandCode,
      reorderPoint, 
      minimumOrder, 
      maximumOrder,
      costPrice,
      salesPrice,
      productWeight
    } = await req.json();

    console.log('Syncing product to Odoo:', { product_id, sku, productName, brandCode });

    if (!sku || !productName) {
      return new Response(
        JSON.stringify({ success: false, error: 'SKU and product name are required' }),
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

    if (!odooConfig.product_api_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Product API URL not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const odooApiKey = odooConfig.api_key;
    const productApiUrl = odooConfig.product_api_url;

    // First, try PUT to check if product exists (update existing)
    console.log('Checking if product exists in Odoo with PUT:', `${productApiUrl}/${sku}`);
    
    const putResponse = await fetch(`${productApiUrl}/${sku}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify({
        name: productName,
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

    if (putResult.success) {
      // Product exists and was updated
      console.log('Product updated in Odoo:', putResult);
      
      // Update local product with odoo_product_id
      if (putResult.product_id && product_id) {
        await supabase
          .from('products')
          .update({ 
            odoo_product_id: putResult.product_id,
            odoo_sync_status: 'synced',
            odoo_synced_at: new Date().toISOString()
          })
          .eq('id', product_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Product updated in Odoo',
          odoo_product_id: putResult.product_id,
          odoo_response: putResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If PUT failed (product doesn't exist), try POST to create
    console.log('Product not found, creating with POST:', productApiUrl);
    
    // Build request body with all available fields
    const postBody: any = {
      sku: sku,
      name: productName,
    };

    // Add optional fields if provided
    if (uom) postBody.uom = uom;
    if (brandCode) postBody.cat_code = brandCode;
    if (reorderPoint !== undefined && reorderPoint !== null) postBody.reorder_point = reorderPoint;
    if (minimumOrder !== undefined && minimumOrder !== null) postBody.minimum_order = minimumOrder;
    if (maximumOrder !== undefined && maximumOrder !== null) postBody.maximum_order = maximumOrder;
    if (costPrice !== undefined && costPrice !== null) postBody.cost_price = costPrice;
    if (salesPrice !== undefined && salesPrice !== null) postBody.sales_price = salesPrice;
    if (productWeight !== undefined && productWeight !== null) postBody.product_weight = productWeight;

    console.log('POST body:', postBody);

    const postResponse = await fetch(productApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify(postBody),
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

    if (postResult.success) {
      // Product created successfully
      console.log('Product created in Odoo:', postResult);
      
      // Update local product with odoo_product_id
      if (postResult.product_id && product_id) {
        await supabase
          .from('products')
          .update({ 
            odoo_product_id: postResult.product_id,
            odoo_sync_status: 'synced',
            odoo_synced_at: new Date().toISOString()
          })
          .eq('id', product_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Product created in Odoo',
          odoo_product_id: postResult.product_id,
          odoo_response: postResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Both PUT and POST failed
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: postResult.message || postResult.error || 'Failed to sync product to Odoo',
        odoo_response: postResult 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-product-to-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
