-- Add brand_name, payment_method, and payment_brand columns to odoo_sync_run_details
ALTER TABLE public.odoo_sync_run_details 
ADD COLUMN IF NOT EXISTS brand_name text,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS payment_brand text;