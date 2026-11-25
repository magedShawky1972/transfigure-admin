ALTER TABLE public.attendance_types ADD COLUMN IF NOT EXISTS late_recovery_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS late_recovery_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS late_recovery_approved_by uuid;
ALTER TABLE public.timesheets ADD COLUMN IF NOT EXISTS late_recovery_approved_at timestamptz;