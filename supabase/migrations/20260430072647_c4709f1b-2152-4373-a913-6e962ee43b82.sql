ALTER TABLE public.brand_type
  ADD COLUMN IF NOT EXISTS synced_to_odoo_production boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS synced_to_odoo_test boolean NOT NULL DEFAULT false;