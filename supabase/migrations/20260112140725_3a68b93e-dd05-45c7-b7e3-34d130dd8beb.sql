-- Add force_kill column to system_backups table for force stopping backup service
ALTER TABLE public.system_backups ADD COLUMN IF NOT EXISTS force_kill BOOLEAN DEFAULT FALSE;