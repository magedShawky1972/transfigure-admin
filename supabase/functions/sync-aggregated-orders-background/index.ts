import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ProductLine {
  productSku: string;
  productName: string;
  unitPrice: number;
  totalQty: number;
  totalAmount: number;
}

interface AggregatedInvoice {
  orderNumber: string;
  date: string;
  brandName: string;
  paymentMethod: string;
  paymentBrand: string;
  userName: string;
  productLines: ProductLine[];
  grandTotal: number;
  originalOrderNumbers: string[];
  brandCode: string;
  company: string;
  hasNonStock: boolean;
}

interface BackgroundSyncRequest {
  jobId: string;
  fromDate: string;
  toDate: string;
  userId: string;
  userEmail: string;
  userName: string;
  resumeFrom?: number;
  selectedOrderNumbers?: string[];
  aggregatedInvoices?: AggregatedInvoice[];
}

interface InvoiceSyncResult {
  invoice: AggregatedInvoice;
  success: boolean;
  errorMessage: string;
  stepStatus: Record<string, string>;
}

// Helper to send email via existing SMTP function
async function sendCompletionEmail(
  supabase: any,
  userEmail: string,
  userName: string,
  fromDate: string,
  toDate: string,
  successful: number,
  failed: number,
  skipped: number,
  total: number,
  duration: string
) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_password, mail_type_id')
      .eq('email', userEmail)
      .single();

    if (!profile?.email_password || !profile?.mail_type_id) {
      console.log('User email not configured, skipping email notification');
      return false;
    }

    const { data: mailType } = await supabase
      .from('mail_types')
      .select('*')
      .eq('id', profile.mail_type_id)
      .single();

    if (!mailType) {
      console.log('Mail type not found, skipping email notification');
      return false;
    }

    const { SMTPClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts');

    const client = new SMTPClient({
      connection: {
        hostname: mailType.smtp_host,
        port: mailType.smtp_port,
        tls: mailType.smtp_secure,
        auth: {
          username: userEmail,
          password: profile.email_password,
        },
      },
    });

    const statusEmoji = failed > 0 ? '⚠️' : '✅';
    const subject = `${statusEmoji} Aggregated Odoo Sync Complete - ${fromDate} to ${toDate}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
          Aggregated Odoo Sync Completed
        </h2>
        
        <p>Hello ${userName},</p>
        
        <p>Your background aggregated Odoo sync job has completed.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Date Range:</td>
              <td style="padding: 8px 0; font-weight: bold;">${fromDate} to ${toDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Total Aggregated Invoices:</td>
              <td style="padding: 8px 0; font-weight: bold;">${total}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Successful:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #22c55e;">${successful}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Failed:</td>
              <td style="padding: 8px 0; font-weight: bold; color: ${failed > 0 ? '#ef4444' : '#666'};">${failed}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Skipped (already synced):</td>
              <td style="padding: 8px 0; font-weight: bold;">${skipped}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Duration:</td>
              <td style="padding: 8px 0; font-weight: bold;">${duration}</td>
            </tr>
          </table>
        </div>
        
        ${
          failed > 0
            ? `
          <p style="color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 8px;">
            ⚠️ Some invoices failed to sync. Please check the sync history in the application for details.
          </p>
        `
            : ''
        }
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated email from your Odoo Sync System.
        </p>
      </div>
    `;

    await client.send({
      from: `Odoo Sync <${userEmail}>`,
      to: [userEmail],
      subject,
      html: htmlBody,
    });

    await client.close();
    console.log('Completion email sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending completion email:', error);
    return false;
  }
}

