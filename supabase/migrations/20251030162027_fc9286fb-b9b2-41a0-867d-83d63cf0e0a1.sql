-- Create a summary RPC for totals by date range
CREATE OR REPLACE FUNCTION public.transactions_summary(date_from date, date_to date)
RETURNS TABLE(total_sales numeric, total_profit numeric, tx_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(SUM(total), 0) AS total_sales,
    COALESCE(SUM(profit), 0) AS total_profit,
    COUNT(*)::bigint AS tx_count
  FROM public.purpletransaction
  WHERE created_at_date::date BETWEEN date_from AND date_to;
$$;