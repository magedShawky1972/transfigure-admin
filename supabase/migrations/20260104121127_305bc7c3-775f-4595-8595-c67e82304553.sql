-- Add Arabic name column to job_positions table
ALTER TABLE public.job_positions 
ADD COLUMN position_name_ar text;