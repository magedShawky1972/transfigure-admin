import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Column {
  name: string;
  type: string;
  nullable: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableName, oldColumns, newColumns } = await req.json();

    if (!tableName || !newColumns || !Array.isArray(newColumns)) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Altering table ${tableName}`);
    console.log('Old columns:', JSON.stringify(oldColumns));
    console.log('New columns:', JSON.stringify(newColumns));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const lowerTableName = tableName.toLowerCase();

    // Get current table structure from database
    const { data: currentCols, error: colError } = await supabase
      .rpc('exec_sql', {
        sql: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = '${lowerTableName}'
              AND column_name NOT IN ('id', 'created_at', 'updated_at')`
      });

    if (colError) {
      console.error('Error fetching current columns:', colError);
    }

    // Get existing columns from database
    const { data: existingColumns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', lowerTableName);

    const existingColumnNames = new Set(
      (existingColumns || []).map((c: any) => c.column_name.toLowerCase())
    );

    const alterStatements: string[] = [];

    // Add new columns
    for (const col of newColumns) {
      const colName = col.name.toLowerCase().trim();
      if (!colName) continue;
      
      if (!existingColumnNames.has(colName)) {
        const dataType = getPostgresType(col.type);
        const nullable = col.nullable ? '' : ' NOT NULL';
        alterStatements.push(
          `ALTER TABLE public.${lowerTableName} ADD COLUMN IF NOT EXISTS ${colName} ${dataType}${nullable};`
        );
        console.log(`Adding column: ${colName} ${dataType}${nullable}`);
      }
    }

    // Drop columns that were removed
    if (oldColumns && Array.isArray(oldColumns)) {
      const newColumnNames = new Set(
        newColumns.map((c: Column) => c.name.toLowerCase().trim()).filter(Boolean)
      );
      
      for (const oldCol of oldColumns) {
        const oldColName = oldCol.name.toLowerCase().trim();
        if (oldColName && !newColumnNames.has(oldColName) && existingColumnNames.has(oldColName)) {
          // Don't drop system columns
          if (!['id', 'created_at', 'updated_at'].includes(oldColName)) {
            alterStatements.push(
              `ALTER TABLE public.${lowerTableName} DROP COLUMN IF EXISTS ${oldColName};`
            );
            console.log(`Dropping column: ${oldColName}`);
          }
        }
      }
    }

    // Execute all ALTER statements
    if (alterStatements.length > 0) {
      const fullSQL = alterStatements.join('\n');
      console.log('Executing SQL:', fullSQL);

      const { error: execError } = await supabase.rpc('exec_sql', {
        sql: fullSQL
      });

      if (execError) {
        console.error('Error executing ALTER statements:', execError);
        return new Response(
          JSON.stringify({ error: `Failed to alter table: ${execError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Table altered successfully');
    } else {
      console.log('No changes needed');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Table ${tableName} altered successfully`,
        changes: alterStatements.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getPostgresType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'text': 'TEXT',
    'integer': 'INTEGER',
    'decimal': 'DECIMAL',
    'boolean': 'BOOLEAN',
    'timestamp': 'TIMESTAMP WITH TIME ZONE',
    'uuid': 'UUID',
    'jsonb': 'JSONB',
  };
  
  return typeMap[type.toLowerCase()] || 'TEXT';
}
