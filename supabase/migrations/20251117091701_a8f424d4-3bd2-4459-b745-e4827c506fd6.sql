-- Replace function to fix batch ID selection (no GROUP BY error)
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
  batch_ids uuid[];
BEGIN
  LOOP
    -- Get ordered batch IDs using a subquery (avoids GROUP BY issues)
    SELECT array_agg(s.id) INTO batch_ids
    FROM (
      SELECT o.id
      FROM public.ordertotals o
      WHERE lower(o.payment_brand) = lower(p_brand_name)
        AND lower(o.payment_method) = lower(p_payment_type)
        AND (last_id IS NULL OR o.id > last_id)
      ORDER BY o.id
      LIMIT batch_size
    ) AS s;

    -- Exit if no more records
    EXIT WHEN batch_ids IS NULL OR array_length(batch_ids, 1) IS NULL;

    -- Compute fees for this batch and update
    WITH computed_fees AS (
      SELECT 
        o.id,
        CASE 
          WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
          ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
        END AS new_fee
      FROM public.ordertotals o
      LEFT JOIN public.payment_methods m
        ON lower(o.payment_method) = lower(m.payment_type)
       AND lower(o.payment_brand) = lower(m.payment_method)
       AND m.is_active = true
      WHERE o.id = ANY(batch_ids)
    ), updated_rows AS (
      UPDATE public.ordertotals o
      SET bank_fee = cf.new_fee
      FROM computed_fees cf
      WHERE o.id = cf.id
        AND (o.bank_fee IS NULL OR o.bank_fee = 0 OR o.bank_fee <> cf.new_fee)
      RETURNING o.id
    )
    SELECT count(*) INTO batch_updated FROM updated_rows;

    updated_total := updated_total + COALESCE(batch_updated, 0);

    -- Move cursor forward
    last_id := batch_ids[array_length(batch_ids, 1)];
  END LOOP;

  RETURN updated_total;
END;
$function$;