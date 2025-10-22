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
      .select('payment_method, gateway_fee, fixed_value, vat_fee');

    if (pmError) {
      console.error('Error fetching payment methods:', pmError);
      throw pmError;
    }

    console.log(`Found ${paymentMethods?.length || 0} payment methods`);

    // Get all transactions that need bank_fee calculation
    const { data: transactions, error: txError } = await supabase
      .from('purpletransaction')
      .select('id, payment_method, total');

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw txError;
    }

    console.log(`Processing ${transactions?.length || 0} transactions`);

    let updatedCount = 0;
    const batchSize = 100;

    // Process in batches
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      const updates = batch.map(tx => {
        const paymentMethod = paymentMethods.find(
          pm => pm.payment_method === tx.payment_method
        );

        let bankFee = 0;
        if (paymentMethod && tx.total) {
          const gatewayFee = (tx.total * paymentMethod.gateway_fee) / 100;
          const vatFee = (gatewayFee * paymentMethod.vat_fee) / 100;
          bankFee = gatewayFee + vatFee + paymentMethod.fixed_value;
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
        console.log(`Updated ${updatedCount} / ${transactions.length} transactions`);
      }
    }

    console.log(`Bank fee update completed. Updated ${updatedCount} transactions.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated bank fees for ${updatedCount} transactions`,
        updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in update-bank-fees:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
