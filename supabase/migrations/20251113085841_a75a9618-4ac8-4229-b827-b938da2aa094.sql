-- Add brand_code column to brands table if it doesn't exist
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS brand_code text UNIQUE;