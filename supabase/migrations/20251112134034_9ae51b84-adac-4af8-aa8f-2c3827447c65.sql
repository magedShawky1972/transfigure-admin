-- Add safety_stock and abc_analysis fields to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS safety_stock numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS abc_analysis text DEFAULT 'C';

-- Add comments for documentation
COMMENT ON COLUMN public.products.safety_stock IS 'Safety stock quantity to maintain';
COMMENT ON COLUMN public.products.abc_analysis IS 'ABC Analysis classification (A, B, or C)';