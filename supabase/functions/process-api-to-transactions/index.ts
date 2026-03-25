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

    // 1. Fetch unprocessed headers from Mar 11, 2025 onwards
    let headerQuery = supabase
      .from('sales_order_header')
      .select('*')
      .eq('is_processed', false)
      .gte('order_date', '2025-03-11T00:00:00');

    if (singleOrderNumber) {
      headerQuery = headerQuery.eq('order_number', singleOrderNumber);
    }

    const { data: headers, error: headerError } = await headerQuery.limit(100);

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

    // 2. Fetch all related lines and payments in batch
    const { data: allLines } = await supabase
      .from('sales_order_line')
      .select('*')
      .in('order_number', orderNumbers);

    const { data: allPayments } = await supabase
      .from('payment_transactions')
      .select('*')
      .in('order_number', orderNumbers);

    // 3. Fetch all customers for phone lookup
    const customerPhones = [...new Set(headers.map((h: any) => h.customer_phone).filter(Boolean))];
    const { data: customers } = customerPhones.length > 0
      ? await supabase.from('customers').select('customer_phone, customer_name').in('customer_phone', customerPhones)
      : { data: [] };

    const customerMap: Record<string, string> = {};
    (customers || []).forEach((c: any) => {
      customerMap[c.customer_phone] = c.customer_name;
    });

    // 4. Fetch all products for SKU lookup
    const allSkus = [...new Set((allLines || []).map((l: any) => l.product_sku).filter(Boolean))];
    const { data: products } = allSkus.length > 0
      ? await supabase.from('products').select('product_id, sku, product_name, brand_name, brand_code').in('sku', allSkus)
      : { data: [] };

    // Also try looking up by product_id if sku doesn't match
    const allProductIds = [...new Set((allLines || []).map((l: any) => String(l.product_id)).filter(Boolean))];
    const { data: productsByPid } = allProductIds.length > 0
      ? await supabase.from('products').select('product_id, sku, product_name, brand_name, brand_code').in('product_id', allProductIds)
      : { data: [] };

    const productMapBySku: Record<string, any> = {};
    (products || []).forEach((p: any) => { productMapBySku[p.sku] = p; });
    const productMapById: Record<string, any> = {};
    (productsByPid || []).forEach((p: any) => { productMapById[p.product_id] = p; });

    // 4b. Fetch brands with default supplier for vendor_name lookup
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

    // 5. Fetch payment methods for bank fee calc
    const { data: paymentMethods } = await supabase
      .from('payment_methods')
      .select('payment_method, payment_type, gateway_fee, fixed_value, is_active')
      .eq('is_active', true);

    const pmMap: Record<string, any> = {};
    (paymentMethods || []).forEach((pm: any) => {
      const key = `${(pm.payment_type || '').toLowerCase()}|${(pm.payment_method || '').toLowerCase()}`;
      pmMap[key] = pm;
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

    let processedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

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

        // Calculate bank fee using payment_methods table
        // payment_method from API maps to both payment_method and payment_type in purpletransaction
        // In payment_methods table: payment_type = type category, payment_method = brand
        const pmKey = `${paymentMethod.toLowerCase()}|${paymentBrand.toLowerCase()}`;
        const pm = pmMap[pmKey];

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
            // Fee = (total * gateway_fee/100 + fixed_value) * 1.15 (with VAT)
            lineBankFee = ((lineTotal * gatewayFee / 100) + fixedValue) * 1.15;
          }

          orderTotal += lineTotal;
          orderCostSold += lineCostSold;

          // Generate a unique ordernumber for the unique constraint
          // Format: order_number-line_number
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
            payment_type: paymentMethod || null, // same as payment_method
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

        // Upsert purpletransaction rows (conflict on ordernumber unique index)
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
        if (pm && paymentMethod.toLowerCase() !== 'point') {
          const gatewayFee = Number(pm.gateway_fee) || 0;
          const fixedValue = Number(pm.fixed_value) || 0;
          orderBankFee = ((orderTotal * gatewayFee / 100) + fixedValue) * 1.15;
        }

        // Upsert ordertotals (unique on order_number)
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

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      total_headers: headers.length,
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
