with current_row as (
  select
    b.brand_id,
    br.brand_name,
    sa.assignment_date,
    s.shift_name,
    s.shift_order,
    coalesce(st.type,'') as shift_type,
    b.closing_balance
  from public.shift_brand_balances b
  join public.shift_sessions ss on ss.id = b.shift_session_id
  join public.shift_assignments sa on sa.id = ss.shift_assignment_id
  join public.shifts s on s.id = sa.shift_id
  left join public.shift_types st on st.id = s.shift_type_id
  join public.brands br on br.id = b.brand_id
  where br.brand_name ilike '%Xena Live%'
    and sa.assignment_date = '2026-04-30'
    and s.shift_name like '%1%'
), prior as (
  select
    b.brand_id,
    sa.assignment_date,
    s.shift_name,
    s.shift_order,
    coalesce(st.type,'') as shift_type,
    ss.closed_at,
    b.closing_balance,
    case
      when lower(coalesce(st.type,'') || ' ' || coalesce(s.shift_name,'')) like '%training%'
        or s.shift_name like '%تدريب%' then 'sales-training'
      when lower(coalesce(st.type,'') || ' ' || coalesce(s.shift_name,'')) like '%support%'
        or s.shift_name like '%دعم%' then 'support'
      when lower(coalesce(st.type,'') || ' ' || coalesce(s.shift_name,'')) like '%sale%'
        or s.shift_name like '%مبيعات%' then 'sales'
      else 'other'
    end as shift_family
  from public.shift_brand_balances b
  join public.shift_sessions ss on ss.id = b.shift_session_id
  join public.shift_assignments sa on sa.id = ss.shift_assignment_id
  join public.shifts s on s.id = sa.shift_id
  left join public.shift_types st on st.id = s.shift_type_id
  where b.brand_id = (select brand_id from current_row limit 1)
)
select c.brand_name, c.assignment_date, c.shift_name, c.shift_order,
       p.assignment_date as prior_date, p.shift_name as prior_shift, p.shift_order as prior_order,
       p.shift_family, p.closing_balance as prior_closing
from current_row c
left join lateral (
  select * from prior p
  where p.shift_family = (
    case
      when lower(c.shift_type || ' ' || c.shift_name) like '%training%'
        or c.shift_name like '%تدريب%' then 'sales-training'
      when lower(c.shift_type || ' ' || c.shift_name) like '%support%'
        or c.shift_name like '%دعم%' then 'support'
      when lower(c.shift_type || ' ' || c.shift_name) like '%sale%'
        or c.shift_name like '%مبيعات%' then 'sales'
      else 'other'
    end
  )
  and (p.assignment_date < c.assignment_date or (p.assignment_date = c.assignment_date and p.shift_order < c.shift_order))
  order by p.assignment_date desc, p.shift_order desc, p.closed_at desc nulls last
  limit 1
) p on true;
