-- Create a function to return summed sales per day within a date range
create or replace function public.sales_trend(
  date_from date,
  date_to date
)
returns table(
  created_at_date date,
  total_sum numeric
)
language sql
as $$
  select
    created_at_date::date as created_at_date,
    coalesce(sum((regexp_replace(total, '[^0-9\.-]', '', 'g'))::numeric), 0) as total_sum
  from public.purpletransaction
  where created_at_date::date between date_from and date_to
  group by created_at_date::date
  order by created_at_date::date;
$$;