import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { forwardToKoon, type KoonEndpoint } from '../_shared/koon-forward.ts';

const dateInt = z.number().int().min(19000101).max(29991231).refine((value) => {
  const text = String(value);
  const date = new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8))));
  return date.getUTCFullYear() === Number(text.slice(0, 4)) && date.getUTCMonth() === Number(text.slice(4, 6)) - 1 && date.getUTCDate() === Number(text.slice(6, 8));
}, 'Invalid calendar date');
const runId = z.string().uuid();
const RequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), fromDateInt: dateInt, toDateInt: dateInt }),
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('get'), runId }),
  z.object({ action: z.literal('retry'), runId }),
  z.object({ action: z.literal('process'), runId, batchSize: z.number().int().min(1).max(5).default(5) }),
  z.object({ action: z.literal('errors'), runId }),
]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7));
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (roleError) throw roleError;
    if (!isAdmin) return json({ error: 'Forbidden: Admin access required' }, 403);

    const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid backfill request', details: parsed.error.flatten().fieldErrors }, 400);
    const input = parsed.data;
    const summary = async (id: string) => {
      const { data, error } = await supabase.rpc('get_koon_backfill_summary', { p_run_id: id });
      if (error) throw error;
      return data;
    };

    if (input.action === 'list') {
      const { data, error } = await supabase.from('koon_backfill_runs')
        .select('id, from_date_int, to_date_int, status, created_at, started_at, completed_at, total_items, processed_items, successful_items, failed_items, skipped_items, error_message')
        .order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      return json({ runs: data ?? [] });
    }

    if (input.action === 'create') {
      if (input.fromDateInt > input.toDateInt) return json({ error: 'From Date must be on or before To Date' }, 400);
      const { data: run, error: createError } = await supabase.from('koon_backfill_runs')
        .insert({ from_date_int: input.fromDateInt, to_date_int: input.toDateInt, created_by: userData.user.id })
        .select('id').single();
      if (createError) throw createError;
      const { error: prepareError } = await supabase.rpc('prepare_koon_backfill', { p_run_id: run.id });
      if (prepareError) {
        await supabase.from('koon_backfill_runs').update({ status: 'failed', error_message: prepareError.message }).eq('id', run.id);
        throw prepareError;
      }
      return json(await summary(run.id));
    }

    if (input.action === 'get') return json(await summary(input.runId));

    if (input.action === 'errors') {
      const { data, error } = await supabase.from('koon_backfill_items')
        .select('id, phase, endpoint, record_key, attempt_count, response_status, response_message, processed_at')
        .eq('run_id', input.runId).eq('status', 'failed')
        .order('phase').order('record_key').limit(200);
      if (error) throw error;
      return json({ errors: data ?? [] });
    }

    if (input.action === 'retry') {
      const { data: retried, error: retryError } = await supabase.from('koon_backfill_items')
        .update({ status: 'pending', response_status: null, response_message: null, locked_at: null, processed_at: null })
        .eq('run_id', input.runId).eq('status', 'failed').select('id');
      if (retryError) throw retryError;
      if (!retried?.length) return json({ error: 'No failed deliveries to retry' }, 400);
      const { error: reopenError } = await supabase.from('koon_backfill_runs')
        .update({ status: 'ready', completed_at: null, error_message: null }).eq('id', input.runId);
      if (reopenError) throw reopenError;
      return json({ ...(await summary(input.runId)), retryCount: retried.length });
    }

    const { data: claimed, error: claimError } = await supabase.rpc('claim_koon_backfill_batch', {
      p_run_id: input.runId,
      p_limit: input.batchSize,
    });
    if (claimError) throw claimError;

    const results = await Promise.all((claimed ?? []).map(async (item: any) => {
      const result = await forwardToKoon(item.endpoint as KoonEndpoint, item.payload, {}, supabase, { description: 'KOON backfill' });
      const responseMessage = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
      const { error: itemError } = await supabase.from('koon_backfill_items').update({
        status: result.success ? 'success' : 'failed',
        response_status: result.status || 502,
        response_message: responseMessage?.substring(0, 2000),
        locked_at: null,
        processed_at: new Date().toISOString(),
      }).eq('id', item.id).select('id');
      if (itemError) throw itemError;
      return { id: item.id, endpoint: item.endpoint, record_key: item.record_key, success: result.success, status: result.status };
    }));
    const { error: refreshError } = await supabase.rpc('refresh_koon_backfill_run', { p_run_id: input.runId });
    if (refreshError) throw refreshError;
    return json({ ...(await summary(input.runId)), batch: results });
  } catch (error) {
    console.error('KOON backfill operation failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: error instanceof Error ? error.message : 'KOON backfill operation failed' }, 500);
  }
});
