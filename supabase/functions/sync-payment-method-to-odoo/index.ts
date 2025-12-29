import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      payment_method_id,
      payment_type,
      payment_method,
      gateway_fee,
      fixed_value,
      vat_fee,
      is_active
    } = await req.json();

    console.log('Syncing payment method to Odoo:', { payment_method_id, payment_type, payment_method });

    if (!payment_type || !payment_method) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment type and payment method are required' }),
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
    const isProductionMode = (odooConfig as any).is_production_mode !== false;
    const paymentMethodApiUrl = isProductionMode 
      ? (odooConfig as any).payment_method_api_url 
      : (odooConfig as any).payment_method_api_url_test;
    const odooApiKey = isProductionMode ? odooConfig.api_key : (odooConfig as any).api_key_test;

    console.log('Using environment:', isProductionMode ? 'Production' : 'Test');

    if (!paymentMethodApiUrl) {
      return new Response(
        JSON.stringify({ success: false, error: `Payment Method API URL not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build request body for payment method - use field names expected by Odoo API
    const requestBody: any = {
      payment_type: payment_type,
      payment_brand: payment_method, // Odoo expects payment_brand, not payment_method
      gateway_fee: gateway_fee ?? 0,
      fixed_value: fixed_value ?? 0,
      vat_fee: vat_fee ?? 0,
      is_active: is_active !== false
    };

    // Create unique identifier for payment method (combination of type and method)
    const paymentMethodCode = `${payment_type}-${payment_method}`.toLowerCase().replace(/\s+/g, '_');

    // Try PUT first to update existing payment method
    console.log('Trying PUT to update payment method:', `${paymentMethodApiUrl}/${paymentMethodCode}`);
    console.log('PUT body:', requestBody);

    const putResponse = await fetch(`${paymentMethodApiUrl}/${paymentMethodCode}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': odooApiKey,
      },
      body: JSON.stringify(requestBody),
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

    // If PUT succeeded, payment method was updated
    if (putResult.success) {
      console.log('Payment method updated in Odoo:', putResult);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment method updated in Odoo',
          odoo_response: putResult 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PUT failed because payment method doesn't exist (404 or specific error message)
    const isNotFound = putResponse.status === 404 || 
      (putResult.error && (
        putResult.error.toLowerCase().includes('not found') ||
        putResult.error.toLowerCase().includes('does not exist')
      ));

    if (isNotFound) {
      // Payment method doesn't exist, try POST to create
      console.log('Payment method not found, creating with POST:', paymentMethodApiUrl);
      
      // Add code for creation
      const postBody = {
        ...requestBody,
        code: paymentMethodCode
      };

      console.log('POST body:', postBody);

      const postResponse = await fetch(paymentMethodApiUrl, {
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
        // Payment method created successfully
        console.log('Payment method created in Odoo:', postResult);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Payment method created in Odoo',
            odoo_response: postResult 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST also failed
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: postResult.message || postResult.error || 'Failed to create payment method in Odoo',
          odoo_response: postResult 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT failed for another reason (not "not found")
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: putResult.message || putResult.error || 'Failed to sync payment method to Odoo',
        odoo_response: putResult 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-payment-method-to-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
