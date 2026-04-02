CREATE OR REPLACE FUNCTION public.get_distinct_transaction_product_ids()
RETURNS TABLE(product_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pt.product_id
  FROM purpletransaction pt
  WHERE pt.product_id IS NOT NULL;
$$;