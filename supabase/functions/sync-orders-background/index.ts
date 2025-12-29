import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface OrderLine {
  id: string;
  order_number: string;
  product_id: string | null;
  product_name: string | null;
  sku: string | null;
  brand_code: string | null;
  brand_name: string | null;
  qty: number | null;
  unit_price: number | null;
  total: number | null;
  cost_price: number | null;
  cost_sold: number | null;
  coins_number: number | null;
  customer_phone: string | null;
  customer_name: string | null;
  created_at_date: string | null;
  payment_method: string | null;
  payment_type: string | null;
  payment_brand: string | null;
  user_name: string | null;
}

interface BackgroundSyncRequest {
  jobId: string;
  fromDate: string;
  toDate: string;
  userId: string;
  userEmail: string;
  userName: string;
  resumeFrom?: number; // Number of orders already processed (for resume)
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
    // Get user's email config
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_password, mail_type_id')
      .eq('email', userEmail)
      .single();

    if (!profile?.email_password || !profile?.mail_type_id) {
      console.log('User email not configured, skipping email notification');
      return false;
    }

    // Get SMTP settings
    const { data: mailType } = await supabase
      .from('mail_types')
      .select('*')
      .eq('id', profile.mail_type_id)
      .single();

    if (!mailType) {
      console.log('Mail type not found, skipping email notification');
      return false;
    }

    // Send via SMTP
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    
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
    const subject = `${statusEmoji} Odoo Sync Complete - ${fromDate} to ${toDate}`;
    
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
          Odoo Sync Completed
        </h2>
        
        <p>Hello ${userName},</p>
        
