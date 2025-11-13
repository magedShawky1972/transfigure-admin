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
    const { customerPhone, customerName, email, customerGroup, status, isBlocked, blockReason } = await req.json();

    console.log('Syncing customer to Odoo:', { customerPhone, customerName });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Odoo configuration from database
    const { data: config, error: configError } = await supabase
      .from('odoo_api_config')
      .select('customer_api_url, api_key')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !config) {
      console.error('Error fetching Odoo config:', configError);
      throw new Error('Odoo API configuration not found. Please configure it in the admin panel.');
    }

    const odooUrl = config.customer_api_url;
    const odooApiKey = config.api_key;

    if (!odooUrl || !odooApiKey) {
      throw new Error('Odoo credentials not properly configured');
    }

    // Prepare Odoo request body
    const odooRequestBody = {
      partner_type: "customer",
      phone: customerPhone,
      name: customerName,
      email: email || "",
      customer_group: customerGroup || "",
      status: status === "active" ? "active" : "suspended",
      is_blocked: isBlocked ? true : false,
      block_reason: blockReason || "",
    };

    console.log('Sending to Odoo:', odooRequestBody);

    // Call Odoo API (ODOO_URL should include the full endpoint path)
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
        message: odooData.message || 'Customer synced to Odoo successfully',
        partner_profile_id: odooData.partner_profile_id,
        res_partner_id: odooData.res_partner_id,
        data: odooData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing customer to Odoo:', error);
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
