-- Add progress tracking columns to system_backups
ALTER TABLE public.system_backups 
ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_phase TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS tables_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tables_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rows_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rows_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_backup_id UUID REFERENCES public.system_backups(id) ON DELETE CASCADE;