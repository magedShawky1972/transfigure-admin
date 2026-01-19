-- Add religion column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS religion TEXT;