
-- Table to track month confirmation (lock) status
CREATE TABLE public.timesheet_month_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key TEXT NOT NULL UNIQUE, -- format: YYYY-MM
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table to track per-employee edit permissions for a locked month
CREATE TABLE public.timesheet_edit_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(month_key, employee_id)
);

ALTER TABLE public.timesheet_month_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_edit_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read locks
CREATE POLICY "Authenticated users can read month locks" ON public.timesheet_month_locks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read edit permissions" ON public.timesheet_edit_permissions FOR SELECT TO authenticated USING (true);

-- Only admin/nawaf can manage locks and permissions
CREATE POLICY "Admin can manage month locks" ON public.timesheet_month_locks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage edit permissions" ON public.timesheet_edit_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
