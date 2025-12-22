
-- Remove duplicate/conflicting SELECT policies
DROP POLICY IF EXISTS "Users can view projects in their department" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects in their departments" ON public.projects;

-- Create a comprehensive SELECT policy that covers all access scenarios
CREATE POLICY "Users can view projects in their departments"
  ON public.projects FOR SELECT
  USING (
    -- System admin can view all projects
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    -- Department admin can view projects in their departments
    OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = projects.department_id)
    -- Department member can view projects in their departments
    OR EXISTS (SELECT 1 FROM public.department_members WHERE user_id = auth.uid() AND department_id = projects.department_id)
    -- User with default_department_id matching can view
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND default_department_id = projects.department_id)
    -- Project member can view their assigned projects
    OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
    -- Project creator can always view their projects
    OR created_by = auth.uid()
  );
