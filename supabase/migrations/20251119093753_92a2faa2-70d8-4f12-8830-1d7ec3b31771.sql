-- Fix Security Definer Views: Recreate views without SECURITY DEFINER
-- This ensures views respect RLS policies of the querying user

-- Drop and recreate customer_totals view without SECURITY DEFINER
DROP VIEW IF EXISTS public.customer_totals;

CREATE VIEW public.customer_totals AS
SELECT 
  c.customer_phone,
  c.customer_name,
  c.creation_date,
  c.status,
  c.is_blocked,
  c.block_reason,
  COALESCE(SUM(pt.total), 0) as total,
  MAX(pt.created_at_date) as last_trans_date
FROM public.customers c
LEFT JOIN public.purpletransaction pt ON c.customer_phone = pt.customer_phone
WHERE COALESCE(pt.payment_method, '') != 'point'
GROUP BY c.customer_phone, c.customer_name, c.creation_date, c.status, c.is_blocked, c.block_reason;

-- Drop and recreate purpletransaction_enriched view without SECURITY DEFINER
DROP VIEW IF EXISTS public.purpletransaction_enriched;

CREATE VIEW public.purpletransaction_enriched AS
SELECT 
  id,
  created_at,
  updated_at,
  created_at_date,
  user_name,
  customer_name,
  customer_phone,
  brand_name,
  product_id,
  product_name,
  payment_method,
  payment_type,
  payment_brand,
  vendor_name,
  order_status,
  order_number,
  coins_number,
  unit_price,
  cost_price,
  qty,
  cost_sold,
  total,
  profit,
  -- Add numeric versions for calculations
  CAST(total AS NUMERIC) as total_num,
  CAST(profit AS NUMERIC) as profit_num,
  CAST(qty AS NUMERIC) as qty_num,
  CAST(cost_price AS NUMERIC) as cost_price_num,
  CAST(unit_price AS NUMERIC) as unit_price_num,
  CAST(cost_sold AS NUMERIC) as cost_sold_num
FROM public.purpletransaction;

-- Drop and recreate notin_customer_incustomer view without SECURITY DEFINER
DROP VIEW IF EXISTS public.notin_customer_incustomer;

CREATE VIEW public.notin_customer_incustomer AS
SELECT DISTINCT
  pt.customer_phone,
  pt.customer_name,
  pt.created_at_date as creation_date
FROM public.purpletransaction pt
WHERE pt.customer_phone IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM public.customers c 
    WHERE c.customer_phone = pt.customer_phone
  );