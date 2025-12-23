-- Fix infinite recursion in RLS by avoiding referencing project_members inside its own policies

-- 1) Helper functions (SECURITY DEFINER) to check project membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_manager(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
      AND pm.role = 'manager'
  );
$$;

-- 2) Recreate project_members policies without self-referencing subqueries
DROP POLICY IF EXISTS "Users can view project members for projects in their department" ON public.project_members;
DROP POLICY IF EXISTS "Department admins and project managers can insert project membe" ON public.project_members;
DROP POLICY IF EXISTS "Department admins and project managers can update project membe" ON public.project_members;
DROP POLICY IF EXISTS "Department admins and project managers can delete project membe" ON public.project_members;

CREATE POLICY "Users can view project members for projects in their department"
  ON public.project_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1
            FROM public.department_admins da
            WHERE da.user_id = auth.uid()
              AND da.department_id = p.department_id
          )
          OR EXISTS (
            SELECT 1
            FROM public.department_members dm
            WHERE dm.user_id = auth.uid()
              AND dm.department_id = p.department_id
          )
          OR public.is_project_member(p.id, auth.uid())
        )
    )
  );

CREATE POLICY "Department admins and project managers can insert project membe"
  ON public.project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1
            FROM public.department_admins da
            WHERE da.user_id = auth.uid()
              AND da.department_id = p.department_id
          )
          OR public.is_project_manager(p.id, auth.uid())
        )
    )
  );

CREATE POLICY "Department admins and project managers can update project membe"
  ON public.project_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1
            FROM public.department_admins da
            WHERE da.user_id = auth.uid()
              AND da.department_id = p.department_id
          )
          OR public.is_project_manager(p.id, auth.uid())
        )
    )
  );

CREATE POLICY "Department admins and project managers can delete project membe"
  ON public.project_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_members.project_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR EXISTS (
            SELECT 1
            FROM public.department_admins da
            WHERE da.user_id = auth.uid()
              AND da.department_id = p.department_id
          )
          OR public.is_project_manager(p.id, auth.uid())
        )
    )
  );

-- 3) Update projects SELECT policy to also avoid direct project_members references
DROP POLICY IF EXISTS "Users can view projects in their departments" ON public.projects;

CREATE POLICY "Users can view projects in their departments"
  ON public.projects
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.department_admins
      WHERE user_id = auth.uid()
        AND department_id = projects.department_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.department_members
      WHERE user_id = auth.uid()
        AND department_id = projects.department_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE user_id = auth.uid()
        AND default_department_id = projects.department_id
    )
    OR public.is_project_member(projects.id, auth.uid())
    OR projects.created_by = auth.uid()
  );
