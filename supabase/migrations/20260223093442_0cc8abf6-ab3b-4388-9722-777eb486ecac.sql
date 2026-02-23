
CREATE OR REPLACE FUNCTION public.get_epayment_charges(date_from date, date_to date, p_brand_name text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE 
      WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
      ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * (1 + COALESCE(m.vat_fee, 15) / 100)
    END
  ), 0)
  FROM public.purpletransaction o
  LEFT JOIN public.payment_methods m
    ON lower(o.payment_method) = lower(m.payment_type)
   AND lower(o.payment_brand) = lower(m.payment_method)
   AND m.is_active = true
  WHERE o.created_at_date::date BETWEEN date_from AND date_to
    AND (p_brand_name IS NULL OR o.brand_name = p_brand_name);
$function$;
