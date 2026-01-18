import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function migrates historical HyperPay statement data to bank_ledger
// Linking chain: bank_ledger.reference_number (order_number) -> order_payment.ordernumber -> order_payment.paymentrefrence -> hyberpaystatement.transactionid

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 1000, cursorId, maxBatches = 50 } = await req.json().catch(() => ({}));
    
    console.log(`Starting bank_ledger HyperPay data migration, batchSize=${batchSize}, cursorId=${cursorId || 'none'}, maxBatches=${maxBatches}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get all hyberpaystatement records with transactionid
    let hyperpayQuery = supabase
      .from('hyberpaystatement')
      .select('id, transactionid, transaction_receipt, result, customercountry, riskfrauddescription, clearinginstitutename')
      .not('transactionid', 'is', null)
      .order('id', { ascending: true })
      .limit(batchSize * maxBatches);

    if (cursorId) {
      hyperpayQuery = hyperpayQuery.gt('id', cursorId);
    }

    const { data: hyperpayRecords, error: hyperpayError } = await hyperpayQuery;

    if (hyperpayError) {
      console.error('Error fetching hyberpaystatement:', hyperpayError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch hyberpaystatement records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!hyperpayRecords || hyperpayRecords.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No more hyberpaystatement records to process',
          processed: 0,
          updated: 0,
          hasMore: false
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${hyperpayRecords.length} hyberpaystatement records to process`);

    // Create a map of transactionid -> hyperpay data
    const transactionIdToHyperpay = new Map(
      hyperpayRecords.map(r => [r.transactionid, r])
    );
    const transactionIds = Array.from(transactionIdToHyperpay.keys());

    // Step 2: Find order_payment records where paymentrefrence matches transactionid
    const { data: orderPayments, error: opError } = await supabase
      .from('order_payment')
      .select('ordernumber, paymentrefrence')
      .in('paymentrefrence', transactionIds);

    if (opError) {
      console.error('Error fetching order_payment:', opError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch order_payment records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${orderPayments?.length || 0} matching order_payment records`);

    if (!orderPayments || orderPayments.length === 0) {
      const lastId = hyperpayRecords[hyperpayRecords.length - 1]?.id;
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No matching order_payment records found for this batch',
          processed: hyperpayRecords.length,
          updated: 0,
          lastCursorId: lastId,
          hasMore: hyperpayRecords.length === batchSize * maxBatches
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Create mapping: ordernumber -> hyperpay data
    const orderToHyperpay = new Map<string, any>();
    for (const op of orderPayments) {
      const hyperpayData = transactionIdToHyperpay.get(op.paymentrefrence);
      if (hyperpayData && op.ordernumber) {
        orderToHyperpay.set(op.ordernumber, hyperpayData);
      }
    }

    console.log(`Created mapping for ${orderToHyperpay.size} order numbers`);

    // Step 4: Update bank_ledger entries in batches
    const orderNumbers = Array.from(orderToHyperpay.keys());
    const updateBatchSize = 100;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (let i = 0; i < orderNumbers.length; i += updateBatchSize) {
      const batchOrderNumbers = orderNumbers.slice(i, i + updateBatchSize);
      
      for (const orderNumber of batchOrderNumbers) {
        const hyperpayData = orderToHyperpay.get(orderNumber);
        
        const { error: updateError, count } = await supabase
          .from('bank_ledger')
          .update({
            transactionid: hyperpayData.transactionid,
            result: hyperpayData.result,
            customercountry: hyperpayData.customercountry,
            riskfrauddescription: hyperpayData.riskfrauddescription,
            clearinginstitutename: hyperpayData.clearinginstitutename
          })
          .eq('reference_number', orderNumber);

        if (updateError) {
          console.error(`Error updating bank_ledger for order ${orderNumber}:`, updateError);
          totalErrors++;
        } else {
          totalUpdated++;
        }
      }
      
      console.log(`Processed batch ${Math.floor(i / updateBatchSize) + 1}/${Math.ceil(orderNumbers.length / updateBatchSize)}, updated: ${totalUpdated}, errors: ${totalErrors}`);
    }

    const lastId = hyperpayRecords[hyperpayRecords.length - 1]?.id;
    const hasMore = hyperpayRecords.length === batchSize * maxBatches;

    // Check remaining records
    let remainingCount = 0;
    if (hasMore && lastId) {
      const { count } = await supabase
        .from('hyberpaystatement')
        .select('*', { count: 'exact', head: true })
        .not('transactionid', 'is', null)
        .gt('id', lastId);
      remainingCount = count || 0;
    }

    const response = {
      success: true,
      processed: hyperpayRecords.length,
      matchedOrderPayments: orderPayments.length,
      mappedOrders: orderToHyperpay.size,
      updated: totalUpdated,
      errors: totalErrors,
      lastCursorId: lastId,
      hasMore,
      remainingRecords: remainingCount,
      message: hasMore 
        ? `Processed ${hyperpayRecords.length} records, updated ${totalUpdated} bank_ledger entries. Call again with cursorId="${lastId}" to continue. ${remainingCount} remaining.`
        : `Migration complete. Processed ${hyperpayRecords.length} records, updated ${totalUpdated} bank_ledger entries.`
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
