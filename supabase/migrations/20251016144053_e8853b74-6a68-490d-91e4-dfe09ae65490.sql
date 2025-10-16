-- Drop all views that depend on purpletransaction
DROP VIEW IF EXISTS public.purpletransaction_enriched;
DROP VIEW IF EXISTS public.customer_totals;

-- Convert text columns to numeric(18,3) by cleaning and casting the data
ALTER TABLE public.purpletransaction 
  ALTER COLUMN coins_number TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(coins_number,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

ALTER TABLE public.purpletransaction 
  ALTER COLUMN unit_price TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(unit_price,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

ALTER TABLE public.purpletransaction 
  ALTER COLUMN cost_price TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(cost_price,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

ALTER TABLE public.purpletransaction 
  ALTER COLUMN qty TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(qty,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

ALTER TABLE public.purpletransaction 
  ALTER COLUMN cost_sold TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(cost_sold,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

ALTER TABLE public.purpletransaction 
  ALTER COLUMN total TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(total,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

ALTER TABLE public.purpletransaction 
  ALTER COLUMN profit TYPE numeric(18,3) 
    USING (regexp_replace(coalesce(profit,'0'), '[^0-9\.-]', '', 'g'))::numeric(18,3);

-- Recreate customer_totals view with numeric columns
CREATE OR REPLACE VIEW public.customer_totals AS
SELECT 
  pt.customer_phone,
  -- Get the most recent customer name for this phone
  (SELECT customer_name 
   FROM purpletransaction 
   WHERE customer_phone = pt.customer_phone 
     AND customer_name IS NOT NULL
   ORDER BY created_at_date DESC 
   LIMIT 1) as customer_name,
  -- First transaction date
  MIN(pt.created_at_date) as creation_date,
  -- Last transaction date
  MAX(pt.created_at_date) as last_trans_date,
  -- Total spend (now just sum since columns are numeric)
  COALESCE(SUM(pt.total), 0) as total,
  -- Get status from customers table, default to 'active'
  COALESCE(c.status, 'active') as status,
  -- Get is_blocked from customers table, default to false
  COALESCE(c.is_blocked, false) as is_blocked,
  -- Get block_reason from customers table
  c.block_reason
FROM public.purpletransaction pt
LEFT JOIN public.customers c ON c.customer_phone = pt.customer_phone
WHERE pt.customer_phone IS NOT NULL
GROUP BY pt.customer_phone, c.status, c.is_blocked, c.block_reason;

-- Recreate enriched view (simplified since columns are now numeric)
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
  -- Direct references since columns are now numeric
  total AS total_num,
  profit AS profit_num,
  qty AS qty_num,
  cost_price AS cost_price_num,
  unit_price AS unit_price_num,
  cost_sold AS cost_sold_num
FROM public.purpletransaction;