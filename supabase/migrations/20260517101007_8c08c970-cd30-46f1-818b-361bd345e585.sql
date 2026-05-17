DROP FUNCTION IF EXISTS public.get_income_statement_revenue_source_aggregates(integer, integer, text, text);
CREATE FUNCTION public.get_income_statement_revenue_source_aggregates(p_start_int integer, p_end_int integer, p_brand_name text DEFAULT NULL::text, p_company text DEFAULT NULL::text)
 RETURNS TABLE(revenue_source text, total numeric, cost_sold numeric, tx_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    revenue_source,
    COALESCE(SUM(total), 0) AS total,
    COALESCE(SUM(cost_sold), 0) AS cost_sold,
    COUNT(*)::bigint AS tx_count
  FROM public.purpletransaction
  WHERE created_at_date_int BETWEEN p_start_int AND p_end_int
    AND COALESCE(is_deleted, false) = false
    AND revenue_source IS NOT NULL
    AND (p_brand_name IS NULL OR brand_name = p_brand_name)
    AND (p_company IS NULL OR company = p_company)
  GROUP BY revenue_source;
$function$;