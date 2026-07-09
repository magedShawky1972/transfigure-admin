import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { expense } = await req.json();
    if (!expense) {
      return new Response(JSON.stringify({ success: false, error: 'expense required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: sErr } = await supabase
      .from('sajel_erp_settings')
      .select('api_key, expense_entry_api_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings?.expense_entry_api_url || !settings?.api_key) {
      return new Response(JSON.stringify({ success: false, error: 'Sajel ERP Expense Entry API URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = {
      table: 'expense_entries',
      action: 'insert',
      data: expense,
    };

    console.log('Posting Expense to Sajel:', settings.expense_entry_api_url, JSON.stringify(body));

    const resp = await fetch(settings.expense_entry_api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': settings.api_key,
      },
      body: JSON.stringify(body),
    });

    const respText = await resp.text();
    let respJson: any;
    try { respJson = JSON.parse(respText); } catch { respJson = { raw: respText }; }
    console.log('Sajel expense response:', resp.status, respText);

    if (!resp.ok) {
      return new Response(JSON.stringify({ success: false, error: respJson?.error || respJson?.message || respText || `HTTP ${resp.status}`, response: respJson, sent: body }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, response: respJson, sent: body }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('sync-expense-to-sajel error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
