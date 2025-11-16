-- Add average_consumption_per_month column to brands table
ALTER TABLE public.brands
ADD COLUMN average_consumption_per_month numeric DEFAULT 0;