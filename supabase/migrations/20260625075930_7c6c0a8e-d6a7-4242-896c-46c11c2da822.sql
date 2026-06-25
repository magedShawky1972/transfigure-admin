
ALTER TABLE public.saved_attendance ADD COLUMN IF NOT EXISTS absence_has_notice boolean;
ALTER TABLE public.payroll_elements ADD COLUMN IF NOT EXISTS is_absence_element boolean NOT NULL DEFAULT false;
ALTER TABLE public.deduction_rules ADD COLUMN IF NOT EXISTS is_absence_with_notice boolean NOT NULL DEFAULT false;
ALTER TABLE public.deduction_rules ADD COLUMN IF NOT EXISTS is_absence_without_notice boolean NOT NULL DEFAULT false;
