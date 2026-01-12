-- Fix the function search path for security
CREATE OR REPLACE FUNCTION public.get_distinct_payment_methods()
RETURNS TABLE(payment_method text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT pt.payment_method
  FROM public.purpletransaction pt
  WHERE pt.payment_method IS NOT NULL AND pt.payment_method <> ''
  ORDER BY pt.payment_method;
$$;