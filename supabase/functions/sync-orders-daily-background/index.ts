import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface DailyBackgroundSyncRequest {
  jobId?: string;
  fromDate: string;
  toDate: string;
  userId: string;
  userEmail: string;
  userName: string;
  resumeFromDay?: string;
}

interface DayStatus {
  date: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_orders: number;
  successful_orders: number;
  failed_orders: number;
  skipped_orders: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

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

// Build aggregated invoices from order_totals for a specific date
async function buildAggregatedInvoicesForDate(
  supabase: any,
  targetDate: string,
  nonStockSkus: Set<string>
): Promise<AggregatedInvoice[]> {
  // Fetch orders for this date
  const { data: orders, error } = await supabase
    .from('ordertotals')
    .select(`
      order_number, total, qty, sku, product_name, unit_price, brand_name,
      created_at_date, payment_method, payment_brand, user_name, brand_code, company
    `)
    .eq('created_at_date', targetDate)
    .order('order_number');

  if (error) {
    console.error(`[Daily Sync] Error fetching orders for ${targetDate}:`, error);
    return [];
  }

  if (!orders || orders.length === 0) {
    console.log(`[Daily Sync] No orders found for ${targetDate}`);
    return [];
  }

  console.log(`[Daily Sync] Found ${orders.length} order lines for ${targetDate}`);

  // Group by invoice criteria: brand, payment_method, payment_brand, user_name
  const invoiceMap = new Map<string, {
    orders: any[];
    originalOrderNumbers: Set<string>;
  }>();

  for (const order of orders) {
    const key = `${order.brand_name || 'Unknown'}|${order.payment_method || 'Unknown'}|${order.payment_brand || 'Unknown'}|${order.user_name || 'Unknown'}`;
    
    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, {
        orders: [],
        originalOrderNumbers: new Set(),
      });
    }
    
    const group = invoiceMap.get(key)!;
    group.orders.push(order);
    if (order.order_number) {
      group.originalOrderNumbers.add(order.order_number);
    }
  }

  // Build aggregated invoices
  const aggregatedInvoices: AggregatedInvoice[] = [];
  let invoiceIndex = 1;

  for (const [key, group] of invoiceMap.entries()) {
    const [brandName, paymentMethod, paymentBrand, userName] = key.split('|');
    
    // Group products by SKU
    const productMap = new Map<string, {
      productSku: string;
      productName: string;
      unitPrice: number;
      totalQty: number;
      totalAmount: number;
    }>();

    let hasNonStock = false;

    for (const order of group.orders) {
      const sku = order.sku || 'UNKNOWN';
      const productName = order.product_name || 'Unknown Product';
      const unitPrice = Number(order.unit_price) || 0;
      const qty = Number(order.qty) || 0;
      const total = Number(order.total) || 0;

      if (nonStockSkus.has(sku)) {
        hasNonStock = true;
      }

      if (!productMap.has(sku)) {
        productMap.set(sku, {
          productSku: sku,
          productName,
          unitPrice,
          totalQty: 0,
          totalAmount: 0,
        });
      }

      const product = productMap.get(sku)!;
      product.totalQty += qty;
      product.totalAmount += total;
    }

    const productLines = Array.from(productMap.values());
    const grandTotal = productLines.reduce((sum, p) => sum + p.totalAmount, 0);
    const originalOrderNumbers = Array.from(group.originalOrderNumbers);

    // Generate aggregated order number
    const brandCode = group.orders[0]?.brand_code || brandName.substring(0, 3).toUpperCase();
    const dateStr = targetDate.replace(/-/g, '');
    const orderNumber = `AGG-${brandCode}-${dateStr}-${String(invoiceIndex).padStart(3, '0')}`;

    aggregatedInvoices.push({
      orderNumber,
      date: targetDate,
      brandName,
      paymentMethod,
      paymentBrand,
      userName,
      productLines,
      grandTotal,
      originalOrderNumbers,
      brandCode,
      company: group.orders[0]?.company || '',
      hasNonStock,
    });

    invoiceIndex++;
  }

  console.log(`[Daily Sync] Built ${aggregatedInvoices.length} aggregated invoices for ${targetDate}`);
  return aggregatedInvoices;
}

