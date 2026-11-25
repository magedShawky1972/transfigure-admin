ALTER TABLE public.attendance_types
  ADD COLUMN seasonal_start_date date,
  ADD COLUMN seasonal_end_date date,
  ADD COLUMN seasonal_start_time time,
  ADD COLUMN seasonal_end_time time,
  ADD COLUMN seasonal_is_recurring boolean NOT NULL DEFAULT true;

ALTER TABLE public.attendance_types
  ADD CONSTRAINT attendance_types_seasonal_schedule_complete CHECK (
    (seasonal_start_date IS NULL AND seasonal_end_date IS NULL AND seasonal_start_time IS NULL AND seasonal_end_time IS NULL)
    OR
    (seasonal_start_date IS NOT NULL AND seasonal_end_date IS NOT NULL AND seasonal_start_time IS NOT NULL AND seasonal_end_time IS NOT NULL)
  ),
  ADD CONSTRAINT attendance_types_seasonal_exact_dates_valid CHECK (
    seasonal_is_recurring OR seasonal_start_date IS NULL OR seasonal_end_date >= seasonal_start_date
  );

COMMENT ON COLUMN public.attendance_types.seasonal_start_date IS 'Inclusive start date for alternate seasonal working hours; month/day repeat when seasonal_is_recurring is true.';
COMMENT ON COLUMN public.attendance_types.seasonal_end_date IS 'Inclusive end date for alternate seasonal working hours; month/day repeat when seasonal_is_recurring is true.';
COMMENT ON COLUMN public.attendance_types.seasonal_start_time IS 'Alternate scheduled start used during the effective seasonal period.';
COMMENT ON COLUMN public.attendance_types.seasonal_end_time IS 'Alternate scheduled end used during the effective seasonal period.';
COMMENT ON COLUMN public.attendance_types.seasonal_is_recurring IS 'When true, ignores the year in seasonal dates and repeats the month/day range annually, including ranges crossing New Year.';