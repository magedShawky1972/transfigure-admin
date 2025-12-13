-- Add test API key column
ALTER TABLE public.odoo_api_config 
ADD COLUMN IF NOT EXISTS api_key_test text;