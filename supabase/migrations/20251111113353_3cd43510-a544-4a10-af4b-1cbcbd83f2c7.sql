-- Rename api_url column to customer_api_url in odoo_api_config table
ALTER TABLE public.odoo_api_config 
RENAME COLUMN api_url TO customer_api_url;