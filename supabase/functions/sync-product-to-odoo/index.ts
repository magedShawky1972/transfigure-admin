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

    // Look up the brand's odoo_category_id if brandCode is provided
    let odooCategoryId: number | null = null;
    if (brandCode) {
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('odoo_category_id')
        .eq('brand_code', brandCode)
        .maybeSingle();
      
      if (!brandError && brandData?.odoo_category_id) {
        odooCategoryId = brandData.odoo_category_id;
        console.log('Found brand odoo_category_id:', odooCategoryId);
      } else {
        console.log('Brand not synced to Odoo or not found, skipping cat_code');
      }
    }

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

    // Build PUT request body (for updates - do NOT include cat_code, let Odoo keep existing category)
    const putBody: any = {
      name: productName,
    };

    // Add optional fields for update (excluding cat_code)
    if (uom) putBody.uom = uom;
    if (reorderPoint !== undefined && reorderPoint !== null) putBody.reorder_point = reorderPoint;
    if (minimumOrder !== undefined && minimumOrder !== null) putBody.minimum_order = minimumOrder;
    if (maximumOrder !== undefined && maximumOrder !== null) putBody.maximum_order = maximumOrder;
    if (costPrice !== undefined && costPrice !== null) putBody.cost_price = costPrice;
    if (salesPrice !== undefined && salesPrice !== null) putBody.sales_price = salesPrice;
    if (productWeight !== undefined && productWeight !== null) putBody.product_weight = productWeight;

    // Try PUT first to update existing product
    console.log('Trying PUT to update product:', `${productApiUrl}/${sku}`);
    console.log('PUT body:', putBody);

    const putResponse = await fetch(`${productApiUrl}/${sku}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify(putBody),
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

    // If PUT succeeded, product was updated
    if (putResult.success) {
      console.log('Product updated in Odoo:', putResult);
      
      // Update local product with odoo_product_id
      const odooProductId = putResult.product_id || putResult.product_template_id;
      if (product_id) {
        await supabase
          .from('products')
          .update({ 
            odoo_product_id: odooProductId || null,
            odoo_sync_status: 'synced',
            odoo_synced_at: new Date().toISOString()
          })
          .eq('id', product_id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Product updated in Odoo',
          odoo_product_id: odooProductId,
          odoo_response: putResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PUT failed because product doesn't exist (404 or specific error message)
    const isNotFound = putResponse.status === 404 || 
      (putResult.error && (
        putResult.error.toLowerCase().includes('not found') ||
        putResult.error.toLowerCase().includes('does not exist')
      ));

    if (isNotFound) {
      // Product doesn't exist, try POST to create
      console.log('Product not found, creating with POST:', productApiUrl);
      
      // Build POST body (for creation - include cat_code if available)
      const postBody: any = {
        sku: sku,
        name: productName,
      };

      // Add optional fields for creation
      if (uom) postBody.uom = uom;
      if (brandCode) postBody.cat_code = brandCode; // Use brand_code string, not odoo_category_id number
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
        const odooProductId = postResult.product_id || postResult.product_template_id;
        if (product_id) {
          await supabase
            .from('products')
            .update({ 
              odoo_product_id: odooProductId || null,
              odoo_sync_status: 'synced',
              odoo_synced_at: new Date().toISOString()
            })
            .eq('id', product_id);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Product created in Odoo',
            odoo_product_id: odooProductId,
            odoo_response: postResult 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST also failed
      // Update sync status to failed
      if (product_id) {
        await supabase
          .from('products')
          .update({ 
            odoo_sync_status: 'failed',
          })
          .eq('id', product_id);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: postResult.message || postResult.error || 'Failed to create product in Odoo',
          odoo_response: postResult 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT failed for another reason (not "not found")
    // Update sync status to failed
    if (product_id) {
      await supabase
        .from('products')
        .update({ 
          odoo_sync_status: 'failed',
        })
        .eq('id', product_id);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: putResult.message || putResult.error || 'Failed to sync product to Odoo',
        odoo_response: putResult 
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
