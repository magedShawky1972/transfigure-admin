import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { journals } = await req.json();
    if (!Array.isArray(journals) || journals.length === 0) {
      return new Response(JSON.stringify({ error: 'journals array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: sErr } = await supabase
      .from('sajel_erp_settings')
      .select('api_key, payroll_api_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings?.payroll_api_url || !settings?.api_key) {
      return new Response(JSON.stringify({ error: 'Sajel ERP Payroll API URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];
    for (const body of journals) {
      const started = Date.now();
      try {
        const resp = await fetch(settings.payroll_api_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': settings.api_key,
          },
          body: JSON.stringify(body),
        });
        const text = await resp.text();
        let json: any = null;
        try { json = JSON.parse(text); } catch { /* keep text */ }
        results.push({
          businessUnitCode: body?.businessUnitCode ?? null,
          ok: resp.ok,
          status: resp.status,
          durationMs: Date.now() - started,
          sent: body,
          response: json ?? text,
          error: resp.ok ? null : (json?.error || json?.message || text || `HTTP ${resp.status}`),
        });
      } catch (e: any) {
        results.push({
          businessUnitCode: body?.businessUnitCode ?? null,
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
    return new Response(JSON.stringify({ success: failed === 0, sent: journals.length, failed, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('post-sajel-payroll error:', e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
