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
    const { type } = await req.json(); // 'structure' or 'data'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting database backup: ${type}`);

    if (type === 'structure') {
      // Get all tables
      const { data: tables, error: tablesError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `
      });

      // Get table definitions with columns
      const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            c.table_name,
            c.column_name,
            c.data_type,
            c.column_default,
            c.is_nullable,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.udt_name
          FROM information_schema.columns c
          WHERE c.table_schema = 'public'
          ORDER BY c.table_name, c.ordinal_position
        `
      });

      // Get primary keys
      const { data: primaryKeys } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            tc.table_name,
            kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
        `
      });

      // Get foreign keys
      const { data: foreignKeys } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        `
      });

      // Get functions
      const { data: functions } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            p.proname AS function_name,
            pg_get_functiondef(p.oid) AS function_definition
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          ORDER BY p.proname
        `
      });

      // Get triggers
      const { data: triggers } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            trigger_name,
            event_manipulation,
            event_object_table,
            action_statement,
            action_timing
          FROM information_schema.triggers
          WHERE trigger_schema = 'public'
          ORDER BY event_object_table, trigger_name
        `
      });

      // Get views
      const { data: views } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            table_name AS view_name,
            view_definition
          FROM information_schema.views
          WHERE table_schema = 'public'
          ORDER BY table_name
        `
      });

      // Get indexes
      const { data: indexes } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            indexname,
            tablename,
            indexdef
          FROM pg_indexes
          WHERE schemaname = 'public'
          ORDER BY tablename, indexname
        `
      });

      // Get sequences
      const { data: sequences } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT sequence_name
          FROM information_schema.sequences
          WHERE sequence_schema = 'public'
          ORDER BY sequence_name
        `
      });

      // Get RLS policies
      const { data: policies } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE schemaname = 'public'
          ORDER BY tablename, policyname
        `
      });

      // Get enums/custom types
      const { data: enums } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            t.typname AS enum_name,
            array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_namespace n ON t.typnamespace = n.oid
          WHERE n.nspname = 'public'
          GROUP BY t.typname
          ORDER BY t.typname
        `
      });

      return new Response(
        JSON.stringify({
          success: true,
          type: 'structure',
          data: {
            tables,
            columns,
            primaryKeys,
            foreignKeys,
            functions,
            triggers,
            views,
            indexes,
            sequences,
            policies,
            enums
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'data') {
      // Get all tables
      const { data: tablesResult } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `
      });

      const tableData: Record<string, any[]> = {};

      // For each table, fetch all data
      if (tablesResult && Array.isArray(tablesResult)) {
        for (const row of tablesResult) {
          const tableName = row.table_name;
          
          // Skip system tables that shouldn't be backed up
          if (tableName.startsWith('_') || tableName === 'schema_migrations') {
            continue;
          }

          try {
            // Fetch data using a direct query to get all rows
            const { data: tableRows, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(50000); // Limit to prevent memory issues

            if (!error && tableRows) {
              tableData[tableName] = tableRows;
            } else {
              console.log(`Skipping table ${tableName}: ${error?.message || 'No data'}`);
              tableData[tableName] = [];
            }
          } catch (e) {
            console.log(`Error fetching ${tableName}:`, e);
            tableData[tableName] = [];
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: 'data',
          data: tableData
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
