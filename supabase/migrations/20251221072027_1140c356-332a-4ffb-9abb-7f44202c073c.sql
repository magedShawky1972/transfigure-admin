-- Add JSON column support to excel_column_mappings
ALTER TABLE public.excel_column_mappings 
ADD COLUMN IF NOT EXISTS is_json_column BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.excel_column_mappings 
ADD COLUMN IF NOT EXISTS json_split_keys TEXT[] DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.excel_column_mappings.is_json_column IS 'Whether this column contains JSON data that should be parsed';
COMMENT ON COLUMN public.excel_column_mappings.json_split_keys IS 'Array of JSON keys to extract as separate columns';