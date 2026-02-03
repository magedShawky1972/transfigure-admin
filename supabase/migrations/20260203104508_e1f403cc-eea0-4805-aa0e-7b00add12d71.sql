-- Add approval_comments column to employee_requests table
ALTER TABLE public.employee_requests 
ADD COLUMN IF NOT EXISTS approval_comments TEXT;