ALTER TABLE public.payroll_elements
  ADD COLUMN IF NOT EXISTS element_account TEXT,
  ADD COLUMN IF NOT EXISTS element_account_name TEXT;