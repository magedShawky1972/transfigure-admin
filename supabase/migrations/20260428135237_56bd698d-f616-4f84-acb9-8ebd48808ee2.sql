CREATE OR REPLACE FUNCTION public.get_brand_codes_with_transactions()
RETURNS TABLE(brand_code text, brand_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT brand_code, brand_name
  FROM public.purpletransaction
  WHERE brand_code IS NOT NULL OR brand_name IS NOT NULL;
$$;