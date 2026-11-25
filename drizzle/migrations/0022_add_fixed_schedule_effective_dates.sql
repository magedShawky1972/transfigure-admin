ALTER TABLE public.attendance_types
  ADD COLUMN fixed_start_date date,
  ADD COLUMN fixed_end_date date;

ALTER TABLE public.attendance_types
  ADD CONSTRAINT attendance_types_fixed_schedule_dates_complete CHECK (
    (fixed_start_date IS NULL AND fixed_end_date IS NULL)
    OR (fixed_start_date IS NOT NULL AND fixed_end_date IS NOT NULL)
  ),
  ADD CONSTRAINT attendance_types_fixed_schedule_dates_valid CHECK (
    fixed_start_date IS NULL OR fixed_end_date >= fixed_start_date
  );

COMMENT ON COLUMN public.attendance_types.fixed_start_date IS 'Optional inclusive effective start date for the normal fixed working hours; blank keeps the legacy unbounded fixed schedule.';
COMMENT ON COLUMN public.attendance_types.fixed_end_date IS 'Optional inclusive effective end date for the normal fixed working hours; blank keeps the legacy unbounded fixed schedule.';