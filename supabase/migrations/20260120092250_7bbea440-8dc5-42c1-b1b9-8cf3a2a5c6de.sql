-- Add column to track duplicate records count in upload_logs
ALTER TABLE public.upload_logs ADD COLUMN IF NOT EXISTS duplicate_records_count integer DEFAULT 0;