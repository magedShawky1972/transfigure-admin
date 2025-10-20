-- Add short_name column to brands table
ALTER TABLE public.brands
ADD COLUMN short_name TEXT;