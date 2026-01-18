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
    const { batchSize = 1000, cursorId } = await req.json().catch(() => ({}));
    
    console.log(`Starting bank ledger history migration, batchSize=${batchSize}, cursorId=${cursorId || 'none'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment methods with bank_id
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('payment_method, gateway_fee, fixed_value, bank_id')
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

    const paymentMethodMap = new Map(
      paymentMethods.map(pm => [pm.payment_method?.toLowerCase(), pm])
    );

    // Get payment brands that have bank associations
    const paymentBrands = paymentMethods.map(pm => pm.payment_method).filter(Boolean);
    console.log(`Found ${paymentMethods.length} payment methods with bank_id:`, paymentBrands);

    // Build query for transactions
    let query = supabase
      .from('purpletransaction')
      .select('id, order_number, total, bank_fee, payment_method, payment_brand, created_at_date')
      .neq('payment_method', 'point')
      .order('id', { ascending: true })
      .limit(batchSize);

    if (cursorId) {
      query = query.gt('id', cursorId);
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transactions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transactions || transactions.length === 0) {
      console.log('No more transactions to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Migration complete - no more transactions',
          processed: 0,
          hasMore: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${transactions.length} transactions`);

    // Group by order_number to avoid duplicates (same logic as load-excel-data)
    const orderMap = new Map<string, any>();
    
    for (const tx of transactions) {
      if (!tx.order_number) continue;
      
      const paymentBrand = (tx.payment_brand || '').toLowerCase();
      const pm = paymentMethodMap.get(paymentBrand);
      
      if (!pm || !pm.bank_id) continue;
      
      if (!orderMap.has(tx.order_number)) {
        orderMap.set(tx.order_number, {
          order_number: tx.order_number,
          total: 0,
          bank_fee: 0,
          bank_id: pm.bank_id,
          payment_brand: tx.payment_brand,
          entry_date: tx.created_at_date
        });
      }
      
      const order = orderMap.get(tx.order_number);
      order.total += Number(tx.total) || 0;
      
      // Calculate bank fee if not already set
      const total = Number(tx.total) || 0;
      const gatewayFee = (total * (pm.gateway_fee || 0)) / 100;
      const fixed = pm.fixed_value || 0;
      order.bank_fee += (gatewayFee + fixed) * 1.15;
      
      // Keep earliest date
      if (tx.created_at_date && (!order.entry_date || tx.created_at_date < order.entry_date)) {
        order.entry_date = tx.created_at_date;
      }
    }

    console.log(`Grouped into ${orderMap.size} unique orders`);

    // Check which orders already have ledger entries (avoid duplicates)
    const orderNumbers = Array.from(orderMap.keys());
    
    const { data: existingEntries } = await supabase
      .from('bank_ledger')
      .select('reference_number')
      .eq('reference_type', 'sales_in')
      .in('reference_number', orderNumbers);

    const existingOrderNumbers = new Set((existingEntries || []).map(e => e.reference_number));
    console.log(`Found ${existingOrderNumbers.size} orders already in ledger`);

    // Prepare ledger entries for new orders only
    const bankLedgerEntries: any[] = [];
    let skippedCount = 0;

    for (const [orderNumber, order] of orderMap.entries()) {
      if (existingOrderNumbers.has(orderNumber)) {
        skippedCount++;
        continue;
      }

      // Sales In entry
      bankLedgerEntries.push({
        bank_id: order.bank_id,
        entry_date: order.entry_date || new Date().toISOString(),
        reference_type: 'sales_in',
        reference_number: order.order_number,
        description: `Sales In - ${order.order_number}`,
        in_amount: order.total,
        out_amount: 0,
        balance_after: 0 // Will be calculated separately if needed
      });

      // Bank Fee entry (if applicable)
      if (order.bank_fee > 0) {
        bankLedgerEntries.push({
          bank_id: order.bank_id,
          entry_date: order.entry_date || new Date().toISOString(),
          reference_type: 'bank_fee',
          reference_number: order.order_number,
          description: `Bank Fee - ${order.payment_brand}`,
          in_amount: 0,
          out_amount: order.bank_fee,
          balance_after: 0
        });
      }
    }

    console.log(`Inserting ${bankLedgerEntries.length} ledger entries (skipped ${skippedCount} existing)`);

    // Insert in batches of 500
    let insertedCount = 0;
    const insertBatchSize = 500;
    
    for (let i = 0; i < bankLedgerEntries.length; i += insertBatchSize) {
      const batch = bankLedgerEntries.slice(i, i + insertBatchSize);
      const { error: insertError } = await supabase
        .from('bank_ledger')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting batch ${Math.floor(i / insertBatchSize) + 1}:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    const lastId = transactions[transactions.length - 1]?.id;
    const hasMore = transactions.length === batchSize;

    console.log(`Batch complete: inserted ${insertedCount} entries, lastId=${lastId}, hasMore=${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: transactions.length,
        ordersProcessed: orderMap.size,
        entriesInserted: insertedCount,
        skipped: skippedCount,
        lastId,
        hasMore,
        message: hasMore 
          ? `Processed ${transactions.length} transactions. Call again with cursorId="${lastId}" to continue.`
          : 'Migration batch complete'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in migration:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