// Helper to send email via existing SMTP function
async function sendCompletionEmail(
  supabase: any,
  userEmail: string,
  userName: string,
  fromDate: string,
  toDate: string,
  dayStatuses: DayStatus[],
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

    const totalDays = dayStatuses.length;
    const completedDays = dayStatuses.filter(d => d.status === 'completed').length;
    const failedDays = dayStatuses.filter(d => d.status === 'failed').length;
    const totalOrders = dayStatuses.reduce((sum, d) => sum + d.total_orders, 0);
    const totalSuccess = dayStatuses.reduce((sum, d) => sum + d.successful_orders, 0);
    const totalFailed = dayStatuses.reduce((sum, d) => sum + d.failed_orders, 0);
    const totalSkipped = dayStatuses.reduce((sum, d) => sum + d.skipped_orders, 0);

    const statusEmoji = failedDays > 0 ? '⚠️' : '✅';
    const subject = `${statusEmoji} Daily Odoo Sync Complete - ${fromDate} to ${toDate}`;

    const dayRows = dayStatuses
      .map(d => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.date}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: ${d.status === 'completed' ? '#22c55e' : d.status === 'failed' ? '#ef4444' : '#666'};">
            ${d.status === 'completed' ? '✅ Completed' : d.status === 'failed' ? '❌ Failed' : d.status}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.total_orders}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #22c55e;">${d.successful_orders}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #ef4444;">${d.failed_orders}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${d.skipped_orders}</td>
        </tr>
      `)
      .join('');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px;">
          Daily Odoo Sync Completed
        </h2>
        
        <p>Hello ${userName},</p>
        
        <p>Your day-by-day Odoo sync job has completed.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #333;">Overall Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Date Range:</td>
              <td style="padding: 8px 0; font-weight: bold;">${fromDate} to ${toDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Total Days:</td>
              <td style="padding: 8px 0; font-weight: bold;">${totalDays} (${completedDays} completed, ${failedDays} failed)</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Total Orders:</td>
              <td style="padding: 8px 0; font-weight: bold;">${totalOrders}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Successful:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #22c55e;">${totalSuccess}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Failed:</td>
              <td style="padding: 8px 0; font-weight: bold; color: ${totalFailed > 0 ? '#ef4444' : '#666'};">${totalFailed}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Skipped:</td>
              <td style="padding: 8px 0; font-weight: bold;">${totalSkipped}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Duration:</td>
              <td style="padding: 8px 0; font-weight: bold;">${duration}</td>
            </tr>
          </table>
        </div>

        <h3 style="color: #333;">Daily Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f0f0f0;">
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Status</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Total</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Success</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Failed</th>
              <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Skipped</th>
            </tr>
          </thead>
          <tbody>
            ${dayRows}
          </tbody>
        </table>
        
        ${failedDays > 0 ? `
          <p style="color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 8px;">
            ⚠️ Some days had failures. Please check the sync history in the application for details.
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

function getDatesInRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  
  return dates;
}

async function processDailySync(
  supabase: any,
  jobId: string,
  fromDate: string,
  toDate: string,
  userId: string,
  userEmail: string,
  userName: string,
  resumeFromDay?: string
) {
  const invocationStart = Date.now();
  const MAX_RUNTIME_MS = 25_000; // 25 seconds max per invocation
  
  console.log(`[Daily Sync] ${resumeFromDay ? 'Resuming from ' + resumeFromDay : 'Starting'} job ${jobId} for ${fromDate} to ${toDate}`);

  const scheduleContinuation = async (nextDay: string) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    console.log(`[Daily Sync] Scheduling continuation (nextDay=${nextDay})`);

    try {
      await fetch(`${supabaseUrl}/functions/v1/sync-orders-daily-background`, {
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
          resumeFromDay: nextDay,
        }),
      });
    } catch (e) {
      console.error('[Daily Sync] Failed to schedule continuation:', e);
    }
  };

  try {
    // Get all dates in range
    const allDates = getDatesInRange(fromDate, toDate);
    
    // Get or create job
    let { data: job } = await supabase
      .from('daily_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) {
      // Create new job
      const initialDayStatuses: Record<string, DayStatus> = {};
      allDates.forEach(date => {
        initialDayStatuses[date] = {
          date,
          status: 'pending',
          total_orders: 0,
          successful_orders: 0,
          failed_orders: 0,
          skipped_orders: 0,
        };
      });

      const { data: newJob, error: createError } = await supabase
        .from('daily_sync_jobs')
        .insert({
          id: jobId,
          from_date: fromDate,
          to_date: toDate,
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          status: 'running',
          total_days: allDates.length,
          completed_days: 0,
          failed_days: 0,
          day_statuses: initialDayStatuses,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;
      job = newJob;
    } else {
      // Resume job
      await supabase
        .from('daily_sync_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);
    }

    const dayStatuses: Record<string, DayStatus> = job.day_statuses || {};
    
    // Find where to start
    let startIndex = 0;
    if (resumeFromDay) {
      startIndex = allDates.indexOf(resumeFromDay);
      if (startIndex === -1) startIndex = 0;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Get non-stock products for aggregation
    const { data: nonStockProducts } = await supabase
      .from('products')
      .select('sku, product_id')
      .eq('non_stock', true);

    const nonStockSkus = new Set<string>();
    nonStockProducts?.forEach((p: any) => {
      if (p.sku) nonStockSkus.add(p.sku);
      if (p.product_id) nonStockSkus.add(p.product_id);
    });

    // Process each day
    for (let i = startIndex; i < allDates.length; i++) {
      const currentDate = allDates[i];
      
      // Check runtime limit
      const elapsedMs = Date.now() - invocationStart;
      if (elapsedMs > MAX_RUNTIME_MS) {
        console.log(`[Daily Sync] Runtime limit reached, scheduling continuation for ${currentDate}`);
        await supabase
          .from('daily_sync_jobs')
          .update({
            day_statuses: dayStatuses,
            current_day: currentDate,
          })
          .eq('id', jobId);
        await scheduleContinuation(currentDate);
        return;
      }

      // Check job status
      const { data: jobCheck } = await supabase
        .from('daily_sync_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (jobCheck?.status === 'paused' || jobCheck?.status === 'cancelled') {
        console.log(`[Daily Sync] Job ${jobId} ${jobCheck.status}`);
        await supabase
          .from('daily_sync_jobs')
          .update({
            day_statuses: dayStatuses,
            current_day: currentDate,
          })
          .eq('id', jobId);
        return;
      }

      // Skip already completed days
      if (dayStatuses[currentDate]?.status === 'completed') {
        continue;
      }

      console.log(`[Daily Sync] Processing day ${currentDate}`);
      
      // Update current day status
      dayStatuses[currentDate] = {
        ...dayStatuses[currentDate],
        status: 'running',
        started_at: new Date().toISOString(),
      };

      await supabase
        .from('daily_sync_jobs')
        .update({
          current_day: currentDate,
          day_statuses: dayStatuses,
        })
        .eq('id', jobId);

      try {
        // Build aggregated invoices for this day
        const aggregatedInvoices = await buildAggregatedInvoicesForDate(supabase, currentDate, nonStockSkus);
        
        if (aggregatedInvoices.length === 0) {
          // No orders for this day - mark as completed
          dayStatuses[currentDate] = {
            date: currentDate,
            status: 'completed',
            total_orders: 0,
            successful_orders: 0,
            failed_orders: 0,
            skipped_orders: 0,
            completed_at: new Date().toISOString(),
          };
          continue;
        }

        // Generate a unique job ID for this day's aggregated sync
        const dayJobId = crypto.randomUUID();
        
        // Call the aggregated background sync with pre-built invoices
        const response = await fetch(`${supabaseUrl}/functions/v1/sync-aggregated-orders-background`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId: dayJobId,
            fromDate: currentDate,
            toDate: currentDate,
            userId,
            userEmail,
            userName,
            aggregatedInvoices, // Pass the pre-built invoices
          }),
        });

        const result = await response.json().catch(() => ({}));
        
        // Wait for the aggregated background sync to complete by polling
        if (result.success && result.jobId) {
          let attempts = 0;
          const maxAttempts = 120; // 10 minutes max wait for aggregated sync
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
            
            const { data: bgJob } = await supabase
              .from('background_sync_jobs')
              .select('*')
              .eq('id', result.jobId)
              .single();

            if (bgJob?.status === 'completed' || bgJob?.status === 'failed' || bgJob?.status === 'cancelled') {
              dayStatuses[currentDate] = {
                date: currentDate,
                status: bgJob.status === 'completed' ? 'completed' : 'failed',
                total_orders: bgJob.total_orders || 0,
                successful_orders: bgJob.successful_orders || 0,
                failed_orders: bgJob.failed_orders || 0,
                skipped_orders: bgJob.skipped_orders || 0,
                completed_at: new Date().toISOString(),
                error_message: bgJob.error_message,
              };
              break;
            }
            
            attempts++;
            
            // Check if we need to continue later
            const elapsedMs = Date.now() - invocationStart;
            if (elapsedMs > MAX_RUNTIME_MS) {
              // Save current state and continue later
              await supabase
                .from('daily_sync_jobs')
                .update({
                  day_statuses: dayStatuses,
                  current_day: currentDate,
                })
                .eq('id', jobId);
              await scheduleContinuation(currentDate);
              return;
            }
          }
        } else {
          // No job created or error, mark as failed
          dayStatuses[currentDate] = {
            date: currentDate,
            status: 'failed',
            total_orders: 0,
            successful_orders: 0,
            failed_orders: 0,
            skipped_orders: 0,
            completed_at: new Date().toISOString(),
            error_message: result.error || 'Failed to start aggregated sync job',
          };
        }
      } catch (error: any) {
        console.error(`[Daily Sync] Error processing ${currentDate}:`, error);
        dayStatuses[currentDate] = {
          date: currentDate,
          status: 'failed',
          total_orders: 0,
          successful_orders: 0,
          failed_orders: 0,
          skipped_orders: 0,
          completed_at: new Date().toISOString(),
          error_message: error?.message || 'Unknown error',
        };
      }

      // Update job with day status
      const completedDays = Object.values(dayStatuses).filter(d => d.status === 'completed').length;
      const failedDays = Object.values(dayStatuses).filter(d => d.status === 'failed').length;
      
      await supabase
        .from('daily_sync_jobs')
        .update({
          day_statuses: dayStatuses,
          completed_days: completedDays,
          failed_days: failedDays,
        })
        .eq('id', jobId);
    }

    // All days processed - mark job complete
    const completedDays = Object.values(dayStatuses).filter(d => d.status === 'completed').length;
    const failedDays = Object.values(dayStatuses).filter(d => d.status === 'failed').length;
    const totalSuccess = Object.values(dayStatuses).reduce((sum, d) => sum + (d.successful_orders || 0), 0);
    const totalFailed = Object.values(dayStatuses).reduce((sum, d) => sum + (d.failed_orders || 0), 0);
    const totalSkipped = Object.values(dayStatuses).reduce((sum, d) => sum + (d.skipped_orders || 0), 0);
    const totalOrders = Object.values(dayStatuses).reduce((sum, d) => sum + (d.total_orders || 0), 0);

    await supabase
      .from('daily_sync_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        day_statuses: dayStatuses,
        completed_days: completedDays,
        failed_days: failedDays,
        total_orders: totalOrders,
        successful_orders: totalSuccess,
        failed_orders: totalFailed,
        skipped_orders: totalSkipped,
      })
      .eq('id', jobId);

    // Send completion email
    const duration = formatDuration(new Date(job.started_at || job.created_at), new Date());
    await sendCompletionEmail(
      supabase,
      userEmail,
      userName,
      fromDate,
      toDate,
      Object.values(dayStatuses),
      duration
    );

    console.log(`[Daily Sync] Job ${jobId} completed: ${completedDays} days completed, ${failedDays} days failed`);

  } catch (error: any) {
    console.error(`[Daily Sync] Job ${jobId} failed:`, error);
    
    await supabase
      .from('daily_sync_jobs')
      .update({
        status: 'failed',
        error_message: error?.message || 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: DailyBackgroundSyncRequest = await req.json();
    const { jobId, fromDate, toDate, userId, userEmail, userName, resumeFromDay } = body;

    if (!fromDate || !toDate || !userId || !userEmail || !userName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate job ID if not provided
    const actualJobId = jobId || crypto.randomUUID();

    // Start processing in background
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processDailySync(supabase, actualJobId, fromDate, toDate, userId, userEmail, userName, resumeFromDay)
    ) || processDailySync(supabase, actualJobId, fromDate, toDate, userId, userEmail, userName, resumeFromDay);

    return new Response(
      JSON.stringify({
        success: true,
        jobId: actualJobId,
        message: resumeFromDay ? 'Daily sync resumed' : 'Daily sync started',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Daily Sync] Request error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
