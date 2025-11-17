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

    const { brandName, paymentType } = await req.json();

    if (!brandName || !paymentType) {
      return new Response(
        JSON.stringify({ error: 'brandName and paymentType are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Starting PT bank fee update for ${paymentType}:${brandName}...`);

    // Get payment method config
    const { data: method, error: pmError } = await supabase
      .from('payment_methods')
      .select('payment_type, payment_method, gateway_fee, fixed_value, vat_fee')
      .eq('is_active', true)
      .ilike('payment_type', paymentType)
      .ilike('payment_method', brandName)
      .single();

    if (pmError || !method) {
      console.error('Payment method not found:', pmError);
      return new Response(
        JSON.stringify({ error: 'Payment method configuration not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Count total transactions to update
    const { count, error: countError } = await supabase
      .from('purpletransaction')
      .select('*', { count: 'exact', head: true })
      .ilike('payment_brand', brandName)
      .ilike('payment_method', paymentType)
      .neq('payment_method', 'point');

    if (countError) {
      console.error('Error counting transactions:', countError);
      throw countError;
    }

    console.log(`Total transactions to update: ${count || 0}`);

    let updatedCount = 0;
    const batchSize = 1000;
    const maxBatches = 50; // Limit to 50k per invocation
    let processedBatches = 0;
    let lastId: string | null = null;

    while (processedBatches < maxBatches) {
      let query = supabase
        .from('purpletransaction')
        .select('id, payment_method, payment_brand, total')
        .ilike('payment_brand', brandName)
        .ilike('payment_method', paymentType)
        .neq('payment_method', 'point')
        .order('id', { ascending: false })
        .limit(batchSize);

      if (lastId) query = query.lt('id', lastId);

      const { data: txs, error: txError } = await query;
      if (txError) {
        console.error('Error fetching transactions:', txError);
        throw txError;
      }

      if (!txs || txs.length === 0) break;

      const gatewayPct = Number(method.gateway_fee) || 0;
      const fixed = Number(method.fixed_value) || 0;

      const updates = txs.map((tx) => {
        const totalNum = Number(tx.total) || 0;
        const gatewayFee = (totalNum * gatewayPct) / 100;
        const bankFee = (gatewayFee + fixed) * 1.15;
        return { id: tx.id, bank_fee: bankFee };
      });

      const { error: updateError } = await supabase
        .from('purpletransaction')
        .upsert(updates, { onConflict: 'id' });

      if (updateError) {
        console.error('Error updating batch:', updateError);
        throw updateError;
      }

      updatedCount += updates.length;
      lastId = txs[txs.length - 1].id;
      processedBatches++;

      if (processedBatches >= maxBatches && txs.length === batchSize) {
        console.log(`Reached batch limit. ${(count || 0) - updatedCount} transactions remaining.`);
        break;
      }
    }

    const remainingCount = (count || 0) - updatedCount;
    const needsMoreRuns = remainingCount > 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: needsMoreRuns
          ? `Updated ${updatedCount} transactions. ${remainingCount} remaining - please run again.`
          : `Successfully updated bank fees for ${updatedCount} transactions`,
        updatedCount,
        remainingCount,
        needsMoreRuns,
        paymentType,
        brandName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-purpletransaction-bank-fees-by-pair:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
