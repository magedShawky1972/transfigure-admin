ALTER TABLE public.attendance_types
  ALTER COLUMN seasonal_is_recurring SET DEFAULT false;

COMMENT ON COLUMN public.attendance_types.seasonal_is_recurring IS 'Attendance Type Setup saves false: alternate hours apply only between the exact inclusive dates selected. True is reserved for legacy recurring records.';