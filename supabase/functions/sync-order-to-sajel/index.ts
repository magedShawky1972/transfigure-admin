import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Module-level warm caches (per edge instance) to avoid re-fetching settings and
// payment-method → bank lookups on every request. TTL 5 minutes.
const SETTINGS_TTL_MS = 5 * 60 * 1000;
let cachedSettings: { api_key: string; one_step_combined_transaction_url: string } | null = null;
let cachedSettingsAt = 0;
const bankCodeCache = new Map<string, { code: string; at: number }>();
const BANK_TTL_MS = 5 * 60 * 1000;

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

    const now = Date.now();
    let settings = cachedSettings;
    if (!settings || now - cachedSettingsAt > SETTINGS_TTL_MS) {
      const { data, error: sErr } = await supabase
        .from('sajel_erp_settings')
        .select('api_key, one_step_combined_transaction_url')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sErr) throw sErr;
      if (data?.one_step_combined_transaction_url && data?.api_key) {
        settings = data as any;
        cachedSettings = settings;
        cachedSettingsAt = now;
      }
    }
    if (!settings?.one_step_combined_transaction_url || !settings?.api_key) {
      return new Response(JSON.stringify({ success: false, error: 'Sajel ERP One-Step Combined Transaction URL or API Key not configured' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve bankCode dynamically. If the caller already provided a bankCode
    // (e.g. resolved once on the client for a whole batch), trust it and skip
    // the extra DB round trip. Otherwise look it up with a per-instance cache.
    let resolvedPayment = payment;
    if (payment && !payment.bankCode) {
      try {
        const keys = [payment.paymentType, payment.paymentMethod]
          .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
          .map((v: string) => v.trim().toLowerCase());
        if (keys.length) {
          const cacheKey = keys.join('|');
          const cached = bankCodeCache.get(cacheKey);
          let bankCode: string | undefined;
          if (cached && now - cached.at < BANK_TTL_MS) {
            bankCode = cached.code || undefined;
          } else {
            const { data: pms } = await supabase
              .from('payment_methods')
              .select('payment_type, payment_method, bank_id, banks:bank_id (bank_code)')
              .or(
                keys
                  .flatMap((k) => [`payment_type.ilike.${k}`, `payment_method.ilike.${k}`])
                  .join(',')
              );
            const match = (pms || []).find((r: any) => r?.banks?.bank_code);
            bankCode = (match as any)?.banks?.bank_code;
            bankCodeCache.set(cacheKey, { code: bankCode || '', at: now });
          }
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
