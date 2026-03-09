ALTER TABLE public.employee_requests DROP CONSTRAINT employee_requests_request_type_check;

ALTER TABLE public.employee_requests ADD CONSTRAINT employee_requests_request_type_check 
CHECK (request_type::text = ANY (ARRAY['sick_leave','vacation','delay','early_leave','expense_refund','experience_certificate','penalty_deduction','other']::text[]));