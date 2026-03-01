ALTER TABLE public.riyad_statement_auto_imports 
ADD COLUMN IF NOT EXISTS current_step text DEFAULT NULL;

-- Enable realtime for live step tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.riyad_statement_auto_imports;