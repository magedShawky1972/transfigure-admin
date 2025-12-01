-- Add odoo_category_id column to brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS odoo_category_id integer;

-- Add brand_api_url column to odoo_api_config table
ALTER TABLE public.odoo_api_config ADD COLUMN IF NOT EXISTS brand_api_url text;