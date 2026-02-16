-- Add weekend_days column to attendance_types (array of day numbers: 5=Friday, 6=Saturday)
-- JavaScript getDay(): 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
ALTER TABLE public.attendance_types
ADD COLUMN weekend_days integer[] DEFAULT ARRAY[5, 6];

COMMENT ON COLUMN public.attendance_types.weekend_days IS 'Array of day-of-week numbers (0=Sun, 1=Mon, ..., 5=Fri, 6=Sat) that are considered weekends/off days for this attendance type';