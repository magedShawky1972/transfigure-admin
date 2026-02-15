
-- Junction table for brand-supplier relationship (one brand can have many suppliers)
CREATE TABLE public.brand_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, supplier_id)
);

-- Enable RLS
ALTER TABLE public.brand_suppliers ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write
CREATE POLICY "Authenticated users can view brand_suppliers"
  ON public.brand_suppliers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert brand_suppliers"
  ON public.brand_suppliers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete brand_suppliers"
  ON public.brand_suppliers FOR DELETE
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_brand_suppliers_brand_id ON public.brand_suppliers(brand_id);
CREATE INDEX idx_brand_suppliers_supplier_id ON public.brand_suppliers(supplier_id);
