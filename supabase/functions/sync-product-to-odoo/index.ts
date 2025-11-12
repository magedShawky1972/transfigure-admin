import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      productId,
      productName, 
      uom, 
      catCode, 
      reorderPoint, 
      minimumOrder, 
      maximumOrder,
      costPrice,
      salesPrice,
      productWeight
    } = await req.json();

    console.log('Syncing product to Odoo:', { productId, productName });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Odoo configuration from database
    const { data: config, error: configError } = await supabase
      .from('odoo_api_config')
      .select('product_api_url, api_key')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !config) {
      console.error('Error fetching Odoo config:', configError);
      throw new Error('Odoo API configuration not found. Please configure it in the admin panel.');
    }

    const odooUrl = config.product_api_url;
    const odooApiKey = config.api_key;

    if (!odooUrl || !odooApiKey) {
      throw new Error('Odoo product API credentials not properly configured');
    }

    // Prepare Odoo request body
    const odooRequestBody: any = {
      sku: productId,
      name: productName,
    };

    // Add optional fields only if they have values
    if (uom) odooRequestBody.uom = uom;
    if (catCode) odooRequestBody.cat_code = catCode;
    if (reorderPoint !== undefined && reorderPoint !== null) odooRequestBody.reorder_point = reorderPoint;
    if (minimumOrder !== undefined && minimumOrder !== null) odooRequestBody.minimum_order = minimumOrder;
    if (maximumOrder !== undefined && maximumOrder !== null) odooRequestBody.maximum_order = maximumOrder;
    if (costPrice !== undefined && costPrice !== null) odooRequestBody.cost_price = costPrice;
    if (salesPrice !== undefined && salesPrice !== null) odooRequestBody.sales_price = salesPrice;
    if (productWeight !== undefined && productWeight !== null) odooRequestBody.product_weight = productWeight;

    console.log('Sending to Odoo:', odooRequestBody);

    // Call Odoo API
    const odooResponse = await fetch(odooUrl, {
      method: 'POST',
      headers: {
        'Authorization': odooApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(odooRequestBody),
    });

    const responseText = await odooResponse.text();
    console.log('Odoo response status:', odooResponse.status);
    console.log('Odoo response:', responseText);

    if (!odooResponse.ok) {
      throw new Error(`Odoo API error: ${odooResponse.status} - ${responseText}`);
    }

    let odooData;
    try {
      odooData = JSON.parse(responseText);
    } catch (e) {
      odooData = { message: responseText };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: odooData.message || 'Product synced to Odoo successfully',
        data: odooData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing product to Odoo:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
