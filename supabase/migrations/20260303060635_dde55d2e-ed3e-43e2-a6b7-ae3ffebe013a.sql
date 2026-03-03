-- Add created_by column to vacation_requests to track who entered the vacation
ALTER TABLE public.vacation_requests ADD COLUMN created_by uuid REFERENCES auth.users(id);
