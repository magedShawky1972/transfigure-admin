-- Add brand_type column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS brand_type text;