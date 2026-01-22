-- Add original_orders column to odoo_sync_run_details to store original order numbers as fallback
ALTER TABLE public.odoo_sync_run_details 
ADD COLUMN IF NOT EXISTS original_orders text[];