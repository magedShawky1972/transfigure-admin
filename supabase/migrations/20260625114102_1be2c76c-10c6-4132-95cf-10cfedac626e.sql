CREATE TABLE public.hr_manager_business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_manager_id uuid NOT NULL REFERENCES public.hr_managers(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(hr_manager_id, business_unit_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_manager_business_units TO authenticated;
GRANT ALL ON public.hr_manager_business_units TO service_role;

ALTER TABLE public.hr_manager_business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hr manager business units"
  ON public.hr_manager_business_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage hr manager business units"
  ON public.hr_manager_business_units FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));