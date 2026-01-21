import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JobParams {
  jobId: string;
  fromDateInt?: number;
  toDateInt?: number;
}

async function checkForceKill(supabase: any, jobId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bank_ledger_update_jobs')
    .select('force_kill, status')
    .eq('id', jobId)
    .single();
  
  return data?.force_kill === true || data?.status === 'cancelled';
}

async function runBackgroundJob(params: JobParams) {
  const { jobId, fromDateInt, toDateInt } = params;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[Job ${jobId}] Starting background job for payment reference update`);

  try {
    // Update job status to running
    await supabase
      .from('bank_ledger_update_jobs')
      .update({ 
        status: 'running', 
        started_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    // Build query to count total records
    let countQuery = supabase
      .from('order_payment')
      .select('*', { count: 'exact', head: true })
      .not('paymentrefrence', 'is', null)
      .not('ordernumber', 'is', null);

    if (fromDateInt) {
      countQuery = countQuery.gte('created_at_int', fromDateInt);
    }
    if (toDateInt) {
      countQuery = countQuery.lte('created_at_int', toDateInt);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new Error(`Count error: ${countError.message}`);
    }

    const totalRecords = count || 0;
    console.log(`[Job ${jobId}] Total records to process: ${totalRecords}`);

    if (totalRecords === 0) {
      await supabase
        .from('bank_ledger_update_jobs')
        .update({
          status: 'completed',
          total_records: 0,
          processed_records: 0,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      return;
    }

    // Update total records count
    await supabase
      .from('bank_ledger_update_jobs')
      .update({ total_records: totalRecords })
      .eq('id', jobId);

    const batchSize = 500;
    let offset = 0;
    let processedRecords = 0;
    let updatedRecords = 0;
    let errorRecords = 0;

    while (offset < totalRecords) {
      // Check for force kill
      if (await checkForceKill(supabase, jobId)) {
        console.log(`[Job ${jobId}] Force kill detected, stopping job`);
        await supabase
          .from('bank_ledger_update_jobs')
          .update({
            status: 'cancelled',
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);
        return;
      }

      // Fetch batch
      let batchQuery = supabase
        .from('order_payment')
        .select('ordernumber, paymentrefrence')
        .not('paymentrefrence', 'is', null)
        .not('ordernumber', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (fromDateInt) {
        batchQuery = batchQuery.gte('created_at_int', fromDateInt);
      }
      if (toDateInt) {
        batchQuery = batchQuery.lte('created_at_int', toDateInt);
      }

      const { data: orderPayments, error: fetchError } = await batchQuery;

      if (fetchError) {
        console.error(`[Job ${jobId}] Fetch error at offset ${offset}:`, fetchError);
        errorRecords += batchSize;
        offset += batchSize;
        continue;
      }

      if (!orderPayments || orderPayments.length === 0) {
        break;
      }

      // Process each record in batch
      for (const op of orderPayments) {
        const { error: updateError } = await supabase
          .from('bank_ledger')
          .update({ paymentrefrence: op.paymentrefrence })
          .eq('reference_number', op.ordernumber);

        if (updateError) {
          console.error(`[Job ${jobId}] Update error for order ${op.ordernumber}:`, updateError.message);
          errorRecords++;
        } else {
          updatedRecords++;
        }
        processedRecords++;
      }

      // Update progress
      await supabase
        .from('bank_ledger_update_jobs')
        .update({
          processed_records: processedRecords,
          updated_records: updatedRecords,
          error_records: errorRecords
        })
        .eq('id', jobId);

      console.log(`[Job ${jobId}] Progress: ${processedRecords}/${totalRecords}`);
      offset += batchSize;
    }

    // Mark job as completed
    await supabase
      .from('bank_ledger_update_jobs')
      .update({
        status: 'completed',
        processed_records: processedRecords,
        updated_records: updatedRecords,
        error_records: errorRecords,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    console.log(`[Job ${jobId}] Completed. Updated: ${updatedRecords}, Errors: ${errorRecords}`);

  } catch (error) {
    console.error(`[Job ${jobId}] Fatal error:`, error);
    await supabase
      .from('bank_ledger_update_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, jobId, fromDateInt, toDateInt, userId } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'start') {
      // Create job record
      const { data: job, error: createError } = await supabase
        .from('bank_ledger_update_jobs')
        .insert({
          job_type: 'payment_reference',
          status: 'pending',
          from_date_int: fromDateInt || null,
          to_date_int: toDateInt || null,
          created_by: userId
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create job: ${createError.message}`);
      }

      console.log(`Created job ${job.id}, starting background processing`);

      // Start background processing using waitUntil
      EdgeRuntime.waitUntil(runBackgroundJob({
        jobId: job.id,
        fromDateInt,
        toDateInt
      }));

      return new Response(
        JSON.stringify({ success: true, jobId: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cancel') {
      // Set force_kill flag
      const { error } = await supabase
        .from('bank_ledger_update_jobs')
        .update({ force_kill: true, status: 'cancelled' })
        .eq('id', jobId);

      if (error) {
        throw new Error(`Failed to cancel job: ${error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'status') {
      const { data: job, error } = await supabase
        .from('bank_ledger_update_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        throw new Error(`Failed to get job status: ${error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, job }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
