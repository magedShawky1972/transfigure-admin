
-- Enable citext for case-insensitive email
CREATE EXTENSION IF NOT EXISTS citext;

-- Add external guest flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_external_guest boolean NOT NULL DEFAULT false;

-- Create project_guests table
CREATE TABLE IF NOT EXISTS public.project_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  invite_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  user_id uuid,
  UNIQUE(project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_project_guests_user_id ON public.project_guests(user_id);
CREATE INDEX IF NOT EXISTS idx_project_guests_project_id ON public.project_guests(project_id);

ALTER TABLE public.project_guests ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_project_guest(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_guests
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND accepted_at IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.project_guest_role(p_project_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.project_guests
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND accepted_at IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_external_guest()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_external_guest FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), false);
$$;

CREATE OR REPLACE FUNCTION public.guest_can_edit_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_guests
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND accepted_at IS NOT NULL
      AND role = 'editor'
  );
$$;

-- RLS policies on project_guests
CREATE POLICY "Admins manage all project guests"
  ON public.project_guests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Project managers manage project guests"
  ON public.project_guests FOR ALL
  USING (is_project_manager(project_id, auth.uid()))
  WITH CHECK (is_project_manager(project_id, auth.uid()));

CREATE POLICY "Department admins manage project guests"
  ON public.project_guests FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p
                 JOIN public.department_admins da ON da.department_id = p.department_id
                 WHERE p.id = project_guests.project_id AND da.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p
                 JOIN public.department_admins da ON da.department_id = p.department_id
                 WHERE p.id = project_guests.project_id AND da.user_id = auth.uid()));

CREATE POLICY "Guests can view their own invite"
  ON public.project_guests FOR SELECT
  USING (user_id = auth.uid());

-- Extend RLS so external guests can read their project
CREATE POLICY "External guests can view their project"
  ON public.projects FOR SELECT
  USING (is_project_guest(id, auth.uid()));

CREATE POLICY "External guests can view project tasks"
  ON public.tasks FOR SELECT
  USING (project_id IS NOT NULL AND is_project_guest(project_id, auth.uid()));

CREATE POLICY "External guest editors can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (project_id IS NOT NULL AND guest_can_edit_project(project_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "External guest editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (project_id IS NOT NULL AND guest_can_edit_project(project_id, auth.uid()))
  WITH CHECK (project_id IS NOT NULL AND guest_can_edit_project(project_id, auth.uid()));

CREATE POLICY "External guest editors can delete tasks"
  ON public.tasks FOR DELETE
  USING (project_id IS NOT NULL AND guest_can_edit_project(project_id, auth.uid()));

-- task_messages access for guests
CREATE POLICY "External guests can view task messages in their project"
  ON public.task_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tasks t
                 WHERE t.id = task_messages.task_id
                   AND t.project_id IS NOT NULL
                   AND is_project_guest(t.project_id, auth.uid())));

CREATE POLICY "External guest editors can post task messages"
  ON public.task_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_messages.task_id
      AND t.project_id IS NOT NULL
      AND guest_can_edit_project(t.project_id, auth.uid())
  ));

-- project_members visible to guests
CREATE POLICY "External guests can view project members"
  ON public.project_members FOR SELECT
  USING (is_project_guest(project_id, auth.uid()));

-- project_task_phases visible to guests
CREATE POLICY "External guests can view project phases"
  ON public.project_task_phases FOR SELECT
  USING (is_project_guest(project_id, auth.uid()));
