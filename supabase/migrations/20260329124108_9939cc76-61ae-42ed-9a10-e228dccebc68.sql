
CREATE OR REPLACE FUNCTION public.get_epayment_charges_breakdown(
  p_date_from date,
  p_date_to date,
  p_brand_name text DEFAULT NULL,
  p_company text DEFAULT NULL
)
RETURNS TABLE(
  payment_method text,
  payment_brand text,
  transaction_count bigint,
  total_sales numeric,
  bank_fee numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(t.payment_method, 'Unknown')::text AS payment_method,
    COALESCE(t.payment_brand, 'Unknown')::text AS payment_brand,
    COUNT(*)::bigint AS transaction_count,
    COALESCE(SUM(t.total), 0)::numeric AS total_sales,
    COALESCE(SUM(
      CASE 
        WHEN COALESCE(t.payment_method, '') = 'point' THEN 0
        ELSE ((COALESCE(t.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * (1 + COALESCE(m.vat_fee, 15) / 100)
      END
    ), 0)::numeric AS bank_fee
  FROM public.purpletransaction t
  LEFT JOIN public.payment_methods m
    ON lower(t.payment_method) = lower(m.payment_type)
   AND lower(t.payment_brand) = lower(m.payment_method)
   AND m.is_active = true
  WHERE t.created_at_date::date BETWEEN p_date_from AND p_date_to
    AND COALESCE(t.payment_method, '') != 'point'
    AND (p_brand_name IS NULL OR t.brand_name = p_brand_name)
    AND (p_company IS NULL OR t.company = p_company)
  GROUP BY t.payment_method, t.payment_brand
  ORDER BY bank_fee DESC;
$$;
