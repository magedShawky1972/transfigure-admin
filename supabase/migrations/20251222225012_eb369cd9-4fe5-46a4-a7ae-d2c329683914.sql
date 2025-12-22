-- Create project_members table to track users assigned to projects
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_user_id ON public.project_members(user_id);

-- Enable RLS
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_members
CREATE POLICY "Users can view project members for projects in their departments"
  ON public.project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        -- System admin can view all
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
        -- Department admin can view
        OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = p.department_id)
        -- Department member can view
        OR EXISTS (SELECT 1 FROM public.department_members WHERE user_id = auth.uid() AND department_id = p.department_id)
        -- Project member can view
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Department admins and project managers can insert project members"
  ON public.project_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        -- System admin can insert
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
        -- Department admin can insert
        OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = p.department_id)
        -- Project manager can insert
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role = 'manager')
      )
    )
  );

CREATE POLICY "Department admins and project managers can update project members"
  ON public.project_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
        OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = p.department_id)
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role = 'manager')
      )
    )
  );

CREATE POLICY "Department admins and project managers can delete project members"
  ON public.project_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
        OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = p.department_id)
        OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.role = 'manager')
      )
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update projects table RLS to allow department admins and project managers to update
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;

CREATE POLICY "Users can update projects they manage"
  ON public.projects FOR UPDATE
  USING (
    -- System admin can update
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    -- Creator can update
    OR created_by = auth.uid()
    -- Department admin can update
    OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = projects.department_id)
    -- Project manager can update
    OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid() AND role = 'manager')
  );

-- Ensure projects table has proper SELECT policy
DROP POLICY IF EXISTS "Users can view projects in their departments" ON public.projects;

CREATE POLICY "Users can view projects in their departments"
  ON public.projects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = projects.department_id)
    OR EXISTS (SELECT 1 FROM public.department_members WHERE user_id = auth.uid() AND department_id = projects.department_id)
    OR EXISTS (SELECT 1 FROM public.project_members WHERE project_id = projects.id AND user_id = auth.uid())
  );

-- Ensure projects table has proper INSERT policy
DROP POLICY IF EXISTS "Users can insert projects in their departments" ON public.projects;

CREATE POLICY "Users can insert projects in their departments"
  ON public.projects FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = projects.department_id)
    OR EXISTS (SELECT 1 FROM public.department_members WHERE user_id = auth.uid() AND department_id = projects.department_id)
  );

-- Ensure projects table has proper DELETE policy
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Users can delete projects they manage"
  ON public.projects FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.department_admins WHERE user_id = auth.uid() AND department_id = projects.department_id)
  );