import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface SupplierCheckResult {
  supplier_code: string;
  supplier_name: string;
  partner_profile_id: number | null;
  exists_in_odoo: boolean;
  odoo_response?: any;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Odoo API config
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

    // Determine URLs and API key based on mode
    const isProductionMode = odooConfig.is_production_mode !== false;
    const supplierApiUrl = isProductionMode ? odooConfig.supplier_api_url : odooConfig.supplier_api_url_test;
    const odooApiKey = isProductionMode ? odooConfig.api_key : odooConfig.api_key_test;

    console.log(`Using environment: ${isProductionMode ? 'Production' : 'Test'}`);
    console.log(`Supplier API URL: ${supplierApiUrl}`);

    if (!supplierApiUrl || !odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `Supplier API URL or API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get suppliers with partner_profile_id from database
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('supplier_code, supplier_name, partner_profile_id')
      .not('partner_profile_id', 'is', null)
      .order('supplier_name');

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch suppliers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${suppliers?.length || 0} suppliers with Odoo IDs`);

    const results: SupplierCheckResult[] = [];
    const notInOdoo: SupplierCheckResult[] = [];
    const inOdoo: SupplierCheckResult[] = [];

    // Check each supplier in Odoo using PUT /api/partners/{partner_profile_id}
    for (const supplier of suppliers || []) {
      const result: SupplierCheckResult = {
        supplier_code: supplier.supplier_code,
        supplier_name: supplier.supplier_name,
        partner_profile_id: supplier.partner_profile_id,
        exists_in_odoo: false,
      };

      try {
        const checkUrl = `${supplierApiUrl}/${supplier.partner_profile_id}`;
        console.log(`Checking supplier ${supplier.supplier_name} at: ${checkUrl}`);

        const response = await fetch(checkUrl, {
          method: 'PUT',
          headers: {
            'Authorization': odooApiKey,
            'Content-Type': 'application/json',
          },
        });

        const responseText = await response.text();
        console.log(`Response for ${supplier.supplier_name}: ${response.status} - ${responseText}`);

        let responseData: any = null;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        result.odoo_response = responseData;

        // Check if supplier exists in Odoo
        if (response.ok && responseData?.success !== false && !responseData?.error) {
          result.exists_in_odoo = true;
          inOdoo.push(result);
        } else {
          result.exists_in_odoo = false;
          result.error = responseData?.error || responseData?.message || 'Supplier not found in Odoo';
          notInOdoo.push(result);
        }
      } catch (err: any) {
        console.error(`Error checking supplier ${supplier.supplier_name}:`, err);
        result.exists_in_odoo = false;
        result.error = err.message || 'Network error';
        notInOdoo.push(result);
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({
        success: true,
        environment: isProductionMode ? 'Production' : 'Test',
        total_checked: results.length,
        in_odoo_count: inOdoo.length,
        not_in_odoo_count: notInOdoo.length,
        in_odoo: inOdoo,
        not_in_odoo: notInOdoo,
        all_results: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-suppliers-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
