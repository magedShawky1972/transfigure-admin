CREATE OR REPLACE FUNCTION public.get_income_statement_revenue_source_aggregates(
  p_start_int integer,
  p_end_int integer,
  p_brand_name text DEFAULT NULL,
  p_company text DEFAULT NULL
)
RETURNS TABLE(revenue_source text, total numeric, tx_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    revenue_source,
    COALESCE(SUM(total), 0) AS total,
    COUNT(*)::bigint AS tx_count
  FROM public.purpletransaction
  WHERE created_at_date_int BETWEEN p_start_int AND p_end_int
    AND COALESCE(is_deleted, false) = false
    AND revenue_source IS NOT NULL
    AND (p_brand_name IS NULL OR brand_name = p_brand_name)
    AND (p_company IS NULL OR company = p_company)
  GROUP BY revenue_source;
$$;
