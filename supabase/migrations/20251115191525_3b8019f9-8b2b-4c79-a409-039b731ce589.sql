-- Add abc_analysis column to brands table
ALTER TABLE public.brands 
ADD COLUMN abc_analysis TEXT DEFAULT 'C';

-- Add comment for clarity
COMMENT ON COLUMN public.brands.abc_analysis IS 'ABC analysis classification: A (high value), B (medium value), C (low value)';