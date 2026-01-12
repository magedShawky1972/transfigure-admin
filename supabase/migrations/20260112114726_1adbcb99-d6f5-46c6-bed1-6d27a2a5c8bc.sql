-- Create a lightweight RPC to return distinct payment methods
CREATE OR REPLACE FUNCTION public.get_distinct_payment_methods()
RETURNS TABLE(payment_method text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT pt.payment_method
  FROM public.purpletransaction pt
  WHERE pt.payment_method IS NOT NULL AND pt.payment_method <> ''
  ORDER BY pt.payment_method;
$$;