
-- Payroll module: elements, eligibility, employee assignments, variable entries, runs

CREATE TABLE public.payroll_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  element_type TEXT NOT NULL CHECK (element_type IN ('earning','deduction','employer_contribution','information')),
  classification TEXT,
  calculation_type TEXT NOT NULL DEFAULT 'fixed' CHECK (calculation_type IN ('fixed','formula','variable','delay_minutes')),
  default_amount NUMERIC DEFAULT 0,
  formula TEXT,
  is_delay_minutes_element BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_elements TO authenticated;
GRANT ALL ON public.payroll_elements TO service_role;
ALTER TABLE public.payroll_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payroll_elements" ON public.payroll_elements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write payroll_elements" ON public.payroll_elements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_payroll_elements_updated BEFORE UPDATE ON public.payroll_elements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_element_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id UUID NOT NULL REFERENCES public.payroll_elements(id) ON DELETE CASCADE,
  job_position_id UUID REFERENCES public.job_positions(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_element_eligibility TO authenticated;
GRANT ALL ON public.payroll_element_eligibility TO service_role;
ALTER TABLE public.payroll_element_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payroll_eligibility" ON public.payroll_element_eligibility FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write payroll_eligibility" ON public.payroll_element_eligibility FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.payroll_employee_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  element_id UUID NOT NULL REFERENCES public.payroll_elements(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_employee_elements TO authenticated;
GRANT ALL ON public.payroll_employee_elements TO service_role;
ALTER TABLE public.payroll_employee_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payroll_emp_elements" ON public.payroll_employee_elements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write payroll_emp_elements" ON public.payroll_employee_elements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_payroll_emp_elements_updated BEFORE UPDATE ON public.payroll_employee_elements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_variable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  element_id UUID NOT NULL REFERENCES public.payroll_elements(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_variable_entries TO authenticated;
GRANT ALL ON public.payroll_variable_entries TO service_role;
ALTER TABLE public.payroll_variable_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payroll_var" ON public.payroll_variable_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write payroll_var" ON public.payroll_variable_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_payroll_var_updated BEFORE UPDATE ON public.payroll_variable_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed')),
  total_gross NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,
  total_employer_contributions NUMERIC DEFAULT 0,
  total_net NUMERIC DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_year, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payroll_runs" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write payroll_runs" ON public.payroll_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payroll_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  element_id UUID NOT NULL REFERENCES public.payroll_elements(id) ON DELETE RESTRICT,
  element_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  minutes NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_run_lines TO authenticated;
GRANT ALL ON public.payroll_run_lines TO service_role;
ALTER TABLE public.payroll_run_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read payroll_run_lines" ON public.payroll_run_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write payroll_run_lines" ON public.payroll_run_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_payroll_run_lines_run ON public.payroll_run_lines(run_id);
CREATE INDEX idx_payroll_run_lines_emp ON public.payroll_run_lines(employee_id);
CREATE INDEX idx_payroll_emp_elements_emp ON public.payroll_employee_elements(employee_id);
CREATE INDEX idx_payroll_var_period ON public.payroll_variable_entries(period_year, period_month);
