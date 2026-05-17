
CREATE TABLE public.sales_order_supplier_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_vendor_name text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sales_order_supplier_mappings_source_unique ON public.sales_order_supplier_mappings (source_vendor_name);
CREATE INDEX idx_sosm_source ON public.sales_order_supplier_mappings (lower(source_vendor_name));
ALTER TABLE public.sales_order_supplier_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view supplier mappings" ON public.sales_order_supplier_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert supplier mappings" ON public.sales_order_supplier_mappings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update supplier mappings" ON public.sales_order_supplier_mappings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete supplier mappings" ON public.sales_order_supplier_mappings FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_sosm_updated_at BEFORE UPDATE ON public.sales_order_supplier_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
