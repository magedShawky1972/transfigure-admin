
-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  deadline TIMESTAMP WITH TIME ZONE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Projects RLS policies
CREATE POLICY "Admins can manage all projects"
ON public.projects FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Department admins can manage department projects"
ON public.projects FOR ALL
USING (EXISTS (
  SELECT 1 FROM department_admins da 
  WHERE da.department_id = projects.department_id 
  AND da.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM department_admins da 
  WHERE da.department_id = projects.department_id 
  AND da.user_id = auth.uid()
));

CREATE POLICY "Users can view projects in their department"
ON public.projects FOR SELECT
USING (EXISTS (
  SELECT 1 FROM department_members dm 
  WHERE dm.department_id = projects.department_id 
  AND dm.user_id = auth.uid()
) OR created_by = auth.uid());

CREATE POLICY "Users can create projects"
ON public.projects FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Tasks RLS policies
CREATE POLICY "Admins can manage all tasks"
ON public.tasks FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Department admins can manage department tasks"
ON public.tasks FOR ALL
USING (EXISTS (
  SELECT 1 FROM department_admins da 
  WHERE da.department_id = tasks.department_id 
  AND da.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM department_admins da 
  WHERE da.department_id = tasks.department_id 
  AND da.user_id = auth.uid()
));

CREATE POLICY "Users can view their assigned tasks"
ON public.tasks FOR SELECT
USING (assigned_to = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Users can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own tasks"
ON public.tasks FOR UPDATE
USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- Create triggers for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add constraints
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled'));

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('todo', 'in_progress', 'review', 'done'));

ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check 
CHECK (priority IN ('low', 'medium', 'high', 'urgent'));
