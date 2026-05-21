ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS idx_tasks_is_archived ON public.tasks(is_archived);