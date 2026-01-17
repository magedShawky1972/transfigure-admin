-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_bank_balance_report(UUID, INTEGER, INTEGER);

-- Recreate function with fix for duplicate payment_methods
CREATE OR REPLACE FUNCTION public.get_bank_balance_report(
  p_bank_id UUID,
  p_from_date_int INTEGER,
  p_to_date_int INTEGER
)
RETURNS TABLE (
  description TEXT,
  payment_type TEXT,
  total_amount NUMERIC,
  order_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  -- Sales row - use EXISTS to avoid cartesian product from duplicate payment_methods
  SELECT 
    'Sales'::TEXT as description,
    LOWER(o.payment_type) as payment_type,
    COALESCE(SUM(o.total), 0) as total_amount,
    COUNT(o.id) as order_count
  FROM public.ordertotals o
  WHERE o.order_date_int BETWEEN p_from_date_int AND p_to_date_int
    AND EXISTS (
      SELECT 1 FROM public.payment_methods pm
      INNER JOIN public.banks b ON pm.bank_id = b.id
      WHERE LOWER(pm.payment_type) = LOWER(o.payment_type)
        AND b.id = p_bank_id
    )
  GROUP BY LOWER(o.payment_type)
  
  UNION ALL
  
  -- Bank Charges row
  SELECT 
    'Bank Charges'::TEXT as description,
    LOWER(o.payment_type) as payment_type,
    COALESCE(SUM(o.bank_fee), 0) as total_amount,
    COUNT(o.id) as order_count
  FROM public.ordertotals o
  WHERE o.order_date_int BETWEEN p_from_date_int AND p_to_date_int
    AND EXISTS (
      SELECT 1 FROM public.payment_methods pm
      INNER JOIN public.banks b ON pm.bank_id = b.id
      WHERE LOWER(pm.payment_type) = LOWER(o.payment_type)
        AND b.id = p_bank_id
    )
  GROUP BY LOWER(o.payment_type);
END;
$$;