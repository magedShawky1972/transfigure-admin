import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 1000, cursorId, maxBatches = 50 } = await req.json().catch(() => ({}));
    
    console.log(`Starting bank ledger history migration from ordertotals, batchSize=${batchSize}, cursorId=${cursorId || 'none'}, maxBatches=${maxBatches}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment methods with bank_id
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('payment_method, payment_type, gateway_fee, fixed_value, bank_id')
      .eq('is_active', true)
      .not('bank_id', 'is', null);

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch payment methods' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No payment methods with bank_id found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create lookup map: payment_brand (lowercase) -> payment method config
    const paymentMethodMap = new Map(
      paymentMethods.map(pm => [pm.payment_method?.toLowerCase(), pm])
    );

    console.log(`Found ${paymentMethods.length} payment methods with bank_id`);

    // Get SAR currency ID
    const { data: sarCurrency } = await supabase
      .from('currencies')
      .select('id')
      .eq('currency_code', 'SAR')
      .single();

    const sarCurrencyId = sarCurrency?.id;

    // Get existing order numbers in bank_ledger to avoid duplicates (one-time fetch)
    const { data: existingEntries } = await supabase
      .from('bank_ledger')
      .select('reference_number')
      .eq('reference_type', 'sales_in');

    const existingOrderNumbers = new Set(
      (existingEntries || []).map(e => e.reference_number)
    );

    console.log(`Found ${existingOrderNumbers.size} existing entries in bank_ledger`);

    let totalProcessed = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    let lastId = cursorId;
    let batchCount = 0;
    let hasMore = true;

    while (batchCount < maxBatches && hasMore) {
      // Build query for ordertotals
      let query = supabase
        .from('ordertotals')
        .select('id, order_number, order_date, total, bank_fee, payment_brand, payment_type')
        .not('payment_brand', 'is', null)
        .order('id', { ascending: true })
        .limit(batchSize);

      if (lastId) {
        query = query.gt('id', lastId);
      }

      const { data: orders, error: ordersError } = await query;

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }

      if (!orders || orders.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing batch ${batchCount + 1}: ${orders.length} orders`);

      // Prepare ledger entries
      const bankLedgerEntries: any[] = [];
      let batchSkipped = 0;

      for (const order of orders) {
        // Skip if already processed
        if (existingOrderNumbers.has(order.order_number)) {
          batchSkipped++;
          totalSkipped++;
          continue;
        }

        // Get bank_id from payment_brand
        const pm = paymentMethodMap.get(order.payment_brand?.toLowerCase());
        
        if (!pm || !pm.bank_id) {
          console.log(`No bank mapping for payment_brand: ${order.payment_brand}`);
          batchSkipped++;
          totalSkipped++;
          continue;
        }

        // Sales In entry
        bankLedgerEntries.push({
          bank_id: pm.bank_id,
          entry_date: order.order_date || new Date().toISOString(),
          reference_type: 'sales_in',
          reference_number: order.order_number,
          description: `Sales In - ${order.order_number}`,
          in_amount: order.total || 0,
          out_amount: 0,
          balance_after: 0,
          currency_id: sarCurrencyId
        });

        // Bank Fee entry - use existing bank_fee or calculate
        const bankFee = order.bank_fee || 0;
        if (bankFee > 0) {
          bankLedgerEntries.push({
            bank_id: pm.bank_id,
            entry_date: order.order_date || new Date().toISOString(),
            reference_type: 'bank_fee',
            reference_number: order.order_number,
            description: `Bank Fee - ${order.payment_brand}`,
            in_amount: 0,
            out_amount: bankFee,
            balance_after: 0,
            currency_id: sarCurrencyId
          });
        }

        // Add to existing set to prevent duplicates within same run
        existingOrderNumbers.add(order.order_number);
      }

      // Insert batch in chunks of 500
      if (bankLedgerEntries.length > 0) {
        const insertBatchSize = 500;
        for (let i = 0; i < bankLedgerEntries.length; i += insertBatchSize) {
          const batch = bankLedgerEntries.slice(i, i + insertBatchSize);
          const { error: insertError } = await supabase
            .from('bank_ledger')
            .insert(batch);

          if (insertError) {
            console.error(`Error inserting batch chunk:`, insertError);
          } else {
            totalInserted += batch.length;
          }
        }
      }

      totalProcessed += orders.length;
      lastId = orders[orders.length - 1].id;
      batchCount++;
      hasMore = orders.length === batchSize;

      console.log(`Batch ${batchCount} complete. Inserted: ${bankLedgerEntries.length}, Skipped: ${batchSkipped}, Total processed: ${totalProcessed}`);
    }

    // Check remaining records
    let remainingCount = 0;
    if (hasMore && lastId) {
      const { count } = await supabase
        .from('ordertotals')
        .select('*', { count: 'exact', head: true })
        .not('payment_brand', 'is', null)
        .gt('id', lastId);
      remainingCount = count || 0;
    }

    const response = {
      success: true,
      processed: totalProcessed,
      inserted: totalInserted,
      skipped: totalSkipped,
      lastCursorId: lastId,
      hasMore: hasMore,
      remainingRecords: remainingCount,
      message: hasMore 
        ? `Processed ${totalProcessed} orders. Call again with cursorId="${lastId}" to continue. ${remainingCount} remaining.`
        : `Migration complete. Processed ${totalProcessed} orders, inserted ${totalInserted} ledger entries.`
    };

    console.log('Migration batch complete:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
