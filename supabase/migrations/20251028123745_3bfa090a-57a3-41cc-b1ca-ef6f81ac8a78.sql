-- Add duplicates_found column to upload_logs table
ALTER TABLE public.upload_logs 
ADD COLUMN duplicates_found INTEGER DEFAULT 0;