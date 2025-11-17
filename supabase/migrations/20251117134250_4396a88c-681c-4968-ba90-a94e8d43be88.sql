-- Function to compute cost by brand type without row limits
CREATE OR REPLACE FUNCTION public.cost_by_brand_type(
  date_from date,
  date_to date,
  p_brand_type text DEFAULT NULL
)
RETURNS TABLE(
  brand_type_name text,
  total_cost numeric,
  transaction_count bigint
) AS $$
  SELECT 
    COALESCE(bt.type_name, 'Unknown') AS brand_type_name,
    COALESCE(SUM(t.cost_sold), 0) AS total_cost,
    COUNT(*)::bigint AS transaction_count
  FROM public.purpletransaction t
  LEFT JOIN public.brands b ON t.brand_code = b.brand_code
  LEFT JOIN public.brand_type bt ON bt.id = b.brand_type_id
  WHERE COALESCE(t.payment_method, '') <> 'point'
    AND t.created_at_date::date BETWEEN date_from AND date_to
    AND (p_brand_type IS NULL OR bt.type_name = p_brand_type)
  GROUP BY bt.type_name
  ORDER BY total_cost DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;