-- Add automation tracking columns to saved_attendance
ALTER TABLE public.saved_attendance 
ADD COLUMN IF NOT EXISTS auto_processed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS entry_notification_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exit_notification_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deduction_notification_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS entry_notification_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS exit_notification_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deduction_notification_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS processing_source text DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS has_issues boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN saved_attendance.auto_processed IS 'Whether this record was auto-processed from ZK logs';
COMMENT ON COLUMN saved_attendance.entry_notification_sent IS 'Whether entry notification was sent to employee';
COMMENT ON COLUMN saved_attendance.exit_notification_sent IS 'Whether exit summary notification was sent';
COMMENT ON COLUMN saved_attendance.deduction_notification_sent IS 'Whether deduction notification was sent';
COMMENT ON COLUMN saved_attendance.processing_source IS 'manual, zk_auto, or api';
COMMENT ON COLUMN saved_attendance.has_issues IS 'Whether record has deductions, absences, or missing data requiring admin review';

-- Create index for faster querying of unprocessed records
CREATE INDEX IF NOT EXISTS idx_saved_attendance_auto_processed ON saved_attendance(auto_processed);
CREATE INDEX IF NOT EXISTS idx_saved_attendance_has_issues ON saved_attendance(has_issues);
CREATE INDEX IF NOT EXISTS idx_saved_attendance_confirmation ON saved_attendance(is_confirmed, has_issues);

-- Add unique constraint to prevent duplicate attendance records
ALTER TABLE public.saved_attendance 
DROP CONSTRAINT IF EXISTS saved_attendance_employee_date_unique;

ALTER TABLE public.saved_attendance 
ADD CONSTRAINT saved_attendance_employee_date_unique UNIQUE (employee_code, attendance_date);