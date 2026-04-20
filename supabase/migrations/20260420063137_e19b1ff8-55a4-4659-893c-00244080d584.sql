-- Migration jobs table for background tracking
CREATE TABLE IF NOT EXISTS public.migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  current_table TEXT,
  current_table_index INTEGER DEFAULT 0,
  total_tables INTEGER DEFAULT 0,
  processed_rows BIGINT DEFAULT 0,
  total_rows BIGINT DEFAULT 0,
  current_table_processed BIGINT DEFAULT 0,
  current_table_total BIGINT DEFAULT 0,
  progress_percent NUMERIC DEFAULT 0,
  tables_config JSONB,
  destination_config JSONB,
  failed_tables JSONB DEFAULT '[]'::jsonb,
  completed_tables JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  cancel_requested BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active migration globally
CREATE UNIQUE INDEX IF NOT EXISTS migration_jobs_one_active
  ON public.migration_jobs ((1))
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_migration_jobs_user ON public.migration_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON public.migration_jobs(status);

ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view migration jobs"
  ON public.migration_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert their own migration jobs"
  ON public.migration_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own migration jobs"
  ON public.migration_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete migration jobs"
  ON public.migration_jobs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_migration_jobs_updated_at
  BEFORE UPDATE ON public.migration_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.migration_jobs;