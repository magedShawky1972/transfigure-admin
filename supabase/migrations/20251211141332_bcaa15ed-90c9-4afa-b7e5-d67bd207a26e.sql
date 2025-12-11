-- Create task_time_entries table for tracking multiple time entries per task
CREATE TABLE public.task_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL DEFAULT now(),
  end_time timestamp with time zone,
  duration_minutes integer,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view time entries for their tasks"
ON public.task_time_entries FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.tasks WHERE tasks.id = task_time_entries.task_id AND (tasks.assigned_to = auth.uid() OR tasks.created_by = auth.uid()))
);

CREATE POLICY "Users can create their own time entries"
ON public.task_time_entries FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own time entries"
ON public.task_time_entries FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own time entries"
ON public.task_time_entries FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all time entries"
ON public.task_time_entries FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_task_time_entries_task_id ON public.task_time_entries(task_id);
CREATE INDEX idx_task_time_entries_user_id ON public.task_time_entries(user_id);