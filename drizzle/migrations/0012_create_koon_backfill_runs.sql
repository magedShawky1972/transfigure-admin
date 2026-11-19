CREATE TABLE public.koon_backfill_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_date_int INTEGER NOT NULL,
  to_date_int INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','ready','running','completed','completed_with_errors','failed')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  successful_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  skipped_items INTEGER NOT NULL DEFAULT 0,
  skipped_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  CHECK (from_date_int <= to_date_int)
);

CREATE TABLE public.koon_backfill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.koon_backfill_runs(id) ON DELETE CASCADE,
  phase INTEGER NOT NULL,
  endpoint TEXT NOT NULL CHECK (endpoint IN ('api-customer','api-brand','api-product','api-salesheader','api-salesline','api-payment')),
  record_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','success','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  response_status INTEGER,
  response_message TEXT,
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  UNIQUE (run_id, endpoint, record_key)
);

CREATE INDEX koon_backfill_items_run_status_idx ON public.koon_backfill_items (run_id, status, phase, id);
CREATE INDEX koon_backfill_runs_created_idx ON public.koon_backfill_runs (created_at DESC);

GRANT ALL ON public.koon_backfill_runs TO service_role;
GRANT ALL ON public.koon_backfill_items TO service_role;
ALTER TABLE public.koon_backfill_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.koon_backfill_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prepare_koon_backfill(p_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from INTEGER;
  v_to INTEGER;
BEGIN
  SELECT from_date_int, to_date_int INTO v_from, v_to
  FROM public.koon_backfill_runs WHERE id = p_run_id FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'Backfill run not found'; END IF;

  CREATE TEMP TABLE koon_candidates (
    phase INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    record_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    UNIQUE (endpoint, record_key)
  ) ON COMMIT DROP;

  INSERT INTO pg_temp.koon_candidates
  SELECT 1, 'api-customer', h.customer_phone,
    jsonb_strip_nulls(jsonb_build_object(
      'Customer_Phone', h.customer_phone,
      'Customer_name', COALESCE(c.customer_name, h.customer_name),
      'Customer_email', c.email,
      'Customer_group', c.customer_group,
      'Status', COALESCE(lower(c.status) = 'active', true),
      'Is_blocked', COALESCE(c.is_blocked, false),
      'Block_reason', c.block_reason,
      'Register_date', c.creation_date,
      'Last_transaction', c.last_transaction
    ))
  FROM public.sales_order_header h
  LEFT JOIN public.customers c ON c.customer_phone = h.customer_phone
  WHERE h.order_date_int_utc BETWEEN v_from AND v_to AND NULLIF(h.customer_phone, '') IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO pg_temp.koon_candidates
  SELECT DISTINCT 2, 'api-brand', b.brand_code,
    jsonb_strip_nulls(jsonb_build_object(
      'Brand_Code', b.brand_code,
      'Brand_Name', b.brand_name,
      'Status', lower(b.status) = 'active'
    ))
  FROM public.sales_order_header h
  JOIN public.sales_order_line l ON l.order_number = h.order_number
  JOIN public.products p ON p.product_id = l.product_id
  JOIN public.brands b ON b.brand_code = p.brand_code
  WHERE h.order_date_int_utc BETWEEN v_from AND v_to
  ON CONFLICT DO NOTHING;

  INSERT INTO pg_temp.koon_candidates
  SELECT DISTINCT 3, 'api-product', p.product_id,
    jsonb_strip_nulls(jsonb_build_object(
      'Product_id', p.product_id,
      'SKU', p.sku,
      'Name', p.product_name,
      'UOM', p.uom,
      'Brand_Code', p.brand_code,
      'Reorder_Point', p.reorder_point,
      'Minimum_order', p.minimum_order_quantity,
      'Maximum_order', p.maximum_order_quantity,
      'Cost_price', CASE WHEN p.product_cost ~ '^-?[0-9]+(\.[0-9]+)?$' THEN p.product_cost::numeric END,
      'Sales_Price', CASE WHEN p.product_price ~ '^-?[0-9]+(\.[0-9]+)?$' THEN p.product_price::numeric END,
      'AR_Meta_Title', p.meta_title_ar,
      'AR_Meta_Keywords', p.meta_keywords_ar,
      'AR_Meta_Description', p.meta_description_ar,
      'ENG_Meta_Title', p.meta_title_en,
      'ENG_Meta_Keywords', p.meta_keywords_en,
      'ENG_Meta_Description', p.meta_description_en
    ))
  FROM public.sales_order_header h
  JOIN public.sales_order_line l ON l.order_number = h.order_number
  JOIN public.products p ON p.product_id = l.product_id
  WHERE h.order_date_int_utc BETWEEN v_from AND v_to
  ON CONFLICT DO NOTHING;

  INSERT INTO pg_temp.koon_candidates
  SELECT 4, 'api-salesheader', h.order_number,
    jsonb_strip_nulls(jsonb_build_object(
      'Order_Number', h.order_number,
      'Customer_Phone', h.customer_phone,
      'Order_date', h.order_date,
      'Payment_Term', h.payment_term,
      'Sales_person', h.sales_person,
      'Transaction_Type', h.transaction_type,
      'Media', h.media,
      'Profit_Center', h.profit_center,
      'Company', h.company,
      'Status', h.status,
      'Status_Description', h.status_description,
      'Customer_IP', h.customer_ip,
      'Device_Fingerprint', h.device_fingerprint,
      'Transaction_Location', h.transaction_location,
      'Register_User_ID', h.register_user_id,
      'Player_Id', h.player_id,
      'Point_Value', h.point_value,
      'Point', COALESCE(h.is_point, false),
      'Customer_Name', h.customer_name
    ))
  FROM public.sales_order_header h
  WHERE h.order_date_int_utc BETWEEN v_from AND v_to
  ON CONFLICT DO NOTHING;

  INSERT INTO pg_temp.koon_candidates
  SELECT 5, 'api-salesline', l.order_number || '|' || l.line_number::text,
    jsonb_strip_nulls(jsonb_build_object(
      'Order_Number', l.order_number,
      'Line_Number', l.line_number,
      'Line_Status', l.line_status,
      'Product_SKU', l.product_sku,
      'Product_Id', l.product_id,
      'Quantity', l.quantity,
      'Unit_price', l.unit_price,
      'Total', l.total,
      'Coins_Number', l.coins_number,
      'Cost_Price', l.cost_price,
      'Total_Cost', l.total_cost,
      'Player_Id', l.player_id,
      'Vendor_Name', l.vendor_name
    ))
  FROM public.sales_order_header h
  JOIN public.sales_order_line l ON l.order_number = h.order_number
  WHERE h.order_date_int_utc BETWEEN v_from AND v_to
  ON CONFLICT DO NOTHING;

  INSERT INTO pg_temp.koon_candidates
  SELECT 6, 'api-payment', p.order_number || '|' || p.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'Order_number', p.order_number,
      'Payment_method', p.payment_method,
      'Payment_brand', p.payment_brand,
      'Payment_Amount', p.payment_amount,
      'Payment_reference', p.payment_reference,
      'Payment_Card_Number', p.payment_card_number,
      'Bank_Transaction_Id', p.bank_transaction_id,
      'Redemption_IP', p.redemption_ip,
      'Payment_Location', p.payment_location
    ))
  FROM public.sales_order_header h
  JOIN public.payment_transactions p ON p.order_number = h.order_number
  WHERE h.order_date_int_utc BETWEEN v_from AND v_to
  ON CONFLICT DO NOTHING;

  INSERT INTO public.koon_backfill_items (run_id, phase, endpoint, record_key, payload)
  SELECT p_run_id, c.phase, c.endpoint, c.record_key, c.payload
  FROM pg_temp.koon_candidates c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.api_consumption_logs l
    WHERE l.success = true
      AND l.endpoint = 'koon-' || c.endpoint
      AND CASE c.endpoint
        WHEN 'api-customer' THEN l.request_body->>'Customer_Phone' = c.payload->>'Customer_Phone'
        WHEN 'api-brand' THEN l.request_body->>'Brand_Code' = c.payload->>'Brand_Code'
        WHEN 'api-product' THEN l.request_body->>'Product_id' = c.payload->>'Product_id'
        WHEN 'api-salesheader' THEN l.request_body->>'Order_Number' = c.payload->>'Order_Number'
        WHEN 'api-salesline' THEN l.request_body->>'Order_Number' = c.payload->>'Order_Number' AND l.request_body->>'Line_Number' = c.payload->>'Line_Number'
        WHEN 'api-payment' THEN
          COALESCE(NULLIF(l.request_body->>'Bank_Transaction_Id', ''), NULLIF(l.request_body->>'Payment_reference', ''),
            (l.request_body->>'Order_number') || '|' || (l.request_body->>'Payment_method') || '|' || COALESCE(l.request_body->>'Payment_brand', '') || '|' || (l.request_body->>'Payment_Amount')) =
          COALESCE(NULLIF(c.payload->>'Bank_Transaction_Id', ''), NULLIF(c.payload->>'Payment_reference', ''),
            (c.payload->>'Order_number') || '|' || (c.payload->>'Payment_method') || '|' || COALESCE(c.payload->>'Payment_brand', '') || '|' || (c.payload->>'Payment_Amount'))
      END
  )
  ON CONFLICT DO NOTHING;

  WITH counts AS (
    SELECT c.endpoint, count(*) AS candidate_count, count(i.id) AS item_count
    FROM pg_temp.koon_candidates c
    LEFT JOIN public.koon_backfill_items i
      ON i.run_id = p_run_id AND i.endpoint = c.endpoint AND i.record_key = c.record_key
    GROUP BY c.endpoint
  ), totals AS (
    SELECT count(*) AS total FROM public.koon_backfill_items WHERE run_id = p_run_id
  )
  UPDATE public.koon_backfill_runs r
  SET total_items = totals.total,
      skipped_items = COALESCE((SELECT sum(candidate_count - item_count) FROM counts), 0),
      skipped_counts = COALESCE((SELECT jsonb_object_agg(endpoint, candidate_count - item_count) FROM counts), '{}'::jsonb),
      status = CASE WHEN totals.total = 0 THEN 'completed' ELSE 'ready' END,
      completed_at = CASE WHEN totals.total = 0 THEN now() ELSE NULL END
  FROM totals
  WHERE r.id = p_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_koon_backfill_batch(p_run_id UUID, p_limit INTEGER)
RETURNS SETOF public.koon_backfill_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.koon_backfill_items
  SET status = 'pending', locked_at = NULL
  WHERE run_id = p_run_id AND status = 'processing' AND locked_at < now() - interval '2 minutes';

  RETURN QUERY
  WITH next_endpoint AS (
    SELECT endpoint, phase FROM public.koon_backfill_items
    WHERE run_id = p_run_id AND status = 'pending'
    ORDER BY phase, id LIMIT 1
  ), claimed AS (
    SELECT i.id FROM public.koon_backfill_items i
    JOIN next_endpoint n ON n.endpoint = i.endpoint AND n.phase = i.phase
    WHERE i.run_id = p_run_id AND i.status = 'pending'
    ORDER BY i.id
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_limit, 5))
  ), updated AS (
    UPDATE public.koon_backfill_items i
    SET status = 'processing', locked_at = now(), attempt_count = i.attempt_count + 1
    FROM claimed c WHERE i.id = c.id
    RETURNING i.*
  )
  SELECT * FROM updated ORDER BY phase, id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_koon_backfill_run(p_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_success INTEGER;
  v_failed INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE status = 'success'), count(*) FILTER (WHERE status = 'failed'),
    count(*) FILTER (WHERE status IN ('pending','processing'))
  INTO v_total, v_success, v_failed, v_remaining
  FROM public.koon_backfill_items WHERE run_id = p_run_id;

  UPDATE public.koon_backfill_runs
  SET total_items = v_total,
      successful_items = v_success,
      failed_items = v_failed,
      processed_items = v_success + v_failed,
      started_at = COALESCE(started_at, now()),
      status = CASE WHEN v_remaining = 0 THEN (CASE WHEN v_failed > 0 THEN 'completed_with_errors' ELSE 'completed' END) ELSE 'running' END,
      completed_at = CASE WHEN v_remaining = 0 THEN now() ELSE NULL END
  WHERE id = p_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_koon_backfill_summary(p_run_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'run', to_jsonb(r),
    'endpoints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'phase', s.phase, 'endpoint', s.endpoint, 'total', s.total,
        'pending', s.pending, 'success', s.success, 'failed', s.failed
      ) ORDER BY s.phase)
      FROM (
        SELECT phase, endpoint, count(*) AS total,
          count(*) FILTER (WHERE status IN ('pending','processing')) AS pending,
          count(*) FILTER (WHERE status = 'success') AS success,
          count(*) FILTER (WHERE status = 'failed') AS failed
        FROM public.koon_backfill_items WHERE run_id = p_run_id GROUP BY phase, endpoint
      ) s
    ), '[]'::jsonb)
  )
  FROM public.koon_backfill_runs r WHERE r.id = p_run_id;
$$;

REVOKE ALL ON FUNCTION public.prepare_koon_backfill(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_koon_backfill_batch(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_koon_backfill_run(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_koon_backfill_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_koon_backfill(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_koon_backfill_batch(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_koon_backfill_run(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_koon_backfill_summary(UUID) TO service_role;