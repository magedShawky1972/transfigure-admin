-- Create a table for hierarchy position assignments (visual only, doesn't affect employee records)
CREATE TABLE public.hierarchy_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  job_position_id UUID REFERENCES public.job_positions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, department_id)
);

-- Enable Row Level Security
ALTER TABLE public.hierarchy_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Allow authenticated read" 
ON public.hierarchy_assignments 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated insert" 
ON public.hierarchy_assignments 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update" 
ON public.hierarchy_assignments 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete" 
ON public.hierarchy_assignments 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hierarchy_assignments_updated_at
BEFORE UPDATE ON public.hierarchy_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();