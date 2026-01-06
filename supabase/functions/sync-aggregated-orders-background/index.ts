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
  timeoutMs: number = 60_000
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

// Build aggregated invoices from transactions
function buildAggregatedInvoices(
  transactions: any[],
  nonStockSet: Set<string>,
  alreadySyncedMap: Map<string, string>,
  dateSequenceMap: Map<string, number>
): AggregatedInvoice[] {
  // Group by order_number first
  const orderGroups = new Map<string, any[]>();
  transactions.forEach((tx: any) => {
    if (!tx.order_number) return;
    const existing = orderGroups.get(tx.order_number) || [];
    existing.push(tx);
    orderGroups.set(tx.order_number, existing);
  });

  // Now group by invoice criteria: date, brand, payment_method, payment_brand, user_name
  const invoiceMap = new Map<string, {
    date: string;
    brandName: string;
    brandCode: string;
    paymentMethod: string;
    paymentBrand: string;
    userName: string;
    company: string;
    lines: any[];
    originalOrderNumbers: string[];
  }>();

  for (const [orderNumber, lines] of orderGroups) {
    lines.forEach((line: any) => {
      const dateOnly = line.created_at_date?.substring(0, 10) || '';
      const invoiceKey = `${dateOnly}|${line.brand_name || ''}|${line.payment_method}|${line.payment_brand}|${line.user_name || ''}`;

      const existing = invoiceMap.get(invoiceKey);
      if (existing) {
        existing.lines.push(line);
        if (!existing.originalOrderNumbers.includes(orderNumber)) {
          existing.originalOrderNumbers.push(orderNumber);
        }
      } else {
        invoiceMap.set(invoiceKey, {
          date: dateOnly,
          brandName: line.brand_name || '',
          brandCode: line.brand_code || '',
          paymentMethod: line.payment_method || '',
          paymentBrand: line.payment_brand || '',
          userName: line.user_name || '',
          company: line.company || 'Purple',
          lines: [line],
          originalOrderNumbers: [orderNumber],
        });
      }
    });
  }

  // Build result
  const result: AggregatedInvoice[] = [];
  const sortedKeys = Array.from(invoiceMap.keys()).sort();

  sortedKeys.forEach(invoiceKey => {
    const invoice = invoiceMap.get(invoiceKey)!;
    const dateStr = invoice.date?.replace(/-/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Check if ALL original orders are already synced
    const allAlreadySynced = invoice.originalOrderNumbers.every(orderNum =>
      alreadySyncedMap.has(orderNum)
    );

    let orderNumber: string;
    if (allAlreadySynced && invoice.originalOrderNumbers.length > 0) {
      orderNumber = alreadySyncedMap.get(invoice.originalOrderNumbers[0]) || '';
    } else {
      const currentSeq = dateSequenceMap.get(dateStr) || 0;
      const nextSeq = currentSeq + 1;
      dateSequenceMap.set(dateStr, nextSeq);
      orderNumber = `${dateStr}${String(nextSeq).padStart(4, '0')}`;
    }

    // Skip if already synced
    if (allAlreadySynced) {
      return;
    }

    // Aggregate product lines by SKU and unit_price
    const productMap = new Map<string, ProductLine>();
    invoice.lines.forEach((line: any) => {
      const productKey = `${line.sku || line.product_id || ''}|${line.unit_price}`;
      const existing = productMap.get(productKey);
      if (existing) {
        existing.totalQty += line.qty || 0;
        existing.totalAmount += line.total || 0;
      } else {
        productMap.set(productKey, {
          productSku: line.sku || line.product_id || '',
          productName: line.product_name || '',
          unitPrice: line.unit_price || 0,
          totalQty: line.qty || 0,
          totalAmount: line.total || 0,
        });
      }
    });

    const productLines = Array.from(productMap.values()).sort((a, b) =>
      a.productSku.localeCompare(b.productSku)
    );

    const hasNonStock = invoice.lines.some((line: any) => {
      const sku = line.sku || line.product_id || '';
      return nonStockSet.has(sku);
    });

    result.push({
      orderNumber,
      date: invoice.date,
      brandName: invoice.brandName,
      brandCode: invoice.brandCode,
      paymentMethod: invoice.paymentMethod,
      paymentBrand: invoice.paymentBrand,
      userName: invoice.userName,
      company: invoice.company,
      productLines,
      grandTotal: productLines.reduce((sum, p) => sum + p.totalAmount, 0),
      originalOrderNumbers: invoice.originalOrderNumbers,
      hasNonStock,
    });
  });

  return result;
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
  resumeFrom: number = 0,
  selectedOrderNumbers?: string[]
) {
  const MAX_INVOICES_PER_CHUNK = 5;
  const MAX_RUNTIME_MS = 20_000;

  const invocationStart = Date.now();
  const isResume = resumeFrom > 0;
  console.log(
    `[Aggregated Background Sync] ${isResume ? 'Resuming' : 'Starting'} job ${jobId} for ${fromDate} to ${toDate}`
  );

  const scheduleContinuation = async (processedSoFar: number) => {
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
          selectedOrderNumbers,
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

    const fromDateInt = parseInt(fromDate.replace(/-/g, ''), 10);
    const toDateInt = parseInt(toDate.replace(/-/g, ''), 10);

    // Fetch transactions - filter by selected order numbers if provided
    let query = supabase
      .from('purpletransaction')
      .select('*')
      .gte('created_at_date_int', fromDateInt)
      .lte('created_at_date_int', toDateInt)
      .neq('payment_method', 'point')
      .eq('is_deleted', false)
      .or('sendodoo.is.null,sendodoo.eq.false');

    // If selectedOrderNumbers is provided, filter to only those orders
    if (selectedOrderNumbers && selectedOrderNumbers.length > 0) {
      query = query.in('order_number', selectedOrderNumbers);
      console.log(`[Aggregated Background Sync] Filtering to ${selectedOrderNumbers.length} selected order numbers`);
    }

    const { data: transactions, error: txError } = await query.order('created_at_date_int', { ascending: false });

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

    // Get all original order numbers
    const allOrderNumbers = [...new Set((transactions || []).map((tx: any) => tx.order_number).filter(Boolean))];

    // Fetch existing mappings
    const { data: existingMappingsData } = await supabase
      .from('aggregated_order_mapping')
      .select('original_order_number, aggregated_order_number')
      .in('original_order_number', allOrderNumbers.length > 0 ? allOrderNumbers : ['__none__']);

    const alreadySyncedMap = new Map<string, string>();
    existingMappingsData?.forEach((m: any) => {
      alreadySyncedMap.set(m.original_order_number, m.aggregated_order_number);
    });

    // Fetch max sequence for dates
    const uniqueDates = new Set<string>();
    (transactions || []).forEach((tx: any) => {
      const dateStr = tx.created_at_date?.substring(0, 10)?.replace(/-/g, '') || '';
      if (dateStr) uniqueDates.add(dateStr);
    });

    const dateSequenceMap = new Map<string, number>();
    for (const dateStr of uniqueDates) {
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      const { data: existingMappings } = await supabase
        .from('aggregated_order_mapping')
        .select('aggregated_order_number')
        .eq('aggregation_date', formattedDate)
        .order('aggregated_order_number', { ascending: false })
        .limit(1);

      if (existingMappings && existingMappings.length > 0) {
        const lastSeq = parseInt(existingMappings[0].aggregated_order_number.slice(-4), 10) || 0;
        dateSequenceMap.set(dateStr, lastSeq);
      } else {
        dateSequenceMap.set(dateStr, 0);
      }
    }

    // Build aggregated invoices
    const aggregatedInvoices = buildAggregatedInvoices(
      transactions || [],
      nonStockSet,
      alreadySyncedMap,
      dateSequenceMap
    );

    const totalInvoices = aggregatedInvoices.length;
    console.log(`[Aggregated Background Sync] Built ${totalInvoices} aggregated invoices`);

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

    let processedThisChunk = 0;

    for (const invoice of aggregatedInvoices) {
      const elapsedMs = Date.now() - invocationStart;
      if (processedThisChunk >= MAX_INVOICES_PER_CHUNK || elapsedMs > MAX_RUNTIME_MS) {
        console.log(`[Aggregated Background Sync] Chunk limit reached. Continuing...`);
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
        await scheduleContinuation(processedInvoices);
        return;
      }

      if (processedOrderNumbers.has(invoice.orderNumber)) {
        continue;
      }

      // Check job status
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

      console.log(`[Aggregated Background Sync] Processing invoice ${invoice.orderNumber}`);

      await supabase
        .from('background_sync_jobs')
        .update({ current_order_number: invoice.orderNumber })
        .eq('id', jobId);

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

      const stepStatus: Record<string, string> = {
        customer: 'skipped',
        brand: 'skipped',
        product: 'skipped',
        order: 'pending',
        purchase: 'pending',
      };

      let syncStatus = 'success';
      let errorMessage = '';

      try {
        // Skip customer, brand, product checks for aggregated mode - go directly to order
        console.log(`[Aggregated Background Sync] Skipping customer/brand/product checks for aggregated invoice`);

        const orderResult = await executeStep('order', syntheticTransactions, nonStockTx, supabaseUrl, supabaseKey);
        if (!orderResult.success) throw new Error(`Order: ${orderResult.error}`);
        stepStatus.order = 'sent';

        if (invoice.hasNonStock && nonStockTx.length > 0) {
          const purchaseResult = await executeStep('purchase', syntheticTransactions, nonStockTx, supabaseUrl, supabaseKey);
          if (!purchaseResult.success) throw new Error(`Purchase: ${purchaseResult.error}`);
          stepStatus.purchase = 'created';
        } else {
          stepStatus.purchase = 'skipped';
        }

        // Mark original orders as synced and save mapping
        await supabase
          .from('purpletransaction')
          .update({ sendodoo: true })
          .in('order_number', invoice.originalOrderNumbers);

        const mappings = invoice.originalOrderNumbers.map(originalOrderNumber => ({
          aggregated_order_number: invoice.orderNumber,
          original_order_number: originalOrderNumber,
          aggregation_date: invoice.date,
          brand_name: invoice.brandName,
          payment_method: invoice.paymentMethod,
          payment_brand: invoice.paymentBrand,
          user_name: invoice.userName,
        }));

        await supabase
          .from('aggregated_order_mapping')
          .upsert(mappings, { onConflict: 'original_order_number' });

        successfulInvoices++;
        console.log(`[Aggregated Background Sync] Invoice ${invoice.orderNumber} synced successfully`);
      } catch (error: any) {
        syncStatus = 'failed';
        errorMessage = error.message || 'Unknown error';
        failedInvoices++;
        console.error(`[Aggregated Background Sync] Invoice ${invoice.orderNumber} failed: ${errorMessage}`);
      }

      if (runId) {
        await supabase.from('odoo_sync_run_details').insert({
          run_id: runId,
          order_number: invoice.orderNumber,
          order_date: invoice.date,
          customer_phone: '0000',
          product_names: invoice.productLines.map(p => p.productName).join(', '),
          total_amount: invoice.grandTotal,
          sync_status: syncStatus,
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
      formatDuration(new Date(Date.now() - processedInvoices * 3000), endTime)
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

    console.log(`[Aggregated Background Sync] Job ${jobId} completed`);
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
    const { jobId, fromDate, toDate, userId, userEmail, userName, resumeFrom, selectedOrderNumbers } =
      (await req.json()) as BackgroundSyncRequest;

    if (!jobId || !fromDate || !toDate || !userId || !userEmail || !userName) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isResume = resumeFrom !== undefined && resumeFrom > 0;
    console.log(`[Aggregated Background Sync] Received ${isResume ? 'resume' : 'start'} request for job ${jobId}`);
    if (selectedOrderNumbers && selectedOrderNumbers.length > 0) {
      console.log(`[Aggregated Background Sync] Processing ${selectedOrderNumbers.length} selected order numbers`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    EdgeRuntime.waitUntil(
      processBackgroundSync(supabase, jobId, fromDate, toDate, userId, userEmail, userName, resumeFrom || 0, selectedOrderNumbers)
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
