-- Add conversion operator column to currency_rates table
-- 'multiply' means: base_amount = amount * rate_to_base
-- 'divide' means: base_amount = amount / rate_to_base
ALTER TABLE public.currency_rates 
ADD COLUMN conversion_operator TEXT NOT NULL DEFAULT 'multiply' 
CHECK (conversion_operator IN ('multiply', 'divide'));