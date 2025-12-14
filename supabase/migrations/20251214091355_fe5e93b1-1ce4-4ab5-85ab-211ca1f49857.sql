-- Add is_outsource column to departments table
ALTER TABLE public.departments 
ADD COLUMN is_outsource boolean NOT NULL DEFAULT false;