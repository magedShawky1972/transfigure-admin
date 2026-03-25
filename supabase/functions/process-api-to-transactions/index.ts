import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json().catch(() => ({}));
    const singleOrderNumber = body.order_number || null;

    // 1. Read start_date from api_integration_settings
    let startDate = '2025-03-11';
    const { data: settingsData } = await supabase
      .from('api_integration_settings')
      .select('setting_value')
      .eq('setting_key', 'start_date')
      .maybeSingle();

    if (settingsData?.setting_value) {
      startDate = settingsData.setting_value;
    }
    console.log(`Using start_date: ${startDate}`);

    // 2. Fetch unprocessed headers from start_date onwards
    let headerQuery = supabase
      .from('sales_order_header')
      .select('*')
      .eq('is_processed', false)
      .gte('order_date', `${startDate}T00:00:00`);

    if (singleOrderNumber) {
      headerQuery = headerQuery.eq('order_number', singleOrderNumber);
    }

    const { data: headers, error: headerError } = await headerQuery.order('order_date', { ascending: false }).limit(100);

    if (headerError) {
      console.error('Error fetching headers:', headerError);
      return new Response(JSON.stringify({ error: headerError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!headers || headers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, message: 'No unprocessed orders found', processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderNumbers = headers.map((h: any) => h.order_number);
    console.log(`Processing ${orderNumbers.length} orders:`, orderNumbers);

    // 3. Fetch all related lines and payments in batch
    const { data: allLines } = await supabase
      .from('sales_order_line')
      .select('*')
      .in('order_number', orderNumbers);

    const { data: allPayments } = await supabase
      .from('payment_transactions')
      .select('*')
      .in('order_number', orderNumbers);

    // 4. Fetch all customers for phone lookup
    const customerPhones = [...new Set(headers.map((h: any) => h.customer_phone).filter(Boolean))];
    const { data: customers } = customerPhones.length > 0
      ? await supabase.from('customers').select('customer_phone, customer_name').in('customer_phone', customerPhones)
      : { data: [] };

    const customerMap: Record<string, string> = {};
    (customers || []).forEach((c: any) => {
      customerMap[c.customer_phone] = c.customer_name;
    });

    // 5. Fetch all products for SKU lookup
    const allSkus = [...new Set((allLines || []).map((l: any) => l.product_sku).filter(Boolean))];
    const { data: products } = allSkus.length > 0
      ? await supabase.from('products').select('product_id, sku, product_name, brand_name, brand_code').in('sku', allSkus)
      : { data: [] };

    const allProductIds = [...new Set((allLines || []).map((l: any) => String(l.product_id)).filter(Boolean))];
    const { data: productsByPid } = allProductIds.length > 0
      ? await supabase.from('products').select('product_id, sku, product_name, brand_name, brand_code').in('product_id', allProductIds)
      : { data: [] };

    const productMapBySku: Record<string, any> = {};
    (products || []).forEach((p: any) => { productMapBySku[p.sku] = p; });
    const productMapById: Record<string, any> = {};
    (productsByPid || []).forEach((p: any) => { productMapById[p.product_id] = p; });

    // 5b. Fetch brands with default supplier for vendor_name lookup
    const { data: brandsWithSupplier } = await supabase
      .from('brands')
      .select('brand_code, default_supplier_id, suppliers:default_supplier_id(supplier_name)')
      .not('default_supplier_id', 'is', null);

    const brandVendorMap: Record<string, string> = {};
    (brandsWithSupplier || []).forEach((b: any) => {
      if (b.brand_code && b.suppliers?.supplier_name) {
        brandVendorMap[b.brand_code] = b.suppliers.supplier_name;
      }
    });

    // 6. Fetch payment methods for bank fee calc (including bank_id and vat_fee)
    const { data: paymentMethods } = await supabase
      .from('payment_methods')
      .select('payment_method, payment_type, gateway_fee, fixed_value, vat_fee, bank_id, is_active')
      .eq('is_active', true);

    const pmMap: Record<string, any> = {};
    (paymentMethods || []).forEach((pm: any) => {
      const key = `${(pm.payment_type || '').toLowerCase()}|${(pm.payment_method || '').toLowerCase()}`;
      pmMap[key] = pm;
    });

    // Also build a map by payment_method (brand) only for fallback
    const pmByBrand: Record<string, any> = {};
    (paymentMethods || []).forEach((pm: any) => {
      const brand = (pm.payment_method || '').trim().toLowerCase();
      if (!pmByBrand[brand]) pmByBrand[brand] = pm;
    });

    // Group lines and payments by order_number
    const linesByOrder: Record<string, any[]> = {};
    (allLines || []).forEach((l: any) => {
      if (!linesByOrder[l.order_number]) linesByOrder[l.order_number] = [];
      linesByOrder[l.order_number].push(l);
    });

    const paymentsByOrder: Record<string, any[]> = {};
    (allPayments || []).forEach((p: any) => {
      if (!paymentsByOrder[p.order_number]) paymentsByOrder[p.order_number] = [];
      paymentsByOrder[p.order_number].push(p);
    });

    // 7. Fetch bank balances for bank_ledger processing
    const bankIds = [...new Set((paymentMethods || []).map((pm: any) => pm.bank_id).filter(Boolean))];
    let bankBalanceMap: Map<string, number> = new Map();

    if (bankIds.length > 0) {
      const { data: banks } = await supabase
        .from('banks')
        .select('id, current_balance')
        .in('id', bankIds);

      bankBalanceMap = new Map(
        (banks || []).map((b: any) => [b.id, Number(b.current_balance) || 0])
      );
    }

    let processedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const bankLedgerEntries: any[] = [];

    for (const header of headers) {
      const orderNum = header.order_number;
      const lines = linesByOrder[orderNum];
      const payments = paymentsByOrder[orderNum];

      // Skip if missing lines or payments
      if (!lines || lines.length === 0 || !payments || payments.length === 0) {
        skippedCount++;
        console.log(`Skipping ${orderNum}: missing lines=${!lines}, missing payments=${!payments}`);
        continue;
      }

      try {
        // Customer name lookup
        const customerName = header.customer_phone 
          ? (customerMap[header.customer_phone] || 'Not Defined')
          : 'Not Defined';

        // Use first payment for the order (primary payment)
        const payment = payments[0];
        const paymentMethod = payment.payment_method || '';
        const paymentBrand = payment.payment_brand || '';

        // Find matching payment method config
        const pmKey = `${paymentMethod.toLowerCase()}|${paymentBrand.toLowerCase()}`;
        const pm = pmMap[pmKey] || pmByBrand[paymentBrand.toLowerCase()] || null;
        const vatRate = pm ? (Number(pm.vat_fee) || 15) : 15;

        // Build purpletransaction rows - one per sales line
        const txnRows: any[] = [];
        let orderTotal = 0;
        let orderCostSold = 0;

        for (const line of lines) {
          const sku = line.product_sku || '';
          const pid = String(line.product_id || '');
          const product = productMapBySku[sku] || productMapById[pid] || null;

          const lineTotal = Number(line.total) || 0;
          const lineCostSold = Number(line.total_cost) || 0;
          const lineProfit = lineTotal - lineCostSold;

          // Calculate bank fee per line (proportional)
          let lineBankFee = 0;
          if (pm && paymentMethod.toLowerCase() !== 'point') {
            const gatewayFee = Number(pm.gateway_fee) || 0;
            const fixedValue = Number(pm.fixed_value) || 0;
            lineBankFee = ((lineTotal * gatewayFee / 100) + fixedValue) * (1 + vatRate / 100);
          }

          orderTotal += lineTotal;
          orderCostSold += lineCostSold;

          const ordernumber = `${orderNum}-${line.line_number || 1}`;

          txnRows.push({
            order_number: orderNum,
            ordernumber: ordernumber,
            created_at_date: header.order_date,
            user_name: header.sales_person || null,
            customer_phone: header.customer_phone || null,
            customer_name: customerName,
            customer_ip: header.customer_ip || null,
            device_fingerprint: header.device_fingerprint || null,
            transaction_location: header.transaction_location || null,
            register_user_id: header.register_user_id ? parseInt(header.register_user_id) : null,
            player_id: header.player_id || line.player_id || null,
            brand_name: product?.brand_name || null,
            brand_code: product?.brand_code || null,
            product_name: product?.product_name || null,
            product_id: sku || pid || null,
            coins_number: line.coins_number || null,
            unit_price: line.unit_price || null,
            cost_price: line.cost_price || null,
            qty: line.quantity || null,
            cost_sold: lineCostSold || null,
            total: lineTotal || null,
            profit: lineProfit || null,
            payment_method: paymentMethod || null,
            payment_type: paymentMethod || null,
            payment_brand: paymentBrand || null,
            payment_reference: payment.payment_reference || null,
            payment_card_number: payment.payment_card_number || null,
            bank_fee: lineBankFee || null,
            company: header.company || null,
            status: header.status || null,
            status_description: header.status_description || null,
            is_point: header.is_point || false,
            point_value: header.point_value || null,
            media: header.media || null,
            profit_center: header.profit_center || null,
            payment_term: header.payment_term || null,
            transaction_type: header.transaction_type || null,
            trans_type: 'automatic',
            vendor_name: product?.brand_code ? (brandVendorMap[product.brand_code] || null) : null,
            is_deleted: false,
            is_api_reviewed: false,
          });
        }

        // Upsert purpletransaction rows
        const { error: txnError } = await supabase
          .from('purpletransaction')
          .upsert(txnRows, { onConflict: 'ordernumber', ignoreDuplicates: false })
          .select('id');

        if (txnError) {
          console.error(`Error upserting purpletransaction for ${orderNum}:`, txnError);
          errors.push(`${orderNum}: ${txnError.message}`);
          continue;
        }

        // Calculate order-level bank fee for ordertotals
        let orderBankFee = 0;
        let orderBankId: string | null = null;
        if (pm && paymentMethod.toLowerCase() !== 'point') {
          const gatewayFee = Number(pm.gateway_fee) || 0;
          const fixedValue = Number(pm.fixed_value) || 0;
          orderBankFee = ((orderTotal * gatewayFee / 100) + fixedValue) * (1 + vatRate / 100);
          orderBankId = pm.bank_id || null;
        }

        // Upsert ordertotals
        const { error: otError } = await supabase
          .from('ordertotals')
          .upsert({
            order_number: orderNum,
            total: orderTotal,
            payment_method: paymentMethod || null,
            payment_type: paymentMethod || null,
            payment_brand: paymentBrand || null,
            bank_fee: orderBankFee || null,
            order_date: header.order_date,
          }, { onConflict: 'order_number', ignoreDuplicates: false });

        if (otError) {
          console.error(`Error upserting ordertotals for ${orderNum}:`, otError);
          errors.push(`${orderNum} ordertotals: ${otError.message}`);
        }

        // Create bank_ledger entries (same logic as Excel upload)
        if (orderBankId && paymentMethod.toLowerCase() !== 'point') {
          const currentBalance = bankBalanceMap.get(orderBankId) || 0;

          // Sales In entry
          const balanceAfterSalesIn = currentBalance + orderTotal;
          bankLedgerEntries.push({
            bank_id: orderBankId,
            entry_date: header.order_date || new Date().toISOString(),
            reference_type: 'sales_in',
            reference_number: orderNum,
            description: `Sales In - ${orderNum}`,
            in_amount: orderTotal,
            out_amount: 0,
            balance_after: balanceAfterSalesIn,
          });

          // Bank Fee entry (Out) - only if there's a fee
          if (orderBankFee > 0) {
            const balanceAfterFee = balanceAfterSalesIn - orderBankFee;
            bankLedgerEntries.push({
              bank_id: orderBankId,
              entry_date: header.order_date || new Date().toISOString(),
              reference_type: 'bank_fee',
              reference_number: orderNum,
              description: `Bank Fee - ${paymentBrand || paymentMethod}`,
              in_amount: 0,
              out_amount: orderBankFee,
              balance_after: balanceAfterFee,
            });
            bankBalanceMap.set(orderBankId, balanceAfterFee);
          } else {
            bankBalanceMap.set(orderBankId, balanceAfterSalesIn);
          }
        }

        // Mark header as processed
        await supabase
          .from('sales_order_header')
          .update({ is_processed: true })
          .eq('order_number', orderNum);

        processedCount++;
        console.log(`Processed order ${orderNum}: ${lines.length} lines, total=${orderTotal}`);

      } catch (orderErr) {
        const msg = orderErr instanceof Error ? orderErr.message : String(orderErr);
        console.error(`Error processing ${orderNum}:`, msg);
        errors.push(`${orderNum}: ${msg}`);
      }
    }

    // 8. Insert bank_ledger entries in batches
    if (bankLedgerEntries.length > 0) {
      console.log(`Inserting ${bankLedgerEntries.length} bank ledger entries...`);
      const batchSize = 500;
      for (let i = 0; i < bankLedgerEntries.length; i += batchSize) {
        const batch = bankLedgerEntries.slice(i, i + batchSize);
        const { error: ledgerError } = await supabase
          .from('bank_ledger')
          .insert(batch);

        if (ledgerError) {
          console.error(`Error inserting bank ledger batch ${Math.floor(i / batchSize) + 1}:`, ledgerError);
        }
      }
      console.log(`Successfully inserted ${bankLedgerEntries.length} bank ledger entries`);

      // Update bank current_balance with final balances
      for (const [bankId, finalBalance] of bankBalanceMap.entries()) {
        const { error: updateError } = await supabase
          .from('banks')
          .update({ current_balance: finalBalance })
          .eq('id', bankId);

        if (updateError) {
          console.error(`Error updating bank balance for ${bankId}:`, updateError);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      total_headers: headers.length,
      bank_ledger_entries: bankLedgerEntries.length,
      start_date: startDate,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-api-to-transactions:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});