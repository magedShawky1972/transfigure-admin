-- Add recharge_usd_value column to brands table
ALTER TABLE public.brands
ADD COLUMN recharge_usd_value NUMERIC(18,3) DEFAULT 0;