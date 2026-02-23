
DROP FUNCTION IF EXISTS public.cost_by_brand_type(date, date, text);
DROP FUNCTION IF EXISTS public.cost_by_brand_type_brands(date, date, text);
DROP FUNCTION IF EXISTS public.cost_by_brand_type_products(date, date, text);

CREATE OR REPLACE FUNCTION public.cost_by_brand_type(date_from date, date_to date, p_brand_type text DEFAULT NULL::text)
RETURNS TABLE(brand_type_name text, total_cost numeric, transaction_count bigint, total_qty numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(bt.type_name, 'Unknown') AS brand_type_name,
    COALESCE(SUM(t.cost_sold), 0) AS total_cost,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(t.qty), 0) AS total_qty
  FROM public.purpletransaction t
  LEFT JOIN public.brands b ON t.brand_code = b.brand_code
  LEFT JOIN public.brand_type bt ON bt.id = b.brand_type_id
  WHERE COALESCE(t.payment_method, '') <> 'point'
    AND t.created_at_date::date BETWEEN date_from AND date_to
    AND (p_brand_type IS NULL OR bt.type_name = p_brand_type)
  GROUP BY bt.type_name
  ORDER BY total_cost DESC;
$$;

CREATE OR REPLACE FUNCTION public.cost_by_brand_type_brands(date_from date, date_to date, p_brand_type text)
RETURNS TABLE(brand_name text, total_cost numeric, transaction_count bigint, total_qty numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(b.brand_name, 'Unknown') AS brand_name,
    COALESCE(SUM(t.cost_sold), 0) AS total_cost,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(t.qty), 0) AS total_qty
  FROM public.purpletransaction t
  LEFT JOIN public.brands b ON t.brand_code = b.brand_code
  LEFT JOIN public.brand_type bt ON bt.id = b.brand_type_id
  WHERE COALESCE(t.payment_method, '') <> 'point'
    AND t.created_at_date::date BETWEEN date_from AND date_to
    AND bt.type_name = p_brand_type
  GROUP BY b.brand_name
  ORDER BY total_cost DESC;
$$;

CREATE OR REPLACE FUNCTION public.cost_by_brand_type_products(date_from date, date_to date, p_brand_name text)
RETURNS TABLE(product_name text, total_cost numeric, transaction_count bigint, total_qty numeric)
LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(t.product_name, 'Unknown') AS product_name,
    COALESCE(SUM(t.cost_sold), 0) AS total_cost,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(t.qty), 0) AS total_qty
  FROM public.purpletransaction t
  LEFT JOIN public.brands b ON t.brand_code = b.brand_code
  WHERE COALESCE(t.payment_method, '') <> 'point'
    AND t.created_at_date::date BETWEEN date_from AND date_to
    AND b.brand_name = p_brand_name
  GROUP BY t.product_name
  ORDER BY total_cost DESC;
$$;
