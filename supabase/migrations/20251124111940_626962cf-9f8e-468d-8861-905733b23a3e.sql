-- Drop the existing check constraint on status
ALTER TABLE public.software_licenses 
DROP CONSTRAINT IF EXISTS software_licenses_status_check;

-- Add new check constraint that includes 'cancelled'
ALTER TABLE public.software_licenses
ADD CONSTRAINT software_licenses_status_check 
CHECK (status IN ('active', 'expired', 'expiring_soon', 'cancelled'));