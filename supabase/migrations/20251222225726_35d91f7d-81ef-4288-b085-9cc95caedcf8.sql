-- Update the SELECT policy to include users with default_department_id matching project's department
DROP POLICY IF EXISTS "Users can view projects in their departments" ON public.projects;

CREATE POLICY "Users can view projects in their departments"
  ON public.projects FOR SELECT
  USING (
    -- System admin can view all
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    -- Department admin can view
    OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = projects.department_id)
    -- Department member can view
    OR EXISTS (SELECT 1 FROM public.department_members WHERE user_id = auth.uid() AND department_id = projects.department_id)
    -- User with default_department_id matching can view
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND default_department_id = projects.department_id)
    -- Project member can view
    OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
    -- Project creator can view
    OR created_by = auth.uid()
  );