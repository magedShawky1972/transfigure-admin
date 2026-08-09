import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Posts payroll as AP Invoices (one per business unit / currency) to Sajel ERP.
// Generates a fresh batchNumber first, then POSTs each invoice.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { journals, invoices } = await req.json();
    const list = Array.isArray(invoices) && invoices.length ? invoices : journals;
    if (!Array.isArray(list) || list.length === 0) {
      return new Response(JSON.stringify({ error: 'invoices array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: sErr } = await supabase
      .from('sajel_erp_settings')
      .select('api_key, ap_invoice_api_url, generate_batch_number_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;

    const apiKey = (settings as any)?.api_key;
    const url = (settings as any)?.ap_invoice_api_url;
    const batchUrl = (settings as any)?.generate_batch_number_url;

    if (!url || !apiKey) {
      return new Response(JSON.stringify({ error: 'Sajel ERP AP Invoice API URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!batchUrl) {
      return new Response(JSON.stringify({ error: 'Generate Batch Number URL not configured in Sajel ERP Setup' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Generate batch number
    const bResp = await fetch(batchUrl, { method: 'POST', headers: { 'Authorization': apiKey } });
    const bText = await bResp.text();
    let bJson: any; try { bJson = JSON.parse(bText); } catch { bJson = { raw: bText }; }
    const batchNumber = bJson?.data?.batchNumber ?? bJson?.batchNumber;
    const batchInfo = { url: batchUrl, status: bResp.status, response: bJson };
    if (!bResp.ok || !batchNumber) {
      return new Response(JSON.stringify({ error: `Failed to generate batch number: ${bText || bResp.status}`, batch: batchInfo }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];
    for (const raw of list) {
      const started = Date.now();
      const { _total, ...invoice } = (raw ?? {}) as Record<string, unknown>;
      const businessUnitCode = (invoice as any)?.businessUnitCode;
      const { lines, ...rest } = invoice as Record<string, unknown>;
      const body = { ...rest, batchNumber, ...(lines !== undefined ? { lines } : {}) };
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
          body: JSON.stringify(body),
        });
        const text = await resp.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch { /* keep text */ }
        const ok = resp.ok && json?.success !== false;
        results.push({
          businessUnitCode: businessUnitCode ?? null,
          ok,
          status: resp.status,
          durationMs: Date.now() - started,
          sent: body,
          response: json ?? text,
          error: ok ? null : (json?.error || json?.message || text || `HTTP ${resp.status}`),
        });
      } catch (e: any) {
        results.push({
          businessUnitCode: businessUnitCode ?? null,
          ok: false,
          status: 0,
          durationMs: Date.now() - started,
          sent: body,
          response: null,
          error: e?.message ?? String(e),
        });
      }
    }

    const failed = results.filter((r) => !r.ok).length;
    return new Response(JSON.stringify({ success: failed === 0, sent: list.length, failed, batchNumber, batch: batchInfo, url, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('post-sajel-payroll error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
