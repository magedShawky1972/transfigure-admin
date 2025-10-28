-- Add column to store duplicate order numbers
ALTER TABLE public.upload_logs
ADD COLUMN duplicate_orders JSONB DEFAULT '[]'::jsonb;