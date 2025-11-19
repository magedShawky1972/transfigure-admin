-- Update the get_epayment_charges function to calculate fees dynamically
-- using payment_methods table with composite key (payment_type + payment_method)
CREATE OR REPLACE FUNCTION public.get_epayment_charges(date_from date, date_to date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE 
      WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
      ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
    END
  ), 0)
  FROM public.ordertotals o
  LEFT JOIN public.payment_methods m
    ON lower(o.payment_method) = lower(m.payment_type)
   AND lower(o.payment_brand) = lower(m.payment_method)
   AND m.is_active = true
  WHERE o.order_date::date BETWEEN date_from AND date_to;
$function$;