CREATE OR REPLACE FUNCTION public.get_income_statement_brand_aggregates(
  p_start_int integer,
  p_end_int integer,
  p_brand_name text DEFAULT NULL,
  p_company text DEFAULT NULL
)
RETURNS TABLE (
  brand_name text,
  total numeric,
  cost_sold numeric,
  bank_fee numeric,
  points_cost numeric,
  qty numeric,
  coins numeric,
  tx_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(brand_name, 'Unknown') AS brand_name,
      COALESCE(total, 0)::numeric      AS total,
      COALESCE(cost_sold, 0)::numeric  AS cost_sold,
      COALESCE(bank_fee, 0)::numeric   AS bank_fee,
      COALESCE(qty, 0)::numeric        AS qty,
      COALESCE(coins_number, 0)::numeric AS coins,
      payment_method,
      order_number,
      id
    FROM purpletransaction
    WHERE created_at_date_int >= p_start_int
      AND created_at_date_int <= p_end_int
      AND (p_brand_name IS NULL OR brand_name = p_brand_name)
      AND (p_company   IS NULL OR company   = p_company)
  ),
  non_point AS (
    SELECT
      brand_name,
      SUM(total)     AS total,
      SUM(cost_sold) AS cost_sold,
      SUM(bank_fee)  AS bank_fee,
      SUM(qty)       AS qty,
      SUM(coins)     AS coins,
      COUNT(*)::bigint AS tx_count
    FROM base
    WHERE LOWER(COALESCE(payment_method, '')) <> 'point'
    GROUP BY brand_name
  ),
  point_orders AS (
    -- collapse duplicate point rows per order before summing
    SELECT brand_name, COALESCE(order_number, id::text) AS order_key, SUM(total) AS order_total
    FROM base
    WHERE LOWER(COALESCE(payment_method, '')) = 'point'
    GROUP BY brand_name, COALESCE(order_number, id::text)
  ),
  points_per_brand AS (
    SELECT brand_name, SUM(order_total) AS points_cost
    FROM point_orders
    GROUP BY brand_name
  )
  SELECT
    COALESCE(np.brand_name, pp.brand_name) AS brand_name,
    COALESCE(np.total, 0)     AS total,
    COALESCE(np.cost_sold, 0) AS cost_sold,
    COALESCE(np.bank_fee, 0)  AS bank_fee,
    COALESCE(pp.points_cost, 0) AS points_cost,
    COALESCE(np.qty, 0)       AS qty,
    COALESCE(np.coins, 0)     AS coins,
    COALESCE(np.tx_count, 0)  AS tx_count
  FROM non_point np
  FULL OUTER JOIN points_per_brand pp ON pp.brand_name = np.brand_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_income_statement_brand_aggregates(integer, integer, text, text) TO authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_purpletransaction_created_at_date_int
  ON public.purpletransaction (created_at_date_int);