        <p>Your background Odoo sync job has completed.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Date Range:</td>
              <td style="padding: 8px 0; font-weight: bold;">${fromDate} to ${toDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Total Orders:</td>
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
              <td style="padding: 8px 0; color: #666;">Skipped:</td>
              <td style="padding: 8px 0; font-weight: bold;">${skipped}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Duration:</td>
              <td style="padding: 8px 0; font-weight: bold;">${duration}</td>
            </tr>
          </table>
        </div>
        
        ${failed > 0 ? `
          <p style="color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 8px;">
            ⚠️ Some orders failed to sync. Please check the sync history in the application for details.
          </p>
        ` : ''}
        
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

// Format duration
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

// Execute a single sync step
async function executeStep(
  stepId: string,
  transactions: OrderLine[],
  nonStockProducts: OrderLine[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-order-to-odoo-step`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step: stepId, transactions, nonStockProducts }),
    });

    const data = await response.json();
    
    if (data.skipped) {
      return { success: true };
    }

    if (data.success) {
      return { success: true };
    } else {
      const errorMessage = typeof data.error === 'object' && data.error?.error 
        ? data.error.error 
        : (data.error || data.message || 'Failed');
      return { success: false, error: errorMessage };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

// Main background sync function
async function processBackgroundSync(
  supabase: any,
  jobId: string,
  fromDate: string,
  toDate: string,
  userId: string,
  userEmail: string,
  userName: string,
  resumeFrom: number = 0
) {
  const startTime = new Date();
  const isResume = resumeFrom > 0;
  console.log(`[Background Sync] ${isResume ? 'Resuming' : 'Starting'} job ${jobId} for ${fromDate} to ${toDate}${isResume ? ` from order ${resumeFrom}` : ''}`);

  try {
    // Update job status to running (only update started_at if not resuming)
    const updateData: any = { status: 'running' };
    if (!isResume) {
      updateData.started_at = startTime.toISOString();
    }
    await supabase
      .from('background_sync_jobs')
      .update(updateData)
      .eq('id', jobId);

    // Convert date strings to integer format YYYYMMDD
    const fromDateInt = parseInt(fromDate.replace(/-/g, ''), 10);
    const toDateInt = parseInt(toDate.replace(/-/g, ''), 10);

    // Fetch transactions
    const { data: transactions, error: txError } = await supabase
      .from('purpletransaction')
      .select('*')
      .gte('created_at_date_int', fromDateInt)
      .lte('created_at_date_int', toDateInt)
      .neq('payment_method', 'point')
      .eq('is_deleted', false)
      .or('sendodoo.is.null,sendodoo.eq.false')
      .order('created_at_date_int', { ascending: false });

    if (txError) {
      throw new Error(`Failed to fetch transactions: ${txError.message}`);
    }

    // Get non-stock products
    const { data: nonStockProducts } = await supabase
      .from('products')
      .select('sku, product_id')
      .eq('non_stock', true);

    const nonStockSet = new Set<string>();
    nonStockProducts?.forEach((p: any) => {
      if (p.sku) nonStockSet.add(p.sku);
      if (p.product_id) nonStockSet.add(p.product_id);
    });

    // Group by order_number
    const orderGroups = new Map<string, OrderLine[]>();
    (transactions || []).forEach((tx: any) => {
      if (!tx.order_number) return;
      const existing = orderGroups.get(tx.order_number) || [];
      existing.push(tx);
      orderGroups.set(tx.order_number, existing);
    });

    const totalOrders = orderGroups.size;
    console.log(`[Background Sync] Found ${totalOrders} orders to process`);

    // Update total orders (only if not resuming)
    if (!isResume) {
      await supabase
        .from('background_sync_jobs')
        .update({ total_orders: totalOrders })
        .eq('id', jobId);
    }

    // Create or get sync run record
    let runId: string | null = null;
    
    if (isResume) {
      // Find existing run for this job
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
        // Update run status back to running
        await supabase
          .from('odoo_sync_runs')
          .update({ status: 'running' })
          .eq('id', runId);
      }
    }
    
    if (!runId) {
      const { data: runData } = await supabase
        .from('odoo_sync_runs')
        .insert({
          from_date: fromDate,
          to_date: toDate,
          start_time: startTime.toISOString(),
          total_orders: totalOrders,
          status: 'running',
          created_by: userId,
        })
        .select('id')
        .single();
      
      runId = runData?.id;
    }

    // Get existing counts if resuming
    let processedOrders = 0;
    let successfulOrders = 0;
    let failedOrders = 0;
    let skippedOrders = 0;
    
    if (isResume) {
      const { data: jobData } = await supabase
        .from('background_sync_jobs')
        .select('processed_orders, successful_orders, failed_orders, skipped_orders')
        .eq('id', jobId)
        .single();
      
      if (jobData) {
        processedOrders = jobData.processed_orders || 0;
        successfulOrders = jobData.successful_orders || 0;
        failedOrders = jobData.failed_orders || 0;
        skippedOrders = jobData.skipped_orders || 0;
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Process each order
    let orderIndex = 0;
    for (const [orderNumber, lines] of orderGroups) {
      // Skip already processed orders when resuming
      if (isResume && orderIndex < resumeFrom) {
        orderIndex++;
        continue;
      }
      orderIndex++;
      // Check if job was cancelled
      const { data: jobCheck } = await supabase
        .from('background_sync_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (jobCheck?.status === 'paused') {
        console.log(`[Background Sync] Job ${jobId} was paused by user`);
        
        // Update sync run as paused
        if (runId) {
          await supabase
            .from('odoo_sync_runs')
            .update({
              successful_orders: successfulOrders,
              failed_orders: failedOrders,
              skipped_orders: skippedOrders,
              status: 'paused',
            })
            .eq('id', runId);
        }

        // Keep the job in paused state with current progress
        await supabase
          .from('background_sync_jobs')
          .update({
            processed_orders: processedOrders,
            successful_orders: successfulOrders,
            failed_orders: failedOrders,
            skipped_orders: skippedOrders,
            current_order_number: null,
          })
          .eq('id', jobId);

        return;
      }

      if (jobCheck?.status === 'cancelled') {
        console.log(`[Background Sync] Job ${jobId} was cancelled by user`);
        
        // Update sync run as cancelled
        if (runId) {
          await supabase
            .from('odoo_sync_runs')
            .update({
              end_time: new Date().toISOString(),
              successful_orders: successfulOrders,
              failed_orders: failedOrders,
              skipped_orders: skippedOrders,
              status: 'cancelled',
            })
            .eq('id', runId);
        }

        await supabase
          .from('background_sync_jobs')
          .update({
            processed_orders: processedOrders,
            successful_orders: successfulOrders,
            failed_orders: failedOrders,
            skipped_orders: skippedOrders,
            completed_at: new Date().toISOString(),
            current_order_number: null,
          })
          .eq('id', jobId);

        return;
      }

      const firstLine = lines[0];
      console.log(`[Background Sync] Processing order ${orderNumber} (${processedOrders + 1}/${totalOrders})`);

      // Update current order
      await supabase
        .from('background_sync_jobs')
        .update({
          current_order_number: orderNumber,
          processed_orders: processedOrders,
        })
        .eq('id', jobId);

      // Check for non-stock products in this order
      const orderNonStockProducts = lines.filter(line => {
        const sku = line.sku || line.product_id;
        return sku && nonStockSet.has(sku);
      });

      const hasNonStock = orderNonStockProducts.length > 0;
      const stepStatus: Record<string, string> = {
        customer: 'pending',
        brand: 'pending',
        product: 'pending',
        order: 'pending',
        purchase: 'pending',
      };

      let syncStatus = 'success';
      let errorMessage = '';

      try {
        // Step 1: Customer
        const customerResult = await executeStep('customer', lines, orderNonStockProducts, supabaseUrl, supabaseKey);
        if (!customerResult.success) {
          stepStatus.customer = 'failed';
          throw new Error(`Customer: ${customerResult.error}`);
        }
        stepStatus.customer = 'found';

        // Step 2: Brand
        const brandResult = await executeStep('brand', lines, orderNonStockProducts, supabaseUrl, supabaseKey);
        if (!brandResult.success) {
          stepStatus.brand = 'failed';
          throw new Error(`Brand: ${brandResult.error}`);
        }
        stepStatus.brand = 'found';

        // Step 3: Product
        const productResult = await executeStep('product', lines, orderNonStockProducts, supabaseUrl, supabaseKey);
        if (!productResult.success) {
          stepStatus.product = 'failed';
          throw new Error(`Product: ${productResult.error}`);
        }
        stepStatus.product = 'found';

        // Step 4: Order
        const orderResult = await executeStep('order', lines, orderNonStockProducts, supabaseUrl, supabaseKey);
        if (!orderResult.success) {
          stepStatus.order = 'failed';
          throw new Error(`Order: ${orderResult.error}`);
        }
        stepStatus.order = 'sent';

        // Step 5: Purchase (if non-stock)
        if (hasNonStock) {
          const purchaseResult = await executeStep('purchase', lines, orderNonStockProducts, supabaseUrl, supabaseKey);
          if (!purchaseResult.success) {
            stepStatus.purchase = 'failed';
            throw new Error(`Purchase: ${purchaseResult.error}`);
          }
          stepStatus.purchase = 'created';
        } else {
          stepStatus.purchase = 'skipped';
        }

        successfulOrders++;
        console.log(`[Background Sync] Order ${orderNumber} synced successfully`);

      } catch (error: any) {
        syncStatus = 'failed';
        errorMessage = error.message || 'Unknown error';
        failedOrders++;
        console.error(`[Background Sync] Order ${orderNumber} failed: ${errorMessage}`);
      }

      // Save run detail
      if (runId) {
        await supabase
          .from('odoo_sync_run_details')
          .insert({
            run_id: runId,
            order_number: orderNumber,
            order_date: firstLine.created_at_date?.slice(0, 10) || null,
            customer_phone: firstLine.customer_phone || null,
            product_names: [...new Set(lines.map(l => l.product_name))].filter(Boolean).join(', '),
            total_amount: lines.reduce((sum, l) => sum + (l.total || 0), 0),
            sync_status: syncStatus,
            error_message: errorMessage || null,
            step_customer: stepStatus.customer,
            step_brand: stepStatus.brand,
            step_product: stepStatus.product,
            step_order: stepStatus.order,
            step_purchase: stepStatus.purchase,
          });
      }

      processedOrders++;
    }

    const endTime = new Date();
    const duration = formatDuration(startTime, endTime);

    // Update sync run
    if (runId) {
      await supabase
        .from('odoo_sync_runs')
        .update({
          end_time: endTime.toISOString(),
          successful_orders: successfulOrders,
          failed_orders: failedOrders,
          skipped_orders: skippedOrders,
          status: 'completed',
        })
        .eq('id', runId);
    }

    // Send completion email
    const emailSent = await sendCompletionEmail(
      supabase,
      userEmail,
      userName,
      fromDate,
      toDate,
      successfulOrders,
      failedOrders,
      skippedOrders,
      totalOrders,
      duration
    );

    // Update job as completed
    await supabase
      .from('background_sync_jobs')
      .update({
        status: 'completed',
        processed_orders: processedOrders,
        successful_orders: successfulOrders,
        failed_orders: failedOrders,
        skipped_orders: skippedOrders,
        completed_at: endTime.toISOString(),
        email_sent: emailSent,
        current_order_number: null,
      })
      .eq('id', jobId);

    console.log(`[Background Sync] Job ${jobId} completed. Success: ${successfulOrders}, Failed: ${failedOrders}`);

  } catch (error: any) {
    console.error(`[Background Sync] Job ${jobId} failed:`, error);
    
    await supabase
      .from('background_sync_jobs')
      .update({
        status: 'failed',
        error_message: error.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

// Declare EdgeRuntime for TypeScript
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<any>) => void;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, fromDate, toDate, userId, userEmail, userName, resumeFrom } = await req.json() as BackgroundSyncRequest;

    if (!jobId || !fromDate || !toDate || !userId || !userEmail || !userName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isResume = resumeFrom !== undefined && resumeFrom > 0;
    console.log(`[Background Sync] Received ${isResume ? 'resume' : 'start'} request for job ${jobId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Use waitUntil for background processing
    EdgeRuntime.waitUntil(processBackgroundSync(supabase, jobId, fromDate, toDate, userId, userEmail, userName, resumeFrom || 0));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        message: isResume ? 'Background sync resumed' : 'Background sync started',
        jobId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-orders-background:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
