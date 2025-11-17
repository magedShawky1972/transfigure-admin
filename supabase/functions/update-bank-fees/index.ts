import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting bank fee update process...');

    // Get all payment methods with their fees
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('payment_type, payment_method, gateway_fee, fixed_value, vat_fee')
      .eq('is_active', true);

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
      throw pmError;
    }

    console.log(`Found ${paymentMethods?.length || 0} payment methods:`, 
      paymentMethods?.map(pm => `${pm.payment_type}:${pm.payment_method}`));

    // Build a list of payment_brand names to filter only matchable transactions
    const brandNames = (paymentMethods || [])
      .map(pm => (pm.payment_method || '').trim())
      .filter(Boolean);


    // Count total transactions to update
    const { count, error: countError } = await supabase
      .from('purpletransaction')
      .select('*', { count: 'exact', head: true })
      .neq('payment_method', 'point')
      .or('bank_fee.is.null,bank_fee.eq.0')
      .in('payment_brand', brandNames);

    if (countError) {
      console.error('Error counting transactions:', countError);
      throw countError;
    }

    console.log(`Total transactions to update (eligible brands only): ${count || 0}`);

    let updatedCount = 0;
    let matchedCount = 0;
    let unmatchedMethods = new Set();
    const batchSize = 500;
    const maxBatches = 20; // Limit to 10,000 records per execution to avoid timeout
    let processedBatches = 0;

    // Process in batches with pagination to avoid timeout
    while (processedBatches < maxBatches) {
      // Fetch a batch of transactions
      const { data: transactions, error: txError } = await supabase
        .from('purpletransaction')
        .select('id, payment_method, payment_brand, total')
        .neq('payment_method', 'point')
        .or('bank_fee.is.null,bank_fee.eq.0')
        .in('payment_brand', brandNames)
        .order('id', { ascending: true })
        .limit(batchSize);

      if (txError) {
        console.error('Error fetching transactions:', txError);
        throw txError;
      }

      // If no more transactions, we're done
      if (!transactions || transactions.length === 0) {
        console.log('No more transactions to process');
        break;
      }

    const updates = transactions.map(tx => {
        // Match on BOTH payment_method (from tx) and payment_brand (from tx) 
        // against payment_type and payment_method in payment_methods table
        const txMethod = (tx.payment_method || '').trim().toLowerCase();
        const txBrand = (tx.payment_brand || '').trim().toLowerCase();
        
        const paymentMethod = paymentMethods.find(pm => 
          (pm.payment_type || '').trim().toLowerCase() === txMethod &&
          (pm.payment_method || '').trim().toLowerCase() === txBrand
        );

        let bankFee = 0;
        if (paymentMethod && tx.total) {
          const totalNum = Number(tx.total) || 0;
          const gatewayPct = Number(paymentMethod.gateway_fee) || 0;
          const fixed = Number(paymentMethod.fixed_value) || 0;

          // Calculate: ((total * percentage/100) + fixed_fee) * 1.15 for VAT
          const gatewayFee = (totalNum * gatewayPct) / 100;
          bankFee = (gatewayFee + fixed) * 1.15;
          matchedCount++;
        } else {
          const label = `${tx.payment_method}:${tx.payment_brand}`;
          if (label) unmatchedMethods.add(label);
        }

        return {
          id: tx.id,
          bank_fee: bankFee
        };
      });

      // Update batch
      const { error: updateError } = await supabase
        .from('purpletransaction')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error('Error updating batch:', updateError);
      } else {
        updatedCount += updates.length;
        console.log(`Updated ${updatedCount} transactions so far...`);
      }

      processedBatches++;
      
      // If we've hit the max batches, inform that more updates are needed
      if (processedBatches >= maxBatches && transactions.length === batchSize) {
        console.log(`Reached batch limit. ${count! - updatedCount} transactions remaining.`);
        break;
      }
    }

    const remainingCount = (count || 0) - updatedCount;
    const needsMoreRuns = remainingCount > 0;

    console.log(`Bank fee update completed. Updated ${updatedCount} transactions.`);
    console.log(`Matched ${matchedCount} transactions with payment methods.`);
    
    if (unmatchedMethods.size > 0) {
      console.warn(`Unmatched payment methods found:`, Array.from(unmatchedMethods));
    }

    if (needsMoreRuns) {
      console.log(`${remainingCount} transactions still need updating. Run again to continue.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: needsMoreRuns 
          ? `Updated ${updatedCount} transactions. ${remainingCount} remaining - please run again.`
          : `Successfully updated bank fees for ${updatedCount} transactions (${matchedCount} matched)`,
        updatedCount,
        matchedCount,
        remainingCount,
        needsMoreRuns,
        unmatchedMethods: Array.from(unmatchedMethods)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-bank-fees:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
