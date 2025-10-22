-- Add usd_value_for_coins column to brands table
ALTER TABLE public.brands
ADD COLUMN usd_value_for_coins NUMERIC DEFAULT 0;