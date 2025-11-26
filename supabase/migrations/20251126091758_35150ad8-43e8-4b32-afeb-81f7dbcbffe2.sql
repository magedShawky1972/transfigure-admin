-- Drop the existing check constraint and recreate with Rejected status
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check 
CHECK (status IN ('Open', 'In Progress', 'Closed', 'Rejected'));