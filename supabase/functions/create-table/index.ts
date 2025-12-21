import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { tableName, columns } = await req.json();

    if (!tableName || !columns || !Array.isArray(columns) || columns.length === 0) {
      throw new Error('Invalid request: tableName and columns are required');
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build column definitions, filtering out standard fields that are added automatically
    const standardFields = ['id', 'created_at', 'updated_at'];
    const userColumns = columns.filter((col: any) => 
      col && col.name && !standardFields.includes(col.name.toLowerCase())
    );
    
    if (userColumns.length === 0) {
      throw new Error('No valid columns provided for table creation');
    }
    
    const columnDefs = userColumns.map((col: any) => {
      const nullable = col.nullable ? '' : 'NOT NULL';
      return `${col.name} ${col.type.toUpperCase()} ${nullable}`;
    }).join(',\n  ');

    // Create the table with standard fields
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.${tableName} (
        id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        ${columnDefs},
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
    `;

    // Enable RLS
    const enableRLSSQL = `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`;

    // Create permissive policy for admin access
    const createPolicySQL = `
      CREATE POLICY "Allow all operations on ${tableName}" 
      ON public.${tableName} 
      FOR ALL 
      USING (true) 
      WITH CHECK (true);
    `;

    // Create trigger for updated_at
    const createTriggerSQL = `
      CREATE TRIGGER update_${tableName}_updated_at
      BEFORE UPDATE ON public.${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
    `;

    // Execute all SQL statements
    const { error: tableError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });
    if (tableError) throw tableError;

    const { error: rlsError } = await supabase.rpc('exec_sql', { 
      sql: enableRLSSQL 
    });
    if (rlsError) throw rlsError;

    const { error: policyError } = await supabase.rpc('exec_sql', { 
      sql: createPolicySQL 
    });
    if (policyError) throw policyError;

    const { error: triggerError } = await supabase.rpc('exec_sql', { 
      sql: createTriggerSQL 
    });
    if (triggerError) throw triggerError;

    // Save table metadata (upsert to avoid unique constraint errors)
    const { error: metaError } = await supabase
      .from('generated_tables')
      .upsert(
        {
          table_name: tableName,
          columns: columns,
        },
        { onConflict: 'table_name' }
      );

    if (metaError) throw metaError;

    return new Response(
      JSON.stringify({ success: true, tableName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating table:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
