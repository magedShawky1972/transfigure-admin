-- Add updated_by column to saved_attendance for tracking who edited records
ALTER TABLE public.saved_attendance 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Add trigger to update updated_at automatically on any update
CREATE OR REPLACE FUNCTION public.update_saved_attendance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_attendance_updated_at ON public.saved_attendance;
CREATE TRIGGER update_saved_attendance_updated_at
BEFORE UPDATE ON public.saved_attendance
FOR EACH ROW
EXECUTE FUNCTION public.update_saved_attendance_timestamp();

-- Add audit trigger for saved_attendance to log all changes
DROP TRIGGER IF EXISTS audit_saved_attendance ON public.saved_attendance;
CREATE TRIGGER audit_saved_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.saved_attendance
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();