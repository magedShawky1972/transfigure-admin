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

    // First, check if customer exists using PUT request
    const checkUrl = `https://purplecard-staging-24752844.dev.odoo.com/api/partners/${customerPhone}`;
    console.log('Checking if customer exists:', checkUrl);

    try {
      const checkResponse = await fetch(checkUrl, {
        method: 'PUT',
        headers: {
          'Authorization': odooApiKey,
          'Content-Type': 'application/json',
        },
      });

      const checkText = await checkResponse.text();
      console.log('Check response status:', checkResponse.status);
      console.log('Check response:', checkText);

      let checkData;
      try {
        checkData = JSON.parse(checkText);
      } catch (e) {
        checkData = null;
      }

      // If customer exists, return the existing IDs
      if (checkResponse.ok && checkData?.success === true) {
        console.log('Customer already exists, using existing IDs');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: checkData.message || 'Customer already exists in Odoo',
            partner_profile_id: checkData.partner_profile_id,
            res_partner_id: checkData.res_partner_id,
            data: checkData 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (checkError) {
      console.log('Customer does not exist or check failed, proceeding with creation:', checkError);
    }

    // Customer doesn't exist, proceed with creation
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

    console.log('Creating new customer in Odoo:', odooRequestBody);

    // Call Odoo API to create customer
    const odooResponse = await fetch(odooUrl, {
      method: 'POST',
      headers: {
        'Authorization': odooApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(odooRequestBody),
    });

    const responseText = await odooResponse.text();
    console.log('Odoo creation response status:', odooResponse.status);
    console.log('Odoo creation response:', responseText);

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
