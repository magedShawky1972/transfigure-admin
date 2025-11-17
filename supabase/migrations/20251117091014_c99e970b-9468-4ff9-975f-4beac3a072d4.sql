-- Drop the old function with ambiguous parameter names
DROP FUNCTION IF EXISTS public.update_ordertotals_bank_fees_by_pair(text, text, integer);

-- Create the new function with unambiguous parameter names (prefixed with p_)
CREATE OR REPLACE FUNCTION public.update_ordertotals_bank_fees_by_pair(
  p_brand_name text,
  p_payment_type text,
  batch_size integer DEFAULT 5000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_total integer := 0;
  batch_updated integer := 0;
  last_id uuid := NULL;
BEGIN
  LOOP
    WITH batch AS (
      SELECT o.id
      FROM public.ordertotals o
      WHERE lower(o.payment_brand) = lower(p_brand_name)
        AND lower(o.payment_method) = lower(p_payment_type)
        AND (last_id IS NULL OR o.id > last_id)
      ORDER BY o.id
      LIMIT batch_size
    ), computed AS (
      SELECT 
        o.id,
        CASE 
          WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
          ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
        END AS new_fee
      FROM public.ordertotals o
      JOIN batch b ON b.id = o.id
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
    SELECT count(*) INTO batch_updated FROM upd;

    updated_total := updated_total + COALESCE(batch_updated, 0);

    -- Advance the cursor
    SELECT max(id) INTO last_id FROM batch;

    EXIT WHEN last_id IS NULL; -- no more rows in this pair
  END LOOP;

  RETURN updated_total;
END;
$function$;