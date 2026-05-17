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
      COALESCE(brand_name, 'Unknown')   AS brand_name,
      COALESCE(total, 0)::numeric        AS total,
      COALESCE(cost_sold, 0)::numeric    AS cost_sold,
      COALESCE(qty, 0)::numeric          AS qty,
      COALESCE(coins_number, 0)::numeric AS coins,
      payment_method,
      payment_brand,
      order_number,
      id
    FROM purpletransaction
    WHERE created_at_date_int >= p_start_int
      AND created_at_date_int <= p_end_int
      AND (p_brand_name IS NULL OR brand_name = p_brand_name)
      AND (p_company   IS NULL OR company   = p_company)
  ),
  non_point AS (
    SELECT *
    FROM base
    WHERE LOWER(COALESCE(payment_method, '')) <> 'point'
  ),
  -- Aggregate per order to compute fee once per order
  order_agg AS (
    SELECT
      COALESCE(order_number, id::text) AS order_key,
      MAX(payment_method) AS payment_method,
      MAX(payment_brand)  AS payment_brand,
      SUM(total)          AS order_total
    FROM non_point
    GROUP BY COALESCE(order_number, id::text)
  ),
  order_fees AS (
    SELECT
      o.order_key,
      o.order_total,
      CASE
        WHEN o.order_total <= 0 THEN 0
        ELSE ((o.order_total * COALESCE(m.gateway_fee, 0) / 100)
              + COALESCE(m.fixed_value, 0))
             * (1 + COALESCE(m.vat_fee, 15) / 100)
      END AS fee
    FROM order_agg o
    LEFT JOIN payment_methods m
      ON LOWER(o.payment_method) = LOWER(m.payment_type)
     AND LOWER(o.payment_brand)  = LOWER(m.payment_method)
     AND m.is_active = true
  ),
  -- Allocate fee back to brands by share of order total
  brand_fee AS (
    SELECT
      np.brand_name,
      SUM(
        CASE WHEN of.order_total > 0
             THEN of.fee * (np.total / of.order_total)
             ELSE 0 END
      ) AS bank_fee
    FROM non_point np
    JOIN order_fees of
      ON of.order_key = COALESCE(np.order_number, np.id::text)
    GROUP BY np.brand_name
  ),
  np_agg AS (
    SELECT
      brand_name,
      SUM(total)     AS total,
      SUM(cost_sold) AS cost_sold,
      SUM(qty)       AS qty,
      SUM(coins)     AS coins,
      COUNT(*)::bigint AS tx_count
    FROM non_point
    GROUP BY brand_name
  ),
  point_orders AS (
    SELECT brand_name,
           COALESCE(order_number, id::text) AS order_key,
           SUM(total) AS order_total
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
    COALESCE(a.brand_name, p.brand_name)           AS brand_name,
    COALESCE(a.total, 0)                            AS total,
    COALESCE(a.cost_sold, 0)                        AS cost_sold,
    COALESCE(bf.bank_fee, 0)                        AS bank_fee,
    COALESCE(p.points_cost, 0)                      AS points_cost,
    COALESCE(a.qty, 0)                              AS qty,
    COALESCE(a.coins, 0)                            AS coins,
    COALESCE(a.tx_count, 0)                         AS tx_count
  FROM np_agg a
  FULL OUTER JOIN points_per_brand p ON p.brand_name = a.brand_name
  LEFT JOIN brand_fee bf
    ON bf.brand_name = COALESCE(a.brand_name, p.brand_name);
$$;