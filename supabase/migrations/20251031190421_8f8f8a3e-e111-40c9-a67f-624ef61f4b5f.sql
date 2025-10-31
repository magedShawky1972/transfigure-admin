-- Update transactions_summary RPC to calculate net profit after deducting points cost and e-payment charges
DROP FUNCTION IF EXISTS public.transactions_summary(date, date);

CREATE OR REPLACE FUNCTION public.transactions_summary(date_from date, date_to date)
RETURNS TABLE(total_sales numeric, total_profit numeric, tx_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH regular_txns AS (
    SELECT 
      COALESCE(SUM(total), 0) AS sales,
      COALESCE(SUM(profit), 0) AS gross_profit,
      COALESCE(SUM(bank_fee), 0) AS payment_charges,
      COUNT(*) AS count
    FROM public.purpletransaction
    WHERE created_at_date::date BETWEEN date_from AND date_to
      AND COALESCE(payment_method, '') != 'point'
  ),
  point_txns AS (
    SELECT COALESCE(SUM(total), 0) AS points_cost
    FROM public.purpletransaction
    WHERE created_at_date::date BETWEEN date_from AND date_to
      AND COALESCE(payment_method, '') = 'point'
  ),
  all_txns AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM public.purpletransaction
    WHERE created_at_date::date BETWEEN date_from AND date_to
  )
  SELECT 
    regular_txns.sales AS total_sales,
    (regular_txns.gross_profit - point_txns.points_cost - regular_txns.payment_charges) AS total_profit,
    all_txns.total_count AS tx_count
  FROM regular_txns, point_txns, all_txns;
$$;