
CREATE TABLE public.pricing_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  inputs JSONB NOT NULL,
  selected_payment_method_ids TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scenarios"
  ON public.pricing_scenarios FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own scenarios"
  ON public.pricing_scenarios FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own scenarios"
  ON public.pricing_scenarios FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Admins can view all scenarios"
  ON public.pricing_scenarios FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
