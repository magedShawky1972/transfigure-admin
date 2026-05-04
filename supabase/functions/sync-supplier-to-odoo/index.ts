import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncResult {
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  partner_profile_id?: number | null;
  status: 'created' | 'existing' | 'skipped' | 'error';
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const supplierIds: string[] | undefined = body?.supplier_ids;

    // Load Odoo config
    const { data: config, error: configError } = await supabase
      .from('odoo_api_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !config) {
      throw new Error('Odoo API configuration not found.');
    }

    const isProductionMode = config.is_production_mode !== false;
    const supplierApiUrl = isProductionMode ? config.supplier_api_url : config.supplier_api_url_test;
    const odooApiKey = isProductionMode ? config.api_key : config.api_key_test;

    if (!supplierApiUrl || !odooApiKey) {
      throw new Error(`Supplier API URL or key not configured for ${isProductionMode ? 'Production' : 'Test'}.`);
    }

    // Load suppliers
    let query = supabase.from('suppliers').select('*');
    if (supplierIds && supplierIds.length > 0) {
      query = query.in('id', supplierIds);
    }
    const { data: suppliers, error: supErr } = await query;
    if (supErr) throw supErr;

    const results: SyncResult[] = [];

    for (const s of suppliers || []) {
      const result: SyncResult = {
        supplier_id: s.id,
        supplier_code: s.supplier_code,
        supplier_name: s.supplier_name,
        partner_profile_id: s.partner_profile_id,
        status: 'skipped',
      };

      // Skip if already has partner_profile_id
      if (s.partner_profile_id) {
        result.status = 'existing';
        result.message = 'Already linked to Odoo';
        results.push(result);
        continue;
      }

      try {
        const odooBody = {
          partner_type: 'supplier',
          name: s.supplier_name,
          email: s.supplier_email || '',
          phone: s.supplier_phone || '',
          status: s.status === 'active' ? 'active' : 'suspended',
        };

        const resp = await fetch(supplierApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': odooApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(odooBody),
        });

        const text = await resp.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        const newId = data?.partner_profile_id || data?.existing_partner_profile_id || data?.id;

        if (resp.ok && newId) {
          await supabase
            .from('suppliers')
            .update({ partner_profile_id: newId })
            .eq('id', s.id);
          result.status = data?.existing_partner_profile_id ? 'existing' : 'created';
          result.partner_profile_id = newId;
          result.message = data?.message || data?.error || 'Synced to Odoo';
        } else if (data?.existing_partner_profile_id) {
          await supabase
            .from('suppliers')
            .update({ partner_profile_id: data.existing_partner_profile_id })
            .eq('id', s.id);
          result.status = 'existing';
          result.partner_profile_id = data.existing_partner_profile_id;
          result.message = data?.error || 'Already exists in Odoo';
        } else {
          result.status = 'error';
          result.message = data?.error || data?.message || `HTTP ${resp.status}`;
        }
      } catch (err: any) {
        result.status = 'error';
        result.message = err?.message || 'Network error';
      }

      results.push(result);
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      existing: results.filter(r => r.status === 'existing').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return new Response(
      JSON.stringify({
        success: true,
        environment: isProductionMode ? 'Production' : 'Test',
        summary,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-supplier-to-odoo:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
