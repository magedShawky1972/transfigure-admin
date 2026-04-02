import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all active products with SKU
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, sku, product_id, product_name, brand_code, reorder_point, minimum_order_quantity, product_cost, product_price, weight, non_stock')
      .eq('status', 'active')
      .not('sku', 'is', null);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch products' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${products?.length || 0} products to sync`);

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

    if (!productApiUrl || !odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `Product API URL or API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      total: products?.length || 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Process each product with PUT only (no POST)
    for (const product of products || []) {
      const sku = product.sku || product.product_id;
      
      if (!sku || !product.product_name) {
        results.skipped++;
        results.details.push({ sku, status: 'skipped', reason: 'Missing SKU or name' });
        continue;
      }

      try {
        // Build PUT request body
        const putBody: any = {
          name: product.product_name,
          detailed_type: 'consu',
          type: 'consu',
        };

        if (product.reorder_point !== undefined && product.reorder_point !== null) {
          putBody.reorder_point = product.reorder_point;
        }
        if (product.minimum_order_quantity !== undefined && product.minimum_order_quantity !== null) {
          putBody.minimum_order = product.minimum_order_quantity;
        }
        if (product.product_cost) {
          putBody.cost_price = parseFloat(product.product_cost);
        }
        if (product.product_price) {
          putBody.sales_price = parseFloat(product.product_price);
        }
        if (product.weight !== undefined && product.weight !== null) {
          putBody.product_weight = product.weight;
        }
        if (product.non_stock !== undefined && product.non_stock !== null) {
          putBody.is_non_stock = product.non_stock;
        }

        console.log(`PUT ${productApiUrl}/${sku}`, putBody);

        const putResponse = await fetch(`${productApiUrl}/${sku}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': odooApiKey,
          },
          body: JSON.stringify(putBody),
        });

        const putText = await putResponse.text();
        let putResult;
        try {
          putResult = JSON.parse(putText);
        } catch (e) {
          putResult = { success: false, error: putText };
        }

        if (putResult.success) {
          const odooProductId = putResult.product_id || putResult.product_template_id || putResult.product_master_id;
          
          // Update local product with odoo_product_id
          await supabase
            .from('products')
            .update({ 
              odoo_product_id: odooProductId || null,
              odoo_sync_status: 'synced',
              odoo_synced_at: new Date().toISOString()
            })
            .eq('id', product.id);

          results.synced++;
          results.details.push({ sku, status: 'synced', odoo_product_id: odooProductId });
        } else {
          const errText = (putResult?.error || putResult?.message || '').toString();

          // If Odoo rejects existing product template type on PUT, retry PUT without type fields
          if (errText.toLowerCase().includes('product.template.type')) {
            try {
              const retryPutBody: any = {
                name: product.product_name,
              };

              if (product.reorder_point !== undefined && product.reorder_point !== null) {
                retryPutBody.reorder_point = product.reorder_point;
              }
              if (product.minimum_order_quantity !== undefined && product.minimum_order_quantity !== null) {
                retryPutBody.minimum_order = product.minimum_order_quantity;
              }
              if (product.product_cost) {
                retryPutBody.cost_price = parseFloat(product.product_cost);
              }
              if (product.product_price) {
                retryPutBody.sales_price = parseFloat(product.product_price);
              }
              if (product.weight !== undefined && product.weight !== null) {
                retryPutBody.product_weight = product.weight;
              }
              if (product.non_stock !== undefined && product.non_stock !== null) {
                retryPutBody.is_non_stock = product.non_stock;
              }

              console.log(`Retry PUT without type ${productApiUrl}/${sku}`, retryPutBody);

              const retryResponse = await fetch(`${productApiUrl}/${sku}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': odooApiKey,
                },
                body: JSON.stringify(retryPutBody),
              });

              const retryText = await retryResponse.text();
              let retryResult: any;
              try {
                retryResult = JSON.parse(retryText);
              } catch {
                retryResult = { success: false, error: retryText };
              }

              if (retryResult.success) {
                const odooProductId = retryResult.product_id || retryResult.product_template_id || retryResult.product_master_id;
                await supabase
                  .from('products')
                  .update({ 
                    odoo_product_id: odooProductId || null,
                    odoo_sync_status: 'synced',
                    odoo_synced_at: new Date().toISOString()
                  })
                  .eq('id', product.id);

                results.synced++;
                results.details.push({ sku, status: 'synced', odoo_product_id: odooProductId, note: 'retry_put_no_type' });
              } else {
                results.skipped++;
                results.details.push({ sku, status: 'skipped', reason: retryResult.error || retryResult.message || 'Retry PUT failed' });
              }
            } catch (retryErr) {
              results.failed++;
              results.details.push({ sku, status: 'failed', error: retryErr instanceof Error ? retryErr.message : 'Retry PUT error' });
            }
          } else {
            // Product not found in Odoo or other error - skip (PUT only mode)
            results.skipped++;
            results.details.push({ sku, status: 'skipped', reason: putResult.error || 'Not found in Odoo' });
          }
        }
      } catch (error) {
        console.error(`Error syncing product ${sku}:`, error);
        results.failed++;
        results.details.push({ sku, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    console.log('Sync complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${results.synced} products, skipped ${results.skipped}, failed ${results.failed}`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-all-products-to-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
