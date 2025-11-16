-- Add brand_code column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS brand_code text;