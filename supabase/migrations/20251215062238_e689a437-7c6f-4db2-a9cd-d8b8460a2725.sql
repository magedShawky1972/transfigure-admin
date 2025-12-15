-- Add position columns for free-form org chart positioning
ALTER TABLE public.departments 
ADD COLUMN IF NOT EXISTS position_x numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS position_y numeric DEFAULT NULL;