-- Add is_production_mode column to odoo_api_config table
ALTER TABLE public.odoo_api_config 
ADD COLUMN IF NOT EXISTS is_production_mode boolean NOT NULL DEFAULT true;