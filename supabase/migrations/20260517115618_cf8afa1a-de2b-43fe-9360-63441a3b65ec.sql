CREATE TABLE IF NOT EXISTS public.sales_order_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_brand_name TEXT NOT NULL DEFAULT '',
  source_product_name TEXT NOT NULL,
  purple_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  purple_product_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_order_product_mappings_unique UNIQUE (source_brand_name, source_product_name)
);

CREATE INDEX IF NOT EXISTS idx_sopm_source ON public.sales_order_product_mappings (lower(source_brand_name), lower(source_product_name));

ALTER TABLE public.sales_order_product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view product mappings"
  ON public.sales_order_product_mappings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert product mappings"
  ON public.sales_order_product_mappings FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update product mappings"
  ON public.sales_order_product_mappings FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete product mappings"
  ON public.sales_order_product_mappings FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_sopm_updated_at
  BEFORE UPDATE ON public.sales_order_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();