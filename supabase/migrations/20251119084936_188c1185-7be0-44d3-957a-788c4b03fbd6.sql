-- Create optimized RPC functions for dashboard metrics

-- Function to get cost of sales (COGS) excluding point transactions
CREATE OR REPLACE FUNCTION public.get_cost_of_sales(date_from date, date_to date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(cost_sold), 0)
  FROM public.purpletransaction
  WHERE created_at_date::date BETWEEN date_from AND date_to
    AND COALESCE(payment_method, '') != 'point';
$function$;

-- Function to get e-payment charges from ordertotals
CREATE OR REPLACE FUNCTION public.get_epayment_charges(date_from date, date_to date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(bank_fee), 0)
  FROM public.ordertotals
  WHERE order_date::date BETWEEN date_from AND date_to
    AND COALESCE(payment_method, '') != 'point';
$function$;

-- Function to get point transactions summary (sales and cost)
CREATE OR REPLACE FUNCTION public.get_points_summary(date_from date, date_to date)
RETURNS TABLE(total_sales numeric, total_cost numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    COALESCE(SUM(total), 0) as total_sales,
    COALESCE(SUM(cost_sold), 0) as total_cost
  FROM public.purpletransaction
  WHERE created_at_date::date BETWEEN date_from AND date_to
    AND COALESCE(payment_method, '') = 'point';
$function$;