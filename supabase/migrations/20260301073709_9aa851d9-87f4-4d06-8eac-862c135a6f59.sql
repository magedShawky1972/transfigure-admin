-- Add columns for multi-file processing
ALTER TABLE public.riyad_statement_auto_imports 
ADD COLUMN IF NOT EXISTS found_files jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_file_index integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_files integer DEFAULT NULL;