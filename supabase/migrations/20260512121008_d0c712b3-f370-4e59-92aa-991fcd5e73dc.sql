
CREATE TABLE IF NOT EXISTS public.project_departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_project_departments_project ON public.project_departments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_departments_department ON public.project_departments(department_id);

ALTER TABLE public.project_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view project departments"
  ON public.project_departments FOR SELECT
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage project departments"
  ON public.project_departments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can manage project departments"
  ON public.project_departments FOR ALL
  TO authenticated USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Backfill: seed join table from existing projects.department_id
INSERT INTO public.project_departments (project_id, department_id)
SELECT id, department_id FROM public.projects
ON CONFLICT (project_id, department_id) DO NOTHING;
