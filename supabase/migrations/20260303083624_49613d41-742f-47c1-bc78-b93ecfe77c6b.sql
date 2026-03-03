-- Add 'holiday' to the timesheets status check constraint
ALTER TABLE public.timesheets DROP CONSTRAINT timesheets_status_check;
ALTER TABLE public.timesheets ADD CONSTRAINT timesheets_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'vacation', 'holiday'));