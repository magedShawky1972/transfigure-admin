-- Drop existing constraint and add new one with vacation status
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;

ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'vacation'));