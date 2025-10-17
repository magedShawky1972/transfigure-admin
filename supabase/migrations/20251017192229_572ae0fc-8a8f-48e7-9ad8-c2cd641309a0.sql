-- Fix backend aggregation functions to work with numeric columns (remove regexp_replace)

CREATE OR REPLACE FUNCTION public.customer_stats()
 RETURNS TABLE(customer_phone text, total_spend numeric, last_transaction timestamp without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    customer_phone,
    coalesce(sum(total), 0) AS total_spend,
    max(created_at_date) AS last_transaction
  FROM public.purpletransaction
  WHERE customer_phone IS NOT NULL
  GROUP BY customer_phone
$function$;

-- sales_trend used by dashboard charts
CREATE OR REPLACE FUNCTION public.sales_trend(date_from date, date_to date)
 RETURNS TABLE(created_at_date date, total_sum numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    created_at_date::date as created_at_date,
    coalesce(sum(total), 0) as total_sum
  from public.purpletransaction
  where created_at_date::date between date_from and date_to
  group by created_at_date::date
  order by created_at_date::date;
$function$;

-- Stats by specific phones
CREATE OR REPLACE FUNCTION public.customer_stats_by_phones(_phones text[])
 RETURNS TABLE(customer_phone text, total_spend numeric, last_transaction timestamp without time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    customer_phone,
    coalesce(sum(total), 0) AS total_spend,
    max(created_at_date) AS last_transaction
  FROM public.purpletransaction
  WHERE customer_phone IS NOT NULL
    AND customer_phone = ANY(_phones)
  GROUP BY customer_phone
$function$;