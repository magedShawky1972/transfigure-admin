
ALTER TABLE public.coins_sheet_payment_terms 
  ADD COLUMN line_id UUID REFERENCES public.coins_sheet_order_lines(id) ON DELETE CASCADE;
