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
      .select('api_key, payment_api_url, expense_entry_api_url')
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

    let bankCode = (payment as any).banks?.bank_code ?? '';
    if (!bankCode && (payment as any).bank_id) {
      const { data: bankRow } = await supabase
        .from('banks')
        .select('bank_code')
        .eq('id', (payment as any).bank_id)
        .maybeSingle();
      bankCode = bankRow?.bank_code ?? '';
    }

    const paymentDate: string = payment.payment_date;
    const [yyyy, mm] = paymentDate.split('-');
    const periodCode = `${mm}/${yyyy}`;

    const body = {
      vendorCode: (payment as any).suppliers?.supplier_code ?? '',
      paymentDate,
      amount: Number(payment.transaction_amount),
      paymentMethod: 'BANK_TRANSFER',
      bankCode,
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
      const errText = typeof respJson === 'object' && respJson
        ? (respJson.error || respJson.message || JSON.stringify(respJson))
        : String(respText);
      await supabase
        .from('supplier_advance_payments')
        .update({
          sajel_request_body: body,
          sajel_response: respJson ?? { raw: respText },
          sajel_error: `[${resp.status}] ${errText}`,
          sajel_sent_at: new Date().toISOString(),
        } as any)
        .eq('id', paymentId);
      return new Response(JSON.stringify({
        error: 'Sajel ERP request failed', status: resp.status, details: respJson ?? respText, sent: body,
      }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If Bank Transfer Fee exists, post Expense Entry (always in SAR)
    const bankFee = Number((payment as any).bank_fee) || 0;
    let expenseSent: any = null;
    let expenseResponse: any = null;
    if (bankFee > 0 && settings.expense_entry_api_url) {
      const grandTotal = Number(bankFee.toFixed(2));
      const vatPercent = 15;
      const netAmount = Number((grandTotal / (1 + vatPercent / 100)).toFixed(2));
      const vatAmount = Number((grandTotal - netAmount).toFixed(2));
      const expenseBody = {
        table: 'expense_entries',
        action: 'insert',
        data: {
          entry_date: paymentDate,
          payment_method: 'BANK',
          bank_code: bankCode,
          currency_code: 'SAR',
          exchange_rate: 1.0,
          grand_total: grandTotal,
          expense_reference: `BFEE-${payment.ref_number ?? payment.id}`,
          business_unit_code: 'Asus-Trading',
          notes: `Bank transfer fee for payment ${payment.ref_number ?? payment.id}`,
          status: 'POSTED',
          expense_entry_lines: [
            {
              expense_type_code: 'GBC002',
              quantity: 1,
              unit_price: netAmount,
              vat_percent: vatPercent,
              vat_amount: vatAmount,
              line_total: grandTotal,
            },
          ],
        },
      };
      expenseSent = expenseBody;
      console.log('Posting Bank Fee to Sajel ERP Expense Entry:', settings.expense_entry_api_url, expenseBody);
      const eResp = await fetch(settings.expense_entry_api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': settings.api_key,
        },
        body: JSON.stringify(expenseBody),
      });
      const eText = await eResp.text();
      try { expenseResponse = JSON.parse(eText); } catch { expenseResponse = eText; }
      if (!eResp.ok) {
        console.error(`Sajel ERP expense entry failed [${eResp.status}]:`, eText);
        return new Response(JSON.stringify({
          success: true,
          sent: body,
          response: respJson ?? respText,
          expenseError: 'Expense entry request failed',
          expenseStatus: eResp.status,
          expenseSent,
          expenseResponse,
        }), { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    await supabase
      .from('supplier_advance_payments')
      .update({
        sajel_request_body: body,
        sajel_response: respJson ?? { raw: respText },
        sajel_error: null,
        sajel_sent_at: new Date().toISOString(),
      } as any)
      .eq('id', paymentId);

    return new Response(JSON.stringify({
      success: true,
      sent: body,
      response: respJson ?? respText,
      expenseSent,
      expenseResponse,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('post-sajel-payment error:', e);
    return new Response(JSON.stringify({ error: e.message ?? 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
