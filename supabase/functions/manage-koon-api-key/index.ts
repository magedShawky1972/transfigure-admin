import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';

const BodySchema = z.object({
  apiKey: z.string().trim().min(20).max(512).regex(/^\S+$/),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST'].includes(req.method)) return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (roleError) throw roleError;
    if (!isAdmin) return json({ error: 'Forbidden: Admin access required' }, 403);

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('koon_settings')
        .select('api_key, updated_at')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return json({ configured: Boolean(data?.api_key), updated_at: data?.updated_at ?? null });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Enter a valid KOON API key (at least 20 characters, no spaces)' }, 400);
    const updatedAt = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('koon_settings')
      .upsert({
        id: true,
        api_key: parsed.data.apiKey,
        updated_at: updatedAt,
        updated_by: userData.user.id,
      }, { onConflict: 'id' })
      .select('updated_at');
    if (error) throw error;
    if (!data?.length) return json({ error: 'The KOON API key could not be saved' }, 500);
    return json({ configured: true, updated_at: data[0].updated_at });
  } catch (error) {
    console.error('KOON settings operation failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'KOON settings operation failed' }, 500);
  }
});
