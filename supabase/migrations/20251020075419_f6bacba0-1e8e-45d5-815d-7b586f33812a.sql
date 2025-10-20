-- Add brand_name column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- Update products with brand_name from purpletransaction
UPDATE products 
SET brand_name = (
  SELECT brand_name
  FROM purpletransaction 
  WHERE products.product_id = purpletransaction.product_id
  ORDER BY purpletransaction.product_id 
  LIMIT 1
)
WHERE product_id IS NOT NULL;