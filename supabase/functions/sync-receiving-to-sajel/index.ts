import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Posts a Receiving Entry (purchase coins) as an AP Invoice to Sijillat/Sajel ERP.
// Generates a fresh batchNumber first, then POSTs the invoice (with optional payment block).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { invoice, payment, batchNumber: providedBatch } = await req.json();
    if (!invoice) {
      return new Response(JSON.stringify({ success: false, error: 'invoice required' }), {
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
      return new Response(JSON.stringify({ success: false, error: 'Sajel ERP AP Invoice API URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Generate batch number (unless caller supplied one)
    let batchNumber: string | undefined = providedBatch;
    let batchInfo: any = null;
    if (!batchNumber) {
      if (!batchUrl) {
        return new Response(JSON.stringify({ success: false, error: 'Generate Batch Number URL not configured in Sajel ERP Setup' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const bResp = await fetch(batchUrl, { method: 'POST', headers: { 'Authorization': apiKey } });
      const bText = await bResp.text();
      let bJson: any; try { bJson = JSON.parse(bText); } catch { bJson = { raw: bText }; }
      batchInfo = { url: batchUrl, status: bResp.status, response: bJson };
      batchNumber = bJson?.data?.batchNumber ?? bJson?.batchNumber;
      if (!bResp.ok || !batchNumber) {
        return new Response(JSON.stringify({ success: false, error: `Failed to generate batch number: ${bText || bResp.status}`, batch: batchInfo }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 2) Build AP Invoice body (flat, per Sijillat REST reference)
    const { lines, ...invoiceRest } = (invoice ?? {}) as Record<string, unknown>;
    const body: Record<string, unknown> = {
      ...invoiceRest,
      batchNumber,
      ...(lines !== undefined ? { lines } : {}),
      ...(payment ? { payment } : {}),
    };

    console.log('Posting AP Invoice to Sajel:', url, JSON.stringify(body));

    const startedAt = Date.now();
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
      body: JSON.stringify(body),
    });
    const respText = await resp.text();
    const durationMs = Date.now() - startedAt;
    let respJson: any; try { respJson = JSON.parse(respText); } catch { respJson = { raw: respText }; }
    console.log('Sajel AP Invoice response:', resp.status, `${durationMs}ms`, respText);

    const ok = resp.ok && respJson?.success !== false;
    return new Response(JSON.stringify({
      success: ok,
      error: ok ? undefined : (respJson?.error || respJson?.message || respText || `HTTP ${resp.status}`),
      response: respJson,
      sent: body,
      batch: batchInfo,
      batchNumber,
      url,
      httpStatus: resp.status,
      durationMs,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('sync-receiving-to-sajel error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
