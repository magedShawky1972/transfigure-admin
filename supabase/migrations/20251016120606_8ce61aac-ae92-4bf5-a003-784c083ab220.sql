-- Normalize phone numbers and make view resilient to NULLs using NOT EXISTS
DROP VIEW IF EXISTS public.notin_customer_incustomer;

CREATE VIEW public.notin_customer_incustomer AS
WITH normalized AS (
  SELECT
    trim(both from customer_phone) AS customer_phone,
    trim(both from customer_name) AS customer_name,
    created_at_date
  FROM public.purpletransaction
  WHERE customer_phone IS NOT NULL
)
SELECT
  n.customer_phone,
  MIN(n.customer_name) AS customer_name,
  MIN(n.created_at_date) AS creation_date
FROM normalized n
WHERE NOT EXISTS (
  SELECT 1
  FROM public.customers c
  WHERE trim(both from c.customer_phone) = n.customer_phone
)
GROUP BY n.customer_phone;