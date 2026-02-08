-- Add submitted_by_id column to track who submitted the request on behalf of the employee
ALTER TABLE public.employee_requests 
ADD COLUMN IF NOT EXISTS submitted_by_id uuid REFERENCES public.employees(id);