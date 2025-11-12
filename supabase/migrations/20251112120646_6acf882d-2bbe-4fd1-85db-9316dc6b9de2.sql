-- Add comprehensive product fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_order_quantity NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS reorder_point NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS weight NUMERIC,
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on SKU for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- Create index on barcode for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

-- Add comments for clarity
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - unique product identifier';
COMMENT ON COLUMN public.products.product_id IS 'Internal product ID from external system';
COMMENT ON COLUMN public.products.minimum_order_quantity IS 'Minimum quantity that can be ordered';
COMMENT ON COLUMN public.products.reorder_point IS 'Stock level at which to reorder';
COMMENT ON COLUMN public.products.stock_quantity IS 'Current available stock';