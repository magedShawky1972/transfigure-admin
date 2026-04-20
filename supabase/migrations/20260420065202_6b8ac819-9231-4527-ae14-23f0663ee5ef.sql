ALTER TABLE public.migration_jobs
ADD COLUMN IF NOT EXISTS pause_requested boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;