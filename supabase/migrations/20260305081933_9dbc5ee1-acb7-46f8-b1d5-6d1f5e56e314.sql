ALTER TABLE public.excel_column_mappings 
  ADD COLUMN source_type text NOT NULL DEFAULT 'excel',
  ADD COLUMN fixed_value text;