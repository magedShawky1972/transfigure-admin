-- Add payment_method_api_url columns to odoo_api_config
ALTER TABLE public.odoo_api_config 
ADD COLUMN IF NOT EXISTS payment_method_api_url TEXT,
ADD COLUMN IF NOT EXISTS payment_method_api_url_test TEXT;