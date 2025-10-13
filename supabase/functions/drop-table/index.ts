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
    const { tableName, tableId } = await req.json();

    if (!tableName || !tableId) {
      return new Response(
        JSON.stringify({ error: 'Missing tableName or tableId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Dropping table ${tableName} (ID: ${tableId})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const lowerTableName = tableName.toLowerCase();

    // Drop the actual database table
    const dropSQL = `DROP TABLE IF EXISTS public.${lowerTableName} CASCADE;`;
    console.log('Executing SQL:', dropSQL);

    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: dropSQL
    });

    if (dropError) {
      console.error('Error dropping table:', dropError);
      return new Response(
        JSON.stringify({ error: `Failed to drop table: ${dropError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Table ${lowerTableName} dropped successfully`);

    // Delete from generated_tables metadata
    const { error: deleteError } = await supabase
      .from('generated_tables')
      .delete()
      .eq('id', tableId);

    if (deleteError) {
      console.error('Error deleting from generated_tables:', deleteError);
      return new Response(
        JSON.stringify({ error: `Failed to delete metadata: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Metadata deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Table ${tableName} dropped successfully`
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
