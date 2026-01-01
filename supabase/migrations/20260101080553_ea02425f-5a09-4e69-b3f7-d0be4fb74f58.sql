-- Add new columns to attendance_types table
ALTER TABLE public.attendance_types 
ADD COLUMN IF NOT EXISTS fixed_start_time TIME NULL,
ADD COLUMN IF NOT EXISTS fixed_end_time TIME NULL,
ADD COLUMN IF NOT EXISTS allow_late_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS allow_early_exit_minutes INTEGER DEFAULT 0;

-- Update existing Fixed Time record with default times
UPDATE public.attendance_types 
SET fixed_start_time = '09:00:00', 
    fixed_end_time = '18:00:00',
    allow_late_minutes = 15,
    allow_early_exit_minutes = 0
WHERE type_code = 'FIXED';