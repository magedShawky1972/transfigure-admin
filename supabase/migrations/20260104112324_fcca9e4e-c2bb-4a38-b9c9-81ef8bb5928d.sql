-- Add Arabic name column to departments table
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS department_name_ar TEXT;