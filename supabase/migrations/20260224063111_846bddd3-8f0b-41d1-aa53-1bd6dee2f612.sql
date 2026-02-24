
-- Add brand_id and brand_name to receiving_coins_line
ALTER TABLE public.receiving_coins_line 
  ADD COLUMN brand_id uuid REFERENCES public.brands(id),
  ADD COLUMN brand_name text;

-- Add currency_id and exchange_rate to receiving_coins_header
ALTER TABLE public.receiving_coins_header
  ADD COLUMN currency_id uuid REFERENCES public.currencies(id),
  ADD COLUMN exchange_rate numeric;
