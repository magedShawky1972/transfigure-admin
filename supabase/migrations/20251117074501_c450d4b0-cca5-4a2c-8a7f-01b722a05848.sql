-- Create function to recalculate bank fees for a specific payment brand
CREATE OR REPLACE FUNCTION public.update_ordertotals_bank_fees_by_brand(brand_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.ordertotals o
  SET bank_fee = CASE
    WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
    ELSE (
      COALESCE(o.total, 0) * COALESCE((SELECT m.gateway_fee/100 FROM public.payment_methods m WHERE lower(o.payment_brand) = lower(m.payment_method) AND m.is_active = true LIMIT 1), 0)
      + COALESCE((SELECT m.fixed_value FROM public.payment_methods m WHERE lower(o.payment_brand) = lower(m.payment_method) AND m.is_active = true LIMIT 1), 0)
    ) * 1.15
  END
  WHERE lower(o.payment_brand) = lower(brand_name)
    AND (o.bank_fee IS NULL OR o.bank_fee = 0 OR o.bank_fee != (
      CASE
        WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
        ELSE (
          COALESCE(o.total, 0) * COALESCE((SELECT m.gateway_fee/100 FROM public.payment_methods m WHERE lower(o.payment_brand) = lower(m.payment_method) AND m.is_active = true LIMIT 1), 0)
          + COALESCE((SELECT m.fixed_value FROM public.payment_methods m WHERE lower(o.payment_brand) = lower(m.payment_method) AND m.is_active = true LIMIT 1), 0)
        ) * 1.15
      END
    ));

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;