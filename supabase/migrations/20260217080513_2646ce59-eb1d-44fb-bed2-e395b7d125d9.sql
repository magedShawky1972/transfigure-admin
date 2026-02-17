
-- Create order lines table for multi-line coins purchase orders
CREATE TABLE public.coins_purchase_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.coins_purchase_orders(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  amount_in_currency NUMERIC DEFAULT 0,
  base_amount_sar NUMERIC DEFAULT 0,
  notes TEXT,
  line_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coins_purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order lines"
ON public.coins_purchase_order_lines FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert order lines"
ON public.coins_purchase_order_lines FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update order lines"
ON public.coins_purchase_order_lines FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete order lines"
ON public.coins_purchase_order_lines FOR DELETE
USING (auth.uid() IS NOT NULL);
