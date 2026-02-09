import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, externalUrl, externalAnonKey, sql, tableName, data } = await req.json();

    console.log(`External Supabase Proxy - Action: ${action}`);

    if (!externalUrl || !externalAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing external Supabase URL or Anon Key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isHtmlError = (msg: unknown) =>
      typeof msg === 'string' && msg.trim().toLowerCase().startsWith('<!doctype html');

    const normalizeExternalError = (err: any) => {
      const message = err?.message ?? String(err);
      if (isHtmlError(message)) {
        return {
          message:
            'Invalid external SUPABASE_URL. Please use the API URL like https://<project-ref>.supabase.co (not the Studio/website URL).',
          code: 'INVALID_SUPABASE_URL',
        };
      }
      return { message, code: err?.code };
    };

    // Create client for external Supabase
    const externalClient = createClient(externalUrl, externalAnonKey);

    let result;

    switch (action) {
      case 'test_connection':
        // Try to execute a simple SQL query to test connection
        const { data: testData, error: testError } = await externalClient.rpc('exec_sql', { sql: 'SELECT 1 as test' });
        if (testError) {
          const e = normalizeExternalError(testError);
          console.error('Test connection error:', e);
          return new Response(
            JSON.stringify({ success: false, error: e.message, code: e.code }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = { success: true, data: testData };
        break;

      case 'fetch_tables':
        // Fetch all tables from the external database
        const { data: tablesData, error: tablesError } = await externalClient.rpc('exec_sql', {
          sql: `
            SELECT 
              t.tablename as name,
              COALESCE(s.n_live_tup, 0)::integer as row_count
            FROM pg_catalog.pg_tables t
            LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname
            WHERE t.schemaname = 'public'
            ORDER BY t.tablename
          `
        });
        if (tablesError) {
          const e = normalizeExternalError(tablesError);
          console.error('Fetch tables error:', e);
          return new Response(
            JSON.stringify({ success: false, error: e.message, code: e.code }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Handle response - exec_sql now returns JSON array for SELECT queries
        let tables = [];
        if (Array.isArray(tablesData)) {
          tables = tablesData;
        } else if (tablesData && typeof tablesData === 'object') {
          // Check if it's an error response from exec_sql
          if (tablesData.error) {
            console.error('exec_sql returned error:', tablesData.error);
            return new Response(
              JSON.stringify({ success: false, error: tablesData.error, detail: tablesData.detail }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          // If it's a single object, wrap in array
          tables = [tablesData];
        }
        
        console.log(`Fetch tables: found ${tables.length} tables`);
        result = { success: true, tables };
        break;

      case 'exec_sql':
        // Execute SQL statement
        if (!sql) {
          return new Response(
            JSON.stringify({ error: 'Missing SQL statement' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('Executing SQL:', sql.substring(0, 200) + (sql.length > 200 ? '...' : ''));
        
        const { data: sqlData, error: sqlError } = await externalClient.rpc('exec_sql', { sql });
        
        if (sqlError) {
          const e = normalizeExternalError(sqlError);
          console.error('Exec SQL error:', e);
          
          // Check if exec_sql function doesn't exist
          if (e.message?.includes('function') || e.message?.includes('PGRST202') || e.message?.includes('does not exist')) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'The exec_sql function does not exist in the external database. Please create it first using the SQL Editor in your Supabase dashboard.',
                code: 'EXEC_SQL_NOT_FOUND',
                hint: 'You need to create the exec_sql database function in the target Supabase project before restoring.'
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: false, error: e.message, code: e.code }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log('SQL executed successfully, result:', JSON.stringify(sqlData).substring(0, 200));
        result = { success: true, data: sqlData };
        break;

      case 'insert_data':
        // Insert data into a table
        if (!tableName || !data) {
          return new Response(
            JSON.stringify({ error: 'Missing table name or data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { data: insertData, error: insertError } = await externalClient
          .from(tableName)
          .upsert(data, { onConflict: 'id', ignoreDuplicates: false });
        
        if (insertError) {
          const e = normalizeExternalError(insertError);
          console.error('Insert data error:', e);
          return new Response(
            JSON.stringify({ success: false, error: e.message, code: e.code }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = { success: true, data: insertData };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Action ${action} completed successfully`);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
