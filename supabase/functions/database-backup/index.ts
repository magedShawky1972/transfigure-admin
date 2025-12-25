import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type } = body; // 'structure' or 'data'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting database backup: ${type}`);

    if (type === 'structure') {
      // Get all schema information using RPC functions
      const [
        columnsRes,
        primaryKeysRes,
        foreignKeysRes,
        indexesRes,
        policiesRes,
        functionsRes,
        triggersRes
      ] = await Promise.all([
        supabase.rpc('get_table_columns_info'),
        supabase.rpc('get_primary_keys_info'),
        supabase.rpc('get_foreign_keys_info'),
        supabase.rpc('get_indexes_info'),
        supabase.rpc('get_rls_policies_info'),
        supabase.rpc('get_db_functions_info'),
        supabase.rpc('get_triggers_info')
      ]);

      if (columnsRes.error) {
        console.error('Error fetching columns:', columnsRes.error);
      }

      // Get row counts for each table
      const columnsData = columnsRes.data as Array<{ table_name: string }> || [];
      const tableNameSet = new Set<string>();
      for (const c of columnsData) {
        tableNameSet.add(String(c.table_name));
      }
      const tableNames = Array.from(tableNameSet);
      
      const tableRowCounts: Record<string, number> = {};

      for (const tbl of tableNames) {
        try {
          const { count } = await supabase
            .from(tbl)
            .select('*', { count: 'exact', head: true });
          tableRowCounts[tbl] = count || 0;
        } catch (e) {
          tableRowCounts[tbl] = 0;
        }
      }

      console.log(`Found ${tableNames.length} tables, ${(functionsRes.data || []).length} functions, ${(triggersRes.data || []).length} triggers, ${(policiesRes.data || []).length} policies`);

      return new Response(
        JSON.stringify({
          success: true,
          type: 'structure',
          data: {
            columns: columnsRes.data || [],
            primaryKeys: primaryKeysRes.data || [],
            foreignKeys: foreignKeysRes.data || [],
            indexes: indexesRes.data || [],
            policies: policiesRes.data || [],
            functions: functionsRes.data || [],
            triggers: triggersRes.data || [],
            tableRowCounts
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'data') {
      const requestedTables = body.tables as string[] | undefined; // optional: export only specific tables
      const maxRowsPerTable = body.maxRows as number || 10000; // default 10k limit to avoid timeout

      // Get all tables from columns info
      const { data: colData } = await supabase.rpc('get_table_columns_info');
      const columnsData = colData as Array<{ table_name: string }> || [];
      const tableNameSet = new Set<string>();
      for (const c of columnsData) {
        tableNameSet.add(String(c.table_name));
      }
      let tableNames = Array.from(tableNameSet);

      // If specific tables requested, filter
      if (requestedTables && requestedTables.length > 0) {
        tableNames = tableNames.filter(t => requestedTables.includes(t));
      }

      const tableData: Record<string, unknown[]> = {};
      const tableTruncated: Record<string, boolean> = {};
      let totalRows = 0;

      for (const tbl of tableNames) {
        try {
          const pageSize = 1000;
          const allRows: unknown[] = [];
          let from = 0;
          let keepGoing = true;

          while (keepGoing && allRows.length < maxRowsPerTable) {
            const remaining = maxRowsPerTable - allRows.length;
            const fetchSize = Math.min(pageSize, remaining);

            const { data: rows, error } = await supabase
              .from(tbl)
              .select('*')
              .range(from, from + fetchSize - 1);

            if (error) {
              console.log(`Error fetching ${tbl}: ${error.message}`);
              break;
            }

            if (!rows || rows.length === 0) {
              keepGoing = false;
              break;
            }

            allRows.push(...rows);
            from += rows.length;

            if (rows.length < fetchSize) {
              keepGoing = false;
            }
          }

          if (allRows.length > 0) {
            tableData[tbl] = allRows;
            totalRows += allRows.length;
            
            // Check if we hit the limit (table may have more rows)
            if (allRows.length >= maxRowsPerTable) {
              tableTruncated[tbl] = true;
            }
            
            console.log(`Fetched ${allRows.length} rows from ${tbl}${tableTruncated[tbl] ? ' (truncated)' : ''}`);
          }
        } catch (e) {
          console.log(`Error accessing table ${tbl}:`, e);
        }
      }

      console.log(`Total rows fetched: ${totalRows}`);

      return new Response(
        JSON.stringify({
          success: true,
          type: 'data',
          data: tableData,
          truncated: tableTruncated,
          maxRowsPerTable
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Use "structure" or "data"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error processing backup request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
