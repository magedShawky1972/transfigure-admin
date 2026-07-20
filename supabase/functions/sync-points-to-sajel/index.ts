import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Posts a Points-day payload to Sajel: Stock Issue (Class A) or AP Invoice (non-A).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { type, payload } = await req.json();
    if (!type || !payload) {
      return new Response(JSON.stringify({ success: false, error: 'type and payload required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: sErr } = await supabase
      .from('sajel_erp_settings')
      .select('api_key, stock_issue_api_url, stock_movement_api_url, ap_invoice_api_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;

    let url: string | null | undefined;
    if (type === 'stock_issue') {
      // Points stock issues are sent via the "Stock Issue API URL (Points)" setting.
      url = (settings as any)?.stock_issue_api_url || (settings as any)?.stock_movement_api_url;
    } else if (type === 'ap_invoice') url = (settings as any)?.ap_invoice_api_url;
    else {
      return new Response(JSON.stringify({ success: false, error: `Unknown type: ${type}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!url || !settings?.api_key) {
      return new Response(JSON.stringify({ success: false, error: `${type} URL or API Key not configured in Sajel ERP Setup` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Posting ${type} to Sajel:`, url, JSON.stringify(payload));

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': settings.api_key },
      body: JSON.stringify(payload),
    });

    const respText = await resp.text();
    let respJson: any;
    try { respJson = JSON.parse(respText); } catch { respJson = { raw: respText }; }
    console.log(`Sajel ${type} response:`, resp.status, respText);

    if (!resp.ok) {
      return new Response(JSON.stringify({ success: false, error: respJson?.error || respJson?.message || respText || `HTTP ${resp.status}`, response: respJson, sent: payload }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, response: respJson, sent: payload }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('sync-points-to-sajel error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
