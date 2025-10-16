-- Fix security definer issue by explicitly setting SECURITY INVOKER
DROP VIEW IF EXISTS public.customer_totals;

CREATE VIEW public.customer_totals
WITH (security_invoker = true)
AS
SELECT 
  c.customer_phone,
  c.customer_name,
  MIN(t.created_at_date) AS creation_date,
  MAX(t.created_at_date) AS last_trans_date,
  COALESCE(SUM((REGEXP_REPLACE(t.total, '[^0-9\.-]', '', 'g'))::numeric), 0) AS total,
  c.status,
  c.is_blocked,
  c.block_reason
FROM customers AS c
INNER JOIN purpletransaction AS t ON c.customer_phone = t.customer_phone
WHERE t.payment_method <> 'point' OR t.payment_method IS NULL
GROUP BY c.customer_phone, c.customer_name, c.status, c.is_blocked, c.block_reason;

-- Enable RLS on the view
ALTER VIEW public.customer_totals SET (security_invoker = true);