-- Add new_brands_count column to upload_logs table
ALTER TABLE public.upload_logs 
ADD COLUMN IF NOT EXISTS new_brands_count integer DEFAULT 0;