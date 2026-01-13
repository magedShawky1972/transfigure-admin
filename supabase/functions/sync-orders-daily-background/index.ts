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

// Build aggregated invoices from transactions for a specific date
async function buildAggregatedInvoicesForDate(
  supabase: any,
  targetDate: string,
  nonStockSkus: Set<string>
): Promise<AggregatedInvoice[]> {
  const targetDateInt = Number(targetDate.replace(/-/g, ''));

  // Fetch transaction lines for this date
  const { data: tx, error } = await supabase
    .from('purpletransaction')
    .select(
      [
        'order_number',
        'created_at_date',
        'created_at_date_int',
        'brand_name',
        'brand_code',
        'payment_method',
        'payment_brand',
        'user_name',
        'product_id',
        'product_name',
        'unit_price',
        'qty',
        'total',
        'company',
        'is_deleted',
        'sendodoo',
      ].join(',')
    )
    .eq('created_at_date_int', targetDateInt)
    .neq('payment_method', 'point')
    .neq('is_deleted', true);

  if (error) {
    console.error(`[Daily Sync] Error fetching transactions for ${targetDate}:`, error);
    return [];
  }

  const transactions = (tx || []).filter((t: any) => !!t?.order_number);

  if (transactions.length === 0) {
    console.log(`[Daily Sync] No transactions found for ${targetDate}`);
    return [];
  }

  // Filter out already-synced original orders (aggregated mapping)
  const uniqueOrderNumbers = Array.from(new Set(transactions.map((t: any) => t.order_number)));
  const { data: existingMappings, error: mappingError } = await supabase
    .from('aggregated_order_mapping')
    .select('original_order_number')
    .in('original_order_number', uniqueOrderNumbers);

  if (mappingError) {
    console.error('[Daily Sync] Error checking aggregated_order_mapping:', mappingError);
  }

  const alreadyMapped = new Set<string>((existingMappings || []).map((m: any) => m.original_order_number));
  const unsyncedTransactions = transactions.filter((t: any) => !alreadyMapped.has(t.order_number));

  if (unsyncedTransactions.length === 0) {
    console.log(`[Daily Sync] All orders for ${targetDate} are already aggregated/synced`);
    return [];
  }

  console.log(`[Daily Sync] Found ${unsyncedTransactions.length} transaction lines for ${targetDate}`);

  // Group by invoice criteria: brand, payment_method, payment_brand, user_name
  const invoiceMap = new Map<
    string,
    {
      brandName: string;
      paymentMethod: string;
      paymentBrand: string;
      userName: string;
      company: string;
      brandCode: string;
      lines: any[];
      originalOrderNumbers: Set<string>;
    }
  >();

  for (const line of unsyncedTransactions) {
    const brandName = line.brand_name || '';
    const paymentMethod = line.payment_method || '';
    const paymentBrand = line.payment_brand || '';
    const userName = line.user_name || '';
    const key = `${brandName}|${paymentMethod}|${paymentBrand}|${userName}`;

    if (!invoiceMap.has(key)) {
      invoiceMap.set(key, {
        brandName,
        paymentMethod,
        paymentBrand,
        userName,
        company: line.company || '',
        brandCode: line.brand_code || '',
        lines: [],
        originalOrderNumbers: new Set(),
      });
    }

    const group = invoiceMap.get(key)!;
    group.lines.push(line);
    group.originalOrderNumbers.add(line.order_number);
  }

  // Determine starting sequence for this date from existing mappings
  const dateStr = targetDate.replace(/-/g, '');
  let seq = 0;
  const { data: lastMapping } = await supabase
    .from('aggregated_order_mapping')
    .select('aggregated_order_number')
    .eq('aggregation_date', targetDate)
    .order('aggregated_order_number', { ascending: false })
    .limit(1);

  if (lastMapping && lastMapping.length > 0) {
    const last = String(lastMapping[0].aggregated_order_number || '');
    const lastSeq = parseInt(last.slice(-4), 10);
    if (!Number.isNaN(lastSeq)) seq = lastSeq;
  }

  const aggregatedInvoices: AggregatedInvoice[] = [];

  for (const group of invoiceMap.values()) {
    // Aggregate product lines by product_id and unit_price (same as batch screen)
    const productMap = new Map<
      string,
      {
        productSku: string;
        productName: string;
        unitPrice: number;
        totalQty: number;
        totalAmount: number;
      }
    >();

    let hasNonStock = false;

    for (const line of group.lines) {
      const sku = (line.product_id || '').toString();
      const unitPrice = Number(line.unit_price) || 0;
      const productKey = `${sku}|${unitPrice}`;

      if (sku && nonStockSkus.has(sku)) hasNonStock = true;

      const existing = productMap.get(productKey);
      if (existing) {
        existing.totalQty += Number(line.qty) || 0;
        existing.totalAmount += Number(line.total) || 0;
      } else {
        productMap.set(productKey, {
          productSku: sku,
          productName: line.product_name || '',
          unitPrice,
          totalQty: Number(line.qty) || 0,
          totalAmount: Number(line.total) || 0,
        });
      }
    }

    const productLines = Array.from(productMap.values()).sort((a, b) => a.productSku.localeCompare(b.productSku));

    seq += 1;
    const orderNumber = `${dateStr}${String(seq).padStart(4, '0')}`;

    aggregatedInvoices.push({
      orderNumber,
      date: targetDate,
      brandName: group.brandName,
      paymentMethod: group.paymentMethod,
      paymentBrand: group.paymentBrand,
      userName: group.userName,
      productLines,
      grandTotal: productLines.reduce((sum, p) => sum + p.totalAmount, 0),
      originalOrderNumbers: Array.from(group.originalOrderNumbers),
      brandCode: group.brandCode,
      company: group.company,
      hasNonStock,
    });
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
  resumeFromDay?: string,
  isNewStart: boolean = false
) {
  const invocationStart = Date.now();
  const MAX_RUNTIME_MS = 25_000; // 25 seconds max per invocation
  
  console.log(`[Daily Sync] ${resumeFromDay ? 'Resuming from ' + resumeFromDay : 'Starting'} job ${jobId} for ${fromDate} to ${toDate}`);

  const scheduleContinuation = async (nextDay: string) => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // If job was deleted/cancelled, do NOT reschedule
    const { data: jobState } = await supabase
      .from('daily_sync_jobs')
      .select('status')
      .eq('id', jobId)
      .maybeSingle();

    if (!jobState) {
      console.log(`[Daily Sync] Not scheduling continuation because job ${jobId} no longer exists`);
      return;
    }

    if (jobState.status !== 'running') {
      console.log(`[Daily Sync] Not scheduling continuation because job ${jobId} status=${jobState.status}`);
      return;
    }

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
    let { data: job, error: jobFetchError } = await supabase
      .from('daily_sync_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (jobFetchError) {
      console.error('[Daily Sync] Failed to fetch job:', jobFetchError);
    }

    if (!job) {
      // If this is a continuation/resume AND job no longer exists (e.g. user deleted it), stop.
      if (!isNewStart) {
        console.log(`[Daily Sync] Job ${jobId} not found (likely deleted). Stopping.`);
        return;
      }

      // Create new job (fresh start)
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
        .maybeSingle();

      // If deleted, stop immediately
      if (!jobCheck) {
        console.log(`[Daily Sync] Job ${jobId} deleted. Stopping.`);
        return;
      }

      if (jobCheck.status === 'paused' || jobCheck.status === 'cancelled') {
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

        // Always persist the "will send" count immediately (so UI doesn't show 0)
        dayStatuses[currentDate] = {
          ...dayStatuses[currentDate],
          date: currentDate,
          total_orders: aggregatedInvoices.length,
        };

        await supabase
          .from('daily_sync_jobs')
          .update({ day_statuses: dayStatuses, current_day: currentDate })
          .eq('id', jobId);

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

          await supabase
            .from('daily_sync_jobs')
            .update({ day_statuses: dayStatuses })
            .eq('id', jobId);

          continue;
        }

        // Generate a unique job ID for this day's aggregated sync
        const dayJobId = crypto.randomUUID();

        // Store the background job id for UI tracking
        (dayStatuses as any)[currentDate] = {
          ...(dayStatuses as any)[currentDate],
          background_job_id: dayJobId,
        };

        await supabase
          .from('daily_sync_jobs')
          .update({ day_statuses: dayStatuses })
          .eq('id', jobId);

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
            aggregatedInvoices,
          }),
        });

        const result = await response.json().catch(() => ({}));

        // Poll background job for progress + completion
        if (result.success && result.jobId) {
          let attempts = 0;
          const maxAttempts = 120; // 10 minutes max wait

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5s

            const { data: bgJob } = await supabase
              .from('background_sync_jobs')
              .select('status,total_orders,processed_orders,successful_orders,failed_orders,skipped_orders,error_message')
              .eq('id', result.jobId)
              .maybeSingle();

            if (bgJob) {
              // Update progress continuously so UI shows a moving progress bar
              dayStatuses[currentDate] = {
                date: currentDate,
                status: bgJob.status === 'running' ? 'running' : bgJob.status === 'completed' ? 'completed' : 'failed',
                total_orders: bgJob.total_orders || aggregatedInvoices.length,
                successful_orders: bgJob.successful_orders || 0,
                failed_orders: bgJob.failed_orders || 0,
                skipped_orders: bgJob.skipped_orders || 0,
                completed_at:
                  bgJob.status === 'completed' || bgJob.status === 'failed' || bgJob.status === 'cancelled'
                    ? new Date().toISOString()
                    : undefined,
                error_message: bgJob.error_message,
              };

              await supabase
                .from('daily_sync_jobs')
                .update({ day_statuses: dayStatuses })
                .eq('id', jobId);

              if (bgJob.status === 'completed' || bgJob.status === 'failed' || bgJob.status === 'cancelled') {
                break;
              }
            }

            attempts++;

            // If we hit runtime limit, persist state + continue later (same day)
            const elapsedMs = Date.now() - invocationStart;
            if (elapsedMs > MAX_RUNTIME_MS) {
              await supabase
                .from('daily_sync_jobs')
                .update({ day_statuses: dayStatuses, current_day: currentDate })
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
            total_orders: aggregatedInvoices.length,
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
          total_orders: dayStatuses[currentDate]?.total_orders || 0,
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

    // Only create a new DB job row when jobId is not provided (fresh start)
    const isNewStart = !jobId;

    // Start processing in background
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      processDailySync(supabase, actualJobId, fromDate, toDate, userId, userEmail, userName, resumeFromDay, isNewStart)
    ) || processDailySync(supabase, actualJobId, fromDate, toDate, userId, userEmail, userName, resumeFromDay, isNewStart);

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
