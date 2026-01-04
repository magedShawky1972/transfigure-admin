-- Create junction table for employee vacation types
CREATE TABLE public.employee_vacation_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  vacation_code_id UUID NOT NULL REFERENCES public.vacation_codes(id) ON DELETE CASCADE,
  custom_days NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, vacation_code_id)
);

-- Enable RLS
ALTER TABLE public.employee_vacation_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view employee vacation types" 
ON public.employee_vacation_types 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert employee vacation types" 
ON public.employee_vacation_types 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update employee vacation types" 
ON public.employee_vacation_types 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete employee vacation types" 
ON public.employee_vacation_types 
FOR DELETE 
USING (true);