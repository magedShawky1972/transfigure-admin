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
  offset?: number;
}

async function checkForceKill(supabase: any, jobId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bank_ledger_update_jobs')
    .select('force_kill, status')
    .eq('id', jobId)
    .single();
  
  return data?.force_kill === true || data?.status === 'cancelled';
}

async function selfInvoke(params: JobParams) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/update-bank-ledger-background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'continue',
        ...params
      })
    });
    
    if (!response.ok) {
      console.error(`Self-invoke failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Self-invoke error:', error);
  }
}

async function processChunk(params: JobParams) {
  const { jobId, fromDateInt, toDateInt, offset = 0 } = params;
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[Job ${jobId}] Processing chunk at offset ${offset}`);

  try {
    // Check for force kill first
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

    // Get current job state
    const { data: job } = await supabase
      .from('bank_ledger_update_jobs')
      .select('total_records, processed_records, updated_records, error_records')
      .eq('id', jobId)
      .single();

    if (!job) {
      console.error(`[Job ${jobId}] Job not found`);
      return;
    }

    let { processed_records = 0, updated_records = 0, error_records = 0, total_records = 0 } = job;

    // If this is the first chunk, count total records
    if (offset === 0 && total_records === 0) {
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

      total_records = count || 0;
      console.log(`[Job ${jobId}] Total records to process: ${total_records}`);

      if (total_records === 0) {
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

      await supabase
        .from('bank_ledger_update_jobs')
        .update({ 
          status: 'running',
          started_at: new Date().toISOString(),
          total_records 
        })
        .eq('id', jobId);
    }

    // Process records in this chunk - larger batch for efficiency
    const chunkSize = 2000; // Records per chunk/invocation
    const batchSize = 200;  // Records per database operation
    let chunkProcessed = 0;
    let chunkUpdated = 0;
    let chunkErrors = 0;

    while (chunkProcessed < chunkSize && offset + chunkProcessed < total_records) {
      // Check for force kill periodically
      if (chunkProcessed > 0 && chunkProcessed % 500 === 0) {
        if (await checkForceKill(supabase, jobId)) {
          console.log(`[Job ${jobId}] Force kill detected during processing`);
          await supabase
            .from('bank_ledger_update_jobs')
            .update({
              status: 'cancelled',
              processed_records: processed_records + chunkProcessed,
              updated_records: updated_records + chunkUpdated,
              error_records: error_records + chunkErrors,
              completed_at: new Date().toISOString()
            })
            .eq('id', jobId);
          return;
        }
      }

      // Fetch batch
      let batchQuery = supabase
        .from('order_payment')
        .select('ordernumber, paymentrefrence')
        .not('paymentrefrence', 'is', null)
        .not('ordernumber', 'is', null)
        .range(offset + chunkProcessed, offset + chunkProcessed + batchSize - 1);

      if (fromDateInt) {
        batchQuery = batchQuery.gte('created_at_int', fromDateInt);
      }
      if (toDateInt) {
        batchQuery = batchQuery.lte('created_at_int', toDateInt);
      }

      const { data: orderPayments, error: fetchError } = await batchQuery;

      if (fetchError) {
        console.error(`[Job ${jobId}] Fetch error:`, fetchError);
        chunkErrors += batchSize;
        chunkProcessed += batchSize;
        continue;
      }

      if (!orderPayments || orderPayments.length === 0) {
        break;
      }

      // Process each record in batch - but do parallel updates
      const updatePromises = orderPayments.map(async (op) => {
        const { error: updateError } = await supabase
          .from('bank_ledger')
          .update({ paymentrefrence: op.paymentrefrence })
          .eq('reference_number', op.ordernumber);

        return { success: !updateError, ordernumber: op.ordernumber };
      });

      const results = await Promise.all(updatePromises);
      
      for (const result of results) {
        if (result.success) {
          chunkUpdated++;
        } else {
          chunkErrors++;
        }
      }
      
      chunkProcessed += orderPayments.length;

      // Update progress periodically
      if (chunkProcessed % 500 === 0) {
        await supabase
          .from('bank_ledger_update_jobs')
          .update({
            processed_records: processed_records + chunkProcessed,
            updated_records: updated_records + chunkUpdated,
            error_records: error_records + chunkErrors
          })
          .eq('id', jobId);
        
        console.log(`[Job ${jobId}] Progress: ${processed_records + chunkProcessed}/${total_records}`);
      }
    }

    // Update final progress for this chunk
    const newProcessed = processed_records + chunkProcessed;
    const newUpdated = updated_records + chunkUpdated;
    const newErrors = error_records + chunkErrors;

    await supabase
      .from('bank_ledger_update_jobs')
      .update({
        processed_records: newProcessed,
        updated_records: newUpdated,
        error_records: newErrors
      })
      .eq('id', jobId);

    console.log(`[Job ${jobId}] Chunk done. Progress: ${newProcessed}/${total_records}`);

    // Check if we need to continue
    if (newProcessed < total_records) {
      // Schedule next chunk via self-invocation
      EdgeRuntime.waitUntil(selfInvoke({
        jobId,
        fromDateInt,
        toDateInt,
        offset: offset + chunkProcessed
      }));
    } else {
      // Mark job as completed
      await supabase
        .from('bank_ledger_update_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      console.log(`[Job ${jobId}] Completed. Updated: ${newUpdated}, Errors: ${newErrors}`);
    }

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
    const body = await req.json();
    const { action, jobId, fromDateInt, toDateInt, userId, offset } = body;
    
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

      // Start background processing
      EdgeRuntime.waitUntil(processChunk({
        jobId: job.id,
        fromDateInt,
        toDateInt,
        offset: 0
      }));

      return new Response(
        JSON.stringify({ success: true, jobId: job.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'continue') {
      // Continue processing from where we left off
      console.log(`Continuing job ${jobId} at offset ${offset}`);
      
      EdgeRuntime.waitUntil(processChunk({
        jobId,
        fromDateInt,
        toDateInt,
        offset: offset || 0
      }));

      return new Response(
        JSON.stringify({ success: true }),
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
