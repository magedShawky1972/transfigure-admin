-- Add odoo_sync_status column to products table
ALTER TABLE public.products 
ADD COLUMN odoo_sync_status text NULL DEFAULT 'not_synced',
ADD COLUMN odoo_synced_at timestamp with time zone NULL;