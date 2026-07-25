
CREATE TABLE public.business_unit_cost_center_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  cost_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  payroll_dr_account TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (business_unit_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_unit_cost_center_mapping TO authenticated;
GRANT ALL ON public.business_unit_cost_center_mapping TO service_role;

ALTER TABLE public.business_unit_cost_center_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mappings"
  ON public.business_unit_cost_center_mapping FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert mappings"
  ON public.business_unit_cost_center_mapping FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update mappings"
  ON public.business_unit_cost_center_mapping FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete mappings"
  ON public.business_unit_cost_center_mapping FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_bu_cc_mapping_updated_at
  BEFORE UPDATE ON public.business_unit_cost_center_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
