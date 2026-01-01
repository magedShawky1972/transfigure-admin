-- =====================================================
-- FIX SECURITY DEFINER VIEWS - Convert to SECURITY INVOKER
-- This ensures views respect RLS of underlying tables
-- =====================================================

-- 1. DROP existing views
DROP VIEW IF EXISTS public.customer_totals;
DROP VIEW IF EXISTS public.notin_customer_incustomer;
DROP VIEW IF EXISTS public.purpletransaction_enriched;

-- 2. Recreate views with SECURITY INVOKER (respects RLS)

-- customer_totals view - joins customers and purpletransaction
CREATE VIEW public.customer_totals 
WITH (security_invoker = true)
AS
SELECT 
  c.customer_phone,
  c.customer_name,
  c.creation_date,
  c.status,
  c.is_blocked,
  c.block_reason,
  COALESCE(sum(pt.total), 0::numeric) AS total,
  max(pt.created_at_date) AS last_trans_date
FROM customers c
LEFT JOIN purpletransaction pt ON c.customer_phone = pt.customer_phone
WHERE COALESCE(pt.payment_method, ''::text) <> 'point'::text
GROUP BY c.customer_phone, c.customer_name, c.creation_date, c.status, c.is_blocked, c.block_reason;

-- notin_customer_incustomer view - finds customers in transactions not in customers table
CREATE VIEW public.notin_customer_incustomer
WITH (security_invoker = true)
AS
SELECT DISTINCT 
  customer_phone,
  customer_name,
  created_at_date AS creation_date
FROM purpletransaction pt
WHERE customer_phone IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 FROM customers c WHERE c.customer_phone = pt.customer_phone
);

-- purpletransaction_enriched view - enriched transaction data
CREATE VIEW public.purpletransaction_enriched
WITH (security_invoker = true)
AS
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
  total::numeric AS total_num,
  profit::numeric AS profit_num,
  qty::numeric AS qty_num,
  cost_price::numeric AS cost_price_num,
  unit_price::numeric AS unit_price_num,
  cost_sold::numeric AS cost_sold_num
FROM purpletransaction;

-- 3. Revoke public access and grant only to authenticated users
REVOKE ALL ON public.customer_totals FROM anon;
REVOKE ALL ON public.notin_customer_incustomer FROM anon;
REVOKE ALL ON public.purpletransaction_enriched FROM anon;

-- Grant select to authenticated (they still need to pass RLS on underlying tables)
GRANT SELECT ON public.customer_totals TO authenticated;
GRANT SELECT ON public.notin_customer_incustomer TO authenticated;
GRANT SELECT ON public.purpletransaction_enriched TO authenticated;