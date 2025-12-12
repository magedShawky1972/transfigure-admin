-- Add default_department_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN default_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create department_task_phases table to store custom kanban phases per department
CREATE TABLE public.department_task_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  phase_key text NOT NULL,
  phase_name text NOT NULL,
  phase_name_ar text,
  phase_order integer NOT NULL DEFAULT 0,
  phase_color text NOT NULL DEFAULT '#6B7280',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(department_id, phase_key)
);

-- Enable RLS
ALTER TABLE public.department_task_phases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage department task phases"
ON public.department_task_phases
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Department admins can manage their phases"
ON public.department_task_phases
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.department_id = department_task_phases.department_id
    AND da.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.department_id = department_task_phases.department_id
    AND da.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can view task phases"
ON public.department_task_phases
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_department_task_phases_updated_at
BEFORE UPDATE ON public.department_task_phases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_department_task_phases_department ON public.department_task_phases(department_id);

-- Insert default phases for existing departments
INSERT INTO public.department_task_phases (department_id, phase_key, phase_name, phase_name_ar, phase_order, phase_color)
SELECT 
  d.id,
  phases.phase_key,
  phases.phase_name,
  phases.phase_name_ar,
  phases.phase_order,
  phases.phase_color
FROM public.departments d
CROSS JOIN (
  VALUES 
    ('todo', 'To Do', 'للتنفيذ', 0, '#6B7280'),
    ('in_progress', 'In Progress', 'قيد التنفيذ', 1, '#3B82F6'),
    ('review', 'Review', 'مراجعة', 2, '#F59E0B'),
    ('done', 'Done', 'مكتمل', 3, '#22C55E')
) AS phases(phase_key, phase_name, phase_name_ar, phase_order, phase_color)
ON CONFLICT (department_id, phase_key) DO NOTHING;