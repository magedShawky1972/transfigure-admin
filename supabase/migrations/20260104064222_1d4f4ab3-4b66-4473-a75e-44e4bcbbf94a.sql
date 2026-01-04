-- Add address column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address TEXT;

-- Create employee_contacts table for many contacts per employee
CREATE TABLE public.employee_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_address TEXT,
  is_emergency_contact BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view employee contacts" 
ON public.employee_contacts 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert employee contacts" 
ON public.employee_contacts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update employee contacts" 
ON public.employee_contacts 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete employee contacts" 
ON public.employee_contacts 
FOR DELETE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_employee_contacts_employee_id ON public.employee_contacts(employee_id);

-- Add trigger for updated_at
CREATE TRIGGER update_employee_contacts_updated_at
BEFORE UPDATE ON public.employee_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();