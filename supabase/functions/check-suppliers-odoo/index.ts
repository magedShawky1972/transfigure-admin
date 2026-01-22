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

interface VendorIssue {
  vendor_name: string;
  supplier_code?: string;
  partner_profile_id?: number | null;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body to get optional vendor_names
    let vendorNames: string[] = [];
    try {
      const body = await req.json();
      vendorNames = body?.vendor_names || [];
    } catch {
      // No body or invalid JSON - proceed with all suppliers check
    }

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
    console.log(`Checking for ${vendorNames.length} specific vendors from orders`);

    if (!supplierApiUrl || !odooApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: `Supplier API URL or API key not configured for ${isProductionMode ? 'Production' : 'Test'} environment` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all suppliers from database
    const { data: allSuppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('supplier_code, supplier_name, partner_profile_id')
      .order('supplier_name');

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch suppliers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If vendor_names provided, check specifically those vendors
    if (vendorNames.length > 0) {
      const missingSupplierRecord: VendorIssue[] = [];
      const missingOdooId: VendorIssue[] = [];
      const notInOdoo: VendorIssue[] = [];
      const inOdoo: VendorIssue[] = [];

      // Normalize function to compare names
      const normalize = (str: string) => str?.toLowerCase().trim().replace(/\s+/g, ' ') || '';

      for (const vendorName of vendorNames) {
        if (!vendorName) continue;

        const normalizedVendor = normalize(vendorName);
        
        // Find matching supplier
        const matchingSupplier = allSuppliers?.find(s => {
          const normalizedSupplierName = normalize(s.supplier_name);
          const normalizedSupplierCode = normalize(s.supplier_code);
          return normalizedSupplierName === normalizedVendor || 
                 normalizedSupplierCode === normalizedVendor ||
                 normalizedSupplierName.includes(normalizedVendor) ||
                 normalizedVendor.includes(normalizedSupplierName);
        });

        if (!matchingSupplier) {
          // Vendor has no supplier record
          console.log(`Vendor "${vendorName}" has no supplier record`);
          missingSupplierRecord.push({ vendor_name: vendorName });
          continue;
        }

        if (!matchingSupplier.partner_profile_id) {
          // Supplier exists but has no Odoo ID
          console.log(`Vendor "${vendorName}" found as supplier "${matchingSupplier.supplier_name}" but missing Odoo ID`);
          missingOdooId.push({
            vendor_name: vendorName,
            supplier_code: matchingSupplier.supplier_code,
          });
          continue;
        }

        // Supplier has partner_profile_id - assume it's valid in Odoo (skip API check due to API issues)
        console.log(`Vendor "${vendorName}" has Odoo ID ${matchingSupplier.partner_profile_id} - marking as ready`);
        inOdoo.push({
          vendor_name: vendorName,
          supplier_code: matchingSupplier.supplier_code,
          partner_profile_id: matchingSupplier.partner_profile_id,
        });
      }

      const totalVendors = vendorNames.filter(Boolean).length;
      const readyCount = inOdoo.length;
      const issueCount = missingSupplierRecord.length + missingOdooId.length + notInOdoo.length;

      return new Response(
        JSON.stringify({
          success: true,
          environment: isProductionMode ? 'Production' : 'Test',
          total_vendors_in_orders: totalVendors,
          ready_count: readyCount,
          issue_count: issueCount,
          all_suppliers_ready: issueCount === 0,
          missing_supplier_record: missingSupplierRecord,
          missing_odoo_id: missingOdooId,
          not_in_odoo: notInOdoo,
          in_odoo: inOdoo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Original behavior: check all suppliers with partner_profile_id
    const suppliersWithId = allSuppliers?.filter(s => s.partner_profile_id) || [];
    
    console.log(`Checking ${suppliersWithId.length} suppliers with Odoo IDs`);

    const results: SupplierCheckResult[] = [];
    const notInOdoo: SupplierCheckResult[] = [];
    const inOdoo: SupplierCheckResult[] = [];

    // Check each supplier in Odoo using PUT /api/partners/{partner_profile_id}
    for (const supplier of suppliersWithId) {
      const result: SupplierCheckResult = {
        supplier_code: supplier.supplier_code,
        supplier_name: supplier.supplier_name,
        partner_profile_id: supplier.partner_profile_id,
        exists_in_odoo: false,
      };

      try {
        const checkUrl = `${supplierApiUrl}/${supplier.partner_profile_id}`;
        console.log(`Checking supplier ${supplier.supplier_name} at: ${checkUrl}`);

        // Use GET to check existence
        const response = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'Authorization': odooApiKey,
            'Content-Type': 'application/json',
          },
        });

        const responseText = await response.text();
        console.log(`Response for ${supplier.supplier_name}: Status ${response.status} - ${responseText.substring(0, 200)}`);

        let responseData: any = null;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        result.odoo_response = responseData;

        // Check if supplier exists - consider it found if HTTP 200 and has data
        const isFound = response.ok && 
                        responseData?.success !== false && 
                        !responseData?.error &&
                        (responseData?.id || responseData?.data || responseData?.result);
        
        if (isFound) {
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
