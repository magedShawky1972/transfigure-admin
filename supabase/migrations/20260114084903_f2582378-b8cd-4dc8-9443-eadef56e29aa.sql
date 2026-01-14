-- Add columns to track order and purchase sync status separately
ALTER TABLE public.odoo_sync_run_details 
ADD COLUMN IF NOT EXISTS order_sync_failed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS purchase_sync_failed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS order_error_message text,
ADD COLUMN IF NOT EXISTS purchase_error_message text;

-- Add comment explaining the columns
COMMENT ON COLUMN public.odoo_sync_run_details.order_sync_failed IS 'True if the order sync failed';
COMMENT ON COLUMN public.odoo_sync_run_details.purchase_sync_failed IS 'True if the purchase sync failed (only for non-stock items)';
COMMENT ON COLUMN public.odoo_sync_run_details.order_error_message IS 'Error message from order sync failure';
COMMENT ON COLUMN public.odoo_sync_run_details.purchase_error_message IS 'Error message from purchase sync failure';