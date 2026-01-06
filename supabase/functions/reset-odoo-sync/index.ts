import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fromDateInt, toDateInt } = await req.json();

    console.log(`Resetting Odoo sync flag for transactions between ${fromDateInt} and ${toDateInt}`);

    if (!fromDateInt || !toDateInt) {
      return new Response(
        JSON.stringify({ error: 'fromDateInt and toDateInt are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First, count how many records will be affected
    const { count: totalCount, error: countError } = await supabase
      .from('purpletransaction')
      .select('*', { count: 'exact', head: true })
      .gte('created_at_date_int', fromDateInt)
      .lte('created_at_date_int', toDateInt)
      .eq('sendodoo', true);

    if (countError) {
      console.error('Error counting records:', countError);
      throw countError;
    }

    console.log(`Found ${totalCount} records to reset`);

    // Convert date integers to date strings for aggregated_order_mapping
    const fromDateStr = `${String(fromDateInt).slice(0, 4)}-${String(fromDateInt).slice(4, 6)}-${String(fromDateInt).slice(6, 8)}`;
    const toDateStr = `${String(toDateInt).slice(0, 4)}-${String(toDateInt).slice(4, 6)}-${String(toDateInt).slice(6, 8)}`;

    // Delete aggregated order mappings for this date range
    const { count: deletedMappingsCount, error: mappingError } = await supabase
      .from('aggregated_order_mapping')
      .delete({ count: 'exact' })
      .gte('aggregation_date', fromDateStr)
      .lte('aggregation_date', toDateStr);

    if (mappingError) {
      console.error('Error deleting aggregated order mappings:', mappingError);
      // Don't throw, continue with transaction reset
    } else {
      console.log(`Deleted ${deletedMappingsCount || 0} aggregated order mappings`);
    }

    // Perform the batch update (return minimal payload to avoid freezing the client)
    const { count: updatedCount, error } = await supabase
      .from('purpletransaction')
      .update(
        { sendodoo: false },
        ({ count: 'exact', returning: 'minimal' } as any)
      )
      .gte('created_at_date_int', fromDateInt)
      .lte('created_at_date_int', toDateInt)
      .eq('sendodoo', true);

    if (error) {
      console.error('Error resetting Odoo sync:', error);
      throw error;
    }

    console.log(`Successfully reset ${updatedCount || 0} records`);

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: updatedCount || 0,
        totalCount: totalCount || 0,
        deletedMappingsCount: deletedMappingsCount || 0,
        message: `Reset ${updatedCount || 0} transaction(s) and ${deletedMappingsCount || 0} aggregated mapping(s) successfully`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-odoo-sync function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
