import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if profiles table exists by attempting to query it
    let tableExists = false;
    let usersCount = 0;

    try {
      const { data, error, count } = await supabaseClient
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      if (error) {
        // If error contains "relation" and "does not exist", the table doesn't exist
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          tableExists = false;
        } else {
          // Some other error occurred
          console.error('Error querying profiles:', error);
          tableExists = false;
        }
      } else {
        tableExists = true;
        usersCount = count || 0;
      }
    } catch (e) {
      console.error('Error checking profiles table:', e);
      tableExists = false;
    }

    return new Response(
      JSON.stringify({ 
        tableExists, 
        usersCount,
        needsRestore: !tableExists,
        needsInitialUser: tableExists && usersCount === 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
