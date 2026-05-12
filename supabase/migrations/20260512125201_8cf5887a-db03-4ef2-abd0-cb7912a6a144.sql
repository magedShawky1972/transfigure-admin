-- Multi-assignee support for tasks
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees(user_id);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task assignees"
  ON public.task_assignees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can add task assignees"
  ON public.task_assignees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can remove task assignees"
  ON public.task_assignees FOR DELETE TO authenticated USING (true);

-- Backfill existing single assignments into the join table
INSERT INTO public.task_assignees (task_id, user_id)
SELECT id, assigned_to FROM public.tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;