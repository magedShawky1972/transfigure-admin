import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { paymentId } = await req.json();
    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'paymentId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: settings, error: sErr } = await supabase
      .from('sajel_erp_settings')
      .select('api_key, payment_api_url')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings?.payment_api_url || !settings?.api_key) {
      return new Response(JSON.stringify({ error: 'Sajel ERP Payment API URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: payment, error: pErr } = await supabase
      .from('supplier_advance_payments')
      .select('*, suppliers(supplier_code, supplier_name), currencies(currency_code), banks(bank_code, bank_name)')
      .eq('id', paymentId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentDate: string = payment.payment_date;
    const [yyyy, mm] = paymentDate.split('-');
    const periodCode = `${mm}/${yyyy}`;

    const body = {
      vendorCode: (payment as any).suppliers?.supplier_code ?? '',
      paymentDate,
      amount: Number(payment.transaction_amount),
      paymentMethod: 'BANK_TRANSFER',
      bankCode: (payment as any).banks?.bank_code ?? '',
      currencyCode: (payment as any).currencies?.currency_code ?? '',
      exchangeRate: Number(payment.exchange_rate),
      referenceNo: payment.ref_number ?? payment.id,
      periodCode,
      businessUnitCode: 'Asus-Trading',
      status: 'POSTED',
    };

    console.log('Posting to Sajel ERP:', settings.payment_api_url, body);

    const resp = await fetch(settings.payment_api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': settings.api_key,
      },
      body: JSON.stringify(body),
    });

    const respText = await resp.text();
    let respJson: any = null;
    try { respJson = JSON.parse(respText); } catch { /* keep text */ }

    if (!resp.ok) {
      console.error(`Sajel ERP payment failed [${resp.status}]:`, respText);
      return new Response(JSON.stringify({
        error: 'Sajel ERP request failed', status: resp.status, details: respJson ?? respText, sent: body,
      }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, sent: body, response: respJson ?? respText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('post-sajel-payment error:', e);
    return new Response(JSON.stringify({ error: e.message ?? 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
