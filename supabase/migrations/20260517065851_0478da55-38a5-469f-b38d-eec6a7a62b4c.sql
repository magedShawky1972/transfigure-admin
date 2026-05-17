CREATE OR REPLACE FUNCTION public.get_epayment_charges_breakdown(
  p_date_from date,
  p_date_to date,
  p_brand_name text DEFAULT NULL,
  p_company text DEFAULT NULL
)
RETURNS TABLE(
  payment_method text,
  payment_brand text,
  transaction_count bigint,
  total_sales numeric,
  bank_fee numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH filtered_lines AS (
    SELECT
      COALESCE(t.order_number, t.id::text) AS order_key,
      COALESCE(t.payment_method, 'Unknown')::text AS payment_method,
      COALESCE(t.payment_brand, 'Unknown')::text AS payment_brand,
      COALESCE(t.total, 0)::numeric AS line_total
    FROM public.purpletransaction t
    WHERE t.created_at_date_int >= REPLACE(p_date_from::text, '-', '')::integer
      AND t.created_at_date_int <= REPLACE(p_date_to::text, '-', '')::integer
      AND LOWER(COALESCE(t.payment_method, '')) <> 'point'
      AND (p_brand_name IS NULL OR t.brand_name = p_brand_name)
      AND (p_company IS NULL OR t.company = p_company)
  ),
  order_agg AS (
    SELECT
      order_key,
      MAX(payment_method) AS payment_method,
      MAX(payment_brand) AS payment_brand,
      SUM(line_total) AS order_total
    FROM filtered_lines
    GROUP BY order_key
  ),
  order_fees AS (
    SELECT
      o.order_key,
      o.payment_method,
      o.payment_brand,
      o.order_total,
      CASE
        WHEN o.order_total <= 0 THEN 0
        ELSE ((o.order_total * COALESCE(m.gateway_fee, 0) / 100)
              + COALESCE(m.fixed_value, 0))
             * (1 + COALESCE(m.vat_fee, 15) / 100)
      END AS bank_fee
    FROM order_agg o
    LEFT JOIN public.payment_methods m
      ON LOWER(o.payment_method) = LOWER(m.payment_type)
     AND LOWER(o.payment_brand) = LOWER(m.payment_method)
     AND m.is_active = true
  )
  SELECT
    payment_method,
    payment_brand,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(order_total), 0)::numeric AS total_sales,
    COALESCE(SUM(bank_fee), 0)::numeric AS bank_fee
  FROM order_fees
  GROUP BY payment_method, payment_brand
  ORDER BY bank_fee DESC;
$$;