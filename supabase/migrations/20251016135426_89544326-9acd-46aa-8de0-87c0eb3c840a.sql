-- Drop the existing customer_totals view
DROP VIEW IF EXISTS public.customer_totals;

-- Create customer_totals as a view that automatically calculates from purpletransaction
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
  -- Total spend (sum of all transaction totals)
  COALESCE(
    SUM(
      (REGEXP_REPLACE(COALESCE(pt.total, '0'), '[^0-9.-]', '', 'g'))::numeric
    ), 
    0
  ) as total,
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