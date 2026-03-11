ALTER TABLE public.coins_sheet_payment_terms
  DROP CONSTRAINT coins_sheet_payment_terms_line_id_fkey;

ALTER TABLE public.coins_sheet_payment_terms
  ADD CONSTRAINT coins_sheet_payment_terms_line_id_fkey
  FOREIGN KEY (line_id) REFERENCES public.coins_sheet_order_lines(id) ON DELETE SET NULL;