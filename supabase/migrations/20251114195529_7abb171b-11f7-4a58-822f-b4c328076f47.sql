-- Add inventory management fields to brands table
ALTER TABLE public.brands 
ADD COLUMN leadtime NUMERIC DEFAULT 0,
ADD COLUMN safety_stock NUMERIC DEFAULT 0,
ADD COLUMN reorder_point NUMERIC DEFAULT 0;