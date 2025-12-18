-- Drop the restrictive status check constraint to allow custom department phases
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;