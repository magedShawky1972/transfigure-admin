CREATE TABLE public.project_task_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_key TEXT NOT NULL,
  phase_name TEXT NOT NULL,
  phase_name_ar TEXT,
  phase_color TEXT NOT NULL DEFAULT '#3B82F6',
  phase_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, phase_key)
);

CREATE INDEX idx_project_task_phases_project_id ON public.project_task_phases(project_id);

ALTER TABLE public.project_task_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view project phases"
ON public.project_task_phases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert project phases"
ON public.project_task_phases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update project phases"
ON public.project_task_phases FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete project phases"
ON public.project_task_phases FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_project_task_phases_updated_at
BEFORE UPDATE ON public.project_task_phases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();