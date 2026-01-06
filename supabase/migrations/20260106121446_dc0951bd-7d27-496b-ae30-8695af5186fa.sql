-- Add force_kill column to background_sync_jobs table
-- Users can set this to TRUE directly in the database to immediately kill a running job
ALTER TABLE public.background_sync_jobs 
ADD COLUMN IF NOT EXISTS force_kill BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN public.background_sync_jobs.force_kill IS 'Set to TRUE to immediately kill this background sync job. The job will stop at the next check interval.';