import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Escape SQL value helper
const escapeValue = (value: any): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

// Background backup task
async function runBackupTask(backupId: string, userId: string | null, isScheduled: boolean) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[Background Backup] Starting backup task: ${backupId}`);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `edara_data_${timestamp}.sql.gz`;
  const filePath = `data/${filename}`;

  try {
    // Update backup record to processing
    await supabase
      .from('system_backups')
      .update({
        status: 'processing',
        file_name: filename,
        file_path: filePath
      })
      .eq('id', backupId);

    // Get table list + counts
    const { data: colData } = await supabase.rpc('get_table_columns_info');
    const columnsData = colData as Array<{ table_name: string }> || [];
    const tableNameSet = new Set<string>();
    for (const c of columnsData) {
      tableNameSet.add(String(c.table_name));
    }
    const tableNames = Array.from(tableNameSet).sort();

    // Get row counts
    const rowCounts: Record<string, number> = {};
    for (const tbl of tableNames) {
      try {
        const { count } = await supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true });
        rowCounts[tbl] = count || 0;
      } catch (e) {
        rowCounts[tbl] = 0;
      }
    }

    console.log(`[Background Backup] Found ${tableNames.length} tables`);

    // Build SQL content
    const chunkSize = 2000;
    const sqlParts: string[] = [];
    
    // Header
    sqlParts.push('-- Edara Database Data Backup\n');
    sqlParts.push(`-- Generated at: ${new Date().toISOString()}\n`);
    sqlParts.push(`-- Backup Type: ${isScheduled ? 'Scheduled' : 'Manual Background'}\n`);
    sqlParts.push('-- ================================================\n\n');

    let exportedTables = 0;
    let totalRows = 0;

    for (const tableName of tableNames) {
      const tableRowCount = rowCounts[tableName] || 0;
      if (tableRowCount === 0) continue;

      exportedTables++;
      const chunksTotal = Math.ceil(tableRowCount / chunkSize) || 1;
      let columns: string[] | null = null;
      let wroteHeader = false;
      let tableRows = 0;

      for (let chunkIndex = 0; chunkIndex < chunksTotal; chunkIndex++) {
        const offset = chunkIndex * chunkSize;
        
        const { data: rows, error } = await supabase
          .from(tableName)
          .select('*')
          .range(offset, offset + chunkSize - 1);

        if (error || !rows || rows.length === 0) {
          if (error) console.log(`[Background Backup] Error fetching ${tableName}: ${error.message}`);
          break;
        }

        if (!columns) {
          columns = Object.keys(rows[0]);
          sqlParts.push(`-- ==================== ${tableName.toUpperCase()} (${tableRowCount.toLocaleString()} rows) ====================\n\n`);
          wroteHeader = true;
        }

        for (const row of rows) {
          const values = columns.map((col) => escapeValue(row?.[col]));
          sqlParts.push(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`);
        }
        
        tableRows += rows.length;
        totalRows += rows.length;

        if (rows.length < chunkSize) break;
      }

      if (wroteHeader) {
        sqlParts.push('\n');
      }

      // Log progress every 10 tables
      if (exportedTables % 10 === 0) {
        console.log(`[Background Backup] Processed ${exportedTables} tables, ${totalRows} rows`);
      }
    }

    console.log(`[Background Backup] SQL generation complete: ${exportedTables} tables, ${totalRows} rows`);

    // Compress the SQL content
    const sqlContent = sqlParts.join('');
    const encoder = new TextEncoder();
    const data = encoder.encode(sqlContent);

    const readableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });

    const compressedStream = readableStream.pipeThrough(new CompressionStream('gzip'));
    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const compressedData = new Uint8Array(totalLength);
    let byteOffset = 0;
    for (const c of chunks) {
      compressedData.set(c, byteOffset);
      byteOffset += c.length;
    }

    console.log(`[Background Backup] Compressed size: ${(totalLength / 1024 / 1024).toFixed(2)} MB`);

    // Upload to storage
    const blob = new Blob([compressedData], { type: 'application/gzip' });
    const { error: uploadError } = await supabase.storage
      .from('system-backups')
      .upload(filePath, blob, {
        contentType: 'application/gzip',
        upsert: false
      });

    if (uploadError) throw uploadError;

    console.log(`[Background Backup] Upload complete`);

    // Update backup record as completed
    await supabase
      .from('system_backups')
      .update({
        status: 'completed',
        file_size: totalLength,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupId);

    console.log(`[Background Backup] Backup completed successfully: ${backupId}`);

  } catch (error) {
    console.error('[Background Backup] Error:', error);
    
    // Update backup record as failed
    await supabase
      .from('system_backups')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', backupId);
  }
}

// Handle shutdown gracefully
addEventListener('beforeunload', (ev) => {
  console.log('[Background Backup] Function shutdown due to:', (ev as any).detail?.reason);
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, userId, isScheduled = false } = body;

    console.log(`[Background Backup] Action: ${action}, User: ${userId}, Scheduled: ${isScheduled}`);

    if (action === 'start') {
      // Create pending backup record
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `edara_data_${timestamp}.sql.gz`;
      const filePath = `data/${filename}`;

      const { data: backupRecord, error: insertError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'data',
          file_name: filename,
          file_path: filePath,
          status: 'pending',
          created_by: userId || null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const backupId = backupRecord.id;

      // Start background task
      (globalThis as any).EdgeRuntime.waitUntil(
        runBackupTask(backupId, userId, isScheduled)
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Background backup started',
          backupId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check-schedule') {
      // Called by cron - check if we should run a scheduled backup
      console.log('[Background Backup] Cron check-schedule triggered');
      
      // The cron job SQL already filters for enabled schedules that haven't run today
      // So if we get here, we should run the backup
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `edara_scheduled_${timestamp}.sql.gz`;
      const filePath = `data/${filename}`;

      const { data: backupRecord, error: insertError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'data',
          file_name: filename,
          file_path: filePath,
          status: 'pending',
          created_by: null
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update schedule last_run_at
      await supabase
        .from('backup_schedule')
        .update({ 
          last_run_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('is_enabled', true);

      const backupId = backupRecord.id;

      // Start background task
      (globalThis as any).EdgeRuntime.waitUntil(
        runBackupTask(backupId, null, true)
      );

      console.log(`[Background Backup] Scheduled backup started: ${backupId}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Scheduled backup started',
          backupId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'status') {
      // Get backup status
      const { backupId } = body;
      
      if (!backupId) {
        return new Response(
          JSON.stringify({ error: 'backupId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: backup, error } = await supabase
        .from('system_backups')
        .select('*')
        .eq('id', backupId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, backup }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "start", "check-schedule", or "status"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[Background Backup] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
