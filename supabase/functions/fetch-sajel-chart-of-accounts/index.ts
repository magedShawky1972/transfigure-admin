import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: sErr } = await supabase
      .from('sajel_erp_settings')
      .select('api_key, chart_of_account_api_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;

    const apiKey = (settings as any)?.api_key;
    const url = (settings as any)?.chart_of_account_api_url;
    if (!url || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Chart Of Account API URL or API Key not configured in Sajel ERP Setup' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resp = await fetch(url, { method: 'GET', headers: { Authorization: apiKey, Accept: 'application/json' } });
    const text = await resp.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `API error ${resp.status}`, response: json, url }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawList: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.data?.items) ? json.data.items
      : Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.result) ? json.result
      : [];

    const accounts = rawList.map((a: any) => {
      const code = a?.accountCode ?? a?.code ?? a?.accountId ?? a?.account_id ?? a?.id ?? '';
      const name = a?.accountName ?? a?.name ?? a?.description ?? a?.accountNameEn ?? '';
      return { code: String(code ?? ''), name: String(name ?? '') };
    }).filter((a) => a.code);

    return new Response(JSON.stringify({ accounts, url, count: accounts.length, raw: accounts.length ? undefined : json }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
