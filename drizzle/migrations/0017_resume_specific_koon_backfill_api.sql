CREATE OR REPLACE FUNCTION public.claim_koon_backfill_batch(p_run_id uuid, p_limit integer, p_endpoint text)
RETURNS SETOF public.koon_backfill_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_endpoint IS NOT NULL AND p_endpoint NOT IN ('api-customer', 'api-brand', 'api-product', 'api-salesheader', 'api-salesline', 'api-payment') THEN
    RAISE EXCEPTION 'Invalid KOON endpoint';
  END IF;

  UPDATE public.koon_backfill_items
  SET status = 'pending', locked_at = NULL
  WHERE run_id = p_run_id
    AND status = 'processing'
    AND locked_at < now() - interval '2 minutes'
    AND (p_endpoint IS NULL OR endpoint = p_endpoint);

  RETURN QUERY
  WITH next_endpoint AS (
    SELECT i.endpoint, i.phase
    FROM public.koon_backfill_items i
    WHERE i.run_id = p_run_id
      AND i.status = 'pending'
      AND (p_endpoint IS NULL OR i.endpoint = p_endpoint)
    ORDER BY i.phase, i.id
    LIMIT 1
  ), claimed AS (
    SELECT i.id
    FROM public.koon_backfill_items i
    JOIN next_endpoint n ON n.endpoint = i.endpoint AND n.phase = i.phase
    WHERE i.run_id = p_run_id AND i.status = 'pending'
    ORDER BY i.id
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 5))
  ), updated AS (
    UPDATE public.koon_backfill_items i
    SET status = 'processing', locked_at = now(), attempt_count = i.attempt_count + 1
    FROM claimed c
    WHERE i.id = c.id
    RETURNING i.*
  )
  SELECT * FROM updated ORDER BY phase, id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_koon_backfill_batch(p_run_id uuid, p_limit integer)
RETURNS SETOF public.koon_backfill_items
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.claim_koon_backfill_batch(p_run_id, p_limit, NULL);
$function$;