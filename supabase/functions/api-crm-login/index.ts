import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  let requestBody: any = null;
  let apiKeyData: any = null;
  let responseStatus = 200;
  let responseMessage = '';
  let success = true;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const logApiCall = async () => {
    try {
      await supabaseAdmin.from('api_consumption_logs').insert({
        endpoint: 'api-crm-login',
        method: req.method,
        request_body: requestBody,
        response_status: responseStatus,
        response_message: responseMessage,
        success,
        execution_time_ms: Date.now() - startTime,
        api_key_id: apiKeyData?.id || null,
        api_key_description: apiKeyData?.description || null,
      });
    } catch (logError) {
      console.error('Error logging API call:', logError);
    }
  };

  if (req.method !== 'POST') {
    responseStatus = 405;
    responseMessage = 'Method not allowed. Use POST.';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Validate API key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      responseStatus = 401;
      responseMessage = 'Missing API key';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: apiKey, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('api_key', authHeader)
      .eq('is_active', true)
      .single();

    apiKeyData = apiKey;

    if (keyError || !apiKey || !apiKey.allow_crm) {
      responseStatus = 403;
      responseMessage = 'Invalid API key or CRM permission denied';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    requestBody = body;
    const { email, password } = body;

    if (!email || !password) {
      responseStatus = 400;
      responseMessage = 'Email and password are required';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      responseStatus = 401;
      responseMessage = 'Invalid email or password';
      success = false;
      await logApiCall();
      return new Response(JSON.stringify({ success: false, error: responseMessage }), {
        status: responseStatus,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = authData.user;
    const session = authData.session;

    // Get user profile, roles, permissions in parallel
    const [profileRes, rolesRes, permissionsRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('user_name, avatar_url').eq('user_id', user.id).single(),
      supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id),
      supabaseAdmin.from('user_permissions').select('parent_menu, menu_item, has_access').eq('user_id', user.id).eq('has_access', true),
    ]);

    responseMessage = 'Login successful';
    await logApiCall();

    return new Response(JSON.stringify({
      success: true,
      session_id: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: {
        id: user.id,
        email: user.email,
        user_name: profileRes.data?.user_name || null,
        avatar_url: profileRes.data?.avatar_url || null,
        roles: rolesRes.data?.map(r => r.role) || [],
        permissions: permissionsRes.data || [],
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CRM Login error:', error);
    responseStatus = 500;
    responseMessage = 'Authentication failed';
    success = false;
    await logApiCall();
    return new Response(JSON.stringify({ success: false, error: responseMessage }), {
      status: responseStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
