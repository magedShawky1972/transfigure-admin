
CREATE TABLE public.employee_wfh_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  wfh_date DATE NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, wfh_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_wfh_days TO authenticated;
GRANT ALL ON public.employee_wfh_days TO service_role;

ALTER TABLE public.employee_wfh_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view employee wfh days"
  ON public.employee_wfh_days FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage employee wfh days"
  ON public.employee_wfh_days FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_employee_wfh_days_updated_at
  BEFORE UPDATE ON public.employee_wfh_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_employee_wfh_days_date ON public.employee_wfh_days(wfh_date);
CREATE INDEX idx_employee_wfh_days_employee ON public.employee_wfh_days(employee_id);
