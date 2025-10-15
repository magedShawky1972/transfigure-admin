-- Aggregate customer transaction stats to fix totals and last transaction values
-- Function: customer_stats - aggregates across all phones
CREATE OR REPLACE FUNCTION public.customer_stats()
RETURNS TABLE(
  customer_phone text,
  total_spend numeric,
  last_transaction timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    customer_phone,
    coalesce(sum((regexp_replace(total, '[^0-9\.-]', '', 'g'))::numeric), 0) AS total_spend,
    max(created_at_date) AS last_transaction
  FROM public.purpletransaction
  WHERE customer_phone IS NOT NULL
  GROUP BY customer_phone
$$;

-- Function: customer_stats_by_phones - aggregates for a specific list of phones
CREATE OR REPLACE FUNCTION public.customer_stats_by_phones(_phones text[])
RETURNS TABLE(
  customer_phone text,
  total_spend numeric,
  last_transaction timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    customer_phone,
    coalesce(sum((regexp_replace(total, '[^0-9\.-]', '', 'g'))::numeric), 0) AS total_spend,
    max(created_at_date) AS last_transaction
  FROM public.purpletransaction
  WHERE customer_phone IS NOT NULL
    AND customer_phone = ANY(_phones)
  GROUP BY customer_phone
$$;