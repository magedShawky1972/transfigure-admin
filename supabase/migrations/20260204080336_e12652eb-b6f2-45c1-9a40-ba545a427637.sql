-- Fix infinite recursion in projects UPDATE policy by avoiding direct reads from RLS-protected tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'projects'
      AND policyname = 'Users can update projects they manage'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update projects they manage" ON public.projects';
  END IF;
END $$;

CREATE POLICY "Users can update projects they manage"
ON public.projects
FOR UPDATE
TO public
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.department_admins da
    WHERE da.user_id = auth.uid()
      AND da.department_id = projects.department_id
  )
  OR public.is_project_manager(projects.id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.department_admins da
    WHERE da.user_id = auth.uid()
      AND da.department_id = projects.department_id
  )
  OR public.is_project_manager(projects.id, auth.uid())
);

-- Keep tasks.department_id in sync when project department changes
CREATE OR REPLACE FUNCTION public.sync_tasks_department_on_project_department_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when department_id actually changes
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    UPDATE public.tasks
    SET department_id = NEW.department_id,
        updated_at = now()
    WHERE project_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tasks_department_on_project_department_change ON public.projects;
CREATE TRIGGER trg_sync_tasks_department_on_project_department_change
AFTER UPDATE OF department_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_tasks_department_on_project_department_change();
