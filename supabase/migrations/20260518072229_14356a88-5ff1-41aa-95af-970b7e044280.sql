ALTER TABLE public.expense_categories
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS code_prefix varchar(10);