-- Add new URL columns for Production/Test environments and additional API types
ALTER TABLE public.odoo_api_config 
ADD COLUMN IF NOT EXISTS customer_api_url_test text,
ADD COLUMN IF NOT EXISTS product_api_url_test text,
ADD COLUMN IF NOT EXISTS brand_api_url_test text,
ADD COLUMN IF NOT EXISTS supplier_api_url text,
ADD COLUMN IF NOT EXISTS supplier_api_url_test text,
ADD COLUMN IF NOT EXISTS sales_order_api_url text,
ADD COLUMN IF NOT EXISTS sales_order_api_url_test text,
ADD COLUMN IF NOT EXISTS purchase_order_api_url text,
ADD COLUMN IF NOT EXISTS purchase_order_api_url_test text;

-- Rename existing columns to indicate they are production URLs
-- Note: customer_api_url, product_api_url, brand_api_url remain as production URLs