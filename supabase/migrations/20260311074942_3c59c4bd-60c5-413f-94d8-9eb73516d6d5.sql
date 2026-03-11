
CREATE TABLE public.coins_sheet_payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_order_id UUID NOT NULL REFERENCES public.coins_sheet_orders(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_remaining BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coins_sheet_payment_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sheet payment terms"
  ON public.coins_sheet_payment_terms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_sheet_payment_terms_updated_at
  BEFORE UPDATE ON public.coins_sheet_payment_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
