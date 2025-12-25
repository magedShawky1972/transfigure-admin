import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use a connection string to query system tables directly
const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL');

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
      // Get all public tables from generated_tables
      const { data: generatedTables, error: genTablesError } = await supabase
        .from('generated_tables')
        .select('table_name, columns, status');
      
      if (genTablesError) {
        console.error('Error fetching generated_tables:', genTablesError);
      }

      // Get all known public tables by querying each one
      const knownTables = [
        'api_field_configs', 'api_keys', 'brand_closing_training', 'brand_type', 'brands',
        'company_news', 'crm_customer_followup', 'currencies', 'currency_rates', 'customers',
        'deleted_email_ids', 'department_admins', 'department_members', 'department_task_phases',
        'departments', 'email_attachments', 'email_contacts', 'emails', 'excel_column_mappings',
        'excel_sheets', 'generated_tables', 'hyberpaystatement', 'internal_conversation_participants',
        'internal_conversations', 'internal_messages', 'job_positions', 'ludo_training',
        'ludo_transactions', 'mail_types', 'notifications', 'odoo_api_config', 'order_payment',
        'ordertotals', 'payment_methods', 'payment_transactions', 'products', 'profiles',
        'project_members', 'projects', 'purchase_items', 'purpletransaction', 'push_subscriptions',
        'query_cache', 'riyadbankstatement', 'shift_closing_images', 'shift_closing_numbers',
        'shift_plans', 'shift_sessions', 'shifts', 'software_licenses', 'supplier_products',
        'suppliers', 'system_config', 'task_attachments', 'task_time_entries', 'tasks',
        'ticket_actions', 'ticket_attachments', 'tickets', 'upload_logs', 'user_groups',
        'user_permissions', 'user_roles', 'user_email_configs', 'whatsapp_messages'
      ];

      // Build table info by checking each table
      const tableInfo: any[] = [];
      for (const tableName of knownTables) {
        try {
          const { count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          tableInfo.push({
            table_name: tableName,
            row_count: count || 0
          });
        } catch (e) {
          // Table might not exist, skip it
          console.log(`Table ${tableName} not accessible`);
        }
      }

      // Add generated tables
      if (generatedTables) {
        for (const gt of generatedTables) {
          if (!knownTables.includes(gt.table_name.toLowerCase())) {
            try {
              const { count } = await supabase
                .from(gt.table_name.toLowerCase())
                .select('*', { count: 'exact', head: true });
              
              tableInfo.push({
                table_name: gt.table_name,
                row_count: count || 0,
                columns: gt.columns
              });
            } catch (e) {
              console.log(`Generated table ${gt.table_name} not accessible`);
            }
          }
        }
      }

      // Get database functions using information_schema approach via RPC
      // Since exec_sql returns void, we need a different approach
      // We'll return the structure info we can gather
      
      const structureData = {
        tables: tableInfo,
        generatedTables: generatedTables || [],
        // Note: Functions, triggers, policies require direct DB access
        // We'll provide what we can from the client
        functionsNote: 'Database functions are stored in pg_proc system table',
        triggersNote: 'Triggers are stored in information_schema.triggers',
        policiesNote: 'RLS policies are stored in pg_policies'
      };

      console.log(`Found ${tableInfo.length} tables`);

      return new Response(
        JSON.stringify({
          success: true,
          type: 'structure',
          data: structureData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (type === 'data') {
      // Get all tables from generated_tables first
      const { data: generatedTables } = await supabase
        .from('generated_tables')
        .select('table_name');

      const knownTables = [
        'api_field_configs', 'api_keys', 'brand_closing_training', 'brand_type', 'brands',
        'company_news', 'crm_customer_followup', 'currencies', 'currency_rates', 'customers',
        'deleted_email_ids', 'department_admins', 'department_members', 'department_task_phases',
        'departments', 'email_attachments', 'email_contacts', 'emails', 'excel_column_mappings',
        'excel_sheets', 'generated_tables', 'hyberpaystatement', 'internal_conversation_participants',
        'internal_conversations', 'internal_messages', 'job_positions', 'ludo_training',
        'ludo_transactions', 'mail_types', 'notifications', 'odoo_api_config', 'order_payment',
        'ordertotals', 'payment_methods', 'payment_transactions', 'products', 'profiles',
        'project_members', 'projects', 'purchase_items', 'purpletransaction', 'push_subscriptions',
        'query_cache', 'riyadbankstatement', 'shift_closing_images', 'shift_closing_numbers',
        'shift_plans', 'shift_sessions', 'shifts', 'software_licenses', 'supplier_products',
        'suppliers', 'system_config', 'task_attachments', 'task_time_entries', 'tasks',
        'ticket_actions', 'ticket_attachments', 'tickets', 'upload_logs', 'user_groups',
        'user_permissions', 'user_roles', 'user_email_configs', 'whatsapp_messages'
      ];

      // Add generated tables
      if (generatedTables) {
        for (const gt of generatedTables) {
          const tableName = gt.table_name.toLowerCase();
          if (!knownTables.includes(tableName)) {
            knownTables.push(tableName);
          }
        }
      }

      const tableData: Record<string, any[]> = {};
      let totalRows = 0;

      for (const tableName of knownTables) {
        try {
          // Fetch data in pages to handle large tables
          const pageSize = 1000;
          const maxRows = 10000;
          const allRows: any[] = [];

          for (let from = 0; from < maxRows; from += pageSize) {
            const { data: rows, error } = await supabase
              .from(tableName)
              .select('*')
              .range(from, from + pageSize - 1);

            if (error) {
              console.log(`Error fetching ${tableName}: ${error.message}`);
              break;
            }

            if (!rows || rows.length === 0) break;
            allRows.push(...rows);
            
            if (rows.length < pageSize) break;
          }

          if (allRows.length > 0) {
            tableData[tableName] = allRows;
            totalRows += allRows.length;
            console.log(`Fetched ${allRows.length} rows from ${tableName}`);
          }
        } catch (e) {
          console.log(`Error accessing table ${tableName}:`, e);
        }
      }

      console.log(`Total rows fetched: ${totalRows}`);

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
