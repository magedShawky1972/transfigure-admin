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

    // Create client for external Supabase
    const externalClient = createClient(externalUrl, externalAnonKey);

    let result;

    switch (action) {
      case 'test_connection':
        // Try to execute a simple SQL query to test connection
        const { data: testData, error: testError } = await externalClient.rpc('exec_sql', { sql: 'SELECT 1 as test' });
        if (testError) {
          console.error('Test connection error:', testError);
          return new Response(
            JSON.stringify({ success: false, error: testError.message, code: testError.code }),
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
          console.error('Fetch tables error:', tablesError);
          return new Response(
            JSON.stringify({ success: false, error: tablesError.message, code: tablesError.code }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = { success: true, tables: tablesData || [] };
        break;

      case 'exec_sql':
        // Execute SQL statement
        if (!sql) {
          return new Response(
            JSON.stringify({ error: 'Missing SQL statement' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { data: sqlData, error: sqlError } = await externalClient.rpc('exec_sql', { sql });
        if (sqlError) {
          console.error('Exec SQL error:', sqlError);
          return new Response(
            JSON.stringify({ success: false, error: sqlError.message, code: sqlError.code }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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
          console.error('Insert data error:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: insertError.message, code: insertError.code }),
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
