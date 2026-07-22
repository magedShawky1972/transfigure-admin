import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fromDateInt, toDateInt } = await req.json();

    if (!fromDateInt || !toDateInt) {
      return new Response(
        JSON.stringify({ error: 'fromDateInt and toDateInt are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const fromDateStr = `${String(fromDateInt).slice(0, 4)}-${String(fromDateInt).slice(4, 6)}-${String(fromDateInt).slice(6, 8)}`;
    const toDateStr = `${String(toDateInt).slice(0, 4)}-${String(toDateInt).slice(4, 6)}-${String(toDateInt).slice(6, 8)}`;

    console.log(`Resetting Sajel sync (aggregated_order_mapping) between ${fromDateStr} and ${toDateStr}`);

    // Only clear Sajel-side aggregation state. Do NOT touch sendodoo — that flag
    // controls Odoo sync and has its own reset.
    const { count: deletedMappingsCount, error: mappingError } = await supabase
      .from('aggregated_order_mapping')
      .delete({ count: 'exact' })
      .gte('aggregation_date', fromDateStr)
      .lte('aggregation_date', toDateStr);

    if (mappingError) {
      console.error('Error deleting aggregated order mappings:', mappingError);
      throw mappingError;
    }

    console.log(`Deleted ${deletedMappingsCount || 0} aggregated order mappings`);

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount: 0,
        deletedMappingsCount: deletedMappingsCount || 0,
        message: `Reset ${deletedMappingsCount || 0} aggregated mapping(s) successfully`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in reset-sajel-sync function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