function formatDuration(startTime: Date, endTime: Date): string {
  const totalSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

async function executeStep(
  stepId: string,
  transactions: any[],
  nonStockProducts: any[],
  supabaseUrl: string,
  supabaseKey: string,
  timeoutMs: number = 30_000
): Promise<{ success: boolean; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-order-to-odoo-step`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step: stepId, transactions, nonStockProducts }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({} as any));

    if (data?.skipped) {
      return { success: true };
    }

    if (data?.success) {
      return { success: true };
    }

    const errorMessage =
      typeof data?.error === 'object' && data?.error?.error
        ? data.error.error
        : data?.error || data?.message || `Step ${stepId} failed`;

    return { success: false, error: errorMessage };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { success: false, error: `Step ${stepId} timed out after ${Math.round(timeoutMs / 1000)}s` };
    }
    return { success: false, error: error?.message || 'Network error' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Process a single invoice and return result
async function processSingleInvoice(
  invoice: AggregatedInvoice,
  nonStockSet: Set<string>,
  supabaseUrl: string,
  supabaseKey: string
): Promise<InvoiceSyncResult> {
  const stepStatus: Record<string, string> = {
    customer: 'skipped',
    brand: 'skipped',
    product: 'skipped',
    order: 'pending',
    purchase: 'pending',
  };

  let errorMessage = '';

  try {
    // Build synthetic transactions for the edge function
    const syntheticTransactions = invoice.productLines.map((pl) => ({
      order_number: invoice.orderNumber,
      customer_name: 'Cash Customer',
      customer_phone: '0000',
      brand_code: invoice.brandCode,
      brand_name: invoice.brandName,
      product_id: pl.productSku,
      sku: pl.productSku,
      product_name: pl.productName,
      unit_price: pl.unitPrice,
      total: pl.totalAmount,
      qty: pl.totalQty,
      created_at_date: invoice.date,
      payment_method: invoice.paymentMethod,
      payment_brand: invoice.paymentBrand,
      user_name: invoice.userName,
      company: invoice.company,
    }));

    const nonStockTx = syntheticTransactions.filter((tx: any) => {
      const sku = tx.sku || tx.product_id;
      return sku && nonStockSet.has(sku);
    });

    // Skip customer, brand, product checks - go directly to order
    const orderResult = await executeStep('order', syntheticTransactions, nonStockTx, supabaseUrl, supabaseKey);
    if (!orderResult.success) {
      throw new Error(`Order: ${orderResult.error}`);
    }
    stepStatus.order = 'sent';

    if (invoice.hasNonStock && nonStockTx.length > 0) {
      const purchaseResult = await executeStep('purchase', syntheticTransactions, nonStockTx, supabaseUrl, supabaseKey);
      if (!purchaseResult.success) {
        throw new Error(`Purchase: ${purchaseResult.error}`);
      }
      stepStatus.purchase = 'created';
    } else {
      stepStatus.purchase = 'skipped';
    }

    return { invoice, success: true, errorMessage: '', stepStatus };
  } catch (error: any) {
    errorMessage = error.message || 'Unknown error';
    return { invoice, success: false, errorMessage, stepStatus };
  }
}

// Main background sync function - OPTIMIZED FOR SPEED
async function processBackgroundSync(
  supabase: any,
  jobId: string,
  fromDate: string,
  toDate: string,
  userId: string,
  userEmail: string,
  userName: string,
  resumeFrom: number = 0,
  prebuiltInvoices?: AggregatedInvoice[]
) {
  // OPTIMIZED: Process 20 invoices per chunk with 50 second runtime
  const MAX_INVOICES_PER_CHUNK = 20;
  const MAX_RUNTIME_MS = 50_000;
  // Process 5 invoices in parallel at a time
  const PARALLEL_BATCH_SIZE = 5;

  const invocationStart = Date.now();
  const isResume = resumeFrom > 0;
  console.log(
    `[Aggregated Background Sync] ${isResume ? 'Resuming' : 'Starting'} job ${jobId} for ${fromDate} to ${toDate}`
  );

  const scheduleContinuation = async (processedSoFar: number) => {
    // IMPORTANT: user may have pressed Stop after this chunk finished.
    // Never auto-resume unless the job is still explicitly running.
    const { data: jobState } = await supabase
      .from('background_sync_jobs')
      .select('status')
      .eq('id', jobId)
      .single();

    if (jobState?.status !== 'running') {
      console.log(
        `[Aggregated Background Sync] Not scheduling continuation because job ${jobId} status=${jobState?.status}`
      );
      return;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    console.log(`[Aggregated Background Sync] Scheduling continuation (resumeFrom=${processedSoFar})`);

    try {
      await fetch(`${supabaseUrl}/functions/v1/sync-aggregated-orders-background`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          fromDate,
          toDate,
          userId,
          userEmail,
          userName,
          resumeFrom: processedSoFar,
          aggregatedInvoices: prebuiltInvoices,
        }),
      });
    } catch (e) {
      console.error('[Aggregated Background Sync] Failed to schedule continuation:', e);
    }
  };

  try {
    if (!isResume) {
      await supabase
        .from('background_sync_jobs')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', jobId);
    } else {
      await supabase.from('background_sync_jobs').update({ status: 'running' }).eq('id', jobId);
    }

    // Use prebuilt invoices directly - no need to rebuild
    if (!prebuiltInvoices || prebuiltInvoices.length === 0) {
      throw new Error('No aggregated invoices provided');
    }

    const aggregatedInvoices = prebuiltInvoices;
    const totalInvoices = aggregatedInvoices.length;
    console.log(`[Aggregated Background Sync] Using ${totalInvoices} prebuilt aggregated invoices`);

    // Get non-stock products for the sync step
    const { data: nonStockProducts } = await supabase
      .from('products')
      .select('sku, product_id')
      .eq('non_stock', true);

    const nonStockSet = new Set<string>();
    nonStockProducts?.forEach((p: any) => {
      if (p.sku) nonStockSet.add(p.sku);
      if (p.product_id) nonStockSet.add(p.product_id);
    });

    if (!isResume) {
      await supabase.from('background_sync_jobs').update({ total_orders: totalInvoices }).eq('id', jobId);
    }

    // Create sync run record
    let runId: string | null = null;
    if (isResume) {
      const { data: existingRun } = await supabase
        .from('odoo_sync_runs')
        .select('id')
        .eq('from_date', fromDate)
        .eq('to_date', toDate)
        .eq('created_by', userId)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      runId = existingRun?.id || null;
      if (runId) {
        await supabase.from('odoo_sync_runs').update({ status: 'running' }).eq('id', runId);
      }
    }

    if (!runId) {
      const { data: runData } = await supabase
        .from('odoo_sync_runs')
        .insert({
          from_date: fromDate,
          to_date: toDate,
          start_time: new Date().toISOString(),
          total_orders: totalInvoices,
          status: 'running',
          created_by: userId,
        })
        .select('id')
        .single();

      runId = runData?.id;
    }

    let processedInvoices = 0;
    let successfulInvoices = 0;
    let failedInvoices = 0;
    let skippedInvoices = 0;
    const processedOrderNumbers = new Set<string>();

    if (isResume) {
      const { data: jobData } = await supabase
        .from('background_sync_jobs')
        .select('processed_orders, successful_orders, failed_orders, skipped_orders')
        .eq('id', jobId)
        .single();

      if (jobData) {
        processedInvoices = jobData.processed_orders || 0;
        successfulInvoices = jobData.successful_orders || 0;
        failedInvoices = jobData.failed_orders || 0;
        skippedInvoices = jobData.skipped_orders || 0;
      }

      if (runId) {
        const { data: existingDetails } = await supabase
          .from('odoo_sync_run_details')
          .select('order_number')
          .eq('run_id', runId);

        (existingDetails || []).forEach((d: any) => {
          if (d?.order_number) processedOrderNumbers.add(d.order_number);
        });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Filter out already processed invoices
    const invoicesToProcess = aggregatedInvoices.filter(
      (inv) => !processedOrderNumbers.has(inv.orderNumber)
    );

    console.log(`[Aggregated Background Sync] ${invoicesToProcess.length} invoices to process`);

    let processedThisChunk = 0;

    // Process in parallel batches
    for (let i = 0; i < invoicesToProcess.length; i += PARALLEL_BATCH_SIZE) {
      const elapsedMs = Date.now() - invocationStart;
      if (processedThisChunk >= MAX_INVOICES_PER_CHUNK || elapsedMs > MAX_RUNTIME_MS) {
        console.log(`[Aggregated Background Sync] Chunk limit reached. Scheduling continuation...`);
        await supabase
          .from('background_sync_jobs')
          .update({
            processed_orders: processedInvoices,
            successful_orders: successfulInvoices,
            failed_orders: failedInvoices,
            skipped_orders: skippedInvoices,
            current_order_number: null,
          })
          .eq('id', jobId);

        // Re-check status right before scheduling (user may have pressed Stop).
        const { data: jobState } = await supabase
          .from('background_sync_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (jobState?.status === 'running') {
          await scheduleContinuation(processedInvoices);
        } else {
          console.log(
            `[Aggregated Background Sync] Continuation skipped because job ${jobId} status=${jobState?.status}`
          );
        }
        return;
      }

      // Check job status once per batch instead of per invoice
      const { data: jobCheck } = await supabase
        .from('background_sync_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (jobCheck?.status === 'paused' || jobCheck?.status === 'cancelled') {
        console.log(`[Aggregated Background Sync] Job ${jobId} ${jobCheck.status}`);
        if (runId) {
          await supabase.from('odoo_sync_runs').update({
            end_time: new Date().toISOString(),
            successful_orders: successfulInvoices,
            failed_orders: failedInvoices,
            skipped_orders: skippedInvoices,
            status: jobCheck.status,
          }).eq('id', runId);
        }
        return;
      }

      // Get batch of invoices to process in parallel
      const batch = invoicesToProcess.slice(i, i + PARALLEL_BATCH_SIZE);
      console.log(`[Aggregated Background Sync] Processing batch of ${batch.length} invoices in parallel`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((invoice) => processSingleInvoice(invoice, nonStockSet, supabaseUrl, supabaseKey))
      );

      // Collect all order numbers to update and mappings to insert
      const allOriginalOrderNumbers: string[] = [];
      const allMappings: any[] = [];
      const runDetails: any[] = [];

      for (const result of batchResults) {
        const { invoice, success, errorMessage, stepStatus } = result;

        if (success) {
          successfulInvoices++;
          allOriginalOrderNumbers.push(...invoice.originalOrderNumbers);
          
          const mappings = invoice.originalOrderNumbers.map(originalOrderNumber => ({
            aggregated_order_number: invoice.orderNumber,
            original_order_number: originalOrderNumber,
            aggregation_date: invoice.date,
            brand_name: invoice.brandName,
            payment_method: invoice.paymentMethod,
            payment_brand: invoice.paymentBrand,
            user_name: invoice.userName,
          }));
          allMappings.push(...mappings);
          
          console.log(`[Aggregated Background Sync] Invoice ${invoice.orderNumber} synced successfully`);
        } else {
          failedInvoices++;
          console.error(`[Aggregated Background Sync] Invoice ${invoice.orderNumber} failed: ${errorMessage}`);
        }

        if (runId) {
          runDetails.push({
            run_id: runId,
            order_number: invoice.orderNumber,
            order_date: invoice.date,
            customer_phone: '0000',
            product_names: invoice.productLines.map(p => p.productName).join(', '),
            total_amount: invoice.grandTotal,
            sync_status: success ? 'success' : 'failed',
            error_message: errorMessage || null,
            step_customer: stepStatus.customer,
            step_brand: stepStatus.brand,
            step_product: stepStatus.product,
            step_order: stepStatus.order,
            step_purchase: stepStatus.purchase,
          });
        }

        processedInvoices++;
        processedThisChunk++;
        processedOrderNumbers.add(invoice.orderNumber);
      }

      // Batch database operations
      if (allOriginalOrderNumbers.length > 0) {
        await supabase
          .from('purpletransaction')
          .update({ sendodoo: true })
          .in('order_number', allOriginalOrderNumbers);
      }

      if (allMappings.length > 0) {
        await supabase
          .from('aggregated_order_mapping')
          .upsert(allMappings, { onConflict: 'original_order_number' });
      }

      if (runDetails.length > 0) {
        await supabase.from('odoo_sync_run_details').insert(runDetails);
      }

      // Update job progress after each batch
      await supabase
        .from('background_sync_jobs')
        .update({
          processed_orders: processedInvoices,
          successful_orders: successfulInvoices,
          failed_orders: failedInvoices,
          skipped_orders: skippedInvoices,
        })
        .eq('id', jobId);

      if (runId) {
        await supabase.from('odoo_sync_runs').update({
          successful_orders: successfulInvoices,
          failed_orders: failedInvoices,
          skipped_orders: skippedInvoices,
        }).eq('id', runId);
      }
    }

    // Completed
    const endTime = new Date();

    if (runId) {
      await supabase.from('odoo_sync_runs').update({
        end_time: endTime.toISOString(),
        successful_orders: successfulInvoices,
        failed_orders: failedInvoices,
        skipped_orders: skippedInvoices,
        status: 'completed',
      }).eq('id', runId);
    }

    const emailSent = await sendCompletionEmail(
      supabase,
      userEmail,
      userName,
      fromDate,
      toDate,
      successfulInvoices,
      failedInvoices,
      skippedInvoices,
      totalInvoices,
      formatDuration(new Date(invocationStart), endTime)
    );

    await supabase.from('background_sync_jobs').update({
      status: 'completed',
      processed_orders: processedInvoices,
      successful_orders: successfulInvoices,
      failed_orders: failedInvoices,
      skipped_orders: skippedInvoices,
      completed_at: endTime.toISOString(),
      email_sent: emailSent,
      current_order_number: null,
    }).eq('id', jobId);

    console.log(`[Aggregated Background Sync] Job ${jobId} completed in ${formatDuration(new Date(invocationStart), endTime)}`);
  } catch (error: any) {
    console.error(`[Aggregated Background Sync] Job ${jobId} failed:`, error);
    await supabase.from('background_sync_jobs').update({
      status: 'failed',
      error_message: error.message || 'Unknown error',
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, fromDate, toDate, userId, userEmail, userName, resumeFrom, aggregatedInvoices } =
      (await req.json()) as BackgroundSyncRequest;

    if (!jobId || !fromDate || !toDate || !userId || !userEmail || !userName) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isResume = resumeFrom !== undefined && resumeFrom > 0;
    console.log(`[Aggregated Background Sync] Received ${isResume ? 'resume' : 'start'} request for job ${jobId}`);
    if (aggregatedInvoices && aggregatedInvoices.length > 0) {
      console.log(`[Aggregated Background Sync] Processing ${aggregatedInvoices.length} aggregated invoices`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    EdgeRuntime.waitUntil(
      processBackgroundSync(supabase, jobId, fromDate, toDate, userId, userEmail, userName, resumeFrom || 0, aggregatedInvoices)
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: isResume ? 'Aggregated background sync resumed' : 'Aggregated background sync started',
        jobId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-aggregated-orders-background:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
