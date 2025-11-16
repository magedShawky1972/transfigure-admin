-- Add average_consumption_per_day column to brands table
ALTER TABLE public.brands 
ADD COLUMN average_consumption_per_day numeric DEFAULT 0;