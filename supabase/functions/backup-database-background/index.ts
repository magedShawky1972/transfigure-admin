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

// Generate structure SQL
async function generateStructureSQL(supabase: any): Promise<string> {
  let sql = '-- Edara Database Structure Backup\n';
  sql += `-- Generated at: ${new Date().toISOString()}\n`;
  sql += '-- ================================================\n\n';

  // Get columns info
  const { data: columns } = await supabase.rpc('get_table_columns_info');
  
  // Get user-defined types
  const { data: userDefinedTypes } = await supabase.rpc('get_user_defined_types');
  
  // Get primary keys
  const { data: primaryKeys } = await supabase.rpc('get_primary_keys');
  
  // Get foreign keys
  const { data: foreignKeys } = await supabase.rpc('get_foreign_keys');
  
  // Get indexes
  const { data: indexes } = await supabase.rpc('get_indexes');
  
  // Get functions
  const { data: functions } = await supabase.rpc('get_functions');
  
  // Get triggers
  const { data: triggers } = await supabase.rpc('get_triggers');
  
  // Get RLS policies
  const { data: policies } = await supabase.rpc('get_rls_policies');

  // User-Defined Types (Enums, Domains, etc.)
  if (userDefinedTypes && Array.isArray(userDefinedTypes) && userDefinedTypes.length > 0) {
    sql += '-- ==================== USER-DEFINED TYPES ====================\n\n';
    
    for (const udt of userDefinedTypes) {
      if (udt.type_type === 'enum' && udt.enum_values && Array.isArray(udt.enum_values)) {
        const enumValues = udt.enum_values.map((v: string) => `'${v.replace(/'/g, "''")}'`).join(', ');
        sql += `-- Enum type: ${udt.type_name}\n`;
        sql += `DO $$ BEGIN\n`;
        sql += `  CREATE TYPE public.${udt.type_name} AS ENUM (${enumValues});\n`;
        sql += `EXCEPTION\n`;
        sql += `  WHEN duplicate_object THEN NULL;\n`;
        sql += `END $$;\n\n`;
      }
    }
  }

  // Generate CREATE TABLE statements
  if (columns && Array.isArray(columns) && columns.length > 0) {
    const tableColumns: Record<string, any[]> = {};
    for (const col of columns) {
      if (!tableColumns[col.table_name]) {
        tableColumns[col.table_name] = [];
      }
      tableColumns[col.table_name].push(col);
    }

    const pkMap: Record<string, string[]> = {};
    if (primaryKeys && Array.isArray(primaryKeys)) {
      for (const pk of primaryKeys) {
        if (!pkMap[pk.table_name]) {
          pkMap[pk.table_name] = [];
        }
        pkMap[pk.table_name].push(pk.column_name);
      }
    }

    sql += '-- ==================== TABLES ====================\n\n';

    for (const tableName of Object.keys(tableColumns).sort()) {
      sql += `-- Table: ${tableName}\n`;
      sql += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
      
      const cols = tableColumns[tableName];
      const colDefs: string[] = [];
      
      for (const col of cols) {
        let colDef = `  ${col.column_name} `;
        
        const isUserDefinedType = userDefinedTypes?.some(
          (udt: any) => udt.type_name === col.udt_name
        );
        
        if (isUserDefinedType) {
          colDef += `public.${col.udt_name}`;
        } else if (col.data_type === 'USER-DEFINED') {
          colDef += `public.${col.udt_name}`;
        } else if (col.udt_name === 'uuid') {
          colDef += 'UUID';
        } else if (col.udt_name === 'timestamptz') {
          colDef += 'TIMESTAMP WITH TIME ZONE';
        } else if (col.udt_name === 'timestamp') {
          colDef += 'TIMESTAMP WITHOUT TIME ZONE';
        } else if (col.udt_name === 'int4') {
          colDef += 'INTEGER';
        } else if (col.udt_name === 'int8') {
          colDef += 'BIGINT';
        } else if (col.udt_name === 'float8') {
          colDef += 'DOUBLE PRECISION';
        } else if (col.udt_name === 'float4') {
          colDef += 'REAL';
        } else if (col.udt_name === 'bool') {
          colDef += 'BOOLEAN';
        } else if (col.udt_name === 'jsonb') {
          colDef += 'JSONB';
        } else if (col.udt_name === 'json') {
          colDef += 'JSON';
        } else if (col.udt_name === '_text') {
          colDef += 'TEXT[]';
        } else if (col.udt_name === '_int4') {
          colDef += 'INTEGER[]';
        } else if (col.udt_name === 'varchar' && col.character_maximum_length) {
          colDef += `VARCHAR(${col.character_maximum_length})`;
        } else if (col.udt_name === 'numeric' && col.numeric_precision) {
          colDef += `NUMERIC(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
        } else if (col.data_type) {
          colDef += col.data_type.toUpperCase();
        } else {
          colDef += 'TEXT';
        }
        
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        colDefs.push(colDef);
      }
      
      if (pkMap[tableName] && pkMap[tableName].length > 0) {
        colDefs.push(`  PRIMARY KEY (${pkMap[tableName].join(', ')})`);
      }
      
      sql += colDefs.join(',\n');
      sql += '\n);\n\n';
    }
  }

  // Foreign Keys
  if (foreignKeys && Array.isArray(foreignKeys) && foreignKeys.length > 0) {
    sql += '-- ==================== FOREIGN KEYS ====================\n\n';
    for (const fk of foreignKeys) {
      sql += `ALTER TABLE public.${fk.table_name}\n`;
      sql += `  ADD CONSTRAINT ${fk.constraint_name}\n`;
      sql += `  FOREIGN KEY (${fk.column_name})\n`;
      sql += `  REFERENCES public.${fk.foreign_table_name}(${fk.foreign_column_name});\n\n`;
    }
  }

  // Indexes
  if (indexes && Array.isArray(indexes) && indexes.length > 0) {
    sql += '-- ==================== INDEXES ====================\n\n';
    for (const idx of indexes) {
      if (idx.indexname && !idx.indexname.endsWith('_pkey')) {
        sql += `${idx.indexdef};\n`;
      }
    }
    sql += '\n';
  }

  // Functions
  if (functions && Array.isArray(functions) && functions.length > 0) {
    sql += '-- ==================== FUNCTIONS ====================\n\n';
    for (const func of functions) {
      if (func.function_definition) {
        sql += `${func.function_definition};\n\n`;
      }
    }
  }

  // Triggers
  if (triggers && Array.isArray(triggers) && triggers.length > 0) {
    sql += '-- ==================== TRIGGERS ====================\n\n';
    for (const trigger of triggers) {
      if (trigger.trigger_name && trigger.event_object_table) {
        sql += `CREATE TRIGGER ${trigger.trigger_name}\n`;
        sql += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
        sql += `  ON public.${trigger.event_object_table}\n`;
        sql += `  FOR EACH ROW\n`;
        sql += `  ${trigger.action_statement};\n\n`;
      }
    }
  }

  // RLS Policies
  if (policies && Array.isArray(policies) && policies.length > 0) {
    sql += '-- ==================== RLS POLICIES ====================\n\n';
    
    const tablesWithRLS = [...new Set(policies.map((p: any) => p.tablename))];
    for (const table of tablesWithRLS) {
      sql += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n`;
    }
    sql += '\n';
    
    for (const policy of policies) {
      if (policy.policyname && policy.tablename) {
        sql += `CREATE POLICY "${policy.policyname}"\n`;
        sql += `  ON public.${policy.tablename}\n`;
        sql += `  AS ${policy.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'}\n`;
        sql += `  FOR ${policy.cmd}\n`;
        sql += `  TO ${policy.roles || 'public'}\n`;
        if (policy.qual) {
          sql += `  USING (${policy.qual})\n`;
        }
        if (policy.with_check) {
          sql += `  WITH CHECK (${policy.with_check})\n`;
        }
        sql += ';\n\n';
      }
    }
  }

  return sql;
}

// Compress and upload file
async function compressAndUpload(supabase: any, content: string, filePath: string): Promise<number> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

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

  const blob = new Blob([compressedData], { type: 'application/gzip' });
  const { error: uploadError } = await supabase.storage
    .from('system-backups')
    .upload(filePath, blob, {
      contentType: 'application/gzip',
      upsert: false
    });

  if (uploadError) throw uploadError;
  
  return totalLength;
}

// Fetch ALL rows from a table using proper pagination (same logic as database-backup)
async function fetchAllTableRows(supabase: any, tableName: string): Promise<unknown[]> {
  const pageSize = 1000; // Supabase max per request
  const allRows: unknown[] = [];
  let from = 0;
  let keepGoing = true;

  while (keepGoing) {
    const { data: rows, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.log(`[Background Backup] Error fetching ${tableName} at offset ${from}: ${error.message}`);
      break;
    }

    if (!rows || rows.length === 0) {
      keepGoing = false;
      break;
    }

    allRows.push(...rows);
    from += rows.length;

    // If we got fewer rows than pageSize, we've reached the end
    if (rows.length < pageSize) {
      keepGoing = false;
    }
  }

  return allRows;
}

// Check if force_kill is set
async function checkForceKill(supabase: any, backupId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_backups')
    .select('force_kill')
    .eq('id', backupId)
    .single();
  
  if (error) {
    console.log(`[Background Backup] Error checking force_kill: ${error.message}`);
    return false;
  }
  
  return data?.force_kill === true;
}

// Background backup task - creates BOTH structure and data backups
async function runBackupTask(structureBackupId: string, dataBackupId: string, userId: string | null, isScheduled: boolean) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[Background Backup] Starting backup task - Structure: ${structureBackupId}, Data: ${dataBackupId}`);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    // ========== PHASE 1: Structure Backup ==========
    console.log(`[Background Backup] Phase 1: Structure backup`);
    
    const structureFilename = `edara_structure_${timestamp}.sql.gz`;
    const structureFilePath = `structure/${structureFilename}`;

    await supabase
      .from('system_backups')
      .update({
        status: 'processing',
        progress_phase: 'structure',
        progress_percent: 5,
        file_name: structureFilename,
        file_path: structureFilePath
      })
      .eq('id', structureBackupId);

    // Generate structure SQL
    const structureSQL = await generateStructureSQL(supabase);
    
    await supabase
      .from('system_backups')
      .update({ progress_percent: 15 })
      .eq('id', structureBackupId);

    // Compress and upload structure
    const structureSize = await compressAndUpload(supabase, structureSQL, structureFilePath);

    // Mark structure backup as completed
    await supabase
      .from('system_backups')
      .update({
        status: 'completed',
        progress_phase: 'complete',
        progress_percent: 100,
        file_size: structureSize,
        completed_at: new Date().toISOString()
      })
      .eq('id', structureBackupId);

    console.log(`[Background Backup] Structure backup completed: ${structureSize} bytes`);

    // ========== PHASE 2: Data Backup ==========
    console.log(`[Background Backup] Phase 2: Data backup`);
    
    const dataFilename = `edara_data_${timestamp}.sql.gz`;
    const dataFilePath = `data/${dataFilename}`;

    await supabase
      .from('system_backups')
      .update({
        status: 'processing',
        progress_phase: 'fetching_tables',
        progress_percent: 0,
        file_name: dataFilename,
        file_path: dataFilePath
      })
      .eq('id', dataBackupId);

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
    let totalRowsExpected = 0;
    for (const tbl of tableNames) {
      try {
        const { count } = await supabase
          .from(tbl)
          .select('*', { count: 'exact', head: true });
        rowCounts[tbl] = count || 0;
        totalRowsExpected += count || 0;
      } catch (e) {
        rowCounts[tbl] = 0;
      }
    }

    // Update with totals
    await supabase
      .from('system_backups')
      .update({
        tables_total: tableNames.length,
        rows_total: totalRowsExpected,
        progress_phase: 'exporting_data',
        progress_percent: 5
      })
      .eq('id', dataBackupId);

    console.log(`[Background Backup] Found ${tableNames.length} tables, ${totalRowsExpected} total rows`);

    // Check force_kill before starting data export
    if (await checkForceKill(supabase, dataBackupId) || await checkForceKill(supabase, structureBackupId)) {
      console.log('[Background Backup] Force kill detected before data export');
      await supabase
        .from('system_backups')
        .update({
          status: 'failed',
          progress_phase: 'stopped',
          error_message: 'Backup was force stopped by user'
        })
        .in('id', [structureBackupId, dataBackupId]);
      return;
    }

    // Build SQL content - fetch ALL rows from each table using proper pagination
    const sqlParts: string[] = [];
    
    sqlParts.push('-- Edara Database Data Backup\n');
    sqlParts.push(`-- Generated at: ${new Date().toISOString()}\n`);
    sqlParts.push(`-- Backup Type: ${isScheduled ? 'Scheduled' : 'Manual Background'}\n`);
    sqlParts.push('-- ================================================\n\n');

    let tablesProcessed = 0;
    let rowsProcessed = 0;

    for (const tableName of tableNames) {
      const tableRowCount = rowCounts[tableName] || 0;
      
      if (tableRowCount === 0) {
        tablesProcessed++;
        continue;
      }

      console.log(`[Background Backup] Fetching table: ${tableName} (${tableRowCount} rows expected)`);

      // Fetch ALL rows from this table using proper pagination
      const allRows = await fetchAllTableRows(supabase, tableName);

      if (allRows.length > 0) {
        const columns = Object.keys(allRows[0] as Record<string, any>);
        sqlParts.push(`-- ==================== ${tableName.toUpperCase()} (${allRows.length.toLocaleString()} rows) ====================\n\n`);

        for (const row of allRows) {
          const rowObj = row as Record<string, any>;
          const values = columns.map((col) => escapeValue(rowObj[col]));
          sqlParts.push(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`);
        }

        sqlParts.push('\n');
        rowsProcessed += allRows.length;
        
        console.log(`[Background Backup] Table ${tableName}: fetched ${allRows.length} rows`);
      }

      tablesProcessed++;

      // Update progress every 3 tables and check for force_kill
      if (tablesProcessed % 3 === 0 || tablesProcessed === tableNames.length) {
        // Check for force_kill
        if (await checkForceKill(supabase, dataBackupId) || await checkForceKill(supabase, structureBackupId)) {
          console.log(`[Background Backup] Force kill detected at table ${tablesProcessed}/${tableNames.length}`);
          await supabase
            .from('system_backups')
            .update({
              status: 'failed',
              progress_phase: 'stopped',
              error_message: 'Backup was force stopped by user'
            })
            .in('id', [structureBackupId, dataBackupId]);
          return;
        }

        const progressPercent = Math.min(90, Math.floor((rowsProcessed / Math.max(1, totalRowsExpected)) * 85) + 5);
        await supabase
          .from('system_backups')
          .update({
            tables_processed: tablesProcessed,
            rows_processed: rowsProcessed,
            progress_percent: progressPercent
          })
          .eq('id', dataBackupId);
      }
    }

    console.log(`[Background Backup] SQL generation complete: ${tablesProcessed} tables, ${rowsProcessed} rows`);

    // Update to compression phase
    await supabase
      .from('system_backups')
      .update({
        progress_phase: 'compressing',
        progress_percent: 92
      })
      .eq('id', dataBackupId);

    // Compress and upload
    const sqlContent = sqlParts.join('');
    
    await supabase
      .from('system_backups')
      .update({
        progress_phase: 'uploading',
        progress_percent: 95
      })
      .eq('id', dataBackupId);

    const dataSize = await compressAndUpload(supabase, sqlContent, dataFilePath);

    console.log(`[Background Backup] Data upload complete: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);

    // Update data backup record as completed
    await supabase
      .from('system_backups')
      .update({
        status: 'completed',
        progress_phase: 'complete',
        progress_percent: 100,
        file_size: dataSize,
        completed_at: new Date().toISOString()
      })
      .eq('id', dataBackupId);

    console.log(`[Background Backup] Both backups completed successfully`);

    // Update schedule if this was a scheduled backup
    if (isScheduled) {
      await supabase
        .from('backup_schedule')
        .update({ 
          last_run_at: new Date().toISOString(),
          next_run_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('is_enabled', true);
    }

  } catch (error) {
    console.error('[Background Backup] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update both backup records as failed
    await supabase
      .from('system_backups')
      .update({
        status: 'failed',
        progress_phase: 'error',
        error_message: errorMessage
      })
      .in('id', [structureBackupId, dataBackupId]);
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Create structure backup record
      const { data: structureRecord, error: structureError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'structure',
          file_name: `edara_structure_${timestamp}.sql.gz`,
          file_path: `structure/edara_structure_${timestamp}.sql.gz`,
          status: 'pending',
          progress_phase: 'pending',
          progress_percent: 0,
          created_by: userId || null
        })
        .select()
        .single();

      if (structureError) throw structureError;

      // Create data backup record
      const { data: dataRecord, error: dataError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'data',
          file_name: `edara_data_${timestamp}.sql.gz`,
          file_path: `data/edara_data_${timestamp}.sql.gz`,
          status: 'pending',
          progress_phase: 'pending',
          progress_percent: 0,
          created_by: userId || null,
          parent_backup_id: structureRecord.id
        })
        .select()
        .single();

      if (dataError) throw dataError;

      // Start background task
      (globalThis as any).EdgeRuntime.waitUntil(
        runBackupTask(structureRecord.id, dataRecord.id, userId, isScheduled)
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Background backup started (structure + data)',
          structureBackupId: structureRecord.id,
          dataBackupId: dataRecord.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'check-schedule') {
      console.log('[Background Backup] Cron check-schedule triggered');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Create structure backup record
      const { data: structureRecord, error: structureError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'structure',
          file_name: `edara_scheduled_structure_${timestamp}.sql.gz`,
          file_path: `structure/edara_scheduled_structure_${timestamp}.sql.gz`,
          status: 'pending',
          progress_phase: 'pending',
          progress_percent: 0,
          created_by: null
        })
        .select()
        .single();

      if (structureError) throw structureError;

      // Create data backup record
      const { data: dataRecord, error: dataError } = await supabase
        .from('system_backups')
        .insert({
          backup_type: 'data',
          file_name: `edara_scheduled_data_${timestamp}.sql.gz`,
          file_path: `data/edara_scheduled_data_${timestamp}.sql.gz`,
          status: 'pending',
          progress_phase: 'pending',
          progress_percent: 0,
          created_by: null,
          parent_backup_id: structureRecord.id
        })
        .select()
        .single();

      if (dataError) throw dataError;

      // Start background task
      (globalThis as any).EdgeRuntime.waitUntil(
        runBackupTask(structureRecord.id, dataRecord.id, null, true)
      );

      console.log(`[Background Backup] Scheduled backup started - Structure: ${structureRecord.id}, Data: ${dataRecord.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Scheduled backup started',
          structureBackupId: structureRecord.id,
          dataBackupId: dataRecord.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'status') {
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
