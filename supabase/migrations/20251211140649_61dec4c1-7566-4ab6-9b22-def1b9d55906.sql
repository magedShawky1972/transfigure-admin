-- Add start_time and end_time columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN start_time time without time zone,
ADD COLUMN end_time time without time zone;