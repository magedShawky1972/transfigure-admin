ALTER TABLE public.koon_backfill_runs
  ADD COLUMN current_phase INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN current_endpoint TEXT;

CREATE INDEX IF NOT EXISTS api_logs_koon_customer_success_key
  ON public.api_consumption_logs ((request_body->>'Customer_Phone'))
  WHERE success = true AND endpoint = 'koon-api-customer';
CREATE INDEX IF NOT EXISTS api_logs_koon_brand_success_key
  ON public.api_consumption_logs ((request_body->>'Brand_Code'))
  WHERE success = true AND endpoint = 'koon-api-brand';
CREATE INDEX IF NOT EXISTS api_logs_koon_product_success_key
  ON public.api_consumption_logs ((request_body->>'Product_id'))
  WHERE success = true AND endpoint = 'koon-api-product';
CREATE INDEX IF NOT EXISTS api_logs_koon_header_success_key
  ON public.api_consumption_logs ((request_body->>'Order_Number'))
  WHERE success = true AND endpoint = 'koon-api-salesheader';
CREATE INDEX IF NOT EXISTS api_logs_koon_line_success_key
  ON public.api_consumption_logs ((request_body->>'Order_Number'), (request_body->>'Line_Number'))
  WHERE success = true AND endpoint = 'koon-api-salesline';
CREATE INDEX IF NOT EXISTS api_logs_koon_payment_success_key
  ON public.api_consumption_logs ((COALESCE(
    NULLIF(request_body->>'Bank_Transaction_Id', ''),
    NULLIF(request_body->>'Payment_reference', ''),
    (request_body->>'Order_number') || '|' || (request_body->>'Payment_method') || '|' || COALESCE(request_body->>'Payment_brand', '') || '|' || (request_body->>'Payment_Amount')
  )))
  WHERE success = true AND endpoint = 'koon-api-payment';

CREATE OR REPLACE FUNCTION public.prepare_koon_backfill(p_run_id UUID, p_phase INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from INTEGER;
  v_to INTEGER;
  v_endpoint TEXT;
  v_candidate_count INTEGER;
  v_item_count INTEGER;
  v_counts JSONB;
BEGIN
  IF p_phase NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Invalid backfill phase'; END IF;
  SELECT from_date_int, to_date_int, skipped_counts INTO v_from, v_to, v_counts
  FROM public.koon_backfill_runs WHERE id = p_run_id FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'Backfill run not found'; END IF;

  CREATE TEMP TABLE koon_candidates (
    phase INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    record_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    UNIQUE (endpoint, record_key)
  ) ON COMMIT DROP;

  IF p_phase = 1 THEN
    v_endpoint := 'api-customer';
    INSERT INTO pg_temp.koon_candidates
    SELECT DISTINCT ON (h.customer_phone) 1, v_endpoint, h.customer_phone,
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
    ORDER BY h.customer_phone, h.order_date DESC;
  ELSIF p_phase = 2 THEN
    v_endpoint := 'api-brand';
    INSERT INTO pg_temp.koon_candidates
    SELECT DISTINCT 2, v_endpoint, b.brand_code,
      jsonb_strip_nulls(jsonb_build_object(
        'Brand_Code', b.brand_code,
        'Brand_Name', b.brand_name,
        'Status', lower(b.status) = 'active'
      ))
    FROM public.sales_order_header h
    JOIN public.sales_order_line l ON l.order_number = h.order_number
    JOIN public.products p ON p.product_id = l.product_id::text
    JOIN public.brands b ON b.brand_code = p.brand_code
    WHERE h.order_date_int_utc BETWEEN v_from AND v_to;
  ELSIF p_phase = 3 THEN
    v_endpoint := 'api-product';
    INSERT INTO pg_temp.koon_candidates
    SELECT DISTINCT 3, v_endpoint, p.product_id,
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
    JOIN public.products p ON p.product_id = l.product_id::text
    WHERE h.order_date_int_utc BETWEEN v_from AND v_to;
  ELSIF p_phase = 4 THEN
    v_endpoint := 'api-salesheader';
    INSERT INTO pg_temp.koon_candidates
    SELECT 4, v_endpoint, h.order_number,
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
    WHERE h.order_date_int_utc BETWEEN v_from AND v_to;
  ELSIF p_phase = 5 THEN
    v_endpoint := 'api-salesline';
    INSERT INTO pg_temp.koon_candidates
    SELECT 5, v_endpoint, l.order_number || '|' || l.line_number::text,
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
    WHERE h.order_date_int_utc BETWEEN v_from AND v_to;
  ELSE
    v_endpoint := 'api-payment';
    INSERT INTO pg_temp.koon_candidates
    SELECT 6, v_endpoint, p.order_number || '|' || p.id::text,
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
    WHERE h.order_date_int_utc BETWEEN v_from AND v_to;
  END IF;

  SELECT count(*) INTO v_candidate_count FROM pg_temp.koon_candidates;

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

  SELECT count(*) INTO v_item_count FROM public.koon_backfill_items WHERE run_id = p_run_id AND endpoint = v_endpoint;
  v_counts := jsonb_set(COALESCE(v_counts, '{}'::jsonb), ARRAY[v_endpoint], to_jsonb(GREATEST(v_candidate_count - v_item_count, 0)), true);

  UPDATE public.koon_backfill_runs r
  SET current_phase = p_phase,
      current_endpoint = v_endpoint,
      total_items = (SELECT count(*) FROM public.koon_backfill_items WHERE run_id = p_run_id),
      skipped_counts = v_counts,
      skipped_items = COALESCE((SELECT sum(value::INTEGER) FROM jsonb_each_text(v_counts)), 0),
      error_message = NULL,
      status = CASE
        WHEN p_phase < 6 THEN 'preparing'
        WHEN (SELECT count(*) FROM public.koon_backfill_items WHERE run_id = p_run_id) = 0 THEN 'completed'
        ELSE 'ready'
      END,
      completed_at = CASE WHEN p_phase = 6 AND (SELECT count(*) FROM public.koon_backfill_items WHERE run_id = p_run_id) = 0 THEN now() ELSE NULL END
  WHERE r.id = p_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_koon_backfill_summary(p_run_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH endpoint_list(phase, endpoint) AS (
    VALUES
      (1, 'api-customer'),
      (2, 'api-brand'),
      (3, 'api-product'),
      (4, 'api-salesheader'),
      (5, 'api-salesline'),
      (6, 'api-payment')
  ), stats AS (
    SELECT phase, endpoint, count(*) AS total,
      count(*) FILTER (WHERE status IN ('pending','processing')) AS pending,
      count(*) FILTER (WHERE status = 'success') AS success,
      count(*) FILTER (WHERE status = 'failed') AS failed
    FROM public.koon_backfill_items WHERE run_id = p_run_id GROUP BY phase, endpoint
  )
  SELECT jsonb_build_object(
    'run', to_jsonb(r),
    'endpoints', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'phase', e.phase, 'endpoint', e.endpoint,
        'total', COALESCE(s.total, 0),
        'pending', COALESCE(s.pending, 0),
        'success', COALESCE(s.success, 0),
        'failed', COALESCE(s.failed, 0)
      ) ORDER BY e.phase)
      FROM endpoint_list e LEFT JOIN stats s ON s.phase = e.phase AND s.endpoint = e.endpoint
    ), '[]'::jsonb)
  )
  FROM public.koon_backfill_runs r WHERE r.id = p_run_id;
$$;

REVOKE ALL ON FUNCTION public.prepare_koon_backfill(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_koon_backfill_summary(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_koon_backfill(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_koon_backfill_summary(UUID) TO service_role;