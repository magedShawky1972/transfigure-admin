CREATE OR REPLACE FUNCTION public.get_brand_first_sale_dates()
RETURNS TABLE (brand_name text, first_sale_date date, transaction_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_name, MIN(created_at_date)::date AS first_sale_date, COUNT(*)::bigint AS transaction_count
  FROM public.purpletransaction
  WHERE brand_name IS NOT NULL AND created_at_date IS NOT NULL
  GROUP BY brand_name
  ORDER BY MIN(created_at_date) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_brand_first_sale_dates() TO authenticated;