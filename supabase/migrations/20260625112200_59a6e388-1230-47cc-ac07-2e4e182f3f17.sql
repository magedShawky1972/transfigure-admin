
CREATE TABLE IF NOT EXISTS public.business_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_name TEXT NOT NULL UNIQUE,
  unit_name_ar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_units TO authenticated;
GRANT ALL ON public.business_units TO service_role;

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read business units"
ON public.business_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert business units"
ON public.business_units FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update business units"
ON public.business_units FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete business units"
ON public.business_units FOR DELETE TO authenticated USING (true);

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS working_business_unit_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL;
