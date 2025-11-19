-- Add assigned_to and approved columns to tickets table
ALTER TABLE public.tickets
ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create department_members table for users working in departments
CREATE TABLE public.department_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(department_id, user_id)
);

-- Enable RLS on department_members
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for department_members
CREATE POLICY "Admins can manage department members"
ON public.department_members
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Department admins can manage their department members"
ON public.department_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.department_id = department_members.department_id
    AND da.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.department_admins da
    WHERE da.department_id = department_members.department_id
    AND da.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view department members"
ON public.department_members
FOR SELECT
TO authenticated
USING (true);

-- Create index for better performance
CREATE INDEX idx_department_members_department ON public.department_members(department_id);
CREATE INDEX idx_department_members_user ON public.department_members(user_id);
CREATE INDEX idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_approved_at ON public.tickets(approved_at);