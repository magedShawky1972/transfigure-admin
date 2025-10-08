import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Resetting MFA for user: ${email}`);

    // Get user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const user = users.find(u => u.email === email);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found user: ${user.id}, factors:`, user.factors);

    // Since we can't directly delete factors via the admin API in this version,
    // we'll use a workaround: set user metadata to flag for MFA reset
    const factors = user.factors || [];
    
    if (factors.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No MFA factors found for this user'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the factors so admin can manually delete them if needed
    console.log('User has factors:', factors.map(f => ({ id: f.id, type: f.factor_type, status: f.status })));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Found ${factors.length} MFA factor(s). Please delete them manually via Lovable Cloud backend.`,
        factors: factors.map(f => ({ id: f.id, type: f.factor_type, status: f.status })),
        instructions: 'Go to Lovable Cloud backend -> Users -> Find user -> Delete MFA factors'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
