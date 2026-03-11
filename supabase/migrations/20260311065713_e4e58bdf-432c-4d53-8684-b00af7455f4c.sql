ALTER TABLE public.coins_sheet_orders 
  ADD COLUMN IF NOT EXISTS coins_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_coins_rate numeric DEFAULT 0;

ALTER TABLE public.coins_sheet_order_lines 
  ADD COLUMN IF NOT EXISTS usd_payment_amount numeric DEFAULT 0;