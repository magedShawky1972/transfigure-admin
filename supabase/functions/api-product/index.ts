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

    if (keyError || !apiKey || !apiKey.allow_product) {
      return new Response(JSON.stringify({ error: 'Invalid API key or permission denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();

    // Upsert product
    const { data, error } = await supabase
      .from('products')
      .upsert({
        product_id: body.Product_id?.toString(),
        sku: body.SKU,
        product_name: body.Name,
        brand_code: body.Brand_Code,
        reorder_point: body.Reorder_Point,
        minimum_order_quantity: body.Minimum_order,
        maximum_order_quantity: body.Maximum_order,
        product_cost: body.Cost_price?.toString(),
        product_price: body.Sales_Price?.toString(),
        meta_title_ar: body.AR_Meta_Title,
        meta_keywords_ar: body.AR_Meta_Keywords,
        meta_description_ar: body.AR_Meta_Description,
        meta_title_en: body.ENG_Meta_Title,
        meta_keywords_en: body.ENG_Meta_Keywords,
        meta_description_en: body.ENG_Meta_Description,
      }, {
        onConflict: 'sku'
      })
      .select()
      .single();

    if (error) {
      console.error('Error upserting product:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in api-product:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
