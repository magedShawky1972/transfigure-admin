-- Add avatar_url to profiles for user profile pictures
ALTER TABLE public.profiles 
ADD COLUMN avatar_url TEXT;

-- Add parent_department_id to departments for hierarchy support
ALTER TABLE public.departments 
ADD COLUMN parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create index for faster hierarchy queries
CREATE INDEX idx_departments_parent ON public.departments(parent_department_id);

-- Add comment for documentation
COMMENT ON COLUMN public.departments.parent_department_id IS 'Reference to parent department for hierarchy. NULL means top-level department.';