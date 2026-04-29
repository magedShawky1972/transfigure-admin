CREATE OR REPLACE FUNCTION public.get_brand_codes_with_transactions(_from_date integer DEFAULT NULL, _to_date integer DEFAULT NULL)
RETURNS TABLE(brand_code text, brand_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT brand_code, brand_name
  FROM public.purpletransaction
  WHERE (brand_code IS NOT NULL OR brand_name IS NOT NULL)
    AND (_from_date IS NULL OR created_at_date_int_utc >= _from_date)
    AND (_to_date IS NULL OR created_at_date_int_utc <= _to_date);
$function$;