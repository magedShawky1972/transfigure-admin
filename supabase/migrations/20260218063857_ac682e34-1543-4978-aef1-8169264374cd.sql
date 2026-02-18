
-- Create table to track migration state per external connection
CREATE TABLE public.external_migration_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_url TEXT NOT NULL,
  connection_name TEXT,
  last_migration_file TEXT,
  last_migration_run_at TIMESTAMPTZ,
  last_data_sync_at TIMESTAMPTZ,
  migration_files_applied JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on connection URL
ALTER TABLE public.external_migration_log ADD CONSTRAINT external_migration_log_connection_url_key UNIQUE (connection_url);

-- Enable RLS
ALTER TABLE public.external_migration_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage migration logs
CREATE POLICY "Authenticated users can view migration logs"
ON public.external_migration_log FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert migration logs"
ON public.external_migration_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update migration logs"
ON public.external_migration_log FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete migration logs"
ON public.external_migration_log FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Auto-update timestamp
CREATE TRIGGER update_external_migration_log_updated_at
BEFORE UPDATE ON public.external_migration_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
