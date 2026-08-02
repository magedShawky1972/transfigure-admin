CREATE TABLE public.payroll_month_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  is_locked boolean NOT NULL DEFAULT true,
  locked_by uuid,
  locked_at timestamptz NOT NULL DEFAULT now(),
  unlocked_by uuid,
  unlocked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_year, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_month_locks TO authenticated;
GRANT ALL ON public.payroll_month_locks TO service_role;

ALTER TABLE public.payroll_month_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payroll month locks"
ON public.payroll_month_locks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage payroll month locks"
ON public.payroll_month_locks FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE TRIGGER update_payroll_month_locks_updated_at
BEFORE UPDATE ON public.payroll_month_locks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();