-- Add color column to shifts table
ALTER TABLE public.shifts 
ADD COLUMN color TEXT NOT NULL DEFAULT '#3b82f6';