UPDATE public.employee_requests
SET delay_date = COALESCE(start_date::date, (request_date AT TIME ZONE 'Asia/Riyadh')::date)
WHERE request_type IN ('delay','early_leave')
  AND delay_date IS NULL;