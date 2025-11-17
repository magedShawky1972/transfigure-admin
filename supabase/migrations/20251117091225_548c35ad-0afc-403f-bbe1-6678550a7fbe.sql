-- Fix CTE scoping issue - rewrite with explicit table references
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
    -- Update in batches
    WITH target_orders AS (
      SELECT o.id, o.total, o.payment_method, o.payment_brand
      FROM public.ordertotals o
      WHERE lower(o.payment_brand) = lower(p_brand_name)
        AND lower(o.payment_method) = lower(p_payment_type)
        AND (last_id IS NULL OR o.id > last_id)
      ORDER BY o.id
      LIMIT batch_size
    ), 
    computed_fees AS (
      SELECT 
        t.id,
        CASE 
          WHEN COALESCE(t.payment_method, '') = 'point' THEN 0
          ELSE ((COALESCE(t.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
        END AS new_fee
      FROM target_orders t
      LEFT JOIN public.payment_methods m
        ON lower(t.payment_method) = lower(m.payment_type)
       AND lower(t.payment_brand) = lower(m.payment_method)
       AND m.is_active = true
    ), 
    updated_rows AS (
      UPDATE public.ordertotals o
      SET bank_fee = cf.new_fee
      FROM computed_fees cf
      WHERE o.id = cf.id
        AND (o.bank_fee IS NULL OR o.bank_fee = 0 OR o.bank_fee <> cf.new_fee)
      RETURNING o.id
    )
    SELECT count(*) INTO batch_updated FROM updated_rows;

    updated_total := updated_total + COALESCE(batch_updated, 0);

    -- Advance the cursor to the last processed ID
    SELECT max(id) INTO last_id FROM target_orders;

    EXIT WHEN last_id IS NULL; -- no more rows in this pair
  END LOOP;

  RETURN updated_total;
END;
$function$;