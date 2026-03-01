
-- Create log table for tracking auto-imports of Riyad Bank statements
CREATE TABLE public.riyad_statement_auto_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_date DATE NOT NULL DEFAULT CURRENT_DATE,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  missing_columns TEXT[] DEFAULT NULL,
  extra_columns TEXT[] DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT DEFAULT NULL,
  email_subject TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.riyad_statement_auto_imports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can view auto-import logs"
  ON public.riyad_statement_auto_imports
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow service role to insert (edge function uses service role)
CREATE POLICY "Service role can insert auto-import logs"
  ON public.riyad_statement_auto_imports
  FOR INSERT
  WITH CHECK (true);

-- Allow service role to update
CREATE POLICY "Service role can update auto-import logs"
  ON public.riyad_statement_auto_imports
  FOR UPDATE
  USING (true);
