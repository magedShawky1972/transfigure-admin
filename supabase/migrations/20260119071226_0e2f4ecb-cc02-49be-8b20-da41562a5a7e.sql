-- Add field to track if employee requires sign-in time attendance
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS requires_attendance_signin BOOLEAN DEFAULT true;