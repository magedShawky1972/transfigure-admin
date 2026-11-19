import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { forwardToKoon, getFailedKoonRetryEndpoint } from '../_shared/koon-forward.ts';

const BodySchema = z.object({ logId: z.string().uuid() });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  let claimedLogId: string | null = null;

  try {
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

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'A valid logId is required' }, 400);
    const { logId } = parsed.data;

    const { data: log, error: logError } = await supabaseAdmin
      .from('api_consumption_logs')
      .select('id, endpoint, success, request_body')
      .eq('id', logId)
      .maybeSingle();
    if (logError) throw logError;
    if (!log) return json({ error: 'Log entry not found' }, 404);

    const endpoint = getFailedKoonRetryEndpoint(log);
    if (!endpoint) return json({ error: 'Only failed KOON requests with a saved body can be retried' }, 400);

    // Claim atomically so a double-click or two admins cannot deliver the same retry concurrently.
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const retryAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('api_consumption_logs')
      .update({ retry_started_at: retryAt, last_retry_at: retryAt, last_retry_by: userData.user.id })
      .eq('id', logId)
      .eq('success', false)
      .or(`retry_started_at.is.null,retry_started_at.lt.${staleBefore}`)
      .select('id');
    if (claimError) throw claimError;
    if (!claimed?.length) return json({ error: 'This request already succeeded or another retry is in progress' }, 409);
    claimedLogId = logId;

    const result = await forwardToKoon(endpoint, log.request_body, {}, supabaseAdmin, { retryLogId: logId });
    return json(result);
  } catch (error) {
    if (claimedLogId) {
      await supabaseAdmin.from('api_consumption_logs').update({ retry_started_at: null }).eq('id', claimedLogId);
    }
    console.error('KOON manual retry failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'KOON retry failed' }, 500);
  }
});
