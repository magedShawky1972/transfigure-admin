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

    const { brandName, paymentType, cursorId } = await req.json();

    if (!brandName || !paymentType) {
      return new Response(
        JSON.stringify({ error: 'brandName and paymentType are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Starting bank fee update for ${paymentType}:${brandName}...`);

    // Get payment method config
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('payment_type, payment_method, gateway_fee, fixed_value, vat_fee')
      .eq('is_active', true)
      .ilike('payment_type', paymentType)
      .ilike('payment_method', brandName)
      .single();

    if (pmError || !paymentMethods) {
      console.error('Payment method not found:', pmError);
      return new Response(
        JSON.stringify({ error: 'Payment method configuration not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log(`Found payment method config:`, paymentMethods);

    // Count total transactions to update
    const { count, error: countError } = await supabase
      .from('ordertotals')
      .select('*', { count: 'exact', head: true })
      .ilike('payment_brand', brandName)
      .ilike('payment_method', paymentType)
      .neq('payment_method', 'point');

    if (countError) {
      console.error('Error counting orders:', countError);
      throw countError;
    }

    console.log(`Total orders to update: ${count || 0}`);

    let updatedCount = 0;
    const batchSize = 500;
    const maxBatches = 20; // Limit to 10,000 records per execution
    let processedBatches = 0;
    let lastId: string | null = null;

    // Process in batches
    while (processedBatches < maxBatches) {
      let baseQuery = supabase
        .from('ordertotals')
        .select('id, payment_method, payment_brand, total')
        .ilike('payment_brand', brandName)
        .ilike('payment_method', paymentType)
        .neq('payment_method', 'point')
        .order('id', { ascending: false })
        .limit(batchSize);

      if (cursorId) baseQuery = baseQuery.lt('id', cursorId);
      if (lastId) baseQuery = baseQuery.lt('id', lastId);

      const { data: orders, error: txError } = await baseQuery;

      if (txError) {
        console.error('Error fetching orders:', txError);
        throw txError;
      }

      if (!orders || orders.length === 0) {
        console.log('No more orders to process');
        break;
      }

      const updates = orders.map(order => {
        const totalNum = Number(order.total) || 0;
        const gatewayPct = Number(paymentMethods.gateway_fee) || 0;
        const fixed = Number(paymentMethods.fixed_value) || 0;

        // Calculate: ((total * percentage/100) + fixed_fee) * 1.15 for VAT
        const gatewayFee = (totalNum * gatewayPct) / 100;
        const bankFee = (gatewayFee + fixed) * 1.15;

        return {
          id: order.id,
          bank_fee: bankFee
        };
      });

      // Update batch
      const { error: updateError } = await supabase
        .from('ordertotals')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error('Error updating batch:', updateError);
      } else {
        updatedCount += updates.length;
        console.log(`Updated ${updatedCount} orders so far...`);
      }

      // advance cursor
      lastId = orders[orders.length - 1].id;

      processedBatches++;

      // If we've hit the max batches, inform that more updates are needed
      if (processedBatches >= maxBatches && orders.length === batchSize) {
        console.log(`Reached batch limit. ${(count || 0) - updatedCount} orders remaining.`);
        break;
      }
    }

    let remainingCount = 0;
    const nextCursor = lastId || cursorId || null;
    if (nextCursor) {
      const { count: remCount, error: remError } = await supabase
        .from('ordertotals')
        .select('*', { count: 'exact', head: true })
        .ilike('payment_brand', brandName)
        .ilike('payment_method', paymentType)
        .neq('payment_method', 'point')
        .lt('id', nextCursor);
      if (remError) {
        console.error('Error counting remaining orders:', remError);
      }
      remainingCount = remCount || 0;
    } else {
      remainingCount = (count || 0) - updatedCount;
    }
    const needsMoreRuns = remainingCount > 0;

    console.log(`Bank fee update completed. Updated ${updatedCount} orders.`);
    if (needsMoreRuns) {
      console.log(`${remainingCount} orders still need updating. Continue with nextCursor=${nextCursor}.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: needsMoreRuns
          ? `Updated ${updatedCount} orders. ${remainingCount} remaining - run again.`
          : `Successfully updated bank fees for ${updatedCount} orders`,
        updatedCount,
        remainingCount,
        needsMoreRuns,
        nextCursor,
        paymentType,
        brandName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-ordertotals-bank-fees-by-pair:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
