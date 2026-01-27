-- Update transactions_summary to accept optional brand filter
CREATE OR REPLACE FUNCTION public.transactions_summary(date_from date, date_to date, p_brand_name text DEFAULT NULL)
RETURNS TABLE(total_sales numeric, total_profit numeric, tx_count bigint) AS $$
  WITH regular_txns AS (
    SELECT 
      COALESCE(SUM(total), 0) AS sales,
      COALESCE(SUM(profit), 0) AS gross_profit,
      COALESCE(SUM(bank_fee), 0) AS payment_charges,
      COUNT(*) AS count
    FROM public.purpletransaction
    WHERE created_at_date::date BETWEEN date_from AND date_to
      AND COALESCE(payment_method, '') != 'point'
      AND (p_brand_name IS NULL OR brand_name = p_brand_name)
  ),
  point_costs AS (
    SELECT COALESCE(SUM(total), 0) as point_cost
    FROM (
      SELECT DISTINCT ON (COALESCE(order_number, id::text)) total
      FROM public.purpletransaction
      WHERE created_at_date::date BETWEEN date_from AND date_to
        AND COALESCE(payment_method, '') = 'point'
        AND (p_brand_name IS NULL OR brand_name = p_brand_name)
      ORDER BY COALESCE(order_number, id::text), created_at DESC
    ) unique_point_orders
  )
  SELECT 
    r.sales,
    r.gross_profit - r.payment_charges - p.point_cost,
    r.count
  FROM regular_txns r, point_costs p;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Update get_cost_of_sales to accept optional brand filter
CREATE OR REPLACE FUNCTION public.get_cost_of_sales(date_from date, date_to date, p_brand_name text DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(cost_sold), 0)
  FROM public.purpletransaction
  WHERE created_at_date::date BETWEEN date_from AND date_to
    AND COALESCE(payment_method, '') != 'point'
    AND (p_brand_name IS NULL OR brand_name = p_brand_name);
$function$;

-- Update get_epayment_charges to accept optional brand filter
CREATE OR REPLACE FUNCTION public.get_epayment_charges(date_from date, date_to date, p_brand_name text DEFAULT NULL)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE 
      WHEN COALESCE(o.payment_method, '') = 'point' THEN 0
      ELSE ((COALESCE(o.total, 0) * COALESCE(m.gateway_fee, 0) / 100) + COALESCE(m.fixed_value, 0)) * 1.15
    END
  ), 0)
  FROM public.purpletransaction o
  LEFT JOIN public.payment_methods m ON m.payment_method = o.payment_brand
  WHERE o.created_at_date::date BETWEEN date_from AND date_to
    AND (p_brand_name IS NULL OR o.brand_name = p_brand_name);
$function$;

-- Update get_points_summary to accept optional brand filter
CREATE OR REPLACE FUNCTION public.get_points_summary(date_from date, date_to date, p_brand_name text DEFAULT NULL)
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
    AND COALESCE(payment_method, '') = 'point'
    AND (p_brand_name IS NULL OR brand_name = p_brand_name);
$function$;