-- Performance indexes for composite matching
CREATE INDEX IF NOT EXISTS idx_ordertotals_brand_method_lower
  ON public.ordertotals ((lower(payment_brand)), (lower(payment_method)));

CREATE INDEX IF NOT EXISTS idx_payment_methods_type_brand_active_lower
  ON public.payment_methods (is_active, (lower(payment_type)), (lower(payment_method)));

-- Optimized: compute fees via join and update only changed rows
CREATE OR REPLACE FUNCTION public.update_ordertotals_bank_fees()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  WITH computed AS (
    SELECT 
      o.id,
      CASE 
        WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
        ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
      END AS new_fee
    FROM public.ordertotals o
    JOIN public.payment_methods m
      ON lower(o.payment_method) = lower(m.payment_type)
     AND lower(o.payment_brand)   = lower(m.payment_method)
     AND m.is_active = true
  ), upd AS (
    UPDATE public.ordertotals o
    SET bank_fee = c.new_fee
    FROM computed c
    WHERE o.id = c.id
      AND (o.bank_fee IS NULL OR o.bank_fee = 0 OR o.bank_fee <> c.new_fee)
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM upd;

  RETURN updated_count;
END;
$function$;

-- Optimized brand-scoped updater
CREATE OR REPLACE FUNCTION public.update_ordertotals_bank_fees_by_brand(brand_name text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  updated_count integer;
BEGIN
  WITH computed AS (
    SELECT 
      o.id,
      CASE 
        WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
        ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
      END AS new_fee
    FROM public.ordertotals o
    JOIN public.payment_methods m
      ON lower(o.payment_method) = lower(m.payment_type)
     AND lower(o.payment_brand)   = lower(m.payment_method)
     AND m.is_active = true
    WHERE lower(o.payment_brand) = lower(brand_name)
  ), upd AS (
    UPDATE public.ordertotals o
    SET bank_fee = c.new_fee
    FROM computed c
    WHERE o.id = c.id
      AND (o.bank_fee IS NULL OR o.bank_fee = 0 OR o.bank_fee <> c.new_fee)
    RETURNING 1
  )
  SELECT count(*) INTO updated_count FROM upd;

  RETURN updated_count;
END;
$function$;