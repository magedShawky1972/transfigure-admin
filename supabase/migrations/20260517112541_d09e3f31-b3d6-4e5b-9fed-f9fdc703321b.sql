-- Brand mapping table to remember Excel-source brand names mapped to our internal brands
CREATE TABLE IF NOT EXISTS public.sales_order_brand_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_brand_name TEXT NOT NULL,
  purple_brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  purple_brand_code TEXT,
  purple_brand_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_order_brand_mappings_source_unique UNIQUE (source_brand_name)
);

CREATE INDEX IF NOT EXISTS idx_sobm_source ON public.sales_order_brand_mappings (lower(source_brand_name));

ALTER TABLE public.sales_order_brand_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view brand mappings"
  ON public.sales_order_brand_mappings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert brand mappings"
  ON public.sales_order_brand_mappings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update brand mappings"
  ON public.sales_order_brand_mappings FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete brand mappings"
  ON public.sales_order_brand_mappings FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_sobm_updated_at
  BEFORE UPDATE ON public.sales_order_brand_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();