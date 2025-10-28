-- Drop unique constraint on order_number since one order can have multiple line items
ALTER TABLE public.purpletransaction
DROP CONSTRAINT IF EXISTS purpletransaction_order_number_key;

-- Remove duplicate tracking columns from upload_logs as they're no longer needed
ALTER TABLE public.upload_logs
DROP COLUMN IF EXISTS duplicates_found,
DROP COLUMN IF EXISTS duplicate_orders;