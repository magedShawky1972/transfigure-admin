
ALTER TABLE public.employee_requests 
  ADD COLUMN IF NOT EXISTS deduction_rule_id UUID REFERENCES public.deduction_rules(id),
  ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_date DATE;
