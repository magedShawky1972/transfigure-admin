-- Update sales_trend function to exclude point sales
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
    AND COALESCE(payment_method, '') != 'point'
  group by created_at_date::date
  order by created_at_date::date;
$function$