
-- Function 1: Get transactions with no matching product (unmatched)
CREATE OR REPLACE FUNCTION public.get_unmatched_transaction_products(p_date_from date, p_date_to date)
RETURNS TABLE(product_id text, product_name text, brand_name text, brand_code text, transaction_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    t.product_id,
    MAX(t.product_name) AS product_name,
    MAX(t.brand_name) AS brand_name,
    MAX(t.brand_code) AS brand_code,
    COUNT(*)::bigint AS transaction_count
  FROM public.purpletransaction t
  LEFT JOIN public.products p ON t.product_id = p.product_id
  WHERE t.product_id IS NOT NULL
    AND t.created_at_date::date BETWEEN p_date_from AND p_date_to
    AND p.product_id IS NULL
  GROUP BY t.product_id
  ORDER BY transaction_count DESC;
$$;

-- Function 2: Get products with no transactions in date range
CREATE OR REPLACE FUNCTION public.get_products_without_transactions(p_date_from date, p_date_to date)
RETURNS TABLE(product_id text, product_name text, brand_name text, brand_code text, sku text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.product_id,
    p.product_name,
    p.brand_name,
    p.brand_code,
    p.sku,
    p.status
  FROM public.products p
  LEFT JOIN (
    SELECT DISTINCT product_id 
    FROM public.purpletransaction 
    WHERE product_id IS NOT NULL 
      AND created_at_date::date BETWEEN p_date_from AND p_date_to
  ) t ON p.product_id = t.product_id
  WHERE t.product_id IS NULL
  ORDER BY p.product_name;
$$;
