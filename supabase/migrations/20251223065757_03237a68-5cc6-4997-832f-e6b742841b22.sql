-- Add dependency and milestone columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS dependency_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false NOT NULL;

-- Add index for better performance on dependency lookups
CREATE INDEX IF NOT EXISTS idx_tasks_dependency_task_id ON public.tasks(dependency_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_milestone ON public.tasks(is_milestone) WHERE is_milestone = true;