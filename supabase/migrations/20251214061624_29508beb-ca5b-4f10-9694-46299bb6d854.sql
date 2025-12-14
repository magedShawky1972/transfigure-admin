-- Add non_stock boolean column to products table
ALTER TABLE public.products 
ADD COLUMN non_stock boolean NOT NULL DEFAULT false;

-- Update products: A-class brands get false, all others get true
-- First, set all products to true (non-stock)
UPDATE public.products SET non_stock = true;

-- Then set products linked to A-class brands to false (stock items)
UPDATE public.products p
SET non_stock = false
FROM public.brands b
WHERE p.brand_name = b.brand_name
AND b.abc_analysis = 'A';