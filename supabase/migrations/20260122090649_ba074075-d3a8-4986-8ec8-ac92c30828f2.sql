-- Add sync_type column to track whether job is 'orders' or 'aggregated'
ALTER TABLE public.background_sync_jobs 
ADD COLUMN IF NOT EXISTS sync_type TEXT DEFAULT 'orders';

-- Add a comment for documentation
COMMENT ON COLUMN public.background_sync_jobs.sync_type IS 'Type of sync: orders (individual) or aggregated (combined invoices)';