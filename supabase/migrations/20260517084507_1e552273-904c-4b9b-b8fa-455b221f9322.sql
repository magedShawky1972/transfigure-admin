ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS sales_one_coins_sar numeric;

UPDATE public.brands
SET sales_one_coins_sar = COALESCE(sales_usd_value_for_coins, 0) * 3.75
WHERE abc_analysis = 'A';