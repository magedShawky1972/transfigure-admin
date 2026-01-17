-- Harden get_bank_balance_report function (set stable search_path)
CREATE OR REPLACE FUNCTION public.get_bank_balance_report(
  p_bank_id UUID,
  p_from_date_int INTEGER,
  p_to_date_int INTEGER
)
RETURNS TABLE (
  description TEXT,
  payment_type TEXT,
  total_amount NUMERIC,
  bank_charges NUMERIC,
  order_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'sales'::TEXT as description,
    LOWER(o.payment_type) as payment_type,
    COALESCE(SUM(o.total), 0) as total_amount,
    COALESCE(SUM(o.bank_fee), 0) as bank_charges,
    COUNT(o.id) as order_count
  FROM public.ordertotals o
  INNER JOIN public.payment_methods pm ON LOWER(o.payment_type) = LOWER(pm.payment_type)
  INNER JOIN public.banks b ON pm.bank_id = b.id
  WHERE o.order_date_int BETWEEN p_from_date_int AND p_to_date_int
    AND b.id = p_bank_id
  GROUP BY LOWER(o.payment_type);
END;
$$;