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
const endpoint = z.enum(['api-customer', 'api-brand', 'api-product', 'api-salesheader', 'api-salesline', 'api-payment']);
const RequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), fromDateInt: dateInt, toDateInt: dateInt }),
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('get'), runId }),
  z.object({ action: z.literal('prepare'), runId, phase: z.number().int().min(1).max(6) }),
  z.object({ action: z.literal('restart'), runId }),
  z.object({ action: z.literal('retry'), runId }),
  z.object({ action: z.literal('retryItem'), runId, itemId: z.string().uuid() }),
  z.object({ action: z.literal('pause'), runId }),
  z.object({ action: z.literal('process'), runId, endpoint: endpoint.optional(), batchSize: z.number().int().min(1).max(5).default(5) }),
  z.object({ action: z.literal('items'), runId, endpoint, status: z.enum(['all', 'pending', 'success', 'failed']).default('all'), search: z.string().trim().max(200).default(''), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(50) }),
  z.object({ action: z.literal('errors'), runId }),
]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return 'KOON backfill operation failed';
};

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
    const deliverItems = async (items: any[], description: string) => Promise.all(items.map(async (item) => {
      const result = await forwardToKoon(item.endpoint as KoonEndpoint, item.payload, {}, supabase, { description });
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

    if (input.action === 'list') {
      const { data, error } = await supabase.from('koon_backfill_runs')
        .select('id, from_date_int, to_date_int, status, created_at, started_at, completed_at, total_items, processed_items, successful_items, failed_items, skipped_items, error_message, current_phase, current_endpoint')
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
      return json(await summary(run.id));
    }

    if (input.action === 'get') return json(await summary(input.runId));

    if (input.action === 'items') {
      let query = supabase.from('koon_backfill_items')
        .select('id, endpoint, record_key, payload, status, attempt_count, response_status, response_message, processed_at', { count: 'exact' })
        .eq('run_id', input.runId).eq('endpoint', input.endpoint);
      if (input.status === 'pending') query = query.in('status', ['pending', 'processing']);
      if (input.status === 'success' || input.status === 'failed') query = query.eq('status', input.status);
      const search = input.search.replace(/[%_,"()]/g, '');
      if (search) query = query.ilike('record_key', `%${search}%`);
      const from = (input.page - 1) * input.pageSize;
      const { data, error, count } = await query.order('id', { ascending: true }).range(from, from + input.pageSize - 1);
      if (error) throw error;
      return json({ items: data ?? [], total: count ?? 0, page: input.page, pageSize: input.pageSize });
    }

    if (input.action === 'restart') {
      const { count, error: attemptError } = await supabase.from('koon_backfill_items')
        .select('id', { count: 'exact', head: true }).eq('run_id', input.runId).gt('attempt_count', 0);
      if (attemptError) throw attemptError;
      if ((count ?? 0) > 0) return json({ error: 'This run has already attempted deliveries. Resume it instead of restarting preparation.' }, 400);
      const { error: deleteError } = await supabase.from('koon_backfill_items').delete().eq('run_id', input.runId);
      if (deleteError) throw deleteError;
      const { error: resetError } = await supabase.from('koon_backfill_runs').update({
        status: 'preparing', total_items: 0, processed_items: 0, successful_items: 0, failed_items: 0,
        skipped_items: 0, skipped_counts: {}, current_phase: 0, current_endpoint: null,
        error_message: null, started_at: null, completed_at: null,
      }).eq('id', input.runId);
      if (resetError) throw resetError;
      return json(await summary(input.runId));
    }

    if (input.action === 'prepare') {
      const { error: prepareError } = await supabase.rpc('prepare_koon_backfill', {
        p_run_id: input.runId,
        p_phase: input.phase,
      });
      if (prepareError) {
        const message = errorMessage(prepareError);
        await supabase.from('koon_backfill_runs').update({ status: 'failed', error_message: message }).eq('id', input.runId);
        throw prepareError;
      }
      return json(await summary(input.runId));
    }

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

    if (input.action === 'retryItem') {
      const { data: existing, error: findError } = await supabase.from('koon_backfill_items')
        .select('*').eq('id', input.itemId).eq('run_id', input.runId).maybeSingle();
      if (findError) throw findError;
      if (!existing) return json({ error: 'Backfill record not found' }, 404);
      if (existing.status !== 'failed') return json({ error: 'Only failed records can be resent' }, 400);
      const { data: claimed, error: claimError } = await supabase.from('koon_backfill_items')
        .update({ status: 'processing', locked_at: new Date().toISOString(), attempt_count: existing.attempt_count + 1 })
        .eq('id', input.itemId).eq('run_id', input.runId).eq('status', 'failed').select('*').maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) return json({ error: 'This record is already being resent' }, 409);
      const { error: activeError } = await supabase.from('koon_backfill_runs').update({
        current_phase: claimed.phase,
        current_endpoint: claimed.endpoint,
      }).eq('id', input.runId);
      if (activeError) throw activeError;
      const results = await deliverItems([claimed], 'KOON backfill manual record resend');
      const { error: refreshError } = await supabase.rpc('refresh_koon_backfill_run', { p_run_id: input.runId });
      if (refreshError) throw refreshError;
      return json({ ...(await summary(input.runId)), retryResult: results[0] });
    }

    if (input.action === 'pause') {
      const { error: pauseError } = await supabase.from('koon_backfill_runs')
        .update({ status: 'paused' }).eq('id', input.runId).eq('status', 'running');
      if (pauseError) throw pauseError;
      return json(await summary(input.runId));
    }

    const { data: claimed, error: claimError } = await supabase.rpc('claim_koon_backfill_batch', {
      p_run_id: input.runId,
      p_limit: input.batchSize,
      p_endpoint: input.action === 'process' ? input.endpoint ?? null : null,
    });
    if (claimError) throw claimError;

    if (claimed?.length) {
      const { error: activeError } = await supabase.from('koon_backfill_runs').update({
        current_phase: claimed[0].phase,
        current_endpoint: claimed[0].endpoint,
      }).eq('id', input.runId);
      if (activeError) throw activeError;
    }

    const results = await deliverItems(claimed ?? [], 'KOON backfill');
    const { error: refreshError } = await supabase.rpc('refresh_koon_backfill_run', { p_run_id: input.runId });
    if (refreshError) throw refreshError;
    return json({ ...(await summary(input.runId)), batch: results });
  } catch (error) {
    const message = errorMessage(error);
    console.error('KOON backfill operation failed:', message);
    return json({ error: message }, 500);
  }
});
