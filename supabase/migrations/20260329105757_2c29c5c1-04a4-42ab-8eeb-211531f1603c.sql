
CREATE OR REPLACE FUNCTION public.get_payment_whatif_aggregates(p_date_from date, p_date_to date)
RETURNS TABLE(
  payment_method text,
  payment_brand text,
  transaction_count bigint,
  total_sales numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(t.payment_method, '')::text AS payment_method,
    COALESCE(t.payment_brand, '')::text AS payment_brand,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(t.total), 0)::numeric AS total_sales
  FROM public.purpletransaction t
  WHERE t.created_at_date::date BETWEEN p_date_from AND p_date_to
    AND COALESCE(t.payment_method, '') != 'point'
    AND t.payment_brand IS NOT NULL
    AND t.payment_brand != ''
  GROUP BY t.payment_method, t.payment_brand
  ORDER BY total_sales DESC;
$$;
