-- Add sync_run_id column to background_sync_jobs to properly link to sync runs
ALTER TABLE public.background_sync_jobs
ADD COLUMN IF NOT EXISTS sync_run_id uuid REFERENCES public.odoo_sync_runs(id) ON DELETE SET NULL;