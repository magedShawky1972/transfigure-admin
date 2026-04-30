ALTER TABLE public.brand_type
  ADD COLUMN IF NOT EXISTS odoo_sync_error_production text,
  ADD COLUMN IF NOT EXISTS odoo_sync_error_test text;