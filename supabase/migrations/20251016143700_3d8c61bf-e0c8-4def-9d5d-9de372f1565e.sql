-- Create a view with numeric-cast columns for fast, correct sorting/filtering
DROP VIEW IF EXISTS public.purpletransaction_enriched;

CREATE VIEW public.purpletransaction_enriched AS
SELECT
  id,
  created_at,
  updated_at,
  created_at_date,
  order_number,
  user_name,
  customer_name,
  customer_phone,
  brand_name,
  product_name,
  coins_number,
  unit_price,
  cost_price,
  qty,
  cost_sold,
  total,
  profit,
  payment_method,
  payment_type,
  payment_brand,
  vendor_name,
  product_id,
  order_status,
  -- Numeric projections for proper ordering
  (regexp_replace(coalesce(total,'0'), '[^0-9\.-]', '', 'g'))::numeric       AS total_num,
  (regexp_replace(coalesce(profit,'0'), '[^0-9\.-]', '', 'g'))::numeric      AS profit_num,
  (regexp_replace(coalesce(qty,'0'), '[^0-9\.-]', '', 'g'))::numeric         AS qty_num,
  (regexp_replace(coalesce(cost_price,'0'), '[^0-9\.-]', '', 'g'))::numeric  AS cost_price_num,
  (regexp_replace(coalesce(unit_price,'0'), '[^0-9\.-]', '', 'g'))::numeric  AS unit_price_num,
  (regexp_replace(coalesce(cost_sold,'0'), '[^0-9\.-]', '', 'g'))::numeric   AS cost_sold_num
FROM public.purpletransaction;