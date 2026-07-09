import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { invoice, payment } = await req.json();
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
      .select('api_key, one_step_combined_transaction_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings?.one_step_combined_transaction_url || !settings?.api_key) {
      return new Response(JSON.stringify({ success: false, error: 'Sajel ERP One-Step Combined Transaction URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve bankCode dynamically from Payment Methods Bank Linking
    // Match payment.paymentType or payment.paymentMethod against payment_methods.(payment_type|payment_method),
    // then read banks.bank_code via bank_id.
    let resolvedPayment = payment;
    if (payment) {
      try {
        const keys = [payment.paymentType, payment.paymentMethod]
          .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
          .map((v: string) => v.trim());
        if (keys.length) {
          const { data: pms } = await supabase
            .from('payment_methods')
            .select('payment_type, payment_method, bank_id, banks:bank_id (bank_code)')
            .or(
              keys
                .flatMap((k) => [`payment_type.ilike.${k}`, `payment_method.ilike.${k}`])
                .join(',')
            );
          const match = (pms || []).find((r: any) => r?.banks?.bank_code);
          const bankCode = (match as any)?.banks?.bank_code;
          if (bankCode) {
            resolvedPayment = { ...payment, bankCode };
          }
        }
      } catch (lookupErr) {
        console.warn('bank_code lookup failed:', lookupErr);
      }
    }

    // Ensure costCenterCode appears before the lines array in the invoice payload
    const invoiceForSajel: Record<string, unknown> = { ...invoice };
    if (invoiceForSajel.lines !== undefined) {
      const { lines, ...rest } = invoiceForSajel;
      Object.assign(invoiceForSajel, { ...rest, costCenterCode: "P10", lines });
    } else {
      invoiceForSajel.costCenterCode = "P10";
    }

    // Preserve Sajel-required attribute order: invoice first, then payment
    const body: Record<string, unknown> = { invoice: invoiceForSajel };
    if (resolvedPayment) body.payment = resolvedPayment;
    console.log('Posting to Sajel ERP One-Step:', settings.one_step_combined_transaction_url, JSON.stringify(body));

    const resp = await fetch(settings.one_step_combined_transaction_url, {
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
    console.log('Sajel response:', resp.status, respText);

    if (!resp.ok) {
      return new Response(JSON.stringify({ success: false, error: respJson?.error || respJson?.message || respText || `HTTP ${resp.status}`, response: respJson, sent: body }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, response: respJson, sent: body }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('sync-order-to-sajel error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
