-- Add summary columns to upload_logs table
ALTER TABLE upload_logs
ADD COLUMN IF NOT EXISTS new_products_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS date_range_start timestamp without time zone,
ADD COLUMN IF NOT EXISTS date_range_end timestamp without time zone;