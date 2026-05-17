ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS cost_one_coins_sar numeric DEFAULT 0;
UPDATE public.brands SET cost_one_coins_sar = COALESCE(usd_value_for_coins, 0) * 3.75 WHERE abc_analysis = 'A';