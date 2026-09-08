ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS sent_to_accounting_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_accounting_by uuid